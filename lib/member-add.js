import {makeMember,AVATARS} from '../app/trip/subpages/tripMembers.js';
export function memberAddRequest(text){
 if(/不要|暂不|取消|是不是|是否|怎么|如何/.test(text))return null;
 const m=/^(?:请|帮我|请帮我)?(?:添加|新增|增加)(?:同行人|同行成员|成员)\s*[:：]?\s*(.+?)[。！!]?$/u.exec(text.trim());
 if(!m)return null;
 const names=m[1].split(/[、，,\s]+/u).map(x=>x.trim()).filter(Boolean);
 if(!names.length||names.length>10||names.some(n=>n.length>20)||new Set(names).size!==names.length)throw Error('请提供不重复的成员昵称，每个昵称最多20个字。');
 return names;
}
// Build the entire batch before assigning it, so a rejected name never partially adds members.
export function addConfirmedMembers(trip,names){
 if(!Array.isArray(names)||!names.length||names.length>10)throw Error('请提供有效的同行成员昵称');
 const members=[...trip.members];
 for(const name of names)members.push(makeMember(trip.id,name,AVATARS[members.length%AVATARS.length].src,members));
 trip.members=members;return members;
}
