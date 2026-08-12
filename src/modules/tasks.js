// ============================================================
// MEMBERS & SECTION CONFIG, TASK MANAGEMENT TEMPLATE & STATE,
// FIRESTORE SAVE/LOAD, COURSE, TEAM, EXPORT, ASSETS, STATS,
// FILTER, TABLE (+ kanban/timeline/calendar/drag-drop)
// Ported from the original monolith's task-management sections.
// `MEMBERS` now lives on the shared `state` object; `getTeamMembers` is
// imported from state.js instead of being redefined here.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot, writeBatch } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { DEFAULT_MEMBERS, MEMBER_COLORS, DEMO_COURSE_NAME, generateDemoTemplate, demoCourseTasks } from '../data/demoSeed.js';
import { showToast, escHtml, formatDate, dueClass, statusBadge, prioBadge, memberChip, avatarEl, colorToBg, today } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';
import { dtFilterOutMember, dtSaveToFirestore, dtRender } from './dailyTasks.js';
import { tmRenderTeam } from './timeManagement.js';
import { updateThemeBtn, updateTabBadges, closeMobileSidebar } from '../main.js';

// ============================================================
// MEMBERS & SECTION CONFIG
// ============================================================
export function nextColor(){var used=Object.values(state.MEMBERS).map(function(m){return m.color});for(var i=0;i<MEMBER_COLORS.length;i++){if(used.indexOf(MEMBER_COLORS[i])===-1)return MEMBER_COLORS[i]}return MEMBER_COLORS[Object.keys(state.MEMBERS).length%MEMBER_COLORS.length]}
var SECTION_META={'pre-launch':{label:'Pre Launch',color:'var(--brand)',cls:'section-prelaunch'},'sales':{label:'Sales Assets',color:'var(--blue)',cls:'section-sales'},'masterclass':{label:'Masterclass-1',color:'var(--purple)',cls:'section-masterclass'},'one-on-one':{label:'One on One Call',color:'var(--red)',cls:''},'batch':{label:'Batch Management',color:'var(--red)',cls:'section-batch'}};

// ============================================================
// TASK MANAGEMENT — TEMPLATE & STATE
// ============================================================
function generateTemplate(C){return generateDemoTemplate(C)}

var allCourses={},activeCourse='',editingId=null,currentSection='all',currentView='table';
var calMonth=new Date().getMonth(),calYear=new Date().getFullYear();
var sectionAssets={};
var unsubscribeListener=null;
var unsubscribeMembersListener=null;
var isSaving=false;
var membersSaving=false;
var coursesLoadOk=false,coursesDocExists=false;
var membersLoadOk=false,membersDocExists=false;
var membersUpdatedAtMs=0;

export async function saveMembers(opts){
  opts=opts||{};
  if(!opts.allowEmpty&&!Object.keys(state.MEMBERS).length){syncError('Blocked empty team write');return false}
  if(membersSaving)return false;membersSaving=true;syncStart();
  try{
    var nowIso=new Date().toISOString();
    membersUpdatedAtMs=Date.parse(nowIso)||Date.now();
    await setDoc(doc(db,'appdata','members'),{data:state.MEMBERS,updatedAt:nowIso});
    try{await setDoc(doc(db,'appdata','members_backup'),{data:state.MEMBERS,backedUpAt:new Date().toISOString()})}catch(b){}
    try{localStorage.setItem('eg7_members',JSON.stringify(state.MEMBERS))}catch(x){}
    syncDone();return true;
  }catch(e){
    syncError('Team save failed: '+e.message);
    try{localStorage.setItem('eg7_members',JSON.stringify(state.MEMBERS))}catch(x){}
    return false;
  }finally{membersSaving=false}
}

