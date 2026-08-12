// ============================================================
// APP BOOTSTRAP
// Ported from the original monolith's THEME, APP TAB SWITCH, SHOW APP,
// command-palette / sidebar-toggle, and INIT sections — the cross-cutting
// "shell" concerns that don't belong to any single feature module, plus
// the "EXPOSE TO HTML" window.* assignment block (source lines 3190-3215)
// that every inline onclick/onchange attribute in index.html calls into.
// ============================================================
import { state } from './state.js';

import {
  doLogin, doLogout, switchLoginTab, internDoLogin,
  checkSession, loadUsersFromFirestore, initDefaultAdmin, startUsersListener,
  openUserMgmt, closeUserMgmt, createUser
} from './modules/auth.js';

import {
  openInternSignup, closeInternSignup, signupIntern, isInternUser, showInternApp,
  internAdminRender
} from './modules/interns.js';

import {
  openModal, openModalForSection, openAddTask, closeModal, saveTask, editTask, deleteTask, changeStatus,
  toggleSection, setView, filterSection, filterByMember, applyFilters,
  switchCourse, openCourseModal, closeCourseModal, addCourse, duplicateCourse, deleteCourse,
  openTeamModal, closeTeamModal, addMember, openRemoveTeamModal, closeRemoveTeamModal, removeMember,
  openAssetModal, closeAssetModal, saveAsset, removeAsset,
  exportExcel, dragStart, dragOver, drop, dragEnd, renderCalendar,
  loadData, renderAll, startLiveListener, startMembersListener, getTasks
} from './modules/tasks.js';

import {
  tmClockIn, tmClockOut, tmToggleBreak, setTmTab, tmRenderHistory, tmRenderAdmin,
  tmOpenManual, tmCloseManual, tmSaveManual, tmExportMy, tmExportAll,
  tmRefreshAll, tmUpdateGreeting, tmUpdateClockUI, tmRenderStats, tmRenderTeam,
  tmStartClockTimerIfNeeded, tmStartLiveClockInterval
} from './modules/timeManagement.js';

import {
  dtOpenModal, dtOpenModalSection, dtCloseModal, dtSaveTask, dtToggle, dtDelete, dtEdit,
  dtRender, dtLoadFromFirestore, dtStartListener, dtScheduleMidnightReset, getDtTasks
} from './modules/dailyTasks.js';

import {
  adhocOpenModal, adhocCloseModal, adhocSaveTask, adhocRender, adhocChangeProgress,
  adhocDeleteTask, adhocEditTask, adhocExport,
  adhocLoadFromFirestore, adhocStartListener, getAdhocTasks
} from './modules/adhocTasks.js';

import {
  ttOpenModal, ttClose, ttSave, ttEdit, ttDelete, ttRender,
  ttLoadFromFirestore, ttListener
} from './modules/toolTesting.js';

import {
  weeklyOpenModal, weeklyCloseModal, weeklySaveTask, weeklyEditTask, weeklyDeleteTask, weeklyRender,
  weeklyLoadFromFirestore, weeklyStartListener
} from './modules/weeklyTasks.js';

import {
  rolesOpenModal, rolesCloseModal, rolesSaveItem, rolesEditItem, rolesDeleteItem, rolesRender,
  rolesLoadFromFirestore, rolesStartListener
} from './modules/rolesResponsibilities.js';

import {
  sfOpenModal, sfCloseModal, sfSaveRow, sfUpdateField, sfDeleteRow, sfRender, sfChangeMonth, sfNavMonth,
  sfLoad, sfListener, sfStartMonthWatch
} from './modules/salesForecast.js';

import { aiInit, aiOpenPanel } from './modules/aiAssistant.js';

import { today } from './utils/dom.js';

