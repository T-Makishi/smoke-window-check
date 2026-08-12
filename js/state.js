export const createDraft=()=>({
  id:'',createdAt:'',updatedAt:'',customerType:'',customer:{companyName:'',storeName:'',facilityName:'',departmentName:'',contactName:'',phone:'',email:'',managementNumber:''},
  site:{postalCode:'',prefecture:'',city:'',address:'',buildingName:'',floor:'',room:'',siteName:'',parking:'unknown',elevator:'unknown',workHours:'',entryProcedure:'',siteContact:'',sitePhone:''},
  diagnosis:{symptom:'',symptoms:[],interviewVersion:1,interviewAnswers:{},buildingType:'',heightType:'',quantity:'1',makerStatus:'unknown',makerName:'',onset:'',urgency:'normal',notes:''},
  estimate:null,presentedResult:null,inspectionFee:{amount:8000,taxType:'included',chargeWhenInspectionOnly:true,deductionOnFormalOrder:8000,agreed:false,agreedAt:null},media:{count:0,saved:false,names:[]},status:'unconfirmed',memo:''
});
export const appState={screen:'home',step:0,interviewIndex:-1,draft:createDraft(),mediaFiles:[],editingId:null};
