import { $ } from './ui-helpers.js';
import { loadAdminDashboard } from './admin-dashboard.js';
import { loadMonthlyStats } from './statistics.js';
import { loadReportOptions } from './period-reports.js';
import { loadAdminStudents } from './student-management.js';
import { loadAdminTeachers } from './teacher-admin.js';

export function switchPanel(name){
  const map={attendance:'attendancePanel',dashboard:'dashboardPanel',statistics:'statisticsPanel',reports:'reportsPanel',students:'studentsPanel',teachers:'teachersPanel'};
  Object.entries(map).forEach(([k,id])=>$(id).classList.toggle('hidden',k!==name));
  ['attendance','dashboard','statistics','reports','students','teachers'].forEach(k=>$(k+'TabBtn').classList.toggle('active',k===name));
  if(name==='dashboard')loadAdminDashboard();
  if(name==='statistics'){if(!$('statsClassSelect').value)$('statsClassSelect').value=$('classSelect').value;loadMonthlyStats();}
  if(name==='reports'){if(!$('reportClassSelect').value)$('reportClassSelect').value=$('classSelect').value;loadReportOptions();}
  if(name==='students')loadAdminStudents();if(name==='teachers')loadAdminTeachers();
}
export function openStatisticsForClass(classId,month){
  $('statsClassSelect').value=classId;$('statsMonth').value=month;switchPanel('statistics');
}
