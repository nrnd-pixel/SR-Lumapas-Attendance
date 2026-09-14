import { state, beginRequest, isLatestRequest } from './app-state.js';
import { displayDate } from './date-helpers.js';
import { $, esc } from './ui-helpers.js';

let sb;

export function initAttendanceRegister(client){sb=client;}

const routineOptions=[
  ['present','Present'],['absent','Absent'],['late','Late'],['permission','Permission'],
  ['SS','SEN / Special'],['T','Transfer Out'],['D','Deferred'],['X','Deceased'],
  ['SP','Student Pass'],['W','Withdrawn'],['Q','Quit']
];

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
export function hasUnsavedChanges(){
  if(state.saving||state.loading)return false;
  if(state.register?.register)return changedRows().length>0;
  return state.rows.some(r=>!!r.group || !!r.reason || normalizedNote(r.note)!==null);
}
export function confirmDiscard(){
  return !hasUnsavedChanges() || confirm('You have unsaved attendance changes. Discard them and continue?');
}

export function setBusy(flag){
  state.loading=flag;
  $('allPresentBtn').disabled=flag;$('reloadBtn').disabled=flag;$('clearBtn').disabled=flag;
}
export function setBanner(text,type='info'){const b=$('dateBanner');b.className='banner '+type;b.textContent=text;}

export async function loadRegister(){
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
export function markAllPresent(){
  if(state.register?.register&&!confirm('This date already has saved attendance. Mark every pupil Present in the form? Any changed pupil will become a formal correction and will require a reason before saving.'))return;
  state.rows.forEach(r=>{r.group='present';r.reason='';r.note='';r.dirty=true;});render();
}
export function clearAll(){state.rows.forEach(r=>{r.group='';r.reason='';r.note='';r.dirty=true;});render();}

export function updateSummary(){
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

export async function save(){
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