// FIRESTORE SAVE/LOAD — coursesLoadOk blocks auto-seed on failed/empty reads
export async function saveData(opts){
  opts=opts||{};
  if(!opts.allowEmpty&&!Object.keys(allCourses).length){syncError('Blocked empty courses write');return false}
  if(isSaving)return false;isSaving=true;syncStart();
  try{
    var batch=writeBatch(db);
    batch.set(doc(db,'appdata','courses'),{data:allCourses,updatedAt:new Date().toISOString()});
    batch.set(doc(db,'appdata','assets'),{data:sectionAssets});
    try{batch.set(doc(db,'appdata','courses_backup'),{data:allCourses,backedUpAt:new Date().toISOString()})}catch(b){}
    localStorage.setItem('eg7_active_'+state.currentUser.username,activeCourse);
    await batch.commit();syncDone();return true;
  }catch(e){
    syncError('Save failed: '+e.message);
    try{localStorage.setItem('eg7_courses',JSON.stringify(allCourses));localStorage.setItem('eg7_assets',JSON.stringify(sectionAssets))}catch(x){}
    return false;
  }finally{isSaving=false}
}
export async function loadData(){
  coursesLoadOk=false;coursesDocExists=false;membersLoadOk=false;membersDocExists=false;
  for(var attempt=0;attempt<3;attempt++){
    try{
      var [cs,ms,as]=await Promise.all([getDoc(doc(db,'appdata','courses')),getDoc(doc(db,'appdata','members')),getDoc(doc(db,'appdata','assets'))]);
      coursesLoadOk=true;membersLoadOk=true;
      if(cs.exists()){coursesDocExists=true;allCourses=cs.data().data||{}}
      if(ms.exists()){
        membersDocExists=true;
        var msd=ms.data()||{};
        var remoteMembersTs=Date.parse(msd.updatedAt||'')||0;
        if(remoteMembersTs>membersUpdatedAtMs)membersUpdatedAtMs=remoteMembersTs;
        var md=msd.data;
        if(md&&Object.keys(md).length)state.MEMBERS=md;
      }
      if(as.exists())sectionAssets=as.data().data||{};
      try{if(Object.keys(allCourses).length)localStorage.setItem('eg7_courses',JSON.stringify(allCourses))}catch(x){}
      try{if(Object.keys(state.MEMBERS).length)localStorage.setItem('eg7_members',JSON.stringify(state.MEMBERS))}catch(x){}
      break;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,800*(attempt+1))});continue}
      coursesLoadOk=false;membersLoadOk=false;
      try{var c=localStorage.getItem('eg7_courses');if(c)allCourses=JSON.parse(c);var mb=localStorage.getItem('eg7_members');if(mb)state.MEMBERS=JSON.parse(mb);var sa=localStorage.getItem('eg7_assets');if(sa)sectionAssets=JSON.parse(sa)}catch(x){}
      showToast('Loaded from cache (offline)','error');
    }
  }
  if(membersLoadOk&&membersDocExists&&!Object.keys(state.MEMBERS).length){
    try{
      var mbk=await getDoc(doc(db,'appdata','members_backup'));
      if(mbk.exists()){
        var mbd=mbk.data().data||{};
        if(Object.keys(mbd).length){state.MEMBERS=mbd;showToast('Restored team from backup','error');await saveMembers()}
      }
    }catch(re){}
  }
  if(coursesLoadOk&&coursesDocExists&&!Object.keys(allCourses).length){
    try{
      var bk=await getDoc(doc(db,'appdata','courses_backup'));
      if(bk.exists()){
        var bd=bk.data().data||{};
        if(Object.keys(bd).length){allCourses=bd;showToast('Restored courses from backup','error');await saveData()}
      }
    }catch(re){}
  }
  await initDefaultMembers();
  await initDefaultCourses();
  var savedActive=localStorage.getItem('eg7_active_'+(state.currentUser?state.currentUser.username:''));
  if(savedActive&&allCourses[savedActive])activeCourse=savedActive;
  else if(!activeCourse||!allCourses[activeCourse])activeCourse=Object.keys(allCourses)[0]||'';
  Object.values(allCourses).forEach(function(ts){ts.forEach(function(t){if(!t.priority)t.priority='';if(!t.notes)t.notes='';if(!t.blockedBy)t.blockedBy=''})});
  updateThemeBtn();
}
async function initDefaultMembers(){
  if(!membersLoadOk)return;
  if(membersDocExists)return;
  if(Object.keys(state.MEMBERS).length)return;
  state.MEMBERS=JSON.parse(JSON.stringify(DEFAULT_MEMBERS));
  await saveMembers();
}
async function initDefaultCourses(){
  if(!coursesLoadOk)return;
  if(coursesDocExists)return;
  if(Object.keys(allCourses).length)return;
  allCourses[DEMO_COURSE_NAME]=demoCourseTasks();
  activeCourse=DEMO_COURSE_NAME;
  await saveData();
}
export function startLiveListener(){
  if(unsubscribeListener)unsubscribeListener();
  unsubscribeListener=onSnapshot(doc(db,'appdata','courses'),function(snap){
    if(snap.exists()&&!isSaving){
      var d=snap.data().data||{};
      if(!Object.keys(d).length)return;
      allCourses=d;
      if(!activeCourse||!allCourses[activeCourse])activeCourse=Object.keys(allCourses)[0];
      renderAll();
    }
  },function(err){});
}
export function startMembersListener(){
  if(unsubscribeMembersListener)unsubscribeMembersListener();
  unsubscribeMembersListener=onSnapshot(doc(db,'appdata','members'),function(snap){
    if(snap.exists()&&!membersSaving){
      var sd=snap.data()||{};
      var remoteTs=Date.parse(sd.updatedAt||'')||0;
      if(!remoteTs&&membersUpdatedAtMs>0)return;
      if(remoteTs&&remoteTs<membersUpdatedAtMs)return;
      if(remoteTs)membersUpdatedAtMs=remoteTs;
      var d=sd.data||{};
      if(!Object.keys(d).length&&Object.keys(state.MEMBERS).length)return;
      state.MEMBERS=d;
      try{localStorage.setItem('eg7_members',JSON.stringify(state.MEMBERS))}catch(x){}
      renderAll();
      if(document.getElementById('panelDaily').classList.contains('active'))dtRender();
      if(document.getElementById('panelTime').classList.contains('active'))tmRenderTeam();
    }
  },function(){});
}
export function getTasks(){return allCourses[activeCourse]||[]}
export function setTasks(t){allCourses[activeCourse]=t;saveData()}
export function getActiveCourse(){return activeCourse}

