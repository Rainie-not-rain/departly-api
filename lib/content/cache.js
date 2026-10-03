import {createHash} from 'node:crypto'
const entries=new Map(),TTL=30*24*60*60*1000,MAX_ENTRIES=100
// Vercel 热实例内存缓存；实例重建或并行实例之间不会共享。
export async function getCachedContent(key){const entry=entries.get(key);if(!entry)return null;if(entry.expiresAt<=Date.now()){entries.delete(key);return null}entries.delete(key);entries.set(key,entry);return structuredClone(entry)}
export async function setCachedContent(key,content){const now=Date.now();for(const [key,entry] of entries)if(entry.expiresAt<=now)entries.delete(key);entries.delete(key);entries.set(key,{...structuredClone(content),cacheKey:key,fetchedAt:now,expiresAt:now+TTL,contentHash:createHash('sha256').update(content.text).digest('hex')});while(entries.size>MAX_ENTRIES)entries.delete(entries.keys().next().value)}
