// ============================================================
// DAILY TASKS
// Ported from the original monolith's DAILY TASKS section.
// The original hardcoded template assignees (real former team members)
// have been swapped for the fictional roster in src/data/demoSeed.js,
// using the same 1:1 name mapping the seed data's color assignments
// already imply (see DEFAULT_MEMBERS in demoSeed.js).
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { escHtml, showToast } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';
import { updateTabBadges } from '../main.js';
import { isInternUser, internRender } from './interns.js';

var dtTasks=[];
var dtEditId=null;
var dtSaving=false;
var unsubscribeDaily=null;
var dtMidnightTimer=null;

export function getDtTasks(){return dtTasks}

// Daily task templates — these are the permanent tasks that reset every day
var DT_TEMPLATE=[
  {id:'DA-01',name:'One on One daily Msg Linkedin from Riya id',section:'General',assignee:'Riya'},
  {id:'DA-02',name:'Daily Email to all the audience',section:'General',assignee:'Jordan'},
  {id:'DA-03',name:'Facebook Group Posting',section:'General',assignee:'Jordan'},
  {id:'DA-04',name:'Linkedin Group Posting',section:'General',assignee:'Jordan'},
  {id:'DA-05',name:'Daily Post on Social Media | Linkedin',section:'General',assignee:'Jordan'},
  {id:'DA-06',name:'Daily Post on Social Media | Instagram',section:'General',assignee:'Jordan'},
  {id:'DA-07',name:'Daily Post on Social Media | Facebook',section:'General',assignee:'Jordan'},
  {id:'DA-08',name:'One on One daily Msg Linkedin | Sam',section:'General',assignee:'Sam'},
  {id:'DA-09',name:'One on One daily Msg Linkedin from Jordan',section:'General',assignee:'Jordan'},
  {id:'DA-10',name:'One on One daily Msg Linkedin from Priya',section:'General',assignee:'Priya'},
  {id:'DA-11',name:'Daily Post on Social Media | Linkedin',section:'General',assignee:'Priya'},
  {id:'DA-12',name:'Linkedin Group Posting',section:'General',assignee:'Priya'},
  {id:'DA-13',name:'Daily Post on Social Media | Linkedin',section:'General',assignee:'Sam'},
  {id:'DA-14',name:'Linkedin Group Posting',section:'General',assignee:'Sam'}
];

function dtIsMemberActive(name){return !name||!!state.MEMBERS[name]}
function dtSanitizeTasks(){
  var changed=false;
  dtTasks=dtTasks.filter(function(t){
    if(t.templateId){
      var tpl=DT_TEMPLATE.find(function(x){return x.id===t.templateId});
      if(tpl&&tpl.assignee&&!dtIsMemberActive(tpl.assignee)){changed=true;return false}
    }
    if(t.assignee&&!dtIsMemberActive(t.assignee)){t.assignee='';changed=true}
    return true;
  });
  return changed;
}

// Used by tasks.js's removeMember() — filters out (or unassigns) daily
// tasks belonging to a team member who was just removed. Kept as a plain
// synchronous export so callers can control exactly when the save happens
// (mirrors the original inline logic in removeMember()).
export function dtFilterOutMember(name){
  dtTasks=dtTasks.filter(function(t){
    if(t.templateId){
      var tpl=DT_TEMPLATE.find(function(x){return x.id===t.templateId});
      if(tpl&&tpl.assignee===name)return false;
    }
    if(t.assignee===name)t.assignee='';
    return true;
  });
}

function dtTodayStr(){return new Date().toISOString().split('T')[0]}

// Firestore key — daily tasks are per-date so they auto reset when date changes
function dtFirestoreKey(){return 'daily_'+dtTodayStr()}

export async function dtSaveToFirestore(){
  if(dtSaving)return;dtSaving=true;syncStart();
  try{
    await setDoc(doc(db,'appdata',dtFirestoreKey()),{data:dtTasks,date:dtTodayStr()});
    syncDone();
  }catch(e){
    syncError('Daily save failed');
    try{localStorage.setItem('eg9_daily_'+dtTodayStr(),JSON.stringify(dtTasks))}catch(x){}
  }finally{dtSaving=false}
}

