import { createAttendanceClient } from './supabase-client.js';
import { state, requestSerial, beginRequest, isLatestRequest } from './app-state.js';
import { bruneiToday, displayDate, formatMonthLabel, shortDay } from './date-helpers.js';
import { $, esc, fillGroupedClasses } from './ui-helpers.js';
import { initAuthSession, hideEntryViews, showLogin } from './auth-session.js';

const sb=createAttendanceClient();
const PENDING_SIGNUP_KEY='srlAttendancePendingTeacherSignup';
const PENDING_SIGNUP_VERSION=2;
const routineOptions=[
  ['present','Present'],['absent','Absent'],['late','Late'],['permission','Permission'],
  ['SS','SEN / Special'],['T','Transfer Out'],['D','Deferred'],['X','Deceased'],
  ['SP','Student Pass'],['W','Withdrawn'],['Q','Quit']
];

function periodReportSelectionKey(){
  const type=$('reportType').value;
  return [
    $('reportClassSelect').value,
    type,
    type==='term'?$('reportTermSelect').value:'',
    type==='ytd'?$('reportAsOf').value:''
  ].join('|');
}
function invalidatePeriodReport(){
  requestSerial.periodReport+=1;
  state.periodReport=null;
  renderPeriodReport();
  $('loadReportBtn').disabled=false;
  $('exportReportBtn').disabled=true;
}

function groupFromCode(code){
  if(!code)return'';
  if(code==='P'||code==='PP')return'present';
  if(code==='A'||code==='TM')return'absent';
  if(code==='L')return'late';
  if(code==='PM')return'permission';
  return code;
}
function cardClass(group){
  return group==='present'?'status-present':group==='absent'?'status-absent':
    group==='late'?'status-late':group==='permission'?'status-permission':
    group?'status-other':'status-empty';
}
function reasonForLoaded(code,reason){if(code==='TM')return'NONE';return reason||(code==='A'?'NONE':'');}
function statusCodeForRow(r){
  if(r.group==='present')return(!r.dirty&&(r.originalCode==='P'||r.originalCode==='PP'))?r.originalCode:'P';
  if(r.group==='absent'){
    if(!r.dirty&&(r.originalCode==='A'||r.originalCode==='TM'))return r.originalCode;
    return r.reason==='NONE'?'TM':'A';
  }
  if(r.group==='late')return'L';
  if(r.group==='permission')return'PM';
  return r.group||null;
}
function reasonCodeForRow(r){
  if(r.group!=='absent')return null;
  if(!r.dirty)return r.originalReasonCode;
  return r.reason||null;
}
function normalizedNote(v){return (v||'').trim()||null;}
function rowChanged(r){
  if(!state.register?.register)return false;
  return statusCodeForRow(r)!==(r.originalCode||null)
    || reasonCodeForRow(r)!==(r.originalReasonCode||null)
    || normalizedNote(r.note)!==normalizedNote(r.originalNote);
}
function changedRows(){return state.rows.filter(rowChanged);}
function hasUnsavedChanges(){
  if(state.saving||state.loading)return false;
  if(state.register?.register)return changedRows().length>0;
  return state.rows.some(r=>!!r.group || !!r.reason || normalizedNote(r.note)!==null);
}
function confirmDiscard(){
  return !hasUnsavedChanges() || confirm('You have unsaved attendance changes. Discard them and continue?');
}


async function getSignupClasses(){
  const {data,error}=await sb.rpc('attendance_signup_options');
  if(error)throw error;
  const school=(data?.schools||[])[0];
  return {school,classes:school?.classes||[]};
}
async function submitTeacherRequest(name,classId,role){
  const {data,error}=await sb.rpc('attendance_submit_teacher_request',{p_full_name:name,p_requested_class_id:classId,p_requested_role:role});
  if(error)throw error;return data;
}
function readPendingSignup(){
  const raw=localStorage.getItem(PENDING_SIGNUP_KEY);
  if(!raw)return null;
  try{
    const pending=JSON.parse(raw);
    const valid=pending?.version===PENDING_SIGNUP_VERSION
      && typeof pending.userId==='string'&&pending.userId
      && typeof pending.name==='string'&&pending.name.trim()
      && typeof pending.classId==='string'&&pending.classId
      && (pending.role==='class_teacher'||pending.role==='assistant_teacher');
    if(!valid){localStorage.removeItem(PENDING_SIGNUP_KEY);return null;}
    return pending;
  }catch(e){localStorage.removeItem(PENDING_SIGNUP_KEY);return null;}
}
function pendingSignupForUser(userId){
  const pending=readPendingSignup();
  return pending&&userId&&pending.userId===userId?pending:null;
}
function storePendingSignup(userId,name,classId,role){
  if(!userId)return;
  localStorage.setItem(PENDING_SIGNUP_KEY,JSON.stringify({version:PENDING_SIGNUP_VERSION,userId,name,classId,role}));
}
function clearPendingSignupForUser(userId){
  const pending=readPendingSignup();
  if(pending&&userId&&pending.userId===userId)localStorage.removeItem(PENDING_SIGNUP_KEY);
}

function setBusy(flag){
  state.loading=flag;
  $('allPresentBtn').disabled=flag;$('reloadBtn').disabled=flag;$('clearBtn').disabled=flag;
}
function setBanner(text,type='info'){const b=$('dateBanner');b.className='banner '+type;b.textContent=text;}

