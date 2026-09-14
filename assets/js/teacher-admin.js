import { state } from './app-state.js';
import { $, esc } from './ui-helpers.js';

let sb;
let adminClasses;
let showAdminMsg;

export function initTeacherAdmin(client,helpers){
  sb=client;
  adminClasses=helpers.adminClasses;
  showAdminMsg=helpers.showAdminMsg;
}

export async function loadAdminTeachers(){
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
