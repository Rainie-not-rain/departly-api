import { readTrips } from "../../trips/trip-service";
import { initialCreation } from "../creation-service.js";
import type { CreationMode, TripMember, TripPreferences } from "../trip-draft";
export type CreationInput={id:string;form:{name:string;country:string;city:string;start:string;end:string};members:TripMember[];preferences:TripPreferences;mustVisitPlaces?:string;text:string;preferencesChosen:boolean};
export const formKey=(mode:CreationMode)=>`departly_creation_form_${mode}`;
export function readCreation(mode:CreationMode):CreationInput { const raw=sessionStorage.getItem(formKey(mode));if(raw){const input=JSON.parse(raw);if(!input.id||!input.form||!Array.isArray(input.members))throw Error("创建表单格式无效");return input;}const profile=readTrips().profile as Record<string,unknown>|undefined;const input=initialCreation(profile) as CreationInput;saveCreation(mode,input);return input; }
export function saveCreation(mode:CreationMode,input:CreationInput){sessionStorage.setItem(formKey(mode),JSON.stringify(input));}