// ============================================================
// THEME
// ============================================================
export function toggleTheme(){var c=document.documentElement.getAttribute('data-theme');document.documentElement.setAttribute('data-theme',c==='dark'?'':'dark');updateThemeBtn();localStorage.setItem('eg7_theme',document.documentElement.getAttribute('data-theme')||'')}
export function updateThemeBtn(){
  var icon=document.documentElement.getAttribute('data-theme')==='dark'?'☀️':'🌙';
  var tb=document.getElementById('themeBtn');if(tb)tb.textContent=icon;
  var itb=document.getElementById('internThemeBtn');if(itb)itb.textContent=icon;
}

// ============================================================
// APP TAB SWITCH
// (merged with the original's post-hoc `_sw` wrapper — header toolbar
// refresh, per-user last-tab persistence, and badge refresh all happen
// as part of one function here instead of a monkey-patched override.)
// ============================================================
export function switchAppTab(tab){
  ['tasks','time','daily','adhoc','weekly','roles','tools','sales','interns'].forEach(function(t){
    document.getElementById('panel'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
    document.getElementById('appTab'+t.charAt(0).toUpperCase()+t.slice(1)).classList.toggle('active',t===tab);
  });
  document.getElementById('courseSwitcher').style.display=tab==='tasks'?'flex':'none';
  document.getElementById('addTaskBtn').style.display=tab==='tasks'?'block':'none';
  if(tab==='time'){tmRefreshAll()}
  if(tab==='daily'){dtRender()}
  if(tab==='adhoc'){adhocRender()}
  if(tab==='weekly'){weeklyRender()}
  if(tab==='roles'){rolesRender()}
  if(tab==='tools'){ttRender()}
  if(tab==='sales'){sfRender()}
  if(tab==='interns'){internAdminRender()}
  updateHeaderToolbar();
  if(state.currentUser)localStorage.setItem('eg_cc_tab_'+state.currentUser.username,tab);
  updateTabBadges();
}

export function updateHeaderToolbar(){
  var tb=document.getElementById('headerToolbar');
  if(!tb)return;
  tb.style.display='flex';
  var secBtn=document.getElementById('sidebarToggleBtn');
  if(secBtn)secBtn.style.display='inline-flex';
}

// (merged with the original's post-hoc `_ra`/`_ar`/`_dr` wrappers —
// renderAll()/adhocRender()/dtRender() each call this directly at the
// end of their own bodies instead of being monkey-patched from outside.)
export function updateTabBadges(){
  try{
    var td=today(),
      ov=getTasks().filter(function(t){return t.status!=='Done'&&t.due&&t.due<td}).length,
      au=getAdhocTasks().filter(function(t){return t.progress!=='Completed'&&(t.sysStatus==='Failed'||t.priority==='Urgent')}).length,
      dp=getDtTasks().filter(function(t){return!t.done}).length;
    function b(id,n){var el=document.getElementById(id);if(!el)return;if(n>0){el.textContent=n>99?'99+':n;el.style.display='inline-flex';}else el.style.display='none';}
    b('badgeTasks',ov);b('badgeAdhoc',au);b('badgeDaily',dp);
  }catch(e){}
}

// ============================================================
// SHOW APP
// ============================================================
export function showApp(){
  document.getElementById('loginScreen').style.display='none';
  if(isInternUser()){showInternApp();return}
  document.getElementById('internWrap').style.display='none';
  document.getElementById('appWrap').style.display='block';
  document.getElementById('userBadge').textContent=state.currentUser.displayName+' ('+state.currentUser.role+')';
  var isAdmin=state.currentUser.role==='admin';
  document.querySelectorAll('.admin-only').forEach(function(el){
    el.classList.remove('visible','visible-flex');
    if(isAdmin){if(el.tagName==='SPAN')el.classList.add('visible-flex');else el.classList.add('visible')}
  });
  if(isAdmin&&document.getElementById('tmAdminTab'))document.getElementById('tmAdminTab').style.display='inline-block';
  var th=localStorage.getItem('eg7_theme');if(th)document.documentElement.setAttribute('data-theme',th);
  updateThemeBtn();
  // load TM state — restores an in-progress clock-in on login
  tmStartClockTimerIfNeeded();
  tmUpdateGreeting();tmUpdateClockUI();
  // start live header clock
  tmStartLiveClockInterval();
  loadData().then(function(){renderAll();startLiveListener();startMembersListener();tmRenderStats();tmRenderTeam();
    adhocLoadFromFirestore().then(function(){adhocStartListener()});
    weeklyLoadFromFirestore().then(function(){weeklyStartListener()});
    rolesLoadFromFirestore().then(function(){rolesStartListener()});
    ttLoadFromFirestore().then(function(){ttListener()});
    dtLoadFromFirestore().then(function(){dtStartListener();dtScheduleMidnightReset()});
    sfLoad().then(function(){sfListener();sfStartMonthWatch()});
    aiInit();
    if(localStorage.getItem('eg_cc_sidebar')==='1')document.body.classList.add('sidebar-collapsed');
    var st=localStorage.getItem('eg_cc_tab_'+state.currentUser.username);
    if(st&&['tasks','time','daily','adhoc','weekly','roles','tools','sales','interns'].indexOf(st)>=0)switchAppTab(st);
    else updateHeaderToolbar();
    updateTabBadges();
  });
}

// ============================================================
// COMMAND PALETTE & SIDEBAR TOGGLE
// ============================================================
var cmdPaletteOpen=false;
export function openCmdPalette(){
  var p=document.getElementById('cmdPalette');
  p.classList.add('open');cmdPaletteOpen=true;
  var inp=document.getElementById('cmdInput');
  inp.value='';
  cmdFilter('');
  inp.focus();
}
export function closeCmdPalette(){document.getElementById('cmdPalette').classList.remove('open');cmdPaletteOpen=false;}
function cmdVisibleItems(){
  return Array.prototype.slice.call(document.querySelectorAll('#cmdList .cmd-item')).filter(function(el){return !el.classList.contains('cmd-hidden')});
}
export function cmdFilter(q){
  q=(q||'').trim().toLowerCase();
  var isAdmin=!!(state.currentUser&&state.currentUser.role==='admin');
  var items=document.querySelectorAll('#cmdList .cmd-item');
  var shown=0;
  items.forEach(function(el){
    el.classList.remove('cmd-active');
    if(el.getAttribute('data-admin')==='1'&&!isAdmin){el.classList.add('cmd-hidden');return}
    var label=(el.getAttribute('data-label')||'')+' '+(el.textContent||'');
    var match=!q||label.toLowerCase().indexOf(q)>=0;
    el.classList.toggle('cmd-hidden',!match);
    if(match)shown++;
  });
  var empty=document.getElementById('cmdEmpty');
  if(empty)empty.style.display=shown?'none':'block';
  var vis=cmdVisibleItems();
  if(vis.length)vis[0].classList.add('cmd-active');
}
export function cmdInputKey(e){
  if(e.key==='Escape'){closeCmdPalette();return}
  var vis=cmdVisibleItems();
  if(!vis.length)return;
  var idx=vis.findIndex(function(el){return el.classList.contains('cmd-active')});
  if(e.key==='ArrowDown'){e.preventDefault();if(idx>=0)vis[idx].classList.remove('cmd-active');var n=vis[(idx+1+vis.length)%vis.length]||vis[0];n.classList.add('cmd-active');n.scrollIntoView({block:'nearest'})}
  else if(e.key==='ArrowUp'){e.preventDefault();if(idx>=0)vis[idx].classList.remove('cmd-active');var pIdx=idx<=0?vis.length-1:idx-1;var pv=vis[pIdx];pv.classList.add('cmd-active');pv.scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'){e.preventDefault();var target=idx>=0?vis[idx]:vis[0];if(target)target.click()}
}
export function runCmd(a){
  closeCmdPalette();
  if(a==='tasks')switchAppTab('tasks');
  else if(a==='time')switchAppTab('time');
  else if(a==='daily')switchAppTab('daily');
  else if(a==='adhoc')switchAppTab('adhoc');
  else if(a==='weekly')switchAppTab('weekly');
  else if(a==='roles')switchAppTab('roles');
  else if(a==='tools')switchAppTab('tools');
  else if(a==='salesfc')switchAppTab('sales');
  else if(a==='interns')switchAppTab('interns');
  else if(a==='sec-pre'){switchAppTab('tasks');filterSection('pre-launch',null);setView('table')}
  else if(a==='sec-sales'){switchAppTab('tasks');filterSection('sales',null);setView('table')}
  else if(a==='add')openAddTask();
  else if(a==='ai'){aiOpenPanel()}
  else if(a==='theme')toggleTheme();
  else if(a==='export')exportExcel();
}
document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();cmdPaletteOpen?closeCmdPalette():openCmdPalette();}});
export function closeMobileSidebar(){document.body.classList.remove('sidebar-mobile-open')}
export function toggleSidebar(){
  var onTasks=document.getElementById('panelTasks')&&document.getElementById('panelTasks').classList.contains('active');
  if(!onTasks){
    switchAppTab('tasks');
    if(window.innerWidth<=900)document.body.classList.add('sidebar-mobile-open');
    else document.body.classList.remove('sidebar-collapsed');
    return;
  }
  if(window.innerWidth<=900){document.body.classList.toggle('sidebar-mobile-open');return}
  document.body.classList.toggle('sidebar-collapsed');
  localStorage.setItem('eg_cc_sidebar',document.body.classList.contains('sidebar-collapsed')?'1':'0');
}
window.openCmdPalette=openCmdPalette;window.closeCmdPalette=closeCmdPalette;window.runCmd=runCmd;window.cmdFilter=cmdFilter;window.cmdInputKey=cmdInputKey;window.toggleSidebar=toggleSidebar;window.closeMobileSidebar=closeMobileSidebar;

