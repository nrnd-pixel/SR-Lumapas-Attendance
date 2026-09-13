export const state={bootstrap:null,teacherStatus:null,register:null,rows:[],loading:false,saving:false,currentClassId:null,currentDate:null,adminRoster:null,selectedAdminStudent:null,teacherRequests:[],teachers:[],monthlyStats:null,adminDashboard:null,reportOptions:null,periodReport:null};
export const requestSerial={register:0,monthlyStats:0,adminDashboard:0,reportOptions:0,periodReport:0};

export function beginRequest(kind){requestSerial[kind]+=1;return requestSerial[kind];}
export function isLatestRequest(kind,serial){return requestSerial[kind]===serial;}