async function init(){
  $('dateInput').value=bruneiToday();
  await initAuthSession(sb,enterApp);
}
async function showSignup(){
  hideEntryViews();$('signupView').classList.remove('hidden');$('signupMsg').textContent='';
  try{const {classes}=await getSignupClasses();fillGroupedClasses($('signupClass'),classes,{compact:true});}
  catch(e){$('signupMsg').textContent='Could not load classes: '+e.message;}
}
async function showTeacherGate(status){
  hideEntryViews();$('teacherGateView').classList.remove('hidden');state.teacherStatus=status;
  const req=status?.signup_request;
  $('gateMsg').textContent='';$('gateRequestForm').classList.add('hidden');
  $('gateTitle').textContent='Teacher Access';
  if(req?.status==='pending'){
    $('gateStatus').innerHTML='<strong>Pending admin approval</strong><br>'+esc(req.full_name)+' · '+esc(req.requested_class_code)+' · '+(req.requested_role==='assistant_teacher'?'Assistant Teacher':'Class Teacher')+'.';
  }else if(req?.status==='rejected'){
    $('gateStatus').innerHTML='<strong>Request not approved</strong><br>'+(req.admin_note?esc(req.admin_note):'You may submit a corrected request below.');
    await prepareGateRequest(req,status?.user_id);
  }else{
    $('gateStatus').innerHTML='<strong>No Attendance class access yet.</strong><br>Complete the request below for administrator approval.';
    await prepareGateRequest(req,status?.user_id);
  }
}
async function prepareGateRequest(req,userId){
  try{
    const {classes}=await getSignupClasses();fillGroupedClasses($('gateClass'),classes,{compact:true});
    if(req?.requested_class_id)$('gateClass').value=req.requested_class_id;
    $('gateName').value=req?.full_name||'';$('gateRole').value=req?.requested_role||'class_teacher';
    const pending=pendingSignupForUser(userId);
    if(pending){
      if(!$('gateName').value)$('gateName').value=pending.name||'';
      if(pending.classId)$('gateClass').value=pending.classId;
      if(pending.role)$('gateRole').value=pending.role;
    }
    $('gateRequestForm').classList.remove('hidden');
  }catch(e){$('gateMsg').textContent=e.message;}
}
async function enterApp(){
  let status;
  const statusResp=await sb.rpc('attendance_teacher_status');
  if(statusResp.error){showLogin();$('loginMsg').textContent='Could not check teacher access: '+statusResp.error.message;return;}
  status=statusResp.data;state.teacherStatus=status;
  if(!status.authorized){
    const pending=pendingSignupForUser(status?.user_id);
    if(pending && !status.signup_request){
      try{await submitTeacherRequest(pending.name,pending.classId,pending.role);clearPendingSignupForUser(status?.user_id);
        const fresh=await sb.rpc('attendance_teacher_status');if(!fresh.error)status=fresh.data;
      }catch(e){}
    }
    if(status.signup_request)clearPendingSignupForUser(status?.user_id);
    await showTeacherGate(status);return;
  }
  clearPendingSignupForUser(status?.user_id);
  hideEntryViews();$('appView').classList.remove('hidden');
  setBusy(true);setBanner('Loading teacher access…','info');
  const boot=await sb.rpc('attendance_bootstrap');
  if(boot.error){setBanner(boot.error.message,'warn');setBusy(false);return;}
  const data=boot.data;state.bootstrap=data;
  const user=data.user||{};const classes=data.classes||[];
  $('userLine').textContent=user.email||'Teacher';
  const role=user.school_role==='admin'?'Admin':'Teacher';
  $('rolePill').textContent=user.all_classes?role+' · All Classes':role;$('rolePill').classList.remove('hidden');
  $('schoolScope').textContent=user.all_classes?'School-wide access · '+classes.length+' classes':'Assigned classes · '+classes.length;
  const isAdmin=user.school_role==='admin' || user.all_classes;
  $('dashboardTabBtn').classList.toggle('hidden',!isAdmin);$('studentsTabBtn').classList.toggle('hidden',!isAdmin);$('teachersTabBtn').classList.toggle('hidden',!isAdmin);
  $('dashboardMonth').value=bruneiToday().slice(0,7);
  fillGroupedClasses($('classSelect'),classes,{compact:false});
  fillGroupedClasses($('statsClassSelect'),classes,{compact:false});
  fillGroupedClasses($('reportClassSelect'),classes,{compact:false});
  $('statsMonth').value=bruneiToday().slice(0,7);$('reportAsOf').value=bruneiToday();
  if(!classes.length){setBanner('No attendance class has been assigned to this account.','warn');setBusy(false);return;}
  const saved=localStorage.getItem('srlAttendanceLastClass');
  const preferred=classes.find(c=>c.id===saved)||classes.find(c=>c.class_code==='3A')||classes[0];$('classSelect').value=preferred.id;$('statsClassSelect').value=preferred.id;$('reportClassSelect').value=preferred.id;
  setBusy(false);switchPanel('attendance');await loadRegister();
}

async function loadRegister(){
  const classId=$('classSelect').value,date=$('dateInput').value;
  if(!classId||!date)return;
  const serial=beginRequest('register'),selectionKey=classId+'|'+date;
  setBusy(true);setBanner('Loading attendance…','info');$('studentList').innerHTML='';
  const {data,error}=await sb.rpc('attendance_load_register',{p_class_id:classId,p_date:date});
  if(!isLatestRequest('register',serial)||($('classSelect').value+'|'+$('dateInput').value)!==selectionKey)return;
  setBusy(false);
  if(error){state.register=null;state.rows=[];setBanner(error.message,'warn');render();return;}
  state.register=data;
  state.currentClassId=classId;
  state.currentDate=date;
  localStorage.setItem('srlAttendanceLastClass',classId);
  state.rows=(data.students||[]).map(s=>({
    ...s,originalCode:s.status_code||'',originalReasonCode:s.reason_code||null,originalNote:s.note||'',
    group:groupFromCode(s.status_code),reason:reasonForLoaded(s.status_code,s.reason_code),
    note:s.note||'',dirty:false
  }));
  $('correctionReason').value='';
  if(!data.is_school_day)setBanner(displayDate(date)+' — No attendance required'+(data.calendar_label?': '+data.calendar_label:'')+'.','warn');
  else if(data.register){
    const cc=data.register.correction_count||0;
    setBanner('Saved attendance loaded ('+data.register.status+'). Edit only what is wrong. '+(cc?('Previous corrections: '+cc+'. '):'')+'Any new correction requires a reason.','ok');
  }
  else setBanner(displayDate(date)+(data.term_name?' • '+data.term_name:'')+'. Tap “Mark All Present”, then change only the exceptions.','info');
  render();
}

function render(){
  const list=$('studentList');list.innerHTML='';
  const total=state.rows.length,main=state.rows.filter(x=>x.include_in_class_stats).length,special=total-main;
  $('rosterMeta').textContent=total
    ? total+' pupils • '+main+' Main'+(special?' • '+special+' Special':'')
    : '';

  state.rows.forEach((row,i)=>{
    const changed=rowChanged(row);
    const el=document.createElement('article'); el.className='student '+cardClass(row.group)+(changed?' changed':'');
    const opts=routineOptions.map(([v,l])=>'<option value="'+esc(v)+'" '+(row.group===v?'selected':'')+'>'+esc(l)+'</option>').join('');
    const reasons=(state.bootstrap?.reasons||[]).map(x=>'<option value="'+esc(x.code)+'" '+(row.reason===x.code?'selected':'')+'>'+esc(x.label)+'</option>').join('');
    const showReason=row.group==='absent';
    const selectedReason=(state.bootstrap?.reasons||[]).find(x=>x.code===row.reason);
    const showNote=showReason&&selectedReason?.requires_note;

    el.innerHTML=
      '<div class="student-top"><div class="num">'+(i+1)+'</div><div class="student-name">'+esc(row.full_name)+(changed?'<span class="change-badge">Changed</span>':'')+
      '<div><span class="badge '+(row.include_in_class_stats?'':'special')+'">'+esc(row.reporting_group||'Mainstream')+'</span></div></div></div>'+
      '<div class="student-grid"><div><span class="mini-label">Status</span><select class="status" data-i="'+i+'">'+
      '<option value="" '+(!row.group?'selected':'')+'>Not recorded</option>'+opts+'</select></div>'+
      '<div class="reason-wrap '+(showReason?'':'hidden')+'"><span class="mini-label">Absence reason</span><select class="reason" data-i="'+i+'">'+reasons+'</select></div>'+
      '<div class="note-wrap '+(showNote?'':'hidden')+'"><span class="mini-label">Note required</span><textarea class="note" data-i="'+i+'" placeholder="Enter a short note">'+esc(row.note)+'</textarea></div></div>';

    list.appendChild(el);
  });

  list.querySelectorAll('select.status').forEach(x=>x.addEventListener('change',onStatus));
  list.querySelectorAll('select.reason').forEach(x=>x.addEventListener('change',onReason));
  list.querySelectorAll('textarea.note').forEach(x=>x.addEventListener('input',onNote));
  updateSummary();
}

