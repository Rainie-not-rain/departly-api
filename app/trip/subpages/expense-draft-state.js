// Temporary drafts never enter the ledger or localStorage.
const drafts=new Map();
export function rememberExpenseDraft(draft){drafts.set(draft.id,structuredClone(draft));return draft.id;}
export function readExpenseDraft(id,tripId){const draft=drafts.get(id);return draft&&draft.tripId===tripId?structuredClone(draft):null;}
export function consumeExpenseDraft(id){drafts.delete(id);}
