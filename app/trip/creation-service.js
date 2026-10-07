import { generateId, normalizeDraft, validateMembers } from "./detail-service.js";
import { normalizePreferences, buildPreferenceSummary } from "./preference.js";
export const AVATARS=Array.from({length:10},(_,i)=>({id:(i<5?"male_":"female_")+String(i%5+1).padStart(2,"0"),src:`/images/user/${i+1}.png`}));
export function makeMember(tripId,name,avatar,members=[]) { name=String(name||"").trim();if(!name)throw Error("昵称不能为空");if(name.length>20)throw Error("昵称最多20个字");if(members.some(m=>m.name===name))throw Error("本旅程中已存在相同昵称");if(!AVATARS.some(a=>a.src===avatar))throw Error("请选择头像");return {id:generateId("member"),tripId,name,avatar,isOwner:false,isCurrentUser:false}; }
export function createOwner(tripId,profile={}) { const avatar=AVATARS.some(a=>a.src===profile.avatar)?profile.avatar:AVATARS[5].src;return {...makeMember(tripId,profile.name||"我",avatar),isOwner:true,isCurrentUser:true,userId:profile.id||profile.userId||null}; }
export function initialCreation(profile={}) { const id=generateId("trip");return {id,form:{name:"",country:"",city:"",start:"",end:""},members:[createOwner(id,profile)],preferences:normalizePreferences(),text:"",preferencesChosen:false}; }
export function creationDraft(mode,input) {
  if(!["ai_generate","manual","text_import"].includes(mode))throw Error("创建方式无效");const f=input.form;
  if(!f.start||!f.end)throw Error("请选择出发日期和结束日期");
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+"T00:00:00Z"))&&new Date(d+"T00:00:00Z").toISOString().slice(0,10)===d;
  if(!valid(f.start)||!valid(f.end))throw Error("请填写有效日期");if(f.start>f.end)throw Error("结束日期不能早于出发日期");
  if(mode!=="text_import"&&(!f.city.trim()||mode==="manual"&&!f.name.trim()))throw Error("请填写名称和城市");if(mode==="text_import"&&!input.text.trim())throw Error("请粘贴攻略正文");if(input.text.length>3000)throw Error("攻略正文最多3000字");
  if(mode==="ai_generate"&&(Date.parse(f.end)-Date.parse(f.start))/86400000+1>10)throw Error("当前最多支持生成 10 天行程");validateMembers(input.members,input.id);
  const preferences=normalizePreferences(input.preferences);
  return normalizeDraft({id:input.id,creationMode:mode,name:f.name.trim()||(mode==="ai_generate"?`${f.city.trim()} ${(Date.parse(f.end)-Date.parse(f.start))/86400000+1} 日游`:""),destination:{country:f.country.trim(),city:f.city.trim()},startDate:f.start,endDate:f.end,members:input.members,memberSchemaVersion:2,preferences,preferenceSummary:buildPreferenceSummary(preferences),sourceText:input.text});
}
