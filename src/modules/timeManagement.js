// ============================================================
// TIME MANAGEMENT
// Ported from the original monolith's TIME MANAGEMENT section
// (all `tm*` functions). `showApp()` — the big post-login orchestrator
// that wires up every feature area — is a cross-cutting bootstrap
// function and lives in main.js instead.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { showToast } from '../utils/dom.js';

export var TM_WORK_HOURS=9;
var TM_LATE_MINS=15;
var TM_START='09:00';
var tmTimerInterval=null;
var tmLiveClockInterval=null;
var tmCurrentRecord=null;
var tmOnBreak=false;
var tmBreakStart=null;
var tmAttendanceCache={};
var unsubscribeTM=null;

function tmTodayStr(){return new Date().toISOString().split('T')[0]}

// FIRESTORE ATTENDANCE STORAGE
function tmKey(user,date){return user+'_'+date}

async function tmSaveRecord(user,date,data){
  var key=tmKey(user,date);
  tmAttendanceCache[key]=data;
  try{
    await setDoc(doc(db,'attendance',key),{user:user,date:date,...data});
  }catch(e){
    // fallback localStorage
    try{localStorage.setItem('tma_'+key,JSON.stringify(data))}catch(x){}
  }
}

export async function tmLoadTodayRecords(){
  var today=tmTodayStr();
  var members=getTeamMembers();
  try{
    var promises=members.map(function(m){
      return getDoc(doc(db,'attendance',tmKey(m,today))).then(function(snap){
        if(snap.exists())tmAttendanceCache[tmKey(m,today)]=snap.data();
      });
    });
    await Promise.all(promises);
  }catch(e){}
}

export function tmGetRecord(user,date){
  var key=tmKey(user,date);
  if(tmAttendanceCache[key])return tmAttendanceCache[key];
  // fallback localStorage
  try{var r=localStorage.getItem('tma_'+key);if(r)return JSON.parse(r)}catch(e){}
  return null;
}

async function tmGetHistory(user,days){
  var records=[];
  var promises=[];
  for(var i=0;i<days;i++){
    var d=new Date();d.setDate(d.getDate()-i);
    var ds=d.toISOString().split('T')[0];
    var key=tmKey(user,ds);
    if(tmAttendanceCache[key]){records.push({date:ds,...tmAttendanceCache[key]});continue}
    promises.push((function(dateStr){
      return getDoc(doc(db,'attendance',tmKey(user,dateStr))).then(function(snap){
        if(snap.exists()){tmAttendanceCache[tmKey(user,dateStr)]=snap.data();records.push({date:dateStr,...snap.data()})}
        else{
          // try localStorage fallback
          try{var r=localStorage.getItem('tma_tma_'+user+'_'+dateStr);if(!r)r=localStorage.getItem('tma_'+user+'_'+dateStr);if(r){var parsed=JSON.parse(r);tmAttendanceCache[tmKey(user,dateStr)]=parsed;records.push({date:dateStr,...parsed})}}catch(x){}
        }
      }).catch(function(){});
    })(ds));
  }
  await Promise.all(promises);
  return records.sort(function(a,b){return b.date.localeCompare(a.date)});
}

// Live listener — when any team member clocks in/out, refresh team view
export function tmStartLiveListener(){
  if(unsubscribeTM)unsubscribeTM();
  var today=tmTodayStr();
  // listen to today's attendance collection changes
  var members=getTeamMembers();
  members.forEach(function(m){
    if(m===state.currentUser.displayName)return; // own record handled directly
    onSnapshot(doc(db,'attendance',tmKey(m,today)),function(snap){
      if(snap.exists()){
        tmAttendanceCache[tmKey(m,today)]=snap.data();
        if(document.getElementById('panelTime').classList.contains('active')){
          tmRenderTeam();tmRenderStats();
        }
      }
    },function(){});
  });
}

