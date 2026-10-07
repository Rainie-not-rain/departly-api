import {apiError} from './response.js';
export const INSUFFICIENT_CONTENT='这段内容里还没有识别到具体行程，试试复制包含景点和路线的攻略正文。';
export function prepareTripParseText(raw,city=''){
 const withoutUrls=raw.replace(/https?:\/\/\S+/gi,'');
 if(!withoutUrls.replace(/[\s<>()[\]，。；、:：]/g,''))throw apiError('INVALID_INPUT','暂不支持直接读取链接，请复制攻略正文后粘贴。');
 const cleaned=withoutUrls.split(/\r?\n/).filter(line=>!/^\s*(?:作者\s*[:：]|分享者\s*[:：]|复制此链接|复制口令|打开小红书|长按复制|\d+\s*[^\s]*\s*分享了一篇小红书笔记)/.test(line)).join('\n').trim();
 // Reject obvious title-only shares, without demanding a rigid Day format.
 const useful=cleaned.replace(city,'').replace(/(?:旅游攻略|旅行攻略|攻略|三天两夜|两天一夜|[一二三四五六七八九十\d]+\s*[天夜日]|旅游|旅行|收藏|必看)/g,'').replace(/[\s\p{P}\p{S}]/gu,'');
 if(useful.length<4)throw apiError('TRIP_PARSE_INSUFFICIENT_CONTENT','可识别的攻略内容太少，请复制攻略正文后再试。',422);
 return cleaned;
}
