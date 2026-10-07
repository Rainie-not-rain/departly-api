import {writeTrips} from '../trips/trip-service';
import {assertOwner} from '../trips/ownership.js';
import {addConfirmedMembers} from '../../lib/member-add.js';
export function confirmMemberAddition(tripId:string,names:string[]){
 writeTrips(data=>{const trip=data.trips.find(t=>t.id===tripId&&!t.isDeleted);if(!trip)throw Error('旅程不存在或已删除');assertOwner(data,trip);addConfirmedMembers(trip,names);});
}
