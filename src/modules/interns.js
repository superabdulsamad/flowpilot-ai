// ============================================================
// INTERN PORTAL
// Ported from the original monolith's INTERN PORTAL section.
// ============================================================
import { state } from '../state.js';
import { escHtml, formatDate } from '../utils/dom.js';
import { hashPass, loadUsersFromFirestore, saveUsersToFirestore, isUsersLoadOk } from './auth.js';
import { nextColor, saveMembers } from './tasks.js';
import { colorToBg } from '../utils/dom.js';
import { getDtTasks, dtLoadFromFirestore, dtStartListener, dtScheduleMidnightReset } from './dailyTasks.js';
import { getAdhocTasks, adhocLoadFromFirestore, adhocStartListener } from './adhocTasks.js';
import { updateThemeBtn, showApp } from '../main.js';

export function isInternUser(){return state.currentUser&&state.currentUser.role==='intern'}
export function openInternSignup(){document.getElementById('fInternName').value='';document.getElementById('fInternUser').value='';document.getElementById('fInternPass').value='';document.getElementById('internSignupError').style.display='none';document.getElementById('internSignupOverlay').classList.add('open')}
export function closeInternSignup(){document.getElementById('internSignupOverlay').classList.remove('open')}
export function internSignupErr(m){var e=document.getElementById('internSignupError');e.textContent=m;e.style.display='block'}
export async function signupIntern(){
  var name=document.getElementById('fInternName').value.trim();
  var u=document.getElementById('fInternUser').value.trim().toLowerCase();
  var p=document.getElementById('fInternPass').value;
  if(!name||!u||!p){internSignupErr('All fields required');return}
  if(!/^[a-z0-9_.]+$/.test(u)){internSignupErr('Username: letters, numbers, _ . only');return}
  await loadUsersFromFirestore();
  if(!isUsersLoadOk()){internSignupErr('Network issue — try again');return}
  if(state.users[u]){internSignupErr('Username already taken');return}
  state.users[u]={hash:await hashPass(p),role:'intern',displayName:name};
  if(!state.MEMBERS[name]){var c=nextColor();state.MEMBERS[name]={color:c,bg:colorToBg(c)};await saveMembers()}
  var ok=await saveUsersToFirestore();
  if(!ok){internSignupErr('Could not save — try again');return}
  state.currentUser={username:u,role:'intern',displayName:name};
  localStorage.setItem('eg7_session',JSON.stringify(state.currentUser));
  closeInternSignup();showApp();
}

export function internRender(){
  if(!isInternUser())return;
  var me=state.currentUser.displayName;
  document.getElementById('internBadge').textContent=me+' (intern)';
  document.getElementById('internGreeting').textContent='Welcome, '+me+' 🎓';
  document.getElementById('internDate').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var myDaily=getDtTasks().filter(function(t){return t.assignee===me});
  var myAdhoc=getAdhocTasks().filter(function(t){return t.assignee===me});
  var dDone=myDaily.filter(function(t){return t.done}).length;
  var aDone=myAdhoc.filter(function(t){return t.progress==='Completed'}).length;
  var totalAll=myDaily.length+myAdhoc.length,doneAll=dDone+aDone;
  var pct=totalAll?Math.round(doneAll/totalAll*100):0;
  document.getElementById('internStats').innerHTML=
    '<div class="dt-stat dst-total"><div class="stat-label">Total Tasks</div><div class="stat-value">'+totalAll+'</div></div>'+
    '<div class="dt-stat dst-done"><div class="stat-label">Completed</div><div class="stat-value">'+doneAll+'</div></div>'+
    '<div class="dt-stat dst-pending"><div class="stat-label">Pending</div><div class="stat-value">'+(totalAll-doneAll)+'</div></div>'+
    '<div class="dt-stat dst-progress"><div class="stat-label">Progress</div><div class="stat-value">'+pct+'%</div></div>';
  var dh='';
  if(!myDaily.length)dh='<div class="dt-empty">No daily tasks assigned yet.</div>';
  else myDaily.forEach(function(t){
    dh+='<div class="dt-task-row">'+
      '<input type="checkbox" class="dt-checkbox" '+(t.done?'checked':'')+' onchange="dtToggle(\''+t.id+'\',this.checked)">'+
      '<div style="flex:1"><div class="dt-task-name'+(t.done?' done':'')+'">'+escHtml(t.name)+'</div>'+(t.note?'<div class="dt-task-note">💬 '+escHtml(t.note)+'</div>':'')+'</div></div>';
  });
  document.getElementById('internDaily').innerHTML=dh;
  var ah='';
  if(!myAdhoc.length)ah='<div class="dt-empty">No assigned tasks yet.</div>';
  else myAdhoc.forEach(function(t){
    var opts=['Pending','In Progress','Completed','Confusion'].map(function(o){return'<option value="'+o+'"'+(t.progress===o?' selected':'')+'>'+o+'</option>'}).join('');
    ah+='<div class="dt-task-row"><div style="flex:1"><div class="dt-task-name'+(t.progress==='Completed'?' done':'')+'">'+escHtml(t.name)+'</div>'+(t.description?'<div class="dt-task-note">'+escHtml(t.description)+'</div>':'')+'<div class="dt-task-note">Due: '+formatDate(t.endDate)+(t.priority?' · '+escHtml(t.priority):'')+'</div></div>'+
      '<select class="form-select" style="width:140px" onchange="adhocChangeProgress(\''+t.id+'\',this.value)">'+opts+'</select></div>';
  });
  document.getElementById('internAdhoc').innerHTML=ah;
}

