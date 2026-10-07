import {readTrips,writeTrips} from '../../trips/trip-service.ts';
export default {get:readTrips,update:writeTrips,set:value=>writeTrips(data=>Object.assign(data,value))};
