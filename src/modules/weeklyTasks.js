// ============================================================
// WEEKLY TASKS
// Ported from the original monolith's WEEKLY TASKS section. The
// first-run seed row's owner (a real former team member) has been
// swapped for a fictional one from demoSeed.js's roster.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { escHtml, showToast } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';

var weeklyTasks=[],weeklySaving=false,unsubscribeWeekly=null;
var weeklyEditId=null;
export async function weeklySaveToFirestore(){
  if(weeklySaving)return;weeklySaving=true;syncStart();
  try{
    await setDoc(doc(db,'appdata','weekly_tasks'),{data:weeklyTasks,updatedAt:new Date().toISOString()});
    try{await setDoc(doc(db,'appdata','weekly_tasks_backup'),{data:weeklyTasks,backedUpAt:new Date().toISOString()})}catch(b){}
    try{localStorage.setItem('eg7_weekly_tasks',JSON.stringify(weeklyTasks))}catch(x){}
    syncDone();
  }catch(e){syncError('Weekly save failed');try{localStorage.setItem('eg7_weekly_tasks',JSON.stringify(weeklyTasks))}catch(x){}}
  finally{weeklySaving=false}
}
export async function weeklyLoadFromFirestore(){
  for(var attempt=0;attempt<3;attempt++){
    try{
      var snap=await getDoc(doc(db,'appdata','weekly_tasks'));
      if(snap.exists()){
        weeklyTasks=snap.data().data||[];
      }else if(!weeklyTasks.length){
        weeklyTasks=[{id:'wk_'+Date.now(),title:'Website updates',owner:'Sam',status:'Planned',notes:'Review pages + publish blog updates'}];
        await weeklySaveToFirestore();
      }
      return;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,700*(attempt+1))});continue}
      try{var w=localStorage.getItem('eg7_weekly_tasks');if(w)weeklyTasks=JSON.parse(w)}catch(x){}
      return;
    }
  }
}
export function weeklyStartListener(){
  if(unsubscribeWeekly)unsubscribeWeekly();
  unsubscribeWeekly=onSnapshot(doc(db,'appdata','weekly_tasks'),function(snap){
    if(snap.exists()&&!weeklySaving){
      var d=snap.data().data||[];
      if(!d.length&&weeklyTasks.length)return;
      weeklyTasks=d;
      if(document.getElementById('panelWeekly').classList.contains('active'))weeklyRender();
    }
  },function(){});
}
export function stopWeeklyListener(){if(unsubscribeWeekly){unsubscribeWeekly();unsubscribeWeekly=null}}
function weeklyPopulateOwnerSelect(selected){
  var sel=document.getElementById('fWeeklyOwner');
  if(!sel)return;
  sel.innerHTML='<option value="">— Unassigned —</option>';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  if(selected&&getTeamMembers().indexOf(selected)===-1){var lo=document.createElement('option');lo.value=selected;lo.textContent=selected;sel.appendChild(lo)}
  sel.value=selected||'';
}
export function weeklyOpenModal(){
  weeklyEditId=null;
  weeklyPopulateOwnerSelect('');
  document.getElementById('weeklyModalTitle').textContent='Add Weekly Task';
  document.getElementById('fWeeklyTitle').value='';
  document.getElementById('fWeeklyStatus').value='Planned';
  document.getElementById('fWeeklyNotes').value='';
  document.getElementById('weeklyModalOverlay').classList.add('open');
}
export function weeklyEditTask(id){
  var t=weeklyTasks.find(function(x){return x.id===id});if(!t)return;
  weeklyEditId=id;
  weeklyPopulateOwnerSelect(t.owner||'');
  document.getElementById('weeklyModalTitle').textContent='Edit Weekly Task';
  document.getElementById('fWeeklyTitle').value=t.title||'';
  document.getElementById('fWeeklyStatus').value=t.status||'Planned';
  document.getElementById('fWeeklyNotes').value=t.notes||'';
  document.getElementById('weeklyModalOverlay').classList.add('open');
}
export function weeklyCloseModal(){document.getElementById('weeklyModalOverlay').classList.remove('open');weeklyEditId=null}
export async function weeklySaveTask(){
  var title=document.getElementById('fWeeklyTitle').value.trim();
  if(!title){showToast('Task name required','error');return}
  var row={title:title,owner:document.getElementById('fWeeklyOwner').value,status:document.getElementById('fWeeklyStatus').value,notes:document.getElementById('fWeeklyNotes').value.trim(),updatedAt:new Date().toISOString()};
  if(weeklyEditId){
    var i=weeklyTasks.findIndex(function(x){return x.id===weeklyEditId});
    if(i>=0){row.id=weeklyEditId;row.createdAt=weeklyTasks[i].createdAt;weeklyTasks[i]=row;showToast('Weekly task updated')}
  }else{
    row.id='wk_'+Date.now();row.createdAt=new Date().toISOString();weeklyTasks.push(row);showToast('Weekly task added');
  }
  await weeklySaveToFirestore();weeklyCloseModal();weeklyRender();
}
export async function weeklyDeleteTask(id){
  if(!confirm('Delete this weekly task?'))return;
  weeklyTasks=weeklyTasks.filter(function(t){return t.id!==id});
  await weeklySaveToFirestore();weeklyRender();showToast('Deleted','error');
}
function weeklyPopulateFilter(){
  var sel=document.getElementById('weeklyOwnerFilter');if(!sel)return;
  var cur=sel.value||'all';
  var names={};weeklyTasks.forEach(function(t){if(t.owner)names[t.owner]=1});
  sel.innerHTML='<option value="all">All Owners</option>'+Object.keys(names).map(function(n){return'<option>'+n+'</option>'}).join('');
  sel.value=cur;
}
export function weeklyRender(){
  var el=document.getElementById('weeklyTasksWrap');if(!el)return;
  weeklyPopulateFilter();
  var sf=document.getElementById('weeklyStatusFilter').value,of=document.getElementById('weeklyOwnerFilter').value;
  var list=weeklyTasks.filter(function(t){return(sf==='all'||t.status===sf)&&(of==='all'||t.owner===of)});
  var st={Planned:0,'In Progress':0,Blocked:0,Done:0};weeklyTasks.forEach(function(t){if(st[t.status]!=null)st[t.status]++});
  document.getElementById('weeklyStats').innerHTML=
    '<div class="adhoc-stat as-total"><div class="stat-label">Total</div><div class="stat-value">'+weeklyTasks.length+'</div></div>'+
    '<div class="adhoc-stat as-pending"><div class="stat-label">Planned</div><div class="stat-value" style="color:var(--blue)">'+st.Planned+'</div></div>'+
    '<div class="adhoc-stat as-progress"><div class="stat-label">In Progress</div><div class="stat-value" style="color:var(--yellow)">'+st['In Progress']+'</div></div>'+
    '<div class="adhoc-stat as-failed"><div class="stat-label">Blocked</div><div class="stat-value" style="color:var(--red)">'+st.Blocked+'</div></div>'+
    '<div class="adhoc-stat as-completed"><div class="stat-label">Done</div><div class="stat-value" style="color:var(--green)">'+st.Done+'</div></div>';
  var h='<table class="adhoc-table"><thead><tr><th>Task</th><th>Owner</th><th>Status</th><th>Notes</th><th></th></tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:24px">No weekly tasks yet. Click "+ Add Weekly Task".</td></tr>';
  list.forEach(function(t){
    var meta=state.MEMBERS[t.owner]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var owner=t.owner?'<span class="assignee-chip" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(t.owner[0]||'?')+' '+escHtml(t.owner)+'</span>':'<span style="color:var(--text3)">—</span>';
    h+='<tr><td style="font-weight:600">'+escHtml(t.title||'')+'</td><td>'+owner+'</td><td>'+escHtml(t.status||'Planned')+'</td><td style="color:var(--text2);font-size:12px">'+(t.notes?escHtml(t.notes):'—')+'</td><td><div class="action-cell"><button class="action-btn" onclick="weeklyEditTask(\''+t.id+'\')">✏️</button><button class="action-btn delete" onclick="weeklyDeleteTask(\''+t.id+'\')">✕</button></div></td></tr>';
  });
  h+='</tbody></table>';
  el.innerHTML=h;
}
