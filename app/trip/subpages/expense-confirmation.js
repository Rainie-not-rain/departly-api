import {validateExpenseDraft,expenseDraftInput} from '../../../lib/expense-draft.js';
import {saveExpense} from './expense-service.js';
// Success is returned only after the existing persistence wrapper finishes successfully.
export function saveConfirmedExpense(writeTrips,draft,rate){
 let result;
 writeTrips(data=>{
  const trip=data.trips.find(t=>t.id===draft.tripId&&!t.isDeleted);
  if(!trip)throw Error('旅程不存在或已删除');
  const check=validateExpenseDraft(draft,trip);if(!check.valid)throw Error(check.errors.join('；'));
  const expense=saveExpense(data,draft.tripId,expenseDraftInput(draft),'',rate);
  result={tripId:trip.id,expenseId:expense.id,message:`已记入「${trip.name}」账本 🌿`};
 });
 return result;
}
