import { state } from './app-state.js';
import { bruneiToday } from './date-helpers.js';
import { $, esc, fillGroupedClasses } from './ui-helpers.js';

let sb;
let schoolId;
let adminClasses;
let showAdminMsg;

export function initStudentManagement(client,helpers){
  sb=client;
  schoolId=helpers.schoolId;
  adminClasses=helpers.adminClasses;
  showAdminMsg=helpers.showAdminMsg;
}

export async function loadAdminStudents(){
  const sid=schoolId();if(!sid)return;
  showAdminMsg('studentManageMsg','Loading pupil roster…','info');
  const {data,error}=await sb.rpc('attendance_admin_student_roster',{p_school_id:sid});
  if(error){showAdminMsg('studentManageMsg',error.message,'warn');return;}
  state.adminRoster=data;$('studentManageMsg').classList.add('hidden');$('studentAdminCount').textContent=(data.total_current||0)+' current pupils';
  fillGroupedClasses($('studentClassFilter'),data.classes||[],{blankLabel:'All classes',compact:true});
  fillGroupedClasses($('tiClass'),data.classes||[],{compact:true});renderAdminStudents();renderMovements();
}
export function renderAdminStudents(){
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

export function prepareTransferInDialog(){
  $('transferInForm').reset();$('tiStats').checked=true;$('tiDate').value=bruneiToday();$('tiMsg').textContent='';fillGroupedClasses($('tiClass'),state.adminRoster?.classes||adminClasses(),{compact:true});$('transferInDialog').showModal();
}
export function syncTransferInStats(){$('tiStats').checked=$('tiGroup').value==='Mainstream';}
export async function submitTransferIn(e){
  e.preventDefault();if(!confirm('Add '+$('tiName').value.trim()+' to '+$('tiClass').selectedOptions[0]?.textContent+' from '+$('tiDate').value+'?'))return;
  $('tiSaveBtn').disabled=true;$('tiMsg').textContent='Saving…';
  const {data,error}=await sb.rpc('attendance_admin_transfer_in',{p_school_id:schoolId(),p_class_id:$('tiClass').value,p_student_ref:$('tiRef').value.trim(),p_full_name:$('tiName').value.trim(),p_gender:$('tiGender').value||null,p_start_date:$('tiDate').value,p_reporting_group:$('tiGroup').value,p_include_in_class_stats:$('tiStats').checked,p_remarks:$('tiRemarks').value.trim()||null});
  $('tiSaveBtn').disabled=false;if(error){$('tiMsg').textContent=error.message;return;}$('transferInDialog').close();showAdminMsg('studentManageMsg','Transfer In saved.'+(data.backfill_registers?' '+data.backfill_registers+' previously saved register(s) exist from the start date and should be reviewed.':''),'ok');await loadAdminStudents();
}
export async function submitTransferOut(e){
  e.preventDefault();const s=state.selectedAdminStudent;if(!s)return;if(!confirm('Transfer '+s.full_name+' out after '+$('toDate').value+'? Historical attendance will be preserved.'))return;
  $('toSaveBtn').disabled=true;const {data,error}=await sb.rpc('attendance_admin_transfer_out',{p_enrolment_id:s.enrolment_id,p_last_date:$('toDate').value,p_remarks:$('toRemarks').value.trim()||null});$('toSaveBtn').disabled=false;
  if(error){$('toMsg').textContent=error.message;return;}$('transferOutDialog').close();showAdminMsg('studentManageMsg','Transfer Out saved. '+data.preserved_attendance_records+' attendance record(s) preserved.','ok');await loadAdminStudents();
}
export async function submitMoveClass(e){
  e.preventDefault();const s=state.selectedAdminStudent;if(!s)return;const dest=$('mcClass').selectedOptions[0]?.textContent||'new class';if(!confirm('Move '+s.full_name+' from '+s.class_code+' to '+dest+' starting '+$('mcDate').value+'?'))return;
  $('mcSaveBtn').disabled=true;const {data,error}=await sb.rpc('attendance_admin_move_class',{p_enrolment_id:s.enrolment_id,p_to_class_id:$('mcClass').value,p_move_date:$('mcDate').value,p_remarks:$('mcRemarks').value.trim()||null});$('mcSaveBtn').disabled=false;
  if(error){$('mcMsg').textContent=error.message;return;}$('moveClassDialog').close();showAdminMsg('studentManageMsg','Class move saved. '+data.preserved_attendance_records+' old-class attendance record(s) preserved.'+(data.backfill_registers?' '+data.backfill_registers+' saved destination register(s) exist from the move date and should be reviewed.':''),'ok');await loadAdminStudents();
}