export async function dtLoadFromFirestore(){
  var today=dtTodayStr();
  try{
    var snap=await getDoc(doc(db,'appdata',dtFirestoreKey()));
    if(snap.exists()&&snap.data().date===today){
      var loaded=snap.data().data||[];
      // Force reset if task count doesn't match template (template was updated)
      if(loaded.length>0&&loaded.filter(function(t){return t.templateId}).length>0){
        var templateIds=DT_TEMPLATE.map(function(t){return t.id});
        var hasAllTemplates=templateIds.every(function(id){return loaded.some(function(t){return t.templateId===id})});
        if(hasAllTemplates){dtTasks=loaded;if(dtSanitizeTasks())await dtSaveToFirestore();return;}
      }else if(loaded.length>0){
        dtTasks=loaded;if(dtSanitizeTasks())await dtSaveToFirestore();return;
      }
    }
  }catch(e){
    try{var d=localStorage.getItem('eg9_daily_'+today);if(d){dtTasks=JSON.parse(d);return}}catch(x){}
  }
  // Seed fresh from updated template
  dtTasks=DT_TEMPLATE.filter(function(t){return dtIsMemberActive(t.assignee)}).map(function(t){
    return{id:t.id+'_'+today,templateId:t.id,name:t.name,note:'',assignee:t.assignee,section:'General',done:false,createdAt:new Date().toISOString()};
  });
  await dtSaveToFirestore();
}

export function dtStartListener(){
  if(unsubscribeDaily)unsubscribeDaily();
  unsubscribeDaily=onSnapshot(doc(db,'appdata',dtFirestoreKey()),function(snap){
    if(snap.exists()&&snap.data().date===dtTodayStr()&&!dtSaving){
      var d=snap.data().data||[];
      if(!d.length&&dtTasks.length)return;
      dtTasks=d;
      if(isInternUser())internRender();
      else if(document.getElementById('panelDaily').classList.contains('active'))dtRender();
    }
  },function(){});
}

export function dtStopListener(){if(unsubscribeDaily){unsubscribeDaily();unsubscribeDaily=null}}
export function dtStopMidnightTimer(){if(dtMidnightTimer){clearTimeout(dtMidnightTimer);dtMidnightTimer=null}}

// MIDNIGHT RESET — schedule reset at 12:00 AM every day
export function dtScheduleMidnightReset(){
  if(dtMidnightTimer)clearTimeout(dtMidnightTimer);
  var now=new Date();
  var midnight=new Date(now);
  midnight.setDate(midnight.getDate()+1);
  midnight.setHours(0,0,0,0);
  var msUntilMidnight=midnight-now;
  dtMidnightTimer=setTimeout(async function(){
    // Reset tasks for new day
    await dtLoadFromFirestore();
    // restart listener for new day's key
    dtStartListener();
    // re-render if on daily tab
    if(document.getElementById('panelDaily').classList.contains('active'))dtRender();
    showToast('Daily tasks reset for new day! 🌅');
    // Schedule next reset
    dtScheduleMidnightReset();
  },msUntilMidnight);
}

function dtRenderAssigneeProgress(){
  var members=getTeamMembers();
  var h='<div style="font-weight:600;font-size:14px;margin-bottom:12px;color:var(--text)">Progress by Assignee</div><div class="assignee-progress-grid">';
  members.forEach(function(name){
    var tasks=dtTasks.filter(function(t){return t.assignee===name});
    if(!tasks.length)return;
    var meta=state.MEMBERS[name]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var total=tasks.length;
    var done=tasks.filter(function(t){return t.done}).length;
    var pending=total-done;
    var pct=total?Math.round(done/total*100):0;
    h+='<div class="ap-card">'+
      '<div class="ap-card-name"><div class="avatar" style="background:'+meta.bg+';color:'+meta.color+';width:24px;height:24px;font-size:11px">'+name[0]+'</div>'+name+'</div>'+
      '<div class="ap-card-stats" style="font-size:12px;color:var(--text2);line-height:2">'+
        'Total: <strong>'+total+'</strong><br>'+
        'Done: <strong style="color:var(--green)">'+done+'</strong><br>'+
        'Pending: <strong style="color:var(--red)">'+pending+'</strong>'+
      '</div>'+
      '<div class="ap-card-bar"><div class="ap-card-fill" style="width:'+pct+'%;background:'+(pct===100?'var(--green)':'var(--brand)')+'"></div></div>'+
      '<div class="ap-card-pct">'+pct.toFixed(1)+'%</div>'+
    '</div>';
  });
  h+='</div>';
  return h;
}