// CLOCK IN
export async function tmClockIn(){
  var today=tmTodayStr();
  var existing=tmGetRecord(state.currentUser.displayName,today);
  if(existing&&existing.in){showToast('Already clocked in!','error');return}
  var now=new Date();
  var record={in:now.toISOString(),out:null,breaks:[],totalBreak:0,note:''};
  tmAttendanceCache[tmKey(state.currentUser.displayName,today)]=record;
  tmCurrentRecord=record;
  tmUpdateClockUI();tmStartTimer();
  await tmSaveRecord(state.currentUser.displayName,today,record);
  showToast('Clocked in at '+tmFmtTime(now));tmRenderTeam();tmRenderStats();
}
export async function tmClockOut(){
  if(!tmCurrentRecord||!tmCurrentRecord.in){showToast('Not clocked in','error');return}
  if(tmOnBreak){await tmEndBreak()}
  var now=new Date();
  tmCurrentRecord.out=now.toISOString();
  var worked=new Date(tmCurrentRecord.out)-new Date(tmCurrentRecord.in)-(tmCurrentRecord.totalBreak||0);
  tmCurrentRecord.workedMs=worked;
  tmAttendanceCache[tmKey(state.currentUser.displayName,tmTodayStr())]=tmCurrentRecord;
  clearInterval(tmTimerInterval);tmTimerInterval=null;
  tmUpdateClockUI();
  await tmSaveRecord(state.currentUser.displayName,tmTodayStr(),tmCurrentRecord);
  var h=Math.floor(worked/3600000),m=Math.floor((worked%3600000)/60000);
  showToast('Clocked out — '+h+'h '+m+'m worked');tmRenderTeam();tmRenderStats();
}
export function tmToggleBreak(){if(!tmCurrentRecord||tmCurrentRecord.out)return;if(!tmOnBreak)tmStartBreak();else tmEndBreak()}
function tmStartBreak(){tmOnBreak=true;tmBreakStart=new Date();document.getElementById('btnBreak').textContent='▶ Resume';document.getElementById('btnBreak').classList.add('active');showToast('Break started')}
async function tmEndBreak(){if(!tmBreakStart)return;var ms=new Date()-tmBreakStart;tmCurrentRecord.totalBreak=(tmCurrentRecord.totalBreak||0)+ms;tmCurrentRecord.breaks.push({start:tmBreakStart.toISOString(),end:new Date().toISOString(),ms:ms});tmOnBreak=false;tmBreakStart=null;document.getElementById('btnBreak').textContent='☕ Break';document.getElementById('btnBreak').classList.remove('active');tmAttendanceCache[tmKey(state.currentUser.displayName,tmTodayStr())]=tmCurrentRecord;await tmSaveRecord(state.currentUser.displayName,tmTodayStr(),tmCurrentRecord);showToast('Break ended — '+Math.round(ms/60000)+'m')}
function tmStartTimer(){clearInterval(tmTimerInterval);tmTimerInterval=setInterval(function(){tmUpdateElapsed();tmUpdateClockUI()},1000)}
function tmUpdateElapsed(){
  if(!tmCurrentRecord||!tmCurrentRecord.in)return;
  var now=new Date(),inT=new Date(tmCurrentRecord.in);
  var breakMs=(tmCurrentRecord.totalBreak||0)+(tmOnBreak&&tmBreakStart?now-tmBreakStart:0);
  var elapsed=Math.max(0,now-inT-breakMs);
  document.getElementById('tmElapsed').textContent=tmMsToHMS(elapsed);
  var pct=Math.min(100,Math.round(elapsed/(TM_WORK_HOURS*3600000)*100));
  document.getElementById('tmProgFill').style.width=pct+'%';
  document.getElementById('tmProgFill').className='tm-prog-fill'+(pct>=100?' overtime':'');
  document.getElementById('tmProgPct').textContent=pct+'%';
  document.getElementById('tmWorkedVal').textContent=tmMsToHM(elapsed);
  if(breakMs>0)document.getElementById('tmBreakVal').textContent=tmMsToHM(breakMs);
}
export function tmUpdateClockUI(){
  var today=tmTodayStr();
  var r=tmGetRecord(state.currentUser.displayName,today)||tmCurrentRecord;
  var btnIn=document.getElementById('btnClockIn'),btnOut=document.getElementById('btnClockOut'),btnBreak=document.getElementById('btnBreak');
  var badge=document.getElementById('tmStatusBadge');
  if(!r||!r.in){
    btnIn.style.display='flex';btnOut.style.display='none';btnBreak.style.display='none';
    badge.textContent='Not Started';badge.className='tm-badge tb-not';
    document.getElementById('tmElapsed').textContent='00:00:00';
    document.getElementById('tmProgFill').style.width='0%';document.getElementById('tmProgPct').textContent='0%';
  }else if(r.out){
    btnIn.style.display='none';btnOut.style.display='none';btnBreak.style.display='none';
    badge.textContent='Done ✓';badge.className='tm-badge tb-in';
    var wMs=r.workedMs||Math.max(0,new Date(r.out)-new Date(r.in)-(r.totalBreak||0));
    var pct=Math.min(100,Math.round(wMs/(TM_WORK_HOURS*3600000)*100));
    document.getElementById('tmProgFill').style.width=pct+'%';document.getElementById('tmProgPct').textContent=pct+'%';
    document.getElementById('tmElapsed').textContent=tmMsToHMS(wMs);
    document.getElementById('tmWorkedVal').textContent=tmMsToHM(wMs);
    document.getElementById('tmClockOutVal').textContent=tmFmtTime(new Date(r.out));
  }else{
    btnIn.style.display='none';btnOut.style.display='flex';btnBreak.style.display='inline-flex';
    if(tmOnBreak){badge.textContent='On Break';badge.className='tm-badge tb-break'}
    else{badge.textContent='Clocked In';badge.className='tm-badge tb-in'}
  }
  if(r&&r.in)document.getElementById('tmClockInVal').textContent=tmFmtTime(new Date(r.in));
  if(r&&r.totalBreak>0)document.getElementById('tmBreakVal').textContent=tmMsToHM(r.totalBreak);
}
export function tmRenderStats(){
  var today=tmTodayStr();
  var members=getTeamMembers();
  var present=0,absent=0,late=0,totalMs=0;
  members.forEach(function(m){
    var r=tmGetRecord(m,today);
    if(r&&r.in){
      present++;
      var inT=new Date(r.in),startT=new Date(today+'T'+TM_START);
      if(inT-startT>TM_LATE_MINS*60000)late++;
      var end=r.out?new Date(r.out):new Date();
      totalMs+=Math.max(0,end-inT-(r.totalBreak||0));
    }else absent++;
  });
  var avgH=present>0?Math.round(totalMs/present/3600000*10)/10:0;
  document.getElementById('tmStats').innerHTML=
    '<div class="tm-stat s-present"><div class="stat-label">Present</div><div class="stat-value">'+present+'</div><div class="stat-sub">of '+members.length+' team</div></div>'+
    '<div class="tm-stat s-absent"><div class="stat-label">Absent</div><div class="stat-value">'+absent+'</div><div class="stat-sub">not clocked in</div></div>'+
    '<div class="tm-stat s-late"><div class="stat-label">Late Today</div><div class="stat-value">'+late+'</div><div class="stat-sub">after '+TM_START+'</div></div>'+
    '<div class="tm-stat s-hours"><div class="stat-label">Avg Hours</div><div class="stat-value">'+avgH+'h</div><div class="stat-sub">team avg</div></div>';
}
export function tmRenderTeam(){
  var today=tmTodayStr(),h='';
  getTeamMembers().forEach(function(name){
    var meta=state.MEMBERS[name]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var r=tmGetRecord(name,today);
    var status='Not In',statusCls='tb-not',inT='—',outT='—',workT='—',pct=0;
    if(r&&r.in){
      inT=tmFmtTime(new Date(r.in));
      var now=new Date(),end=r.out?new Date(r.out):now;
      var worked=Math.max(0,end-new Date(r.in)-(r.totalBreak||0));
      pct=Math.min(100,Math.round(worked/(TM_WORK_HOURS*3600000)*100));
      workT=tmMsToHM(worked);
      if(r.out){status='Done ✓';statusCls='tb-in';outT=tmFmtTime(new Date(r.out))}
      else if(tmOnBreak&&name===state.currentUser.displayName){status='On Break';statusCls='tb-break'}
      else{status='Working';statusCls='tb-in'}
    }
    var fillColor=pct>=100?'var(--brand)':pct>=50?'var(--green)':'var(--yellow)';
    h+='<div class="team-card"><div class="tc-header"><div class="tc-avatar" style="background:'+meta.bg+';color:'+meta.color+'">'+name[0]+'</div><div><div class="tc-name">'+name+'</div></div><div style="margin-left:auto"><span class="tm-badge '+statusCls+'">'+status+'</span></div></div>'+
      '<div class="tc-times"><div class="tc-time-box"><div class="tc-time-label">In</div><div class="tc-time-val">'+inT+'</div></div><div class="tc-time-box"><div class="tc-time-label">Out</div><div class="tc-time-val">'+outT+'</div></div><div class="tc-time-box"><div class="tc-time-label">Worked</div><div class="tc-time-val">'+workT+'</div></div><div class="tc-time-box"><div class="tc-time-label">Progress</div><div class="tc-time-val">'+pct+'%</div></div></div>'+
      '<div class="tc-prog-bar"><div class="tc-prog-fill" style="width:'+pct+'%;background:'+fillColor+'"></div></div></div>';
  });
  document.getElementById('tmTeamGrid').innerHTML=h||'<div class="tm-empty">No team members found</div>';
}
export async function tmRenderHistory(){
  var days=parseInt(document.getElementById('tmHistDays').value)||30;
  var records=await tmGetHistory(state.currentUser.displayName,days);
  document.getElementById('tmHistName').textContent=state.currentUser.displayName;
  if(!records.length){document.getElementById('tmHistoryBody').innerHTML='<div class="tm-empty">No records yet</div>';return}
  var h='<table class="att-table"><thead><tr><th>Date</th><th>Day</th><th>In</th><th>Out</th><th>Break</th><th>Worked</th></tr></thead><tbody>';
  records.forEach(function(r){
    var d=new Date(r.date+'T12:00:00');
    var day=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    var inT=r.in?tmFmtTime(new Date(r.in)):'—',outT=r.out?tmFmtTime(new Date(r.out)):'—';
    var breakT=r.totalBreak?tmMsToHM(r.totalBreak):'—';
    var worked=r.workedMs||(r.out?Math.max(0,new Date(r.out)-new Date(r.in)-(r.totalBreak||0)):0);
    var workedH=worked/3600000;
    var durCls=workedH>=TM_WORK_HOURS?'dur-ok':workedH>0?'dur-short':'';
    if(workedH>TM_WORK_HOURS+0.5)durCls='dur-over';
    h+='<tr><td class="att-mono">'+tmFmtDateShort(r.date)+'</td><td style="color:var(--text3);font-size:12px">'+day+'</td><td class="att-time">'+inT+'</td><td class="att-time">'+outT+'</td><td class="att-time">'+breakT+'</td><td class="att-dur '+durCls+'">'+tmMsToHM(worked)+'</td></tr>';
  });
  h+='</tbody></table>';document.getElementById('tmHistoryBody').innerHTML=h;
}
export async function tmRenderAdmin(){
  var days=parseInt(document.getElementById('tmAdminDays').value)||30;
  var mf=document.getElementById('tmAdminMember').value;
  var members=getTeamMembers();
  var sel=document.getElementById('tmAdminMember'),cv=sel.value;
  sel.innerHTML='<option value="all">All Members</option>';
  members.forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  sel.value=cv||'all';
  document.getElementById('tmAdminBody').innerHTML='<div class="tm-empty">Loading...</div>';
  var allRows=[];
  var promises=members.map(async function(m){
    if(mf!=='all'&&m!==mf)return;
    var recs=await tmGetHistory(m,days);
    recs.forEach(function(r){allRows.push({member:m,...r})});
  });
  await Promise.all(promises);
  allRows.sort(function(a,b){return b.date.localeCompare(a.date)});
  if(!allRows.length){document.getElementById('tmAdminBody').innerHTML='<div class="tm-empty">No records</div>';return}
  var h='<table class="att-table"><thead><tr><th>Member</th><th>Date</th><th>In</th><th>Out</th><th>Break</th><th>Worked</th></tr></thead><tbody>';
  allRows.forEach(function(r){
    var meta=state.MEMBERS[r.member]||{color:'#999'};
    var inT=r.in?tmFmtTime(new Date(r.in)):'—',outT=r.out?tmFmtTime(new Date(r.out)):'—';
    var breakT=r.totalBreak?tmMsToHM(r.totalBreak):'—';
    var worked=r.workedMs||(r.out?Math.max(0,new Date(r.out)-new Date(r.in)-(r.totalBreak||0)):0);
    var workedH=worked/3600000;
    var durCls=workedH>=TM_WORK_HOURS?'dur-ok':workedH>0?'dur-short':'';
    h+='<tr><td><span style="display:inline-flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:'+meta.color+';flex-shrink:0;display:inline-block"></span>'+r.member+'</span></td><td class="att-mono">'+tmFmtDateShort(r.date)+'</td><td class="att-time">'+inT+'</td><td class="att-time">'+outT+'</td><td class="att-time">'+breakT+'</td><td class="att-dur '+durCls+'">'+tmMsToHM(worked)+'</td></tr>';
  });
  h+='</tbody></table>';document.getElementById('tmAdminBody').innerHTML=h;
}
export function setTmTab(tab,el){
  ['team','history','admin'].forEach(function(t){document.getElementById('tmTab'+t.charAt(0).toUpperCase()+t.slice(1)).style.display=t===tab?'block':'none'});
  document.querySelectorAll('.tm-tab').forEach(function(t){t.classList.remove('active')});
  el.classList.add('active');
  if(tab==='history')tmRenderHistory();
  if(tab==='admin')tmRenderAdmin();
}
export async function tmRefreshAll(){
  tmUpdateGreeting();tmUpdateClockUI();
  await tmLoadTodayRecords();
  // restore today's record for current user
  var todayRecord=tmGetRecord(state.currentUser.displayName,tmTodayStr());
  if(todayRecord&&todayRecord.in&&!todayRecord.out&&!tmCurrentRecord){
    tmCurrentRecord=todayRecord;tmStartTimer();
  }
  tmUpdateClockUI();tmRenderStats();tmRenderTeam();
  tmStartLiveListener();
}