// ============================================================
// MODAL CLOSE ON BACKDROP
// ============================================================
['modalOverlay','courseModalOverlay','teamModalOverlay','removeTeamModalOverlay','assetModalOverlay','userMgmtOverlay','tmManualOverlay','adhocModalOverlay','dtModalOverlay','ttModalOverlay','internSignupOverlay'].forEach(function(id){
  document.getElementById(id).addEventListener('click',function(e){if(e.target===this)this.classList.remove('open')})
});

// ============================================================
// EXPOSE TO HTML
// Recreated from the original monolith's "EXPOSE TO HTML" block (source
// lines 3190-3215) — the complete list of every function the HTML's
// inline onclick/onchange/ondrag* attributes call. `sfNavMonth` has been
// added below: it's used by the Sales Forecast prev/next-month buttons
// in index.html but was never assigned to `window` in the original file,
// so those buttons would have thrown "sfNavMonth is not defined" — this
// port fixes that gap while leaving everything else unchanged.
// ============================================================
window.doLogin=doLogin;window.doLogout=doLogout;
window.switchLoginTab=switchLoginTab;window.internDoLogin=internDoLogin;
window.openInternSignup=openInternSignup;window.closeInternSignup=closeInternSignup;window.signupIntern=signupIntern;
window.openModal=openModal;window.openModalForSection=openModalForSection;window.openAddTask=openAddTask;window.closeModal=closeModal;window.saveTask=saveTask;window.editTask=editTask;window.deleteTask=deleteTask;window.changeStatus=changeStatus;
window.toggleSection=toggleSection;window.setView=setView;window.switchAppTab=switchAppTab;
window.filterSection=filterSection;window.filterByMember=filterByMember;window.applyFilters=applyFilters;
window.switchCourse=switchCourse;window.openCourseModal=openCourseModal;window.closeCourseModal=closeCourseModal;window.addCourse=addCourse;window.duplicateCourse=duplicateCourse;window.deleteCourse=deleteCourse;
window.openTeamModal=openTeamModal;window.closeTeamModal=closeTeamModal;window.addMember=addMember;
window.openRemoveTeamModal=openRemoveTeamModal;window.closeRemoveTeamModal=closeRemoveTeamModal;window.removeMember=removeMember;
window.openAssetModal=openAssetModal;window.closeAssetModal=closeAssetModal;window.saveAsset=saveAsset;window.removeAsset=removeAsset;
window.openUserMgmt=openUserMgmt;window.closeUserMgmt=closeUserMgmt;window.createUser=createUser;
window.exportExcel=exportExcel;window.toggleTheme=toggleTheme;
window.dragStart=dragStart;window.dragOver=dragOver;window.drop=drop;window.dragEnd=dragEnd;window.renderCalendar=renderCalendar;
window.tmClockIn=tmClockIn;window.tmClockOut=tmClockOut;window.tmToggleBreak=tmToggleBreak;
window.setTmTab=setTmTab;window.tmRenderHistory=tmRenderHistory;window.tmRenderAdmin=tmRenderAdmin;
window.tmOpenManual=tmOpenManual;window.tmCloseManual=tmCloseManual;window.tmSaveManual=tmSaveManual;
window.tmExportMy=tmExportMy;window.tmExportAll=tmExportAll;
window.dtOpenModal=dtOpenModal;window.dtOpenModalSection=dtOpenModalSection;window.dtCloseModal=dtCloseModal;
window.dtSaveTask=dtSaveTask;window.dtToggle=dtToggle;window.dtDelete=dtDelete;window.dtEdit=dtEdit;
window.adhocOpenModal=adhocOpenModal;window.adhocCloseModal=adhocCloseModal;window.adhocSaveTask=adhocSaveTask;
window.adhocRender=adhocRender;window.adhocChangeProgress=adhocChangeProgress;
window.adhocDeleteTask=adhocDeleteTask;window.adhocEditTask=adhocEditTask;window.adhocExport=adhocExport;
window.ttOpenModal=ttOpenModal;window.ttClose=ttClose;window.ttSave=ttSave;window.ttEdit=ttEdit;window.ttDelete=ttDelete;window.ttRender=ttRender;
window.weeklyOpenModal=weeklyOpenModal;window.weeklyCloseModal=weeklyCloseModal;window.weeklySaveTask=weeklySaveTask;window.weeklyEditTask=weeklyEditTask;window.weeklyDeleteTask=weeklyDeleteTask;window.weeklyRender=weeklyRender;
window.rolesOpenModal=rolesOpenModal;window.rolesCloseModal=rolesCloseModal;window.rolesSaveItem=rolesSaveItem;window.rolesEditItem=rolesEditItem;window.rolesDeleteItem=rolesDeleteItem;window.rolesRender=rolesRender;
window.sfOpenModal=sfOpenModal;window.sfCloseModal=sfCloseModal;window.sfSaveRow=sfSaveRow;window.sfUpdateField=sfUpdateField;window.sfDeleteRow=sfDeleteRow;window.sfRender=sfRender;window.sfChangeMonth=sfChangeMonth;
window.sfNavMonth=sfNavMonth;

// ============================================================
// INIT
// ============================================================
(async function(){
  var th=localStorage.getItem('eg7_theme');
  if(th)document.documentElement.setAttribute('data-theme',th);
  await loadUsersFromFirestore();
  await initDefaultAdmin();
  startUsersListener();
  document.getElementById('loadingOverlay').style.display='none';
  if(checkSession()&&state.users[state.currentUser.username]){showApp()}
  else{localStorage.removeItem('eg7_session');document.getElementById('loginScreen').style.display='flex'}
})();
