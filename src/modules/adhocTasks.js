// ============================================================
// ADHOC TASKS
// Ported from the original monolith's ADHOC TASKS section. The hardcoded
// first-run seed data (real task names/vendors/assignees) has been
// replaced with the fictional DEMO_ADHOC_TASKS from src/data/demoSeed.js.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { escHtml, showToast } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';
import { DEMO_ADHOC_TASKS } from '../data/demoSeed.js';
import { isInternUser, internRender, internAdminRender } from './interns.js';
import { updateTabBadges } from '../main.js';

var adhocTasks=[];
var adhocEditId=null;
var adhocSaving=false;
var unsubscribeAdhoc=null;
var adhocLoadOk=false,adhocDocExists=false;

export function getAdhocTasks(){return adhocTasks}

export async function adhocSaveToFirestore(){
  if(adhocSaving)return;adhocSaving=true;syncStart();
  try{
    await setDoc(doc(db,'appdata','adhoc'),{data:adhocTasks,updatedAt:new Date().toISOString()});
    try{await setDoc(doc(db,'appdata','adhoc_backup'),{data:adhocTasks,backedUpAt:new Date().toISOString()})}catch(b){}
    syncDone();
    try{if(adhocTasks.length)localStorage.setItem('eg7_adhoc',JSON.stringify(adhocTasks))}catch(x){}
  }catch(e){syncError('Adhoc save failed');try{localStorage.setItem('eg7_adhoc',JSON.stringify(adhocTasks))}catch(x){}}
  finally{adhocSaving=false}
}
export async function adhocLoadFromFirestore(){
  adhocLoadOk=false;adhocDocExists=false;
  for(var attempt=0;attempt<3;attempt++){
    try{
      var snap=await getDoc(doc(db,'appdata','adhoc'));
      adhocLoadOk=true;adhocDocExists=snap.exists();
      if(snap.exists())adhocTasks=snap.data().data||[];
      try{if(adhocTasks.length)localStorage.setItem('eg7_adhoc',JSON.stringify(adhocTasks))}catch(x){}
      break;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,800*(attempt+1))});continue}
      adhocLoadOk=false;
      try{var a=localStorage.getItem('eg7_adhoc');if(a)adhocTasks=JSON.parse(a)}catch(x){}
    }
  }
  await initDefaultAdhoc();
}
async function initDefaultAdhoc(){
  if(!adhocLoadOk)return;
  if(adhocDocExists)return;
  if(adhocTasks.length)return;
  // Seed default tasks only on first-ever setup (no adhoc doc in Firestore yet)
  if(!adhocTasks.length){
    var seed=JSON.parse(JSON.stringify(DEMO_ADHOC_TASKS));
    // auto-set sysStatus
    seed.forEach(function(t){t.sysStatus=adhocGetSysStatus(t)});
    adhocTasks=seed;
    await adhocSaveToFirestore();
  }
}
export function adhocStartListener(){
  if(unsubscribeAdhoc)unsubscribeAdhoc();
  unsubscribeAdhoc=onSnapshot(doc(db,'appdata','adhoc'),function(snap){
    if(snap.exists()&&!adhocSaving){
      var d=snap.data().data||[];
      if(!d.length&&adhocTasks.length)return;
      adhocTasks=d;
      if(isInternUser())internRender();
      else{
        if(document.getElementById('panelAdhoc').classList.contains('active'))adhocRender();
        if(document.getElementById('panelInterns').classList.contains('active'))internAdminRender();
      }
    }
  },function(err){});
}
export function stopAdhocListener(){if(unsubscribeAdhoc){unsubscribeAdhoc();unsubscribeAdhoc=null}}

// Auto-update system status based on end date
function adhocGetSysStatus(task){
  if(task.progress==='Completed')return'Completed';
  var today=new Date();today.setHours(0,0,0,0);
  var end=new Date(task.endDate);end.setHours(0,0,0,0);
  if(end<today)return'Failed';
  return'Active';
}
function adhocDaysRemaining(endDate){
  var today=new Date();today.setHours(0,0,0,0);
  var end=new Date(endDate);end.setHours(0,0,0,0);
  return Math.round((end-today)/(1000*60*60*24));
}

