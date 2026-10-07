export const templates=[
 {id:'food',label:'今晚吃什么',question:'今晚吃什么？',options:['当地特色','拉面','寿司','烧鸟','居酒屋','便利店随缘']},
 {id:'next',label:'下一站去哪',question:'下一站去哪？',options:['咖啡店','公园','博物馆','商场','街区散步','回酒店休息']},
 ...[['photo','谁负责拍照'],['takeaway','谁去取外卖'],['guide','今天谁导航']].map(([id,label])=>({id,label,question:label+'？',options:['同行人 A','同行人 B','同行人 C'],editPeople:true}))
];
export const initial={question:'今晚吃什么？',options:['拉面','寿司','烧鸟','咖喱','居酒屋','烤肉']};
export const phrases=['纠结结束，出发。','那就去试试这个吧。','命运已经替你决定了。','再转一次也可以，我不会告诉它。','BK468 星球今天站这一边。'];
export const KEY='departly_decision_config';
export function validate(value){const question=String(value?.question||'').trim(),options=Array.isArray(value?.options)?value.options.map(x=>String(x).trim()):[];if(!question||question.length>40)throw Error('问题需填写，最多40字');if(options.length<2||options.length>12)throw Error('请保留2至12个选项');if(options.some(x=>!x||x.length>20))throw Error('选项需填写，每项最多20字');if(new Set(options).size===1)throw Error('选项不能全部相同');return {question,options}}
export function load(storage=localStorage){const saved=JSON.parse(storage.getItem(KEY)||'null');if(!saved)return {question:initial.question,options:initial.options.slice()};return validate(saved)}
export function save(value,storage=localStorage){const config=validate(value);storage.setItem(KEY,JSON.stringify(config));return config}
export const normalize=angle=>((angle%360)+360)%360;
export function resultIndex(angle,count){if(!Number.isFinite(angle)||!Number.isInteger(count)||count<2||count>12)throw Error('转盘参数无效');return Math.floor(normalize(-angle)/(360/count))}
export function spinTarget(angle,random=Math.random){const value=random();if(value<0||value>=1||!Number.isFinite(value))throw Error('随机数无效');return angle+360*5+value*360}
export function ease(t){return 1-Math.pow(1-t,4)}

export function touchMarkers(touches,rect){return Array.from(touches).filter(t=>Number.isFinite(t.clientX)&&Number.isFinite(t.clientY)&&t.clientX>=rect.left&&t.clientX<=rect.right&&t.clientY>=rect.top&&t.clientY<=rect.bottom).map(t=>({id:String(t.identifier),x:t.clientX-rect.left,y:t.clientY-rect.top}));}
export function touchCountValid(count){return Number.isInteger(count)&&count>=2&&count<=10;}