export function dtRender(){
  document.getElementById('dtDateDisplay').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  var total=dtTasks.length,done=dtTasks.filter(function(t){return t.done}).length,pending=total-done,prog=Math.round((done/Math.max(total,1))*100);
  document.getElementById('dtStats').innerHTML=
    '<div class="dt-stat dst-total"><div class="stat-label">Total Tasks</div><div class="stat-value">'+total+'</div></div>'+
    '<div class="dt-stat dst-done"><div class="stat-label">Completed</div><div class="stat-value">'+done+'</div></div>'+
    '<div class="dt-stat dst-pending"><div class="stat-label">Pending</div><div class="stat-value">'+pending+'</div></div>'+
    '<div class="dt-stat dst-progress"><div class="stat-label">Progress</div><div class="stat-value">'+prog+'%</div></div>';

  // Progress by Assignee section
  var assigneeHtml='<div class="adhoc-progress-section" style="margin-bottom:20px">'+dtRenderAssigneeProgress()+'</div>';

  // Flat task list — no section grouping
  var h='<div class="dt-section"><div class="dt-section-header" style="border-left:3px solid var(--brand)">'+
    '<span class="dt-section-title">📋 All Daily Tasks</span>'+
    '<span class="dt-section-count">'+done+'/'+total+'</span>'+
    '<button class="dt-add-btn" onclick="dtOpenModal()">+ Add Task</button></div>';

  if(!dtTasks.length){h+='<div class="dt-empty">No tasks. Click "+ Add Task" to get started.</div>'}
  else{
    dtTasks.forEach(function(t){
      var meta=state.MEMBERS[t.assignee]||{color:'#999',bg:'rgba(150,150,150,.1)'};
      h+='<div class="dt-task-row">'+
        '<input type="checkbox" class="dt-checkbox" '+(t.done?'checked':'')+' onchange="dtToggle(\''+t.id+'\',this.checked)">'+
        '<div style="flex:1"><div class="dt-task-name'+(t.done?' done':'')+'">'+escHtml(t.name)+'</div>'+(t.note?'<div class="dt-task-note">💬 '+escHtml(t.note)+'</div>':'')+'</div>'+
        (t.assignee?'<span class="dt-task-assignee" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(t.assignee)+'</span>':'')+
        '<div class="dt-task-actions">'+
          '<button class="action-btn" onclick="dtEdit(\''+t.id+'\')">✏️</button>'+
          '<button class="action-btn delete" onclick="dtDelete(\''+t.id+'\')">✕</button>'+
        '</div></div>';
    });
  }
  h+='</div>';
  document.getElementById('dtSections').innerHTML=assigneeHtml+h;
  updateTabBadges();
}

export async function dtToggle(id,checked){
  var t=dtTasks.find(function(x){return x.id===id});
  if(!t)return;
  t.done=checked;t.doneAt=checked?new Date().toISOString():null;
  await dtSaveToFirestore();
  if(isInternUser())internRender();else dtRender();
}
export function dtDelete(id){
  if(!confirm('Delete this task? It will come back tomorrow on reset.'))return;
  dtTasks=dtTasks.filter(function(x){return x.id!==id});
  dtSaveToFirestore();dtRender();showToast('Deleted','error');
}
export function dtEdit(id){
  var t=dtTasks.find(function(x){return x.id===id});if(!t)return;
  dtEditId=id;
  document.getElementById('dtModalTitle').textContent='Edit Daily Task';
  document.getElementById('fDtName').value=t.name;
  document.getElementById('fDtNote').value=t.note||'';
  var sel=document.getElementById('fDtAssignee');sel.innerHTML='<option value="">— None —</option>';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  sel.value=t.assignee||'';
  document.getElementById('dtModalOverlay').classList.add('open');
}
export function dtOpenModal(){
  dtEditId=null;
  document.getElementById('dtModalTitle').textContent='Add Daily Task';
  document.getElementById('fDtName').value='';
  document.getElementById('fDtNote').value='';
  var sel=document.getElementById('fDtAssignee');sel.innerHTML='<option value="">— None —</option>';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  sel.value=(state.currentUser&&state.currentUser.displayName)||'';
  document.getElementById('dtModalOverlay').classList.add('open');
}
export function dtOpenModalSection(sec){dtOpenModal()}
export function dtCloseModal(){document.getElementById('dtModalOverlay').classList.remove('open');dtEditId=null}
export async function dtSaveTask(){
  var name=document.getElementById('fDtName').value.trim();
  if(!name){showToast('Task name required','error');return}
  var task={name:name,note:document.getElementById('fDtNote').value.trim(),assignee:document.getElementById('fDtAssignee').value,section:'General',done:false,createdAt:new Date().toISOString()};
  if(dtEditId){
    var idx=dtTasks.findIndex(function(t){return t.id===dtEditId});
    if(idx>=0){task.id=dtEditId;task.done=dtTasks[idx].done;task.createdAt=dtTasks[idx].createdAt;task.templateId=dtTasks[idx].templateId;dtTasks[idx]=task;showToast('Updated')}
  }else{
    task.id='dt_'+Date.now();dtTasks.push(task);showToast('Task added');
  }
  await dtSaveToFirestore();dtCloseModal();dtRender();
}