// RENDER
export function adhocRender(){
  adhocAutoUpdateStatuses();
  adhocRenderStats();
  adhocRenderAssigneeGrid();
  adhocRenderTable();
  adhocPopulateFilters();
  updateTabBadges();
}
function adhocAutoUpdateStatuses(){
  var changed=false;
  adhocTasks.forEach(function(t){
    var sys=adhocGetSysStatus(t);
    if(sys!==t.sysStatus){t.sysStatus=sys;changed=true}
  });
  if(changed)adhocSaveToFirestore();
}
function adhocRenderStats(){
  var total=adhocTasks.length;
  var completed=adhocTasks.filter(function(t){return t.progress==='Completed'}).length;
  var pending=adhocTasks.filter(function(t){return t.progress==='Pending'}).length;
  var inprog=adhocTasks.filter(function(t){return t.progress==='In Progress'||t.progress==='Confusion'}).length;
  var failed=adhocTasks.filter(function(t){return t.sysStatus==='Failed'}).length;
  var overdue=adhocTasks.filter(function(t){return t.sysStatus==='Failed'&&t.progress!=='Completed'}).length;
  document.getElementById('adhocStats').innerHTML=
    '<div class="adhoc-stat as-total"><div class="stat-label">Total</div><div class="stat-value">'+total+'</div></div>'+
    '<div class="adhoc-stat as-completed"><div class="stat-label">Completed</div><div class="stat-value">'+completed+'</div></div>'+
    '<div class="adhoc-stat as-pending"><div class="stat-label">Pending</div><div class="stat-value">'+pending+'</div></div>'+
    '<div class="adhoc-stat as-progress"><div class="stat-label">In Progress</div><div class="stat-value">'+inprog+'</div></div>'+
    '<div class="adhoc-stat as-overdue"><div class="stat-label">Overdue</div><div class="stat-value">'+overdue+'</div></div>'+
    '<div class="adhoc-stat as-failed"><div class="stat-label">Failed</div><div class="stat-value">'+failed+'</div></div>';
}
function adhocRenderAssigneeGrid(){
  var members=getTeamMembers();
  var h='';
  members.forEach(function(name){
    var tasks=adhocTasks.filter(function(t){return t.assignee===name});
    if(!tasks.length)return;
    var meta=state.MEMBERS[name]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var total=tasks.length;
    var completed=tasks.filter(function(t){return t.progress==='Completed'}).length;
    var failed=tasks.filter(function(t){return t.sysStatus==='Failed'}).length;
    var active=tasks.filter(function(t){return t.sysStatus==='Active'&&t.progress!=='Completed'}).length;
    var pct=total?Math.round(completed/total*100):0;
    h+='<div class="ap-card">'+
      '<div class="ap-card-name"><div class="avatar" style="background:'+meta.bg+';color:'+meta.color+';width:22px;height:22px;font-size:10px">'+name[0]+'</div>'+name+'</div>'+
      '<div class="ap-card-stats">Total: '+total+'<br>Completed: '+completed+'<br>Failed: '+failed+'<br>Active: '+active+'</div>'+
      '<div class="ap-card-bar"><div class="ap-card-fill" style="width:'+pct+'%"></div></div>'+
      '<div class="ap-card-pct">'+pct+'%</div></div>';
  });
  document.getElementById('adhocAssigneeGrid').innerHTML=h||'<div style="color:var(--text3);font-size:13px">No tasks yet</div>';
}
function adhocPopulateFilters(){
  var members=getTeamMembers();
  var sel=document.getElementById('adhocAssigneeFilter'),cv=sel.value;
  sel.innerHTML='<option value="all">All Assignees</option>';
  members.forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  sel.value=cv||'all';
}
function adhocGetFiltered(){
  var af=document.getElementById('adhocAssigneeFilter').value;
  var pf=document.getElementById('adhocPriorityFilter').value;
  var sf=document.getElementById('adhocStatusFilter').value;
  return adhocTasks.filter(function(t){
    if(af!=='all'&&t.assignee!==af)return false;
    if(pf!=='all'&&t.priority!==pf)return false;
    if(sf!=='all'&&t.progress!==sf)return false;
    return true;
  });
}
function adhocRenderTable(){
  var tasks=adhocGetFiltered();
  var h='';
  tasks.forEach(function(t){
    var days=adhocDaysRemaining(t.endDate);
    var daysCls=days<0?'days-overdue':days<=3?'days-soon':'days-ok';
    var daysStr=days<0?Math.abs(days)+' days overdue':days===0?'Today':days+' days left';
    var sys=t.sysStatus||adhocGetSysStatus(t);
    var sysCls=sys==='Failed'?'ss-failed':sys==='Completed'?'ss-completed':sys==='Active'?'ss-active':'ss-pending';
    var priCls='pri-'+t.priority.toLowerCase();
    var isDone=t.progress==='Completed';
    var meta=state.MEMBERS[t.assignee]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    h+='<tr class="'+(isDone?'row-completed':'')+'">'+
      '<td><div class="adhoc-task-name'+(isDone?' strikethrough':'')+'">'+escHtml(t.name)+'</div>'+(t.description?'<div class="adhoc-desc">'+escHtml(t.description)+'</div>':'')+'</td>'+
      '<td style="max-width:200px;font-size:12px;color:var(--text3)">'+(t.description?escHtml(t.description.substring(0,50))+(t.description.length>50?'...':''):'—')+'</td>'+
      '<td><span class="assignee-chip" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(t.assignee)+'</span></td>'+
      '<td><span class="pri-badge '+priCls+'">'+t.priority+'</span></td>'+
      '<td style="font-family:var(--mono);font-size:11px">'+t.endDate.split('-').reverse().join('/')+'</td>'+
      '<td><span class="days-badge '+daysCls+'">'+daysStr+'</span></td>'+
      '<td><span class="sys-status '+sysCls+'">'+sys+'</span>'+(sys==='Failed'&&!isDone?'<div style="font-size:9px;color:var(--red);font-weight:700;margin-top:2px">TASK FAILED</div>':'')+'</td>'+
      '<td><select class="prog-select" onchange="adhocChangeProgress(\''+t.id+'\',this.value)">'+
        ['Pending','In Progress','Completed','Confusion'].map(function(s){return'<option value="'+s+'"'+(t.progress===s?' selected':'')+'>'+s+'</option>'}).join('')+
      '</select></td>'+
      '<td><div class="action-cell">'+
        '<button class="action-btn" onclick="adhocEditTask(\''+t.id+'\')">✏️</button>'+
        '<button class="action-btn delete" onclick="adhocDeleteTask(\''+t.id+'\')">✕</button>'+
      '</div></td></tr>';
  });
  document.getElementById('adhocTableBody').innerHTML=h||'<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text3)">No adhoc tasks yet. Click "+ Add New Adhoc Task" to get started.</td></tr>';
}