export function stopCourseListener(){if(unsubscribeListener){unsubscribeListener();unsubscribeListener=null}}
export function stopMembersListener(){if(unsubscribeMembersListener){unsubscribeMembersListener();unsubscribeMembersListener=null}}

// COURSE
export function renderCourseSel(){var sel=document.getElementById('courseSel');sel.innerHTML='';Object.keys(allCourses).forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n;if(n===activeCourse)o.selected=true;sel.appendChild(o)})}
export function switchCourse(n){activeCourse=n;localStorage.setItem('eg7_active_'+state.currentUser.username,n);renderAll()}
export function openCourseModal(){document.getElementById('fCourseName').value='';document.getElementById('courseModalOverlay').classList.add('open')}
export function closeCourseModal(){document.getElementById('courseModalOverlay').classList.remove('open')}
export function addCourse(){var n=document.getElementById('fCourseName').value.trim();if(!n){showToast('Enter name','error');return}if(allCourses[n]){showToast('Exists','error');return}allCourses[n]=generateTemplate(n);activeCourse=n;saveData();closeCourseModal();renderAll();showToast('"'+n+'" created')}
export function duplicateCourse(){var nn=prompt('New name (clone of "'+activeCourse+'"):');if(!nn||!nn.trim())return;nn=nn.trim();if(allCourses[nn]){showToast('Exists','error');return}allCourses[nn]=JSON.parse(JSON.stringify(getTasks()));allCourses[nn].forEach(function(t){t.name=t.name.replace(activeCourse,nn)});if(sectionAssets[activeCourse])sectionAssets[nn]=JSON.parse(JSON.stringify(sectionAssets[activeCourse]));activeCourse=nn;saveData();renderAll();showToast('"'+nn+'" cloned')}
export function deleteCourse(){if(Object.keys(allCourses).length<=1){showToast('Last course','error');return}if(!confirm('Delete "'+activeCourse+'"?'))return;delete allCourses[activeCourse];delete sectionAssets[activeCourse];activeCourse=Object.keys(allCourses)[0];saveData();renderAll();showToast('Deleted')}