export function internAdminRender(){
  var interns=Object.keys(state.users).filter(function(u){return state.users[u].role==='intern'}).map(function(u){return state.users[u].displayName});
  var grid=document.getElementById('internAdminGrid'),detail=document.getElementById('internAdminDetail');
  if(!interns.length){grid.innerHTML='<div class="dt-empty">No interns registered yet.</div>';detail.innerHTML='';return}
  var gh='';
  interns.forEach(function(name){
    var meta=state.MEMBERS[name]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var d=getDtTasks().filter(function(t){return t.assignee===name});
    var a=getAdhocTasks().filter(function(t){return t.assignee===name});
    var total=d.length+a.length;
    var done=d.filter(function(t){return t.done}).length+a.filter(function(t){return t.progress==='Completed'}).length;
    var pct=total?Math.round(done/total*100):0;
    gh+='<div class="ap-card">'+
      '<div class="ap-card-name"><div class="avatar" style="background:'+meta.bg+';color:'+meta.color+';width:24px;height:24px;font-size:11px">'+name[0]+'</div>'+name+'</div>'+
      '<div class="ap-card-stats" style="font-size:12px;color:var(--text2);line-height:2">Total: <strong>'+total+'</strong><br>Done: <strong style="color:var(--green)">'+done+'</strong><br>Pending: <strong style="color:var(--red)">'+(total-done)+'</strong></div>'+
      '<div class="ap-card-bar"><div class="ap-card-fill" style="width:'+pct+'%;background:'+(pct===100?'var(--green)':'var(--brand)')+'"></div></div>'+
      '<div class="ap-card-pct">'+pct+'%</div></div>';
  });
  grid.innerHTML=gh;
  var rows='';
  interns.forEach(function(name){
    var tasks=[].concat(
      getDtTasks().filter(function(t){return t.assignee===name}).map(function(t){return{n:t.name,k:'Daily',s:t.done?'Completed':'Pending'}}),
      getAdhocTasks().filter(function(t){return t.assignee===name}).map(function(t){return{n:t.name,k:'Adhoc',s:t.progress}})
    );
    if(!tasks.length){rows+='<tr><td>'+name+'</td><td colspan="2" style="color:var(--text3)">No tasks assigned</td></tr>';return}
    tasks.forEach(function(t,i){rows+='<tr>'+(i===0?'<td rowspan="'+tasks.length+'" style="font-weight:600;vertical-align:top">'+escHtml(name)+'</td>':'')+'<td>'+escHtml(t.n)+' <span style="color:var(--text3);font-size:11px">('+escHtml(t.k)+')</span></td><td>'+(t.s==='Completed'?'<span style="color:var(--green)">✅ '+escHtml(t.s)+'</span>':escHtml(t.s))+'</td></tr>'});
  });
  detail.innerHTML='<div class="adhoc-table-wrap"><div class="adhoc-table-header"><div class="adhoc-table-title">Task Detail</div></div><div style="overflow-x:auto"><table class="adhoc-table"><thead><tr><th>Intern</th><th>Task</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>';
}

export function showInternApp(){
  document.getElementById('appWrap').style.display='none';
  document.getElementById('internWrap').style.display='block';
  document.getElementById('aiBubble').style.display='none';
  var th=localStorage.getItem('eg7_theme');if(th)document.documentElement.setAttribute('data-theme',th);
  updateThemeBtn();
  internRender();
  adhocLoadFromFirestore().then(function(){adhocStartListener();internRender()});
  dtLoadFromFirestore().then(function(){dtStartListener();dtScheduleMidnightReset();internRender()});
}
