import { state } from './app-state.js';
import { $, esc, fillGroupedClasses } from './ui-helpers.js';
import { hideEntryViews, showLogin } from './auth-session.js';

const PENDING_SIGNUP_KEY='srlAttendancePendingTeacherSignup';
const PENDING_SIGNUP_VERSION=2;

let sb;

export function initTeacherAccess(client){
  sb=client;
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

export async function showSignup(){
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

export async function ensureTeacherAccess(){
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
  return true;
}

export async function submitSignup(e,enterApp){
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
}
export async function submitGateRequest(e){
  e.preventDefault();$('gateMsg').textContent='Submitting request…';$('gateSubmitBtn').disabled=true;
  try{await submitTeacherRequest($('gateName').value.trim(),$('gateClass').value,$('gateRole').value);clearPendingSignupForUser(state.teacherStatus?.user_id);const st=await sb.rpc('attendance_teacher_status');if(st.error)throw st.error;await showTeacherGate(st.data);}
  catch(err){$('gateMsg').textContent=err.message;}finally{$('gateSubmitBtn').disabled=false;}
}
export async function signOutTeacherGate(){await sb.auth.signOut();showLogin();}