function onStatus(e){
  const r=state.rows[+e.target.dataset.i];r.group=e.target.value;r.dirty=true;
  if(r.group==='absent'&&!r.reason)r.reason='NONE';
  if(r.group!=='absent'){r.reason='';r.note='';}
  render();
}
function onReason(e){const r=state.rows[+e.target.dataset.i];r.reason=e.target.value;r.dirty=true;render();}
function onNote(e){const r=state.rows[+e.target.dataset.i];r.note=e.target.value;r.dirty=true;updateSummary();}
function markAllPresent(){
  if(state.register?.register&&!confirm('This date already has saved attendance. Mark every pupil Present in the form? Any changed pupil will become a formal correction and will require a reason before saving.'))return;
  state.rows.forEach(r=>{r.group='present';r.reason='';r.note='';r.dirty=true;});render();
}
function clearAll(){state.rows.forEach(r=>{r.group='';r.reason='';r.note='';r.dirty=true;});render();}

function updateSummary(){
  const groups=state.rows.map(r=>r.group),n=v=>groups.filter(x=>x===v).length;
  $('presentCount').textContent=n('present');$('absentCount').textContent=n('absent');$('lateCount').textContent=n('late');$('permissionCount').textContent=n('permission');
  const routine=['present','absent','late','permission',''];
  $('otherCount').textContent=groups.filter(x=>x&&!routine.includes(x)).length;
  const recorded=groups.filter(Boolean).length;$('recordedCount').textContent=recorded+'/'+state.rows.length;

  let reasonOk=true;
  state.rows.forEach(r=>{
    if(r.group==='absent'){
      if(!r.reason)reasonOk=false;
      const def=(state.bootstrap?.reasons||[]).find(x=>x.code===r.reason);
      if(def?.requires_note&&!r.note.trim())reasonOk=false;
    }
  });

  const changes=changedRows();
  const isCorrection=!!state.register?.register && changes.length>0;
  const correctionReason=$('correctionReason').value.trim();
  $('correctionBox').classList.toggle('hidden',!isCorrection);
  $('correctionMeta').textContent=isCorrection
    ? changes.length+' pupil record'+(changes.length===1?'':'s')+' will be corrected.'
    : '';

  const complete=!!state.register?.is_school_day&&state.rows.length>0&&recorded===state.rows.length&&reasonOk;
  const correctionReady=!isCorrection || correctionReason.length>0;
  const hasSomethingToSave=!state.register?.register || changes.length>0;
  const ready=complete&&correctionReady&&hasSomethingToSave&&!state.saving;

  $('saveBtn').disabled=!ready;
  $('saveBtn').textContent=state.saving?'Saving…':(isCorrection?'Save Correction':(state.register?.register?'No Changes':'Save Attendance'));

  if(!state.register?.is_school_day){
    $('saveTitle').textContent='No attendance required';
    $('saveHint').textContent='Attendance cannot be saved for this date.';
  }else if(recorded!==state.rows.length){
    $('saveTitle').textContent=(state.rows.length-recorded)+' pupil'+(state.rows.length-recorded===1?'':'s')+' not recorded';
    $('saveHint').textContent='Complete every pupil before saving.';
  }else if(!reasonOk){
    $('saveTitle').textContent='Attendance needs attention';
    $('saveHint').textContent='Choose an absence reason and complete any required note.';
  }else if(state.register?.register && changes.length===0){
    $('saveTitle').textContent='Saved attendance unchanged';
    $('saveHint').textContent='Change a pupil only if the saved attendance is incorrect.';
  }else if(isCorrection && !correctionReason){
    $('saveTitle').textContent='Correction reason required';
    $('saveHint').textContent=changes.length+' changed pupil record'+(changes.length===1?' needs ':'s need ')+'a short correction reason.';
  }else if(isCorrection){
    $('saveTitle').textContent='Correction ready';
    $('saveHint').textContent=changes.length+' pupil record'+(changes.length===1?'':'s')+' will be changed and added to the audit history.';
  }else{
    $('saveTitle').textContent='Ready to save';
    $('saveHint').textContent=recorded+' of '+state.rows.length+' pupils recorded.';
  }
}

async function save(){
  if($('saveBtn').disabled)return;
  const changes=changedRows();
  const isCorrection=!!state.register?.register&&changes.length>0;
  const correctionReason=$('correctionReason').value.trim();

  if(isCorrection){
    const names=changes.slice(0,3).map(r=>r.full_name).join(', ');
    const more=changes.length>3?' and '+(changes.length-3)+' more':'';
    if(!confirm(`Save attendance correction for ${displayDate($('dateInput').value)}?\n\nChanged: ${names}${more}\n\nReason: ${correctionReason}\n\nThe original submission will remain in the audit history.`))return;
  }

  state.saving=true;updateSummary();
  const payload=state.rows.map(r=>({
    enrolment_id:r.enrolment_id,status_code:statusCodeForRow(r),
    reason_code:reasonCodeForRow(r),note:r.note?.trim()||null
  }));
  const {data,error}=await sb.rpc('attendance_save_register',{
    p_class_id:$('classSelect').value,
    p_date:$('dateInput').value,
    p_records:payload,
    p_correction_reason:isCorrection?correctionReason:null
  });
  state.saving=false;
  if(error){setBanner('Save failed: '+error.message,'warn');updateSummary();return;}

  if(data.no_changes){
    setBanner('No changes were made to the saved attendance.','info');
  }else if(data.correction){
    setBanner('✓ Correction saved — '+data.changed_records+' pupil record'+(data.changed_records===1?'':'s')+' changed. The correction reason was added to the audit history.','ok');
  }else{
    setBanner('✓ Attendance saved successfully — '+data.recorded+' pupils recorded.','ok');
  }
  await loadRegister();
}


