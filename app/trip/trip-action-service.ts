import {writeTrips} from '../trips/trip-service';
import {assertOwner} from '../trips/ownership.js';
import {executeTripAction} from '../../lib/trip-actions.js';
export type TripActionProposal = {id:string;status:'pending'|'applied'|'dismissed'|'invalid'|'superseded';contextVersion:string} & (
 {type:'move_item';itemId:string;fromDayId:string;toDayId:string;proposedStartTime:string} |
 {type:'remove_item';itemId:string;dayId:string} |
 {type:'add_item';dayId:string;title:string;placeName:string;proposedStartTime:string;durationMinutes:number} |
 {type:'update_time';itemId:string;dayId:string;proposedStartTime:string;proposedEndTime?:string});
// Called only by the explicit confirmation button, never by response handling.
export function applyConfirmedTripAction(tripId:string,proposal:TripActionProposal){
 let reply='';
 writeTrips(data=>{
  const trip=data.trips.find(t=>t.id===tripId&&!t.isDeleted);
  if(!trip)throw Object.assign(Error('行程已经发生变化，这条调整建议失效了。'),{code:'ACTION_INVALID'});
  assertOwner(data,trip);
  const applied=Array.isArray(trip.appliedActionIds)?trip.appliedActionIds as string[]:[];
  if(applied.includes(proposal.id))throw Object.assign(Error('这条建议已经应用。'),{code:'ACTION_INVALID'});
  let result;try{result=executeTripAction(trip,proposal);}catch(e){throw Object.assign(e instanceof Error?e:Error('调整建议失效'),{code:'ACTION_INVALID'});}
  result.trip.appliedActionIds=[...applied,proposal.id].slice(-100);
  data.trips[data.trips.indexOf(trip)]=result.trip;reply=result.reply;
 });
 return reply;
}