// MANUAL ENTRY
export function tmOpenManual(){
  var sel=document.getElementById('tmManualUser');sel.innerHTML='';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  document.getElementById('tmManualDate').value=tmTodayStr();
  document.getElementById('tmManualIn').value='09:00';
  document.getElementById('tmManualOut').value='18:00';
  document.getElementById('tmManualBreak').value='0';
  document.getElementById('tmManualNote').value='';
  document.getElementById('tmManualOverlay').classList.add('open');
}
export function tmCloseManual(){document.getElementById('tmManualOverlay').classList.remove('open')}
export async function tmSaveManual(){
  var user=document.getElementById('tmManualUser').value;
  var date=document.getElementById('tmManualDate').value;
  var inT=document.getElementById('tmManualIn').value;
  var outT=document.getElementById('tmManualOut').value;
  var breakMins=parseInt(document.getElementById('tmManualBreak').value)||0;
  var note=document.getElementById('tmManualNote').value.trim();
  if(!date||!inT||!outT){showToast('Fill all fields','error');return}
  var inDt=new Date(date+'T'+inT),outDt=new Date(date+'T'+outT);
  var breakMs=breakMins*60000,workedMs=Math.max(0,outDt-inDt-breakMs);
  var record={in:inDt.toISOString(),out:outDt.toISOString(),breaks:[],totalBreak:breakMs,workedMs:workedMs,note:note};
  tmAttendanceCache[tmKey(user,date)]=record;
  await tmSaveRecord(user,date,record);
  tmCloseManual();tmRenderTeam();tmRenderStats();showToast('Entry saved for '+user);
}

