// ============================================================
// SYNC HELPERS, AUTH, USER MANAGEMENT
// Ported from the original monolith's SYNC HELPERS / AUTH / USER
// MANAGEMENT sections. `users` and `currentUser` now live on the shared
// `state` object (src/state.js) instead of top-level `var`s.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state } from '../state.js';
import { showToast, escHtml, colorToBg } from '../utils/dom.js';
import { nextColor, saveMembers, renderAll } from './tasks.js';
import { tmRenderTeam } from './timeManagement.js';
import { dtRender } from './dailyTasks.js';
import { showApp } from '../main.js';
import { stopCourseListener, stopMembersListener } from './tasks.js';
import { tmStopTimers } from './timeManagement.js';
import { dtStopListener, dtStopMidnightTimer } from './dailyTasks.js';
import { stopAdhocListener } from './adhocTasks.js';
import { stopToolsListener } from './toolTesting.js';
import { stopWeeklyListener } from './weeklyTasks.js';
import { stopRolesListener } from './rolesResponsibilities.js';
import { DEMO_ADMIN } from '../data/demoSeed.js';

// ============================================================
// SYNC HELPERS
// ============================================================
export function syncStart(){var f=document.getElementById('syncBarFill'),s=document.getElementById('syncIndicator');f.className='sync-bar-fill syncing';f.style.width='60%';s.textContent='⟳ Saving...';s.className='sync-indicator saving show'}
export function syncDone(){var f=document.getElementById('syncBarFill'),s=document.getElementById('syncIndicator');f.className='sync-bar-fill';f.style.width='100%';s.textContent='✓ Saved';s.className='sync-indicator ok show';setTimeout(function(){f.style.width='0%';s.classList.remove('show')},2000)}
export function syncError(msg){var f=document.getElementById('syncBarFill'),s=document.getElementById('syncIndicator');f.className='sync-bar-fill error';s.textContent='✕ '+(msg||'Save failed');s.className='sync-indicator err show';setTimeout(function(){f.style.width='0%';s.classList.remove('show')},4000)}

// ============================================================
// AUTH
// ============================================================
export async function hashPass(p){var enc=new TextEncoder().encode(p);var buf=await crypto.subtle.digest('SHA-256',enc);return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('')}
var usersLoadOk=false,usersDocExists=false,unsubscribeUsers=null;

export async function loadUsersFromFirestore(){
  usersLoadOk=false;usersDocExists=false;
  for(var attempt=0;attempt<3;attempt++){
    try{
      var snap=await getDoc(doc(db,'config','users'));
      usersLoadOk=true;usersDocExists=snap.exists();
      if(snap.exists())state.users=snap.data().data||{};
      try{if(Object.keys(state.users).length)localStorage.setItem('eg7_users',JSON.stringify(state.users))}catch(x){}
      return;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,800*(attempt+1))});continue}
      usersLoadOk=false;
      try{var u=localStorage.getItem('eg7_users');if(u)state.users=JSON.parse(u)}catch(x){}
    }
  }
}
export async function saveUsersToFirestore(opts){
  opts=opts||{};
  if(!opts.allowEmpty&&!Object.keys(state.users).length){syncError('Blocked empty user write');return false}
  try{
    syncStart();
    await setDoc(doc(db,'config','users'),{data:state.users,updatedAt:new Date().toISOString()});
    try{await setDoc(doc(db,'config','users_backup'),{data:state.users,backedUpAt:new Date().toISOString()})}catch(b){}
    localStorage.setItem('eg7_users',JSON.stringify(state.users));syncDone();return true;
  }catch(e){syncError('User save failed');try{localStorage.setItem('eg7_users',JSON.stringify(state.users))}catch(x){}return false}
}
export async function initDefaultAdmin(){
  if(!usersLoadOk)return;
  if(usersDocExists)return;
  if(Object.keys(state.users).length)return;
  state.users[DEMO_ADMIN.username]={hash:await hashPass(DEMO_ADMIN.password),role:'admin',displayName:DEMO_ADMIN.displayName};
  await saveUsersToFirestore();
}
export function isUsersLoadOk(){return usersLoadOk}
export function startUsersListener(){
  if(unsubscribeUsers)unsubscribeUsers();
  unsubscribeUsers=onSnapshot(doc(db,'config','users'),function(snap){
    if(snap.exists()){var d=snap.data().data||{};if(Object.keys(d).length){state.users=d;try{localStorage.setItem('eg7_users',JSON.stringify(state.users))}catch(x){}}}
  },function(){});
}

export function switchLoginTab(which){
  var team=which==='team';
  document.getElementById('teamBox').style.display=team?'block':'none';
  document.getElementById('internBox').style.display=team?'none':'block';
  document.getElementById('segTeam').classList.toggle('active',team);
  document.getElementById('segIntern').classList.toggle('active',!team);
  document.getElementById('segIntern').classList.toggle('intern-active',!team);
  document.getElementById('loginError').style.display='none';
  document.getElementById('internLoginError').style.display='none';
  (team?document.getElementById('loginUser'):document.getElementById('internLoginUser')).focus();
}

