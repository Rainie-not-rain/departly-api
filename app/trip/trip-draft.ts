import type { ItineraryDay } from "./detail-components";
export type CreationMode = "ai_generate" | "manual" | "text_import";
export type TripMember = { id:string; tripId:string; name:string; avatar:string; isOwner:boolean; isCurrentUser:boolean; userId?:string|null };
export type TripPreferences = { companionType:string|null; styles:string[]; pace:string; startTimePreference:string; endTimePreference:string; notes:string };
export type TripDraft = { id:string; name?:string; creationMode:CreationMode; destination:{country:string;city:string}; startDate:string; endDate:string; members:TripMember[]; memberIds?:string[]; memberSchemaVersion?:number; preferences?:TripPreferences; pace?:string; mustVisitPlaces?:string[]; preferenceSummary?:string; sourceText?:string; sourceType?:"text"|"xiaohongshu"; sourceUrl?:string|null; sourceInput?:string; days:ItineraryDay[]; isDirty?:boolean; createdAt?:number; updatedAt?:number };
