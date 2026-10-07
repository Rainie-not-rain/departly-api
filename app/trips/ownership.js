function ownerId(data){return data.managerUserId||''}
function ensureOwnership(data){let changed=false;if(!data.managerUserId){data.managerUserId='manager_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);changed=true}for(const trip of data.trips||[]){if(!trip.ownerUserId){trip.ownerUserId=data.managerUserId;changed=true}if(trip.collaborationMode!=='managed'){trip.collaborationMode='managed';changed=true}}return changed}
function isOwner(data,trip){return !!trip&&!!ownerId(data)&&trip.ownerUserId===ownerId(data)}
function assertOwner(data,trip){if(!isOwner(data,trip))throw new Error('只有旅程创建者可以修改账本和结算状态')}
export {ownerId,ensureOwnership,isOwner,assertOwner}
