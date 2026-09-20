import { $ } from './ui-helpers.js';

const initialRecoveryLink=
  new URLSearchParams(window.location.hash.slice(1)).get('type')==='recovery'
  || new URLSearchParams(window.location.search.slice(1)).get('type')==='recovery';
let passwordRecoveryActive=initialRecoveryLink;

export function authErrorMessage(error,context='default'){
  if(error?.code==='weak_password'){
    if(context==='login')return 'This password no longer meets the current security requirements. Use Forgot password? to set a stronger password with at least 8 characters.';
    return 'Password does not meet the current security requirements. Choose a stronger password with at least 8 characters.';
  }
  return error?.message||'Authentication failed. Please try again.';
}

export function hideEntryViews(){
  ['loginView','signupView','teacherGateView','recoveryView','appView'].forEach(id=>$(id).classList.add('hidden'));
}
export function showLogin(){hideEntryViews();$('loginView').classList.remove('hidden');}
function showRecovery(){hideEntryViews();$('recoveryView').classList.remove('hidden');}

export async function initAuthSession(sb,enterApp){
  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();$('loginMsg').textContent='';$('loginBtn').disabled=true;$('loginBtn').innerHTML='<span class="spinner"></span> Signing in';
    const {data,error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    $('loginBtn').disabled=false;$('loginBtn').textContent='Sign In';
    if(error){$('loginMsg').textContent=authErrorMessage(error,'login');return;}
    if(data?.weakPassword){
      const {error:signOutError}=await sb.auth.signOut({scope:'local'});
      showLogin();
      $('loginMsg').textContent=authErrorMessage({code:'weak_password'},'login');
      if(signOutError)$('loginMsg').textContent+=' Close this tab after requesting the reset because the temporary sign-in session could not be fully cleared.';
      return;
    }
    await enterApp();
  });

  $('forgotBtn').addEventListener('click',async()=>{
    const email=$('email').value.trim();
    if(!email){$('loginMsg').textContent='Enter your email address first.';return;}
    $('forgotBtn').disabled=true;
    $('loginMsg').textContent='Sending password reset email…';
    const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/'});
    $('forgotBtn').disabled=false;
    if(error){$('loginMsg').textContent=error.message;return;}
    $('loginMsg').style.color='#147a4b';
    $('loginMsg').textContent='Password reset email sent. Open the email on this phone and tap the recovery link.';
  });

  $('recoveryForm').addEventListener('submit',async e=>{
    e.preventDefault();
    $('recoveryMsg').textContent='';
    if($('newPassword').value!==$('confirmPassword').value){
      $('recoveryMsg').textContent='The two passwords do not match.';return;
    }
    $('recoveryBtn').disabled=true;
    const {error}=await sb.auth.updateUser({password:$('newPassword').value});
    if(error){$('recoveryBtn').disabled=false;$('recoveryMsg').textContent=authErrorMessage(error,'recovery');return;}
    const {error:signOutError}=await sb.auth.signOut();
    $('recoveryBtn').disabled=false;
    if(signOutError){
      $('recoveryMsg').textContent='Password updated, but the recovery session could not be signed out. Please try again.';return;
    }
    passwordRecoveryActive=false;
    $('recoveryForm').reset();
    showLogin();
    $('loginMsg').style.color='#147a4b';
    $('loginMsg').textContent='Password updated successfully. Sign in with your new password.';
  });

  $('signOutBtn').addEventListener('click',async()=>{await sb.auth.signOut();showLogin();});

  sb.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY'){passwordRecoveryActive=true;showRecovery();return;}
    if(event==='SIGNED_OUT'){passwordRecoveryActive=false;showLogin();return;}
  });
  const {data:{session}}=await sb.auth.getSession();
  if(passwordRecoveryActive){showRecovery();return;}
  if(session)await enterApp(); else showLogin();
}
