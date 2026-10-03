import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {normalizeSourceUrl,validateContent} from '../lib/content/normalize.js'
import {getCachedContent,setCachedContent} from '../lib/content/cache.js'
import {resolveWithFirecrawl} from '../lib/content/providers/firecrawl.js'
import {resolveWithProviders} from '../lib/content/providers/index.js'
import {resolveContent} from '../lib/content/resolver.js'
import handler from '../api/content/resolve.js'
const note='6aae0a79000000001001c8f2',url='https://www.xiaohongshu.com/discovery/item/'+note+'?xsec_token=fixture-token&source=share',body=('Day1 三坊七巷，游玩城市街区，下午去平潭海边。Day2 参观博物馆，交通和住宿提前安排。\n').repeat(3)
const content={title:'福州攻略',text:body,sourceUrl:url,provider:'fixture'}
test('noteId 合并不同参数，抓取参数不丢失',()=>{const a=normalizeSourceUrl(url),b=normalizeSourceUrl('https://www.xiaohongshu.com/explore/'+note+'?source=other');assert.equal(a.cacheKey,b.cacheKey);assert(a.originalUrl.includes('xsec_token=fixture-token'));assert(!a.canonicalUrl.includes('?'))})
for(const bad of ['http://127.0.0.1/a','https://xiaohongshu.com.evil.test/explore/'+note,'file:///etc/passwd','https://user:password@xiaohongshu.com/explore/'+note,'https://www.xiaohongshu.com:8443/explore/'+note])test('非法地址拒绝 '+bad.split('/')[2],()=>assert.throws(()=>normalizeSourceUrl(bad)))
test('短链接 key 不泄露 token',()=>{const a=normalizeSourceUrl('http://xhslink.com/a/example');assert(a.cacheKey.startsWith('xiaohongshu:short:'));assert(!a.cacheKey.includes('example'))})
test('有效攻略通过',()=>assert.equal(validateContent(content).text,body.trim()))
test('短正文拒绝',()=>assert.throws(()=>validateContent({text:'登录'}),{code:'CONTENT_TOO_SHORT'}))
test('登录导航页拒绝',()=>assert.throws(()=>validateContent({text:('登录\n发现\n消息\n沪ICP备123号\n').repeat(10)})))
test('风控页面拒绝',()=>assert.throws(()=>validateContent({text:('请先登录，扫码登录后浏览。验证码安全验证。').repeat(10)})))
test('缓存返回副本',async()=>{await setCachedContent('fixture-copy',content);const a=await getCachedContent('fixture-copy');a.text='changed';assert.equal((await getCachedContent('fixture-copy')).text,body);assert(a.contentHash);assert(a.expiresAt>a.fetchedAt)})
test('缓存 30 天过期',async()=>{await setCachedContent('fixture-ttl',content);const now=Date.now;Date.now=()=>now()+31*86400000;try{assert.equal(await getCachedContent('fixture-ttl'),null)}finally{Date.now=now}})
test('Provider 失败切换下一个',async()=>{const result=await resolveWithProviders(url,[async()=>{throw Error('secret failure')},async()=>({success:true,provider:'future',content})]);assert(result.success);assert.equal(result.provider,'future')})
async function mockProvider(fn){const oldFetch=global.fetch,key=process.env.FIRECRAWL_API_KEY;process.env.FIRECRAWL_API_KEY='fixture-not-real';try{await fn()}finally{global.fetch=oldFetch;if(key===undefined)delete process.env.FIRECRAWL_API_KEY;else process.env.FIRECRAWL_API_KEY=key}}
test('优先 og:description，完整分享 URL 发往 Provider',()=>mockProvider(async()=>{global.fetch=async(target,options)=>{assert.equal(target,'https://api.firecrawl.dev/v2/scrape');assert.equal(JSON.parse(options.body).url,url);return {ok:true,json:async()=>({success:true,data:{metadata:{'og:description':body,description:'不应选择'},markdown:'不应选择'}})}};const result=await resolveWithFirecrawl(url);assert.equal(result.content.text,body.trim())}))
test('短 metadata 降级到 markdown',()=>mockProvider(async()=>{global.fetch=async()=>({ok:true,json:async()=>({success:true,data:{metadata:{description:'登录'},markdown:body}})});assert.equal((await resolveWithFirecrawl(url)).content.text,body.trim())}))
for(const status of [402,429,500])test('额度及上游失败 '+status,()=>mockProvider(async()=>{global.fetch=async()=>({ok:false,status});await assert.rejects(resolveWithFirecrawl(url),{code:'CONTENT_PROVIDER_UNAVAILABLE'})}))
test('同 note 缓存避免二次付费抓取',()=>mockProvider(async()=>{let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({success:true,data:{metadata:{'og:description':body}}})}};const first=await resolveContent(url),second=await resolveContent('https://www.xiaohongshu.com/explore/'+note+'?source=other');assert.equal(calls,1);assert.equal(first.cached,false);assert.equal(second.cached,true);assert.equal(second.resolvedBy,'cache');assert(!JSON.stringify(second).includes('fixture-token'))}))
test('并发同 URL 合并抓取',()=>mockProvider(async()=>{let calls=0;global.fetch=async()=>{calls++;await new Promise(resolve=>setImmediate(resolve));return {ok:true,json:async()=>({success:true,data:{markdown:body}})}};await Promise.all([resolveContent('https://xhslink.com/a/concurrent'),resolveContent('https://xhslink.com/a/concurrent')]);assert.equal(calls,1)}))
test('失败不缓存，下一次仍可重试',()=>mockProvider(async()=>{global.fetch=async()=>({ok:false,status:429});await assert.rejects(resolveContent('https://xhslink.com/a/retry'));let calls=0;global.fetch=async()=>{calls++;return {ok:true,json:async()=>({success:true,data:{markdown:body}})}};await resolveContent('https://xhslink.com/a/retry');assert.equal(calls,1)}))
test('短链接回填 noteId 缓存',()=>mockProvider(async()=>{let calls=0;const note='6aae0a79000000001001c8f3';global.fetch=async()=>{calls++;return {ok:true,json:async()=>({success:true,data:{markdown:body,metadata:{sourceURL:'https://www.xiaohongshu.com/explore/'+note}}})}};await resolveContent('https://xhslink.com/a/alias');const hit=await resolveContent('https://www.xiaohongshu.com/explore/'+note);assert.equal(calls,1);assert(hit.cached)}))
test('API 错误为中文，不泄露 Provider 私有信息',async()=>{const response={status(n){this.code=n;return this},json(body){this.body=body},setHeader(){}};await handler({method:'POST',body:{url:'http://localhost/a'}},response);assert.equal(response.body.success,false);assert.equal(response.body.error.code,'INVALID_INPUT');assert(!JSON.stringify(response.body).includes('localhost'))})
function frontService(request){const mod={exports:{}};vm.runInNewContext(fs.readFileSync('../miniprogram/services/contentService.js','utf8'),{module:mod,require:()=>({request})});return mod.exports}
test('前端链接解析成功返回正文',async()=>{const service=frontService(async q=>{assert.equal(q.url,'/api/content/resolve');return {success:true,data:content}});assert.equal((await service.prepareGuide(url)).text,body)})
test('链接加正文，抓取失败后使用正文',async()=>{const service=frontService(async()=>{throw Error('quota')});const result=await service.prepareGuide(url+'\n'+body);assert(result.fallback);assert.equal(result.text,body.trim())})
test('只有链接，失败进入正文降级',async()=>{const service=frontService(async()=>{throw Error('quota')});await assert.rejects(service.prepareGuide(url),{code:'CONTENT_RESOLVE_FAILED'})})
test('分享标题不误判为正文',async()=>{const service=frontService(async()=>{throw Error('quota')});await assert.rejects(service.prepareGuide('74【福州攻略】\n'+url))})
test('纯正文不发抓取请求',async()=>{const service=frontService(async()=>{throw Error('should not call')});assert.equal((await service.prepareGuide(body)).text,body.trim())})

const exportedUrl='https://www.xiaohongshu.com/discovery/item/6ab534f9000000001802e544?source=webshare&xhsshare=pc_web&xsec_token=fixture-token=&xsec_source=pc_share';
const exportedShare='57 【 爱吃卤肉饭 | 小红书 - 你的生活兴趣社区】 😆 fixture-code 😆 '+exportedUrl+'】';
test('后端整段分享文案提取 URL 并保留全部参数',()=>{const out=normalizeSourceUrl(exportedShare);assert.equal(out.originalUrl,exportedUrl);assert.equal(out.sourceId,'6ab534f9000000001802e544')});
test('前端完整分享文案及直接 resolveUrl 都提取干净链接',async()=>{let calls=0;const service=frontService(async q=>{calls++;assert.equal(q.data.url,exportedUrl);return {success:true,data:content}});await service.prepareGuide(exportedShare);await service.resolveUrl(exportedShare);assert.equal(calls,2)});
test('分享链接紧邻表情不包含表情与括号',()=>{const service=frontService(()=>{});assert.equal(service.urlParts('【'+exportedUrl+'😆】').urls[0],exportedUrl);assert.equal(normalizeSourceUrl('【'+exportedUrl+'😆】').originalUrl,exportedUrl)});