function switchPanel(name){
  const map={attendance:'attendancePanel',dashboard:'dashboardPanel',statistics:'statisticsPanel',reports:'reportsPanel',students:'studentsPanel',teachers:'teachersPanel'};
  Object.entries(map).forEach(([k,id])=>$(id).classList.toggle('hidden',k!==name));
  ['attendance','dashboard','statistics','reports','students','teachers'].forEach(k=>$(k+'TabBtn').classList.toggle('active',k===name));
  if(name==='dashboard')loadAdminDashboard();
  if(name==='statistics'){if(!$('statsClassSelect').value)$('statsClassSelect').value=$('classSelect').value;loadMonthlyStats();}
  if(name==='reports'){if(!$('reportClassSelect').value)$('reportClassSelect').value=$('classSelect').value;loadReportOptions();}
  if(name==='students')loadAdminStudents();if(name==='teachers')loadAdminTeachers();
}
function setStatsBanner(text,type='info'){const el=$('statsBanner');el.textContent=text;el.className='banner '+type;}
async function loadMonthlyStats(){
  const classId=$('statsClassSelect').value,month=$('statsMonth').value;if(!classId||!month)return;
  const serial=beginRequest('monthlyStats'),selectionKey=classId+'|'+month;
  $('refreshStatsBtn').disabled=true;setStatsBanner('Loading monthly statistics…','info');
  const {data,error}=await sb.rpc('attendance_monthly_class_stats',{p_class_id:classId,p_month:month+'-01'});
  if(!isLatestRequest('monthlyStats',serial)||($('statsClassSelect').value+'|'+$('statsMonth').value)!==selectionKey)return;
  $('refreshStatsBtn').disabled=false;
  if(error){state.monthlyStats=null;setStatsBanner(error.message,'warn');renderMonthlyStats();return;}
  state.monthlyStats=data;renderMonthlyStats();
}
function renderMonthlyStats(){
  const data=state.monthlyStats,s=data?.summary||{},r=data?.roster||{};
  $('statsMonthLabel').textContent=data?formatMonthLabel(data.month):'';
  $('statsCumulative').textContent=data?s.cumulative_total:'—';
  $('statsAverage').textContent=data&&s.average_attendance!=null?Number(s.average_attendance).toFixed(4):'—';
  $('statsPercent').textContent=data&&s.attendance_percentage!=null?Number(s.attendance_percentage).toFixed(2)+'%':'—';
  $('statsSchoolDays').textContent=data?(s.school_days+'/'+s.scheduled_school_days):'—';
  $('statsMale').textContent=data?s.cumulative_male:'—';$('statsFemale').textContent=data?s.cumulative_female:'—';$('statsAll').textContent=data?s.cumulative_total:'—';$('statsPossible').textContent=data?s.possible_attendance:'—';
  $('statsRoster').textContent=data?(r.pupils_seen_in_month+' pupils · '+r.male_pupils+' male · '+r.female_pupils+' female'):'';
  const gb=$('genderStatsBanner');gb.classList.add('hidden');
  if(data&&!r.gender_complete){gb.textContent='Gender is not recorded for '+r.gender_unknown_pupils+' pupil'+(r.gender_unknown_pupils===1?'':'s')+'. Male/female figures include known genders only; Total remains complete.';gb.className='banner warn';gb.classList.remove('hidden');}
  if(data){
    if(s.registers_missing>0)setStatsBanner('Provisional: '+s.registers_completed+' of '+s.scheduled_school_days+' elapsed school-day registers are complete. '+s.registers_missing+' register'+(s.registers_missing===1?' is':'s are')+' missing. Average and percentage use completed registers only.','warn');
    else if(s.provisional)setStatsBanner('Provisional month-to-date statistics through '+displayDate(data.as_of_date)+'.','info');
    else setStatsBanner('Complete monthly statistics · '+s.school_days+' school days · '+s.possible_attendance+' possible pupil-attendances.','ok');
  }
  const body=$('statsDailyBody');
  if(!data){body.innerHTML='<tr><td colspan="7" class="empty-cell">Load statistics to view daily figures.</td></tr>';return;}
  const rows=data.daily||[];if(!rows.length){body.innerHTML='<tr><td colspan="7" class="empty-cell">No school days are available for this month.</td></tr>';return;}
  body.innerHTML=rows.map(d=>'<tr class="'+(d.register_exists?'':'missing-row')+'"><td>'+esc(shortDay(d.date))+(d.register_exists?'':' · Missing')+'</td><td>'+(d.register_exists?d.male_attendance:'—')+'</td><td>'+(d.register_exists?d.female_attendance:'—')+'</td><td>'+(d.register_exists?d.total_attendance:'—')+'</td><td>'+d.cumulative_male+'</td><td>'+d.cumulative_female+'</td><td>'+d.cumulative_total+'</td></tr>').join('');
}
function setDashboardBanner(text,type='info'){const el=$('dashboardBanner');el.textContent=text;el.className='banner '+type;}
async function loadAdminDashboard(){
  const sid=schoolId(),month=$('dashboardMonth').value;if(!sid||!month)return;
  const serial=beginRequest('adminDashboard'),selectionKey=sid+'|'+month;
  $('refreshDashboardBtn').disabled=true;setDashboardBanner('Loading school attendance dashboard…','info');
  const {data,error}=await sb.rpc('attendance_admin_school_dashboard',{p_school_id:sid,p_month:month+'-01'});
  if(!isLatestRequest('adminDashboard',serial)||(schoolId()+'|'+$('dashboardMonth').value)!==selectionKey)return;
  $('refreshDashboardBtn').disabled=false;
  if(error){state.adminDashboard=null;setDashboardBanner(error.message,'warn');renderAdminDashboard();return;}
  state.adminDashboard=data;renderAdminDashboard();
}
function renderAdminDashboard(){
  const data=state.adminDashboard,s=data?.summary||{},latest=data?.latest_school_day||{};
  $('dashboardMonthLabel').textContent=data?formatMonthLabel(data.month):'';
  $('dashboardCumulative').textContent=data?s.cumulative_total:'—';
  $('dashboardAverage').textContent=data&&s.average_attendance!=null?Number(s.average_attendance).toFixed(4):'—';
  $('dashboardPercent').textContent=data&&s.attendance_percentage!=null?Number(s.attendance_percentage).toFixed(2)+'%':'—';
  $('dashboardRegisters').textContent=data?(s.registers_completed+'/'+(s.registers_completed+s.registers_missing)):'—';
  $('dashboardLatestDate').textContent=latest.date?displayDate(latest.date):'No school day';
  $('dashboardLatestCompleted').textContent=data?latest.classes_completed:'—';
  $('dashboardLatestMissing').textContent=data?latest.classes_missing:'—';
  $('dashboardClassCount').textContent=data?s.class_count:'—';
  $('dashboardGenderIncomplete').textContent=data?s.gender_incomplete_classes:'—';
  if(data){
    if(s.registers_missing>0)setDashboardBanner('Provisional: '+s.registers_missing+' elapsed class register'+(s.registers_missing===1?' is':'s are')+' missing. School average and percentage use completed registers only. A missing register means no saved register was found — not zero attendance.','warn');
    else if(s.provisional)setDashboardBanner('Provisional month-to-date school summary through '+displayDate(data.as_of_date)+'.','info');
    else setDashboardBanner('Complete school summary for '+formatMonthLabel(data.month)+'.','ok');
  }
  const lb=$('dashboardLatestBody');
  const latestRows=latest.classes||[];
  if(!latestRows.length)lb.innerHTML='<tr><td colspan="4" class="empty-cell">No school-day status is available for this month.</td></tr>';
  else lb.innerHTML=latestRows.map(r=>'<tr class="'+(r.register_exists?'':'missing-row')+'"><td>'+esc(r.class_code)+'</td><td><span class="dashboard-status '+(r.register_exists?'saved':'missing')+'">'+(r.register_exists?'Saved':'Missing')+'</span></td><td>'+(r.register_exists?r.attendance:'—')+'</td><td>'+r.eligible_students+'</td></tr>').join('');

  const cb=$('dashboardClassBody'),rows=data?.classes||[];
  if(!rows.length){cb.innerHTML='<tr><td colspan="7" class="empty-cell">No class summaries are available.</td></tr>';return;}
  cb.innerHTML=rows.map(r=>{
    const totalRegs=r.registers_completed+r.registers_missing;
    return '<tr class="'+(r.registers_missing?'missing-row':'')+'"><td>'+esc(r.class_code)+'</td><td>'+r.pupils+'</td><td>'+r.registers_completed+'/'+totalRegs+'</td><td>'+r.cumulative_total+'</td><td>'+(r.average_attendance==null?'—':Number(r.average_attendance).toFixed(4))+'</td><td>'+(r.attendance_percentage==null?'—':Number(r.attendance_percentage).toFixed(2)+'%')+'</td><td><button class="btn btn-light dashboard-view" data-class="'+esc(r.class_id)+'">View</button></td></tr>';
  }).join('');
  cb.querySelectorAll('.dashboard-view').forEach(b=>b.addEventListener('click',()=>{
    $('statsClassSelect').value=b.dataset.class;$('statsMonth').value=data.month;switchPanel('statistics');
  }));
}
function setReportBanner(text,type='info'){const el=$('reportBanner');el.textContent=text;el.className='banner '+type;}
function syncReportTypeUI(){
  const term=$('reportType').value==='term';
  $('reportTermField').classList.toggle('hidden',!term);
  $('reportAsOfField').classList.toggle('hidden',term);
}
async function loadReportOptions(){
  const classId=$('reportClassSelect').value;if(!classId)return false;
  const serial=beginRequest('reportOptions');
  state.reportOptions=null;
  $('reportTermSelect').innerHTML='';
  invalidatePeriodReport();
  setReportBanner('Loading reporting periods…','info');
  const {data,error}=await sb.rpc('attendance_class_report_options',{p_class_id:classId});
  if(!isLatestRequest('reportOptions',serial)||$('reportClassSelect').value!==classId)return false;
  if(error){state.reportOptions=null;setReportBanner(error.message,'warn');return false;}
  state.reportOptions=data;
  const terms=data?.terms||[],sel=$('reportTermSelect');
  sel.innerHTML=terms.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.term_name)+' · '+displayDate(t.start_date)+'–'+displayDate(t.end_date)+'</option>').join('');
  const today=bruneiToday(),current=terms.find(t=>today>=t.start_date&&today<=t.end_date)||terms[terms.length-1];
  if(current)sel.value=current.id;
  syncReportTypeUI();setReportBanner('Choose Term or YTD, then load the report.','info');
  return true;
}
async function loadPeriodReport(){
  const classId=$('reportClassSelect').value,type=$('reportType').value;
  if(!classId)return;
  if(!state.reportOptions||state.reportOptions.class?.id!==classId){
    const optionsReady=await loadReportOptions();
    if(!optionsReady||$('reportClassSelect').value!==classId||$('reportType').value!==type)return;
  }
  const termId=type==='term'?$('reportTermSelect').value:null;
  const asOfDate=type==='ytd'?$('reportAsOf').value:null;
  if(type==='term'&&!termId){setReportBanner('Choose a term.','warn');return;}
  const selectionKey=[classId,type,termId||'',asOfDate||''].join('|');
  const serial=beginRequest('periodReport');
  $('loadReportBtn').disabled=true;$('exportReportBtn').disabled=true;setReportBanner('Loading report…','info');
  const args={p_class_id:classId,p_period_type:type,p_term_id:termId||null,p_as_of_date:asOfDate};
  const {data,error}=await sb.rpc('attendance_class_period_report',args);
  if(!isLatestRequest('periodReport',serial))return;
  if(periodReportSelectionKey()!==selectionKey){$('loadReportBtn').disabled=false;$('exportReportBtn').disabled=true;return;}
  $('loadReportBtn').disabled=false;
  if(error){state.periodReport=null;setReportBanner(error.message,'warn');renderPeriodReport();return;}
  state.periodReport=data;renderPeriodReport();$('exportReportBtn').disabled=false;
}
function renderPeriodReport(){
  const data=state.periodReport,s=data?.summary||{},r=data?.roster||{},p=data?.period||{};
  $('reportPeriodLabel').textContent=data?p.label:'';
  $('reportCumulative').textContent=data?s.cumulative_total:'—';
  $('reportAverage').textContent=data&&s.average_attendance!=null?Number(s.average_attendance).toFixed(4):'—';
  $('reportPercent').textContent=data&&s.attendance_percentage!=null?Number(s.attendance_percentage).toFixed(2)+'%':'—';
  $('reportRegisters').textContent=data?(s.registers_completed+'/'+(s.registers_completed+s.registers_missing)):'—';
  $('reportMale').textContent=data?s.cumulative_male:'—';$('reportFemale').textContent=data?s.cumulative_female:'—';
  $('reportPossible').textContent=data?s.possible_attendance:'—';$('reportSchoolDays').textContent=data?(s.school_days+'/'+s.scheduled_school_days):'—';
  $('reportRoster').textContent=data?(r.pupils_seen+' pupils seen · '+r.male_pupils+' male · '+r.female_pupils+' female'):'';
  const gb=$('reportGenderBanner');gb.classList.add('hidden');
  if(data&&!r.gender_complete){gb.textContent='Gender is missing for '+r.gender_unknown_pupils+' pupil'+(r.gender_unknown_pupils===1?'':'s')+'. Total attendance remains complete; male/female figures include known genders only.';gb.className='banner warn';gb.classList.remove('hidden');}
  if(data){
    if(s.registers_missing>0)setReportBanner('Provisional: '+s.registers_missing+' elapsed register'+(s.registers_missing===1?' is':'s are')+' missing. Average and percentage use completed registers only.','warn');
    else if(s.provisional)setReportBanner('Provisional report through '+displayDate(p.as_of_date)+'.','info');
    else setReportBanner('Complete '+p.label+' report · '+s.school_days+' school days · '+s.possible_attendance+' possible pupil-attendances.','ok');
  }
  const mb=$('reportMonthlyBody'),months=data?.months||[];
  mb.innerHTML=months.length?months.map(m=>'<tr class="'+(m.registers_missing?'missing-row':'')+'"><td>'+esc(formatMonthLabel(m.month))+'</td><td>'+m.registers_completed+'/'+(m.registers_completed+m.registers_missing)+'</td><td>'+m.cumulative_total+'</td><td>'+(m.average_attendance==null?'—':Number(m.average_attendance).toFixed(4))+'</td><td>'+(m.attendance_percentage==null?'—':Number(m.attendance_percentage).toFixed(2)+'%')+'</td></tr>').join(''):'<tr><td colspan="5" class="empty-cell">Load a report to view monthly figures.</td></tr>';
  const db=$('reportDailyBody'),days=data?.daily||[];
  db.innerHTML=days.length?days.map(d=>'<tr class="'+(d.register_exists?'':'missing-row')+'"><td>'+esc(shortDay(d.date))+'</td><td><span class="dashboard-status '+(d.register_exists?'saved':'missing')+'">'+(d.register_exists?'Saved':'Missing')+'</span></td><td>'+(d.register_exists?d.male_attendance:'—')+'</td><td>'+(d.register_exists?d.female_attendance:'—')+'</td><td>'+(d.register_exists?d.total_attendance:'—')+'</td><td>'+d.cumulative_total+'</td></tr>').join(''):'<tr><td colspan="6" class="empty-cell">Load a report to view daily figures.</td></tr>';
}
function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function exportPeriodReport(){
  const d=state.periodReport;if(!d)return;
  const s=d.summary||{},p=d.period||{},c=d.class||{},r=d.roster||{};
  const rows=[
    ['SR Lumapas Main Attendance Report'],
    ['Class',c.class_code,c.class_name],
    ['Academic Year',c.year_no],
    ['Period',p.label],
    ['Start Date',p.start_date],['End Date',p.end_date],['As Of',p.as_of_date],
    ['Cumulative Attendance',s.cumulative_total],['Possible Attendance',s.possible_attendance],
    ['Average Attendance Ratio',s.average_attendance],['Attendance Percentage',s.attendance_percentage],
    ['Male Cumulative',s.cumulative_male],['Female Cumulative',s.cumulative_female],
    ['Completed Registers',s.registers_completed],['Missing Registers',s.registers_missing],
    ['Pupils Seen',r.pupils_seen],['Gender Missing',r.gender_unknown_pupils],
    [],
    ['MONTHLY BREAKDOWN'],
    ['Month','Completed Registers','Scheduled/Elapsed Registers','Cumulative Attendance','Possible Attendance','Average Attendance','Attendance %'],
    ...(d.months||[]).map(m=>[m.month,m.registers_completed,m.scheduled_school_days,m.cumulative_total,m.possible_attendance,m.average_attendance,m.attendance_percentage]),
    [],
    ['DAILY BREAKDOWN'],
    ['Date','Register Status','Eligible Pupils','Male Attendance','Female Attendance','Unknown Gender Attendance','Total Attendance','Cumulative Male','Cumulative Female','Cumulative Total'],
    ...(d.daily||[]).map(x=>[x.date,x.register_exists?'Saved':'Missing',x.eligible_students,x.register_exists?x.male_attendance:'',x.register_exists?x.female_attendance:'',x.register_exists?x.unknown_gender_attendance:'',x.register_exists?x.total_attendance:'',x.cumulative_male,x.cumulative_female,x.cumulative_total])
  ];
  const csv='\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  const safe=(c.class_code+'_'+p.label).replace(/[^A-Za-z0-9_-]+/g,'_');
  a.href=url;a.download='SRL_Attendance_'+safe+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function schoolId(){return state.bootstrap?.classes?.[0]?.school_id||null;}
function adminClasses(){return state.bootstrap?.classes||[];}
function showAdminMsg(id,text,type='info'){const el=$(id);el.textContent=text;el.className='banner '+type;el.classList.remove('hidden');}
async function loadAdminStudents(){
  const sid=schoolId();if(!sid)return;
  showAdminMsg('studentManageMsg','Loading pupil roster…','info');
  const {data,error}=await sb.rpc('attendance_admin_student_roster',{p_school_id:sid});
  if(error){showAdminMsg('studentManageMsg',error.message,'warn');return;}
  state.adminRoster=data;$('studentManageMsg').classList.add('hidden');$('studentAdminCount').textContent=(data.total_current||0)+' current pupils';
  fillGroupedClasses($('studentClassFilter'),data.classes||[],{blankLabel:'All classes',compact:true});
  fillGroupedClasses($('tiClass'),data.classes||[],{compact:true});renderAdminStudents();renderMovements();
}
function renderAdminStudents(){
  const list=$('adminStudentList');list.innerHTML='';if(!state.adminRoster)return;
  const q=$('studentSearch').value.trim().toLowerCase(),classId=$('studentClassFilter').value;
  const rows=(state.adminRoster.students||[]).filter(s=>(!classId||s.class_id===classId)&&(!q||s.full_name.toLowerCase().includes(q)||(s.student_ref||'').toLowerCase().includes(q)));
  if(!rows.length){list.innerHTML='<div class="card empty-state">No pupils match this filter.</div>';return;}
  rows.forEach(s=>{
    const el=document.createElement('div');el.className='list-card';
    el.innerHTML='<div class="list-title">'+esc(s.full_name)+'</div><div class="list-meta"><span class="chip">'+esc(s.class_code)+'</span><span class="chip">'+esc(s.student_ref)+'</span> '+esc(s.reporting_group||'Mainstream')+'<br>Enrolled from '+esc(s.start_date)+(s.last_attendance_date?' · Last saved attendance '+esc(s.last_attendance_date):'')+'</div><div class="row-actions"><button class="btn btn-light move-class" data-id="'+esc(s.enrolment_id)+'">Move Class</button><button class="btn btn-danger transfer-out" data-id="'+esc(s.enrolment_id)+'">Transfer Out</button></div>';
    list.appendChild(el);
  });
  list.querySelectorAll('.move-class').forEach(b=>b.addEventListener('click',()=>openMoveClass(b.dataset.id)));
  list.querySelectorAll('.transfer-out').forEach(b=>b.addEventListener('click',()=>openTransferOut(b.dataset.id)));
}
function renderMovements(){
  const el=$('movementList');const rows=state.adminRoster?.recent_movements||[];
  if(!rows.length){el.innerHTML='<div class="empty-state">No student movements recorded yet.</div>';return;}
  el.innerHTML=rows.slice(0,20).map(m=>'<div class="list-card"><div class="list-title">'+esc(m.full_name)+'</div><div class="list-meta"><span class="chip">'+esc(m.movement_type.replaceAll('_',' '))+'</span> Effective '+esc(m.effective_date)+(m.from_class_code?' · '+esc(m.from_class_code):'')+(m.to_class_code?' → '+esc(m.to_class_code):'')+(m.note?'<br>'+esc(m.note):'')+'</div></div>').join('');
}
function findAdminStudent(enrolmentId){return (state.adminRoster?.students||[]).find(s=>s.enrolment_id===enrolmentId);}
function openTransferOut(id){
  const s=findAdminStudent(id);if(!s)return;state.selectedAdminStudent=s;
  $('toStudentLabel').textContent=s.full_name+' · '+s.class_code+' · '+s.student_ref;$('toDate').value=bruneiToday();$('toRemarks').value='';$('toMsg').textContent='';$('transferOutDialog').showModal();
}
function openMoveClass(id){
  const s=findAdminStudent(id);if(!s)return;state.selectedAdminStudent=s;
  $('mcStudentLabel').textContent=s.full_name+' · currently '+s.class_code;fillGroupedClasses($('mcClass'),state.adminRoster.classes||[],{excludeId:s.class_id,compact:true});$('mcDate').value=bruneiToday();$('mcRemarks').value='';$('mcMsg').textContent='';$('moveClassDialog').showModal();
}
async function loadAdminTeachers(){
  showAdminMsg('teacherAdminMsg','Loading teacher access…','info');
  const [rq,tr]=await Promise.all([sb.rpc('attendance_admin_teacher_requests',{p_status:'pending'}),sb.rpc('attendance_admin_teachers')]);
  if(rq.error||tr.error){showAdminMsg('teacherAdminMsg',(rq.error||tr.error).message,'warn');return;}
  state.teacherRequests=rq.data||[];state.teachers=tr.data||[];$('teacherAdminMsg').classList.add('hidden');renderTeachers();
}
function renderTeachers(){
  $('pendingTeacherCount').textContent=state.teacherRequests.length;$('activeTeacherCount').textContent=state.teachers.filter(t=>t.active).length;$('inactiveTeacherCount').textContent=state.teachers.filter(t=>!t.active).length;
  const rq=$('teacherRequestList');rq.innerHTML='';
  if(!state.teacherRequests.length)rq.innerHTML='<div class="card empty-state">No pending teacher requests.</div>';
  state.teacherRequests.forEach(r=>{
    const el=document.createElement('div');el.className='list-card';
    const options=adminClasses().map(c=>'<option value="'+esc(c.id)+'" '+(c.id===r.requested_class_id?'selected':'')+'>'+esc(c.class_code)+'</option>').join('');
    el.innerHTML='<div class="list-title">'+esc(r.full_name)+'</div><div class="list-meta">'+esc(r.email)+'<br>Requested: '+esc(r.requested_class_code)+' · '+(r.requested_role==='assistant_teacher'?'Assistant Teacher':'Class Teacher')+'</div><div class="field"><label>Approved class</label><select class="approve-class">'+options+'</select></div><div class="field"><label>Approved role</label><select class="approve-role"><option value="class_teacher" '+(r.requested_role==='class_teacher'?'selected':'')+'>Class Teacher</option><option value="assistant_teacher" '+(r.requested_role==='assistant_teacher'?'selected':'')+'>Assistant Teacher</option></select></div><div class="row-actions"><button class="btn btn-primary approve-teacher">Approve</button><button class="btn btn-danger reject-teacher">Reject</button></div>';
    el.querySelector('.approve-teacher').addEventListener('click',()=>reviewTeacher(r,el,'approve'));
    el.querySelector('.reject-teacher').addEventListener('click',()=>reviewTeacher(r,el,'reject'));rq.appendChild(el);
  });
  const tl=$('teacherList');tl.innerHTML='';
  if(!state.teachers.length)tl.innerHTML='<div class="card empty-state">No approved teacher accounts yet.</div>';
  state.teachers.forEach(t=>{
    const classes=(t.classes||[]).map(c=>c.class_code).join(', ')||'No active class';
    const el=document.createElement('div');el.className='list-card';el.innerHTML='<div class="list-title">'+esc(t.email)+'</div><div class="list-meta"><span class="chip '+(t.active?'active':'inactive')+'">'+(t.active?'Active':'Disabled')+'</span> '+esc(classes)+'</div><div class="row-actions"><button class="btn '+(t.active?'btn-danger':'btn-primary')+' toggle-teacher">'+(t.active?'Disable Attendance Access':'Enable Attendance Access')+'</button></div>';
    el.querySelector('.toggle-teacher').addEventListener('click',()=>toggleTeacher(t));tl.appendChild(el);
  });
}
async function reviewTeacher(r,card,action){
  const cls=card.querySelector('.approve-class')?.value||r.requested_class_id;const role=card.querySelector('.approve-role')?.value||r.requested_role;
  const note=action==='reject'?prompt('Optional reason for rejection:',''):null;if(action==='reject'&&note===null)return;
  const verb=action==='approve'?'Approve':'Reject';if(!confirm(verb+' '+r.full_name+'?'))return;
  const {error}=await sb.rpc('attendance_admin_review_teacher_request',{p_request_id:r.request_id,p_action:action,p_class_id:action==='approve'?cls:null,p_assignment_type:action==='approve'?role:null,p_admin_note:note||null});
  if(error){showAdminMsg('teacherAdminMsg',error.message,'warn');return;}showAdminMsg('teacherAdminMsg',verb+'d successfully.','ok');await loadAdminTeachers();
}
async function toggleTeacher(t){
  const next=!t.active;if(!confirm((next?'Enable':'Disable')+' Attendance access for '+t.email+'?'))return;
  const {error}=await sb.rpc('attendance_admin_set_teacher_active',{p_user_id:t.user_id,p_school_id:t.school_id,p_active:next});
  if(error){showAdminMsg('teacherAdminMsg',error.message,'warn');return;}showAdminMsg('teacherAdminMsg','Attendance access '+(next?'enabled.':'disabled.'),'ok');await loadAdminTeachers();
}

$('openSignupBtn').addEventListener('click',showSignup);
$('backToLoginBtn').addEventListener('click',showLogin);
$('signupForm').addEventListener('submit',async e=>{
  e.preventDefault();$('signupMsg').textContent='';$('signupBtn').disabled=true;
  const name=$('signupName').value.trim(),email=$('signupEmail').value.trim(),password=$('signupPassword').value,classId=$('signupClass').value,role=$('signupRole').value;
  const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+'/'}});
  $('signupBtn').disabled=false;
  if(error){$('signupMsg').textContent=error.message;return;}
  const signupUserId=data?.user?.id||data?.session?.user?.id||null;
  if(signupUserId)storePendingSignup(signupUserId,name,classId,role);
  if(data.session){
    try{await submitTeacherRequest(name,classId,role);clearPendingSignupForUser(signupUserId);await enterApp();}
    catch(err){$('signupMsg').textContent=err.message;}
  }else{
    $('signupMsg').style.color='#147a4b';
    $('signupMsg').textContent=signupUserId
      ? 'Account created. Check your email and verify the address, then return here. Your approval request will be completed after sign-in.'
      : 'Account created. Check your email and verify the address, then sign in and submit your approval request manually.';
  }
});
$('gateRequestForm').addEventListener('submit',async e=>{
  e.preventDefault();$('gateMsg').textContent='Submitting request…';$('gateSubmitBtn').disabled=true;
  try{await submitTeacherRequest($('gateName').value.trim(),$('gateClass').value,$('gateRole').value);clearPendingSignupForUser(state.teacherStatus?.user_id);const st=await sb.rpc('attendance_teacher_status');if(st.error)throw st.error;await showTeacherGate(st.data);}
  catch(err){$('gateMsg').textContent=err.message;}finally{$('gateSubmitBtn').disabled=false;}
});
$('checkApprovalBtn').addEventListener('click',enterApp);
$('gateSignOutBtn').addEventListener('click',async()=>{await sb.auth.signOut();showLogin();});