// TEAM
export function openTeamModal(){document.getElementById('fMemberName').value='';document.getElementById('fMemberColor').value=nextColor();document.getElementById('teamModalOverlay').classList.add('open')}
export function closeTeamModal(){document.getElementById('teamModalOverlay').classList.remove('open')}
export function addMember(){var n=document.getElementById('fMemberName').value.trim();if(!n){showToast('Name','error');return}if(state.MEMBERS[n]){showToast('Exists','error');return}var c=document.getElementById('fMemberColor').value;state.MEMBERS[n]={color:c,bg:colorToBg(c)};saveMembers().then(function(){closeTeamModal();renderAll();if(document.getElementById('panelDaily').classList.contains('active'))dtRender();showToast(n+' added')})}
export function openRemoveTeamModal(){var sel=document.getElementById('fRemoveMember');sel.innerHTML='';Object.keys(state.MEMBERS).forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n;sel.appendChild(o)});document.getElementById('removeTeamModalOverlay').classList.add('open')}
export function closeRemoveTeamModal(){document.getElementById('removeTeamModalOverlay').classList.remove('open')}
export function removeMember(){
  var n=document.getElementById('fRemoveMember').value;
  if(!n)return;
  if(!confirm('Remove '+n+'?'))return;
  delete state.MEMBERS[n];
  dtFilterOutMember(n);
  saveMembers().then(async function(){
    await dtSaveToFirestore();
    closeRemoveTeamModal();renderAll();if(document.getElementById('panelDaily').classList.contains('active'))dtRender();showToast(n+' removed')
  })
}

