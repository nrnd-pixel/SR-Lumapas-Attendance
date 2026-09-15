import { createAttendanceClient } from './supabase-client.js';
import { state } from './app-state.js';
import { bruneiToday } from './date-helpers.js';
import { $ } from './ui-helpers.js';
import { initAuthSession, showLogin } from './auth-session.js';
import { initAttendanceRegister, loadRegister, confirmDiscard, markAllPresent, clearAll, updateSummary, save, hasUnsavedChanges } from './attendance-register.js';
import { initStudentManagement, loadAdminStudents, renderAdminStudents, prepareTransferInDialog, syncTransferInStats, submitTransferIn, submitTransferOut, submitMoveClass } from './student-management.js';
import { initTeacherAdmin, loadAdminTeachers } from './teacher-admin.js';
import { initTeacherAccess, showSignup, submitSignup, submitGateRequest, signOutTeacherGate } from './teacher-access.js';
import { initStatistics, loadMonthlyStats } from './statistics.js';
import { initAdminDashboard, loadAdminDashboard } from './admin-dashboard.js';
import { initPeriodReports, loadReportOptions, syncReportTypeUI, invalidatePeriodReport, loadPeriodReport, exportPeriodReport } from './period-reports.js';
import { initAppBootstrap, enterApp, schoolId, adminClasses, showAdminMsg } from './app-bootstrap.js';
import { switchPanel, openStatisticsForClass } from './app-navigation.js';

const sb=createAttendanceClient();
initAppBootstrap(sb,{switchPanel});
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