// EXPORT
export async function tmExportMy(){
  var days=parseInt(document.getElementById('tmHistDays').value)||30;
  var records=await tmGetHistory(state.currentUser.displayName,days);
  var rows=records.map(function(r){return{member:state.currentUser.displayName,...r}});
  tmDoExport(rows,'MyAttendance');
}
export async function tmExportAll(){
  var days=parseInt(document.getElementById('tmAdminDays').value)||30;
  var rows=[];
  var promises=getTeamMembers().map(async function(m){var recs=await tmGetHistory(m,days);recs.forEach(function(r){rows.push({member:m,...r})})});
  await Promise.all(promises);
  rows.sort(function(a,b){return b.date.localeCompare(a.date)});
  tmDoExport(rows,'TeamAttendance');
}
function tmDoExport(rows,filename){
  var csv=[['Member','Date','Clock In','Clock Out','Break (min)','Worked (hrs)','Status']];
  rows.forEach(function(r){
    var inT=r.in?tmFmtTime(new Date(r.in)):'';
    var outT=r.out?tmFmtTime(new Date(r.out)):'';
    var breakMin=r.totalBreak?Math.round(r.totalBreak/60000):0;
    var worked=r.workedMs||(r.out?Math.max(0,new Date(r.out)-new Date(r.in)-(r.totalBreak||0)):0);
    var workedH=Math.round(worked/360000)/10;
    var status=!r.in?'Absent':!r.out?'In Progress':workedH>=TM_WORK_HOURS?'Present':'Half Day';
    csv.push([r.member,r.date,inT,outT,breakMin,workedH,status]);
  });
  var b=new Blob(['﻿'+csv.map(function(r){return r.join(',')}).join('\n')],{type:'text/csv'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='FlowPilotAI_'+filename+'_'+tmTodayStr()+'.csv';a.click();showToast('Exported!');
}

// TM UTILS
function tmMsToHMS(ms){if(ms<0)ms=0;var h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
export function tmMsToHM(ms){if(!ms||ms<0)return'0h 0m';return Math.floor(ms/3600000)+'h '+Math.floor((ms%3600000)/60000)+'m'}
function tmFmtTime(d){return d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',hour12:true})}
function tmFmtDateShort(ds){var d=new Date(ds+'T12:00:00');return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})}
export function tmUpdateGreeting(){
  var h=new Date().getHours();
  var g=h<12?'Good morning,':h<17?'Good afternoon,':'Good evening,';
  document.getElementById('tmGreeting').textContent=g;
  document.getElementById('tmHeroName').textContent=state.currentUser.displayName+' 👋';
  document.getElementById('tmDateStr').textContent=new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

export function tmStopTimers(){clearInterval(tmTimerInterval);clearInterval(tmLiveClockInterval)}
export function tmStartClockTimerIfNeeded(){
  // Mirrors the original showApp() logic that restores an in-progress
  // clock-in on login.
  tmCurrentRecord=tmGetRecord(state.currentUser.displayName,tmTodayStr());
  if(tmCurrentRecord&&tmCurrentRecord.in&&!tmCurrentRecord.out)tmStartTimer();
}
export function tmStartLiveClockInterval(){
  tmLiveClockInterval=setInterval(function(){
    var now=new Date();
    // update team view every 30s
    if(now.getSeconds()===0)tmRenderTeam();
  },1000);
}
