import {prepareTripParseText} from './trip-parse-text.js';
const hosts=['xiaohongshu.com','www.xiaohongshu.com','xhslink.com','www.xhslink.com'];
export function identifyTripSource(raw,city=''){
 const urls=String(raw).match(/https?:\/\/[^\s\u4e00-\u9fff\uD800-\uDFFF<>"“”【】\[\]「」『』]+/gi)||[];
 if(!urls.length){if(/^\s*(?:file|ftp):\/\//i.test(raw))throw Object.assign(Error('链接格式不正确'),{code:'SOURCE_INVALID_URL'});return {inputType:'text',text:prepareTripParseText(raw,city),sourceUrl:null}}
 let text='';try{text=prepareTripParseText(raw,city)}catch{}
 const url=urls.map(value=>value.replace(/[)）。，,;；!！?？]+$/,'')).find(value=>{try{return hosts.includes(new URL(value).hostname)}catch{return false}})||urls[0];
 let parsed;try{parsed=new URL(url)}catch{throw Object.assign(Error('链接格式不正确'),{code:'SOURCE_INVALID_URL'})}
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.port)throw Object.assign(Error('链接格式不正确'),{code:'SOURCE_INVALID_URL'});
 if(!hosts.includes(parsed.hostname))throw Object.assign(Error('目前仅支持小红书攻略链接，其他链接请复制正文后粘贴。'),{code:'SOURCE_UNSUPPORTED'});
 return {inputType:'xiaohongshu_url',sourceUrl:parsed.href,text};
}
