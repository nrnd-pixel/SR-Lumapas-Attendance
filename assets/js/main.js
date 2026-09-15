import { createAttendanceClient } from './supabase-client.js';
import { state } from './app-state.js';
import { bruneiToday } from './date-helpers.js';
import { $, fillGroupedClasses } from './ui-helpers.js';
import { initAuthSession, hideEntryViews, showLogin } from './auth-session.js';
import { initAttendanceRegister, setBusy, setBanner, loadRegister, confirmDiscard, markAllPresent, clearAll, updateSummary, save, hasUnsavedChanges } from './attendance-register.js';
import { initStudentManagement, loadAdminStudents, renderAdminStudents, prepareTransferInDialog, syncTransferInStats, submitTransferIn, submitTransferOut, submitMoveClass } from './student-management.js';
import { initTeacherAdmin, loadAdminTeachers } from './teacher-admin.js';
import { initTeacherAccess, showSignup, ensureTeacherAccess, submitSignup, submitGateRequest, signOutTeacherGate } from './teacher-access.js';
import { initStatistics, loadMonthlyStats } from './statistics.js';
import { initAdminDashboard, loadAdminDashboard } from './admin-dashboard.js';
import { initPeriodReports, loadReportOptions, syncReportTypeUI, invalidatePeriodReport, loadPeriodReport, exportPeriodReport } from './period-reports.js';

const sb=createAttendanceClient();
initAttendanceRegister(sb);
initStudentManagement(sb,{schoolId,adminClasses,showAdminMsg});
initTeacherAdmin(sb,{adminClasses,showAdminMsg});
initTeacherAccess(sb);
initStatistics(sb);
initAdminDashboard(sb,{schoolId,openStatisticsForClass});
initPeriodReports(sb);

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
function openStatisticsForClass(classId,month){
  $('statsClassSelect').value=classId;$('statsMonth').value=month;switchPanel('statistics');
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