// CRUD
export function adhocChangeProgress(id,val){
  var t=adhocTasks.find(function(x){return x.id===id});
  if(!t)return;
  t.progress=val;t.sysStatus=adhocGetSysStatus(t);
  adhocSaveToFirestore();
  if(isInternUser())internRender();else adhocRender();
  showToast(t.name+' → '+val);
}
export function adhocDeleteTask(id){
  if(!confirm('Delete this task?'))return;
  adhocTasks=adhocTasks.filter(function(t){return t.id!==id});
  adhocSaveToFirestore();adhocRender();showToast('Task deleted','error');
}
function adhocPopulateAssignees(selectedVal){
  var sel=document.getElementById('fAdhocAssignee');sel.innerHTML='';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  if(selectedVal)sel.value=selectedVal;
}
export function adhocEditTask(id){
  var t=adhocTasks.find(function(x){return x.id===id});
  if(!t)return;
  adhocEditId=id;
  document.getElementById('adhocModalTitle').textContent='Edit Adhoc Task';
  document.getElementById('fAdhocName').value=t.name;
  document.getElementById('fAdhocDesc').value=t.description||'';
  adhocPopulateAssignees(t.assignee);
  document.getElementById('fAdhocPriority').value=t.priority;
  document.getElementById('fAdhocEndDate').value=t.endDate;
  document.getElementById('fAdhocProgress').value=t.progress;
  document.getElementById('adhocModalOverlay').classList.add('open');
}

// MODAL
export function adhocOpenModal(){
  adhocEditId=null;
  document.getElementById('adhocModalTitle').textContent='Add Adhoc Task';
  document.getElementById('fAdhocName').value='';
  document.getElementById('fAdhocDesc').value='';
  document.getElementById('fAdhocPriority').value='Medium';
  document.getElementById('fAdhocEndDate').value='';
  document.getElementById('fAdhocProgress').value='Pending';
  adhocPopulateAssignees('');
  document.getElementById('adhocModalOverlay').classList.add('open');
}
export function adhocCloseModal(){document.getElementById('adhocModalOverlay').classList.remove('open');adhocEditId=null}
export async function adhocSaveTask(){
  var name=document.getElementById('fAdhocName').value.trim();
  var endDate=document.getElementById('fAdhocEndDate').value;
  if(!name){showToast('Task name required','error');return}
  if(!endDate){showToast('End date required','error');return}
  var task={
    name:name,
    description:document.getElementById('fAdhocDesc').value.trim(),
    assignee:document.getElementById('fAdhocAssignee').value,
    priority:document.getElementById('fAdhocPriority').value,
    endDate:endDate,
    progress:document.getElementById('fAdhocProgress').value,
    createdAt:new Date().toISOString()
  };
  task.sysStatus=adhocGetSysStatus(task);
  if(adhocEditId){
    var idx=adhocTasks.findIndex(function(t){return t.id===adhocEditId});
    if(idx>=0){task.id=adhocEditId;task.createdAt=adhocTasks[idx].createdAt;adhocTasks[idx]=task;showToast('Task updated')}
  }else{
    task.id='adhoc_'+Date.now();adhocTasks.push(task);showToast('Task added');
  }
  await adhocSaveToFirestore();adhocCloseModal();adhocRender();
}

// EXPORT
export function adhocExport(){
  var csv=[['Task Name','Description','Assigned To','Priority','End Date','Days Remaining','System Status','Progress']];
  adhocTasks.forEach(function(t){
    var days=adhocDaysRemaining(t.endDate);
    var daysStr=days<0?-days+' days overdue':days+' days left';
    csv.push(['"'+(t.name||'').replace(/"/g,'""')+'"','"'+(t.description||'').replace(/"/g,'""')+'"',t.assignee,t.priority,t.endDate,daysStr,t.sysStatus,t.progress]);
  });
  var b=new Blob(['﻿'+csv.map(function(r){return r.join(',')}).join('\n')],{type:'text/csv'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='FlowPilotAI_AdhocTasks_'+new Date().toISOString().split('T')[0]+'.csv';a.click();showToast('Exported!');
}
