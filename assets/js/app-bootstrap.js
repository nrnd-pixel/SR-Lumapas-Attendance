import { state } from './app-state.js';
import { bruneiToday } from './date-helpers.js';
import { $, fillGroupedClasses } from './ui-helpers.js';
import { hideEntryViews } from './auth-session.js';
import { setBusy, setBanner, loadRegister } from './attendance-register.js';
import { ensureTeacherAccess } from './teacher-access.js';

let sb;
let switchPanel;

export function initAppBootstrap(client,helpers){
  sb=client;
  switchPanel=helpers.switchPanel;
}

export async function enterApp(){
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

export function schoolId(){return state.bootstrap?.classes?.[0]?.school_id||null;}
export function adminClasses(){return state.bootstrap?.classes||[];}
export function showAdminMsg(id,text,type='info'){const el=$(id);el.textContent=text;el.className='banner '+type;el.classList.remove('hidden');}