// EXPORT
export function exportExcel(){var ts=getTasks(),rows=[['ID','Task','Section','Due','Status','Priority','Assignee','Reviewer','Blocked By','Notes']];ts.forEach(function(t){rows.push([t.id,'"'+t.name.replace(/"/g,'""')+'"',t.section,t.due,t.status,t.priority,'"'+t.assignee+'"',t.reviewer,t.blockedBy,'"'+(t.notes||'').replace(/"/g,'""')+'"'])});var csv=rows.map(function(r){return r.join(',')}).join('\n');var b=new Blob(['﻿'+csv],{type:'text/csv'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=activeCourse.replace(/[^a-zA-Z0-9]/g,'_')+'_tasks.csv';a.click();showToast('Exported')}

// ASSETS
var assetEditSection='';
function getAssets(s){if(!sectionAssets[activeCourse])sectionAssets[activeCourse]={};if(!sectionAssets[activeCourse][s])sectionAssets[activeCourse][s]=[];return sectionAssets[activeCourse][s]}
export function openAssetModal(s){assetEditSection=s;document.getElementById('fAssetName').value='';document.getElementById('fAssetUrl').value='';document.getElementById('fAssetType').value='gdrive';document.getElementById('assetModalTitle').textContent='Add Asset — '+SECTION_META[s].label;document.getElementById('assetModalOverlay').classList.add('open')}
export function closeAssetModal(){document.getElementById('assetModalOverlay').classList.remove('open')}
export function saveAsset(){var n=document.getElementById('fAssetName').value.trim(),u=document.getElementById('fAssetUrl').value.trim(),ty=document.getElementById('fAssetType').value;if(!n||!u){showToast('Required','error');return}if(!u.startsWith('http'))u='https://'+u;getAssets(assetEditSection).push({name:n,url:u,type:ty});saveData();closeAssetModal();renderAll();showToast('Link added')}
export function removeAsset(s,i){if(!confirm('Remove?'))return;getAssets(s).splice(i,1);saveData();renderAll()}
function assetIcon(t){return t==='gdrive'?'📁':t==='onedrive'?'☁️':'🔗'}
function renderSectionAssets(s){var a=getAssets(s),h='<div class="sec-assets">';a.forEach(function(x,i){h+='<a class="sec-asset-link" href="'+encodeURI(x.url)+'" target="_blank" rel="noopener"><span>'+assetIcon(x.type)+'</span>'+escHtml(x.name)+'<span class="asset-rm" onclick="event.preventDefault();event.stopPropagation();removeAsset(\''+s+'\','+i+')">✕</span></a>'});h+='<button class="sec-asset-add" onclick="event.stopPropagation();openAssetModal(\''+s+'\')">+ Add Link</button></div>';return h}

// STATS
export function renderStats(){
  var ts=getTasks(),f=getFiltered(),total=f.length,done=f.filter(function(t){return t.status==='Done'}).length,wip=f.filter(function(t){return t.status==='WIP'}).length,pending=f.filter(function(t){return t.status==='Pending'}).length,overdue=f.filter(function(t){return t.status!=='Done'&&t.due&&t.due<today()}).length;
  document.getElementById('statsRow').innerHTML='<div class="stat-card total"><div class="stat-label">Total</div><div class="stat-value">'+total+'</div><div class="stat-sub">in view</div></div><div class="stat-card done"><div class="stat-label">Done</div><div class="stat-value">'+done+'</div><div class="stat-sub">'+(total?Math.round(done/total*100):0)+'%</div></div><div class="stat-card wip"><div class="stat-label">WIP</div><div class="stat-value">'+wip+'</div><div class="stat-sub">active</div></div><div class="stat-card pending"><div class="stat-label">Pending</div><div class="stat-value">'+pending+'</div><div class="stat-sub">todo</div></div><div class="stat-card overdue"><div class="stat-label">Overdue</div><div class="stat-value">'+overdue+'</div><div class="stat-sub">past due</div></div>';
  var ad=ts.filter(function(t){return t.status==='Done'}).length,pct=ts.length?Math.round(ad/ts.length*100):0;
  document.getElementById('progressPct').textContent=pct+'%';document.getElementById('progressBar').style.width=pct+'%';document.getElementById('progressTitle').textContent=activeCourse+' — Progress';
  document.getElementById('phasePills').innerHTML=Object.entries(SECTION_META).map(function(e){var k=e[0],m=e[1],st=ts.filter(function(t){return t.section===k}),sd=st.filter(function(t){return t.status==='Done'}).length,sp=st.length?Math.round(sd/st.length*100):0;return'<span class="phase-pill '+(currentSection===k?'active':'')+'" onclick="filterSection(\''+k+'\',null)">'+m.label+' '+sp+'%</span>'}).join('');
}
export function renderSidebarMembers(){
  var ts=getTasks(),c={};ts.forEach(function(t){(t.assignee||'').split(',').forEach(function(n){n=n.trim();if(n)c[n]=(c[n]||0)+1})});
  document.getElementById('memberList').innerHTML=Object.keys(state.MEMBERS).map(function(n){return'<div class="member-chip" onclick="filterByMember(\''+n+'\')">'+avatarEl(n)+'<span class="member-name">'+escHtml(n)+'</span><span class="member-count">'+(c[n]||0)+'</span></div>'}).join('');
  var sel=document.getElementById('assigneeFilter'),cv=sel.value;sel.innerHTML='<option value="all">All Assignees</option>';Object.keys(state.MEMBERS).forEach(function(n){var o=document.createElement('option');o.value=n;o.textContent=n;sel.appendChild(o)});sel.value=cv||'all';
}

// FILTER
export function getFiltered(){var ts=getTasks(),q=document.getElementById('searchBox').value.toLowerCase(),sf=document.getElementById('statusFilter').value,af=document.getElementById('assigneeFilter').value,pf=document.getElementById('priorityFilter').value;return ts.filter(function(t){if(currentSection!=='all'&&t.section!==currentSection)return false;if(sf!=='all'&&t.status!==sf)return false;if(af!=='all'&&!t.assignee.includes(af))return false;if(pf!=='all'&&t.priority!==pf)return false;if(q&&!t.name.toLowerCase().includes(q)&&!t.id.toLowerCase().includes(q)&&!t.assignee.toLowerCase().includes(q)&&!(t.notes||'').toLowerCase().includes(q))return false;return true})}
export function applyFilters(){renderAll()}
export function filterSection(s,el){currentSection=s;document.querySelectorAll('.nav-item').forEach(function(n){n.classList.remove('active')});if(el)el.classList.add('active');else document.querySelectorAll('.nav-item').forEach(function(n){if(s==='all'&&n.textContent.includes('All'))n.classList.add('active');else if(n.textContent.trim().toLowerCase().includes(s.replace('-',' ')))n.classList.add('active')});closeMobileSidebar();renderAll()}
export function filterByMember(n){document.getElementById('assigneeFilter').value=n;applyFilters()}

// TABLE
export function renderTable(){
  var f=getFiltered(),secs=currentSection==='all'?Object.keys(SECTION_META):[currentSection],h='';
  secs.forEach(function(sec){
    var st=f.filter(function(t){return t.section===sec}),m=SECTION_META[sec],dc=st.filter(function(t){return t.status==='Done'}).length;
    h+='<div class="section '+m.cls+'" id="sec-'+sec+'"><div class="section-header" onclick="toggleSection(\'sec-'+sec+'\')"><div style="width:8px;height:8px;border-radius:50%;background:'+m.color+';flex-shrink:0"></div><span class="section-title">'+m.label+'</span><span class="section-count">'+dc+'/'+st.length+'</span><button type="button" class="section-add-btn" onclick="event.stopPropagation();openModalForSection(\''+sec+'\')" title="Add task to '+m.label+'">+ Task</button><span class="section-chevron">▼</span></div><div class="section-body">'+renderSectionAssets(sec);
    if(!st.length)h+='<div class="section-empty">No tasks in this section yet. <button type="button" class="section-add-inline" onclick="openModalForSection(\''+sec+'\')">+ Add first task</button></div>';
    else{
      h+='<table class="task-table"><thead><tr><th style="width:20px"></th><th>ID</th><th>Task</th><th>Due</th><th>Pri</th><th>Assignee</th><th>Status</th><th></th></tr></thead><tbody>';
      st.forEach(function(t){var bl=t.blockedBy?'<span class="dep-badge">⛓'+escHtml(t.blockedBy)+'</span>':'';var nt=t.notes?'<div class="task-note">💬 '+escHtml(t.notes.substring(0,60))+'</div>':'';
        h+='<tr class="task-row" draggable="true" data-id="'+t.id+'" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="drop(event)" ondragend="dragEnd(event)"><td style="cursor:grab;color:var(--text3);font-size:10px">⠿</td><td class="task-id">'+escHtml(t.id)+'</td><td><div class="task-name '+(t.sub?'sub':'')+'">'+(t.sub?'↳ ':'')+escHtml(t.name)+' '+bl+'</div>'+nt+'</td><td><span class="due-date '+dueClass(t.due)+'">'+formatDate(t.due)+'</span></td><td>'+prioBadge(t.priority)+'</td><td><div class="assignee-chips">'+memberChip(t.assignee)+'</div></td><td><select class="status-select status-'+t.status+'" onchange="changeStatus(\''+t.id+'\',this.value)">'+['Done','WIP','Pending','HOLD'].map(function(s){return'<option value="'+s+'"'+(t.status===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></td><td><div class="action-cell"><button class="action-btn" onclick="editTask(\''+t.id+'\')">✏️</button><button class="action-btn delete" onclick="deleteTask(\''+t.id+'\')">✕</button></div></td></tr>'});
      h+='</tbody></table>';
    }
    h+='</div></div>';
  });
  document.getElementById('tableView').innerHTML=h||'<div style="color:var(--text3);padding:40px;text-align:center">No sections to show.</div>';
}
export function dragStart(e){var r=e.target.closest('.task-row');if(r){r.classList.add('dragging');e.dataTransfer.setData('text/plain',r.dataset.id)}}
export function dragOver(e){e.preventDefault();var r=e.target.closest('.task-row');if(r)r.style.borderTop='2px solid var(--brand)'}
export function drop(e){e.preventDefault();var tr=e.target.closest('.task-row');if(!tr)return;tr.style.borderTop='';var sid=e.dataTransfer.getData('text/plain'),ts=getTasks(),si=ts.findIndex(function(t){return t.id===sid}),ti=ts.findIndex(function(t){return t.id===tr.dataset.id});if(si<0||ti<0||si===ti)return;var item=ts.splice(si,1)[0];ts.splice(ti,0,item);setTasks(ts);renderAll()}
export function dragEnd(e){document.querySelectorAll('.task-row').forEach(function(r){r.classList.remove('dragging');r.style.borderTop=''})}
export function renderKanban(){var f=getFiltered(),cols=[{k:'Pending',l:'Pending',c:'var(--red)'},{k:'WIP',l:'In Progress',c:'var(--yellow)'},{k:'Done',l:'Done',c:'var(--green)'},{k:'HOLD',l:'On Hold',c:'var(--purple)'}];document.getElementById('kanbanView').innerHTML=cols.map(function(col){var ct=f.filter(function(t){return t.status===col.k});return'<div class="kanban-col"><div class="kanban-col-header"><div style="width:7px;height:7px;border-radius:50%;background:'+col.c+'"></div><span class="kanban-col-title">'+col.l+'</span><span class="kanban-col-count">'+ct.length+'</span></div>'+ct.map(function(t){return'<div class="kanban-card" style="border-left-color:'+col.c+'" onclick="editTask(\''+t.id+'\')"><div class="kanban-card-name">'+escHtml(t.name)+'</div><div class="kanban-card-meta"><span class="kanban-date">'+formatDate(t.due)+'</span>'+prioBadge(t.priority)+'</div><div style="margin-top:4px">'+memberChip(t.assignee)+'</div></div>'}).join('')+'</div>'}).join('')}
export function renderTimeline(){var f=getFiltered().filter(function(t){return t.due}).sort(function(a,b){return a.due.localeCompare(b.due)});if(!f.length){document.getElementById('timelineView').innerHTML='<div style="color:var(--text3);padding:40px;text-align:center">No dated tasks.</div>';return}document.getElementById('timelineView').innerHTML='<div class="timeline-container">'+f.map(function(t){var m=SECTION_META[t.section],dc=dueClass(t.due),dot=dc==='overdue'?'var(--red)':dc==='soon'?'var(--yellow)':m.color;return'<div class="tl-item"><div class="tl-date">'+formatDate(t.due)+'</div><div class="tl-dot" style="background:'+dot+'"></div><div class="tl-content"><div class="tl-name">'+escHtml(t.name)+'</div><div class="tl-meta"><span style="font-size:10px;color:'+m.color+'">'+m.label+'</span>'+statusBadge(t.status)+prioBadge(t.priority)+(t.assignee?memberChip(t.assignee):'')+'</div></div></div>'}).join('')+'</div>'}
export function renderCalendar(){
  var ts=getFiltered(),fd=new Date(calYear,calMonth,1).getDay(),dim=new Date(calYear,calMonth+1,0).getDate(),dip=new Date(calYear,calMonth,0).getDate();
  var mn=['January','February','March','April','May','June','July','August','September','October','November','December'],dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],td=today();
  var bd={};ts.forEach(function(t){if(t.due)bd[t.due]=(bd[t.due]||[]).concat(t)});
  var h='<div class="cal-header"><div class="cal-nav"><button class="cal-nav-btn" onclick="calMonth--;if(calMonth<0){calMonth=11;calYear--}renderCalendar()">←</button><div class="cal-month">'+mn[calMonth]+' '+calYear+'</div><button class="cal-nav-btn" onclick="calMonth++;if(calMonth>11){calMonth=0;calYear++}renderCalendar()">→</button></div></div><div class="cal-grid">';
  dn.forEach(function(d){h+='<div class="cal-day-header">'+d+'</div>'});
  var sf=fd===0?7:fd;for(var i=sf-1;i>0;i--)h+='<div class="cal-day other-month"><div class="cal-day-num">'+(dip-i+1)+'</div></div>';
  for(var d=1;d<=dim;d++){var ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'),it=ds===td?' today':'',dt=bd[ds]||[];h+='<div class="cal-day'+it+'"><div class="cal-day-num">'+d+'</div>';dt.slice(0,3).forEach(function(t){var bg=t.status==='Done'?'var(--green-bg)':t.status==='WIP'?'var(--yellow-bg)':'var(--red-bg)',co=t.status==='Done'?'var(--green)':t.status==='WIP'?'var(--yellow)':'var(--red)';h+='<div class="cal-task" style="background:'+bg+';color:'+co+'" onclick="editTask(\''+t.id+'\')" title="'+t.name+'">'+t.name.substring(0,18)+'</div>'});if(dt.length>3)h+='<div style="font-size:9px;color:var(--text3)">+'+(dt.length-3)+'</div>';h+='</div>'}
  var tc=sf-1+dim,rm=tc%7?7-tc%7:0;for(var i=1;i<=rm;i++)h+='<div class="cal-day other-month"><div class="cal-day-num">'+i+'</div></div>';
  h+='</div>';document.getElementById('calendarView').innerHTML=h;
}
export function setView(v){currentView=v;document.getElementById('tableView').style.display=v==='table'?'block':'none';document.getElementById('kanbanView').className='kanban-view '+(v==='kanban'?'active':'');document.getElementById('timelineView').className='timeline-view '+(v==='timeline'?'active':'');document.getElementById('calendarView').className='calendar-view '+(v==='calendar'?'active':'');['table','kanban','timeline','calendar'].forEach(function(k){var b=document.getElementById('btn'+k.charAt(0).toUpperCase()+k.slice(1));if(b)b.className='view-btn '+(k===v?'active':'')});renderAll()}
export function toggleSection(id){var el=document.getElementById(id);if(el)el.classList.toggle('collapsed')}
export function changeStatus(id,ns){var ts=getTasks(),t=ts.find(function(x){return x.id===id});if(t){t.status=ns;setTasks(ts);renderAll();showToast(id+' → '+ns)}}
export function fillMemberSelect(sel,val,noneLabel){if(!sel)return;sel.innerHTML='<option value="">'+(noneLabel||'— None —')+'</option>';getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});if(val&&getTeamMembers().indexOf(val)===-1){var o=document.createElement('option');o.value=val;o.textContent=val+' (legacy)';sel.appendChild(o)}sel.value=val||''}
export function openModal(task,presetSection){editingId=task?task.id:null;document.getElementById('modalTitle').textContent=task?'Edit Task':'Add Task';document.getElementById('fTaskName').value=task?task.name:'';document.getElementById('fDueDate').value=task?task.due:'';document.getElementById('fStatus').value=task?task.status:'Pending';document.getElementById('fPriority').value=task?task.priority||'':'';fillMemberSelect(document.getElementById('fAssignee'),task?task.assignee:'','— Unassigned —');fillMemberSelect(document.getElementById('fReviewer'),task?task.reviewer:'','— None —');document.getElementById('fSection').value=task?task.section:(presetSection||(currentSection==='all'?'pre-launch':currentSection));document.getElementById('fBlockedBy').value=task?task.blockedBy||'':'';document.getElementById('fNotes').value=task?task.notes||'':'';document.getElementById('modalOverlay').classList.add('open')}
export function openModalForSection(section){openModal(null,section)}
export function openAddTask(){openModal(null,currentSection!=='all'?currentSection:null)}
export function closeModal(){document.getElementById('modalOverlay').classList.remove('open');editingId=null}
export function saveTask(){var n=document.getElementById('fTaskName').value.trim();if(!n){showToast('Required','error');return}var d={name:n,due:document.getElementById('fDueDate').value,status:document.getElementById('fStatus').value,assignee:document.getElementById('fAssignee').value.trim(),reviewer:document.getElementById('fReviewer').value.trim(),section:document.getElementById('fSection').value,sub:false,priority:document.getElementById('fPriority').value,notes:document.getElementById('fNotes').value.trim(),blockedBy:document.getElementById('fBlockedBy').value.trim()};var ts=getTasks();if(editingId){var i=ts.findIndex(function(t){return t.id===editingId});ts[i]=Object.assign({},ts[i],d);showToast(editingId+' saved')}else{var sc=d.section.toUpperCase().slice(0,2),ex=ts.filter(function(t){return t.section===d.section}).length;d.id=sc+'-'+String(ex+1).padStart(2,'0');ts.push(d);showToast(d.id+' added')}setTasks(ts);closeModal();renderAll()}
export function editTask(id){var t=getTasks().find(function(x){return x.id===id});if(t)openModal(t)}
export function deleteTask(id){if(!confirm('Delete '+id+'?'))return;setTasks(getTasks().filter(function(t){return t.id!==id}));renderAll();showToast(id+' deleted','error')}
export function renderAll(){renderCourseSel();renderStats();renderSidebarMembers();if(currentView==='table')renderTable();else if(currentView==='kanban')renderKanban();else if(currentView==='timeline')renderTimeline();else renderCalendar();updateTabBadges()}