$('classSelect').addEventListener('change',async e=>{
  if(!confirmDiscard()){
    if(state.currentClassId)e.target.value=state.currentClassId;
    return;
  }
  await loadRegister();
});
$('dateInput').addEventListener('change',async e=>{
  if(!confirmDiscard()){
    if(state.currentDate)e.target.value=state.currentDate;
    return;
  }
  await loadRegister();
});
$('todayBtn').addEventListener('click',async()=>{
  const today=bruneiToday();
  if($('dateInput').value===today)return;
  if(!confirmDiscard())return;
  $('dateInput').value=today;
  await loadRegister();
});
$('reloadBtn').addEventListener('click',async()=>{
  if(!confirmDiscard())return;
  await loadRegister();
});
$('allPresentBtn').addEventListener('click',markAllPresent);
$('clearBtn').addEventListener('click',clearAll);
$('correctionReason').addEventListener('input',updateSummary);
$('saveBtn').addEventListener('click',save);

$('attendanceTabBtn').addEventListener('click',()=>switchPanel('attendance'));
$('dashboardTabBtn').addEventListener('click',()=>switchPanel('dashboard'));
$('dashboardMonth').addEventListener('change',loadAdminDashboard);
$('refreshDashboardBtn').addEventListener('click',loadAdminDashboard);
$('statisticsTabBtn').addEventListener('click',()=>switchPanel('statistics'));
$('reportsTabBtn').addEventListener('click',()=>switchPanel('reports'));
$('reportClassSelect').addEventListener('change',loadReportOptions);
$('reportType').addEventListener('change',()=>{syncReportTypeUI();invalidatePeriodReport();});
$('reportTermSelect').addEventListener('change',invalidatePeriodReport);
$('reportAsOf').addEventListener('change',invalidatePeriodReport);
$('loadReportBtn').addEventListener('click',loadPeriodReport);
$('exportReportBtn').addEventListener('click',exportPeriodReport);
$('refreshStatsBtn').addEventListener('click',loadMonthlyStats);
$('statsClassSelect').addEventListener('change',loadMonthlyStats);
$('statsMonth').addEventListener('change',loadMonthlyStats);
$('studentsTabBtn').addEventListener('click',()=>switchPanel('students'));
$('teachersTabBtn').addEventListener('click',()=>switchPanel('teachers'));
$('studentSearch').addEventListener('input',renderAdminStudents);
$('studentClassFilter').addEventListener('change',renderAdminStudents);
$('refreshStudentsBtn').addEventListener('click',loadAdminStudents);
$('refreshTeachersBtn').addEventListener('click',loadAdminTeachers);
$('transferInBtn').addEventListener('click',()=>{$('transferInForm').reset();$('tiStats').checked=true;$('tiDate').value=bruneiToday();$('tiMsg').textContent='';fillGroupedClasses($('tiClass'),state.adminRoster?.classes||adminClasses(),{compact:true});$('transferInDialog').showModal();});
$('tiGroup').addEventListener('change',()=>{$('tiStats').checked=$('tiGroup').value==='Mainstream';});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('transferInForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!confirm('Add '+$('tiName').value.trim()+' to '+$('tiClass').selectedOptions[0]?.textContent+' from '+$('tiDate').value+'?'))return;
  $('tiSaveBtn').disabled=true;$('tiMsg').textContent='Saving…';
  const {data,error}=await sb.rpc('attendance_admin_transfer_in',{p_school_id:schoolId(),p_class_id:$('tiClass').value,p_student_ref:$('tiRef').value.trim(),p_full_name:$('tiName').value.trim(),p_gender:$('tiGender').value||null,p_start_date:$('tiDate').value,p_reporting_group:$('tiGroup').value,p_include_in_class_stats:$('tiStats').checked,p_remarks:$('tiRemarks').value.trim()||null});
  $('tiSaveBtn').disabled=false;if(error){$('tiMsg').textContent=error.message;return;}$('transferInDialog').close();showAdminMsg('studentManageMsg','Transfer In saved.'+(data.backfill_registers?' '+data.backfill_registers+' previously saved register(s) exist from the start date and should be reviewed.':''),'ok');await loadAdminStudents();
});
$('transferOutForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=state.selectedAdminStudent;if(!s)return;if(!confirm('Transfer '+s.full_name+' out after '+$('toDate').value+'? Historical attendance will be preserved.'))return;
  $('toSaveBtn').disabled=true;const {data,error}=await sb.rpc('attendance_admin_transfer_out',{p_enrolment_id:s.enrolment_id,p_last_date:$('toDate').value,p_remarks:$('toRemarks').value.trim()||null});$('toSaveBtn').disabled=false;
  if(error){$('toMsg').textContent=error.message;return;}$('transferOutDialog').close();showAdminMsg('studentManageMsg','Transfer Out saved. '+data.preserved_attendance_records+' attendance record(s) preserved.','ok');await loadAdminStudents();
});
$('moveClassForm').addEventListener('submit',async e=>{
  e.preventDefault();const s=state.selectedAdminStudent;if(!s)return;const dest=$('mcClass').selectedOptions[0]?.textContent||'new class';if(!confirm('Move '+s.full_name+' from '+s.class_code+' to '+dest+' starting '+$('mcDate').value+'?'))return;
  $('mcSaveBtn').disabled=true;const {data,error}=await sb.rpc('attendance_admin_move_class',{p_enrolment_id:s.enrolment_id,p_to_class_id:$('mcClass').value,p_move_date:$('mcDate').value,p_remarks:$('mcRemarks').value.trim()||null});$('mcSaveBtn').disabled=false;
  if(error){$('mcMsg').textContent=error.message;return;}$('moveClassDialog').close();showAdminMsg('studentManageMsg','Class move saved. '+data.preserved_attendance_records+' old-class attendance record(s) preserved.'+(data.backfill_registers?' '+data.backfill_registers+' saved destination register(s) exist from the move date and should be reviewed.':''),'ok');await loadAdminStudents();
});

window.addEventListener('beforeunload',e=>{
  if(hasUnsavedChanges()){
    e.preventDefault();
    e.returnValue='';
  }
});


init();
