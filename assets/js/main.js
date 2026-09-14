import { createAttendanceClient } from './supabase-client.js';
import { state, requestSerial, beginRequest, isLatestRequest } from './app-state.js';
import { bruneiToday, displayDate, formatMonthLabel, shortDay } from './date-helpers.js';
import { $, esc, fillGroupedClasses } from './ui-helpers.js';
import { initAuthSession, hideEntryViews, showLogin } from './auth-session.js';
import { initAttendanceRegister, setBusy, setBanner, loadRegister, confirmDiscard, markAllPresent, clearAll, updateSummary, save, hasUnsavedChanges } from './attendance-register.js';
import { initStudentManagement, loadAdminStudents, renderAdminStudents, prepareTransferInDialog, syncTransferInStats, submitTransferIn, submitTransferOut, submitMoveClass } from './student-management.js';
import { initTeacherAdmin, loadAdminTeachers } from './teacher-admin.js';
import { initTeacherAccess, showSignup, ensureTeacherAccess, submitSignup, submitGateRequest, signOutTeacherGate } from './teacher-access.js';

const sb=createAttendanceClient();
initAttendanceRegister(sb);
initStudentManagement(sb,{schoolId,adminClasses,showAdminMsg});
initTeacherAdmin(sb,{adminClasses,showAdminMsg});
initTeacherAccess(sb);

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

async function init(){
  $('dateInput').value=bruneiToday();
  await initAuthSession(sb,enterApp);
}
async function enterApp(){
  if(!(await ensureTeacherAccess()))return;
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

$('openSignupBtn').addEventListener('click',showSignup);
$('backToLoginBtn').addEventListener('click',showLogin);
$('signupForm').addEventListener('submit',e=>submitSignup(e,enterApp));
$('gateRequestForm').addEventListener('submit',submitGateRequest);
$('checkApprovalBtn').addEventListener('click',enterApp);
$('gateSignOutBtn').addEventListener('click',signOutTeacherGate);

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
$('transferInBtn').addEventListener('click',prepareTransferInDialog);
$('tiGroup').addEventListener('change',syncTransferInStats);
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('transferInForm').addEventListener('submit',submitTransferIn);
$('transferOutForm').addEventListener('submit',submitTransferOut);
$('moveClassForm').addEventListener('submit',submitMoveClass);

window.addEventListener('beforeunload',e=>{
  if(hasUnsavedChanges()){
    e.preventDefault();
    e.returnValue='';
  }
});


init();