export async function doLogin(){
  var btn=document.getElementById('loginBtn');btn.disabled=true;btn.textContent='Signing in...';
  var u=document.getElementById('loginUser').value.trim().toLowerCase();
  var p=document.getElementById('loginPass').value;
  var err=document.getElementById('loginError');
  if(!u||!p){err.textContent='Invalid username or password';err.style.display='block';btn.disabled=false;btn.textContent='Sign In';return}
  var h=await hashPass(p);
  if(state.users[u]&&state.users[u].hash===h){
    if(state.users[u].role==='intern'){err.textContent='Interns: use the Intern Login tab';err.style.display='block';btn.disabled=false;btn.textContent='Sign In';return}
    state.currentUser={username:u,role:state.users[u].role,displayName:state.users[u].displayName||u};localStorage.setItem('eg7_session',JSON.stringify(state.currentUser));showApp();
  }
  else{err.textContent='Invalid username or password';err.style.display='block'}
  btn.disabled=false;btn.textContent='Sign In';
}
export async function internDoLogin(){
  var btn=document.getElementById('internLoginBtn');btn.disabled=true;btn.textContent='Signing in...';
  var u=document.getElementById('internLoginUser').value.trim().toLowerCase();
  var p=document.getElementById('internLoginPass').value;
  var err=document.getElementById('internLoginError');
  if(!u||!p){err.textContent='Enter username and password';err.style.display='block';btn.disabled=false;btn.textContent='Intern Sign In';return}
  var h=await hashPass(p);
  if(state.users[u]&&state.users[u].hash===h&&state.users[u].role==='intern'){
    state.currentUser={username:u,role:'intern',displayName:state.users[u].displayName||u};localStorage.setItem('eg7_session',JSON.stringify(state.currentUser));showApp();
  }
  else if(state.users[u]&&state.users[u].hash===h){err.textContent='Not an intern account — use Team Login';err.style.display='block'}
  else{err.textContent='Invalid intern credentials';err.style.display='block'}
  btn.disabled=false;btn.textContent='Intern Sign In';
}
export function doLogout(){
  state.currentUser=null;localStorage.removeItem('eg7_session');
  stopCourseListener();stopMembersListener();
  dtStopListener();
  stopAdhocListener();
  stopToolsListener();
  stopWeeklyListener();
  stopRolesListener();
  tmStopTimers();
  dtStopMidnightTimer();
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('appWrap').style.display='none';
  document.getElementById('internWrap').style.display='none';
  document.getElementById('aiBubble').style.display='none';
  document.getElementById('loginUser').value='';document.getElementById('loginPass').value='';document.getElementById('loginError').style.display='none';
  var ilu=document.getElementById('internLoginUser');if(ilu){ilu.value='';document.getElementById('internLoginPass').value='';document.getElementById('internLoginError').style.display='none'}
  switchLoginTab('team');
}
export function checkSession(){try{var s=localStorage.getItem('eg7_session');if(s){state.currentUser=JSON.parse(s);return true}}catch(e){}return false}

// USER MANAGEMENT
export function openUserMgmt(){renderUserList();document.getElementById('userMgmtOverlay').classList.add('open')}
export function closeUserMgmt(){document.getElementById('userMgmtOverlay').classList.remove('open')}
export function renderUserList(){
  var h='<table class="user-table"><thead><tr><th>Username</th><th>Name</th><th>Role</th><th></th></tr></thead><tbody>';
  Object.keys(state.users).forEach(function(u){var user=state.users[u];h+='<tr><td style="font-family:var(--mono)">'+escHtml(u)+'</td><td>'+escHtml(user.displayName||u)+'</td><td><span class="role-badge role-'+escHtml(user.role)+'">'+escHtml(user.role)+'</span></td><td>';if(u!==state.currentUser.username)h+='<button class="action-btn delete" onclick="window._deleteUser(\''+u+'\')">✕</button> <button class="action-btn" onclick="window._resetPass(\''+u+'\')">🔑</button>';else h+='<button class="action-btn" onclick="window._changeMyPass()">🔑</button>';h+='</td></tr>'});
  h+='</tbody></table>';document.getElementById('userList').innerHTML=h;
}
export async function createUser(){
  var u=document.getElementById('fNewUser').value.trim().toLowerCase(),p=document.getElementById('fNewPass').value,r=document.getElementById('fNewRole').value;
  if(!u||!p){showToast('Required','error');return}if(state.users[u]){showToast('Exists','error');return}
  var displayName=u.charAt(0).toUpperCase()+u.slice(1);
  state.users[u]={hash:await hashPass(p),role:r,displayName:displayName};
  // Auto-add to MEMBERS — save directly to Firestore bypassing batch
  if(!state.MEMBERS[displayName]){
    var c=nextColor();
    state.MEMBERS[displayName]={color:c,bg:colorToBg(c)};
    await saveMembers();
  }
  await saveUsersToFirestore();
  document.getElementById('fNewUser').value='';document.getElementById('fNewPass').value='';
  renderUserList();renderAll();
  if(document.getElementById('panelTime').classList.contains('active'))tmRenderTeam();
  if(document.getElementById('panelDaily').classList.contains('active'))dtRender();
  showToast('User '+displayName+' created and added to team');
}
window._deleteUser=async function(u){
  if(!confirm('Delete user '+u+'?'))return;
  var displayName=state.users[u]?state.users[u].displayName:null;
  delete state.users[u];
  if(displayName&&state.MEMBERS[displayName]){
    delete state.MEMBERS[displayName];
    await saveMembers();
  }
  await saveUsersToFirestore();
  renderUserList();renderAll();
  if(document.getElementById('panelTime').classList.contains('active'))tmRenderTeam();
  if(document.getElementById('panelDaily').classList.contains('active'))dtRender();
  showToast(u+' deleted');
}
window._resetPass=async function(u){var np=prompt('New password for '+u+':');if(!np)return;state.users[u].hash=await hashPass(np);await saveUsersToFirestore();showToast('Password reset for '+u)}
window._changeMyPass=async function(){var np=prompt('Enter your new password:');if(!np)return;state.users[state.currentUser.username].hash=await hashPass(np);await saveUsersToFirestore();showToast('Password updated')}
