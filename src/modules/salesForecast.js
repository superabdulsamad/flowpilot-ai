// ============================================================
// SALES FORECAST — monthly view, daily forecast vs actual
// Ported from the original monolith's SALES FORECAST section.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { escHtml, showToast } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';

var sfRows=[],sfSaving=false,unsubscribeSf=null;
var sfViewMonth=new Date().toISOString().slice(0,7); // YYYY-MM
var sfFollowMonth=true,sfMonthInterval=null;
function sfTodayStr(){return new Date().toISOString().split('T')[0]}
function sfCurMonth(){return new Date().toISOString().slice(0,7)}
function sfKey(m){return 'salesforecast_month_'+m}

export async function sfSaveToFirestore(){
  if(sfSaving)return;sfSaving=true;syncStart();
  try{
    await setDoc(doc(db,'appdata',sfKey(sfViewMonth)),{month:sfViewMonth,data:sfRows,updatedAt:new Date().toISOString()});
    try{localStorage.setItem('eg7_sfm_'+sfViewMonth,JSON.stringify(sfRows))}catch(x){}
    syncDone();
  }catch(e){syncError('Forecast save failed');try{localStorage.setItem('eg7_sfm_'+sfViewMonth,JSON.stringify(sfRows))}catch(x){}}
  finally{sfSaving=false}
}
export async function sfLoad(){
  for(var attempt=0;attempt<3;attempt++){
    try{
      var snap=await getDoc(doc(db,'appdata',sfKey(sfViewMonth)));
      sfRows=snap.exists()?(snap.data().data||[]):[];
      return;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,700*(attempt+1))});continue}
      try{var d=localStorage.getItem('eg7_sfm_'+sfViewMonth);if(d)sfRows=JSON.parse(d);else sfRows=[]}catch(x){sfRows=[]}
      return;
    }
  }
}
export function sfListener(){
  if(unsubscribeSf)unsubscribeSf();
  unsubscribeSf=onSnapshot(doc(db,'appdata',sfKey(sfViewMonth)),function(snap){
    if(snap.exists()&&!sfSaving){
      sfRows=snap.data().data||[];
      if(document.getElementById('panelSales').classList.contains('active'))sfRender();
    }
  },function(){});
}
export function stopSfListener(){if(unsubscribeSf){unsubscribeSf();unsubscribeSf=null}}
export function sfChangeMonth(val){
  if(!val)return;
  sfViewMonth=val;
  sfFollowMonth=(val===sfCurMonth());
  sfLoad().then(function(){sfListener();sfRender()});
}
export function sfNavMonth(delta){
  var p=sfViewMonth.split('-');
  var d=new Date(Number(p[0]),Number(p[1])-1+delta,1);
  sfChangeMonth(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));
}
// If app stays open into a new month, follow it automatically
export function sfStartMonthWatch(){
  if(sfMonthInterval)clearInterval(sfMonthInterval);
  sfMonthInterval=setInterval(function(){
    if(sfFollowMonth&&sfViewMonth!==sfCurMonth()){
      sfViewMonth=sfCurMonth();
      sfLoad().then(function(){sfListener();if(document.getElementById('panelSales').classList.contains('active'))sfRender()});
    }
  },60000);
}
function sfStatus(r){
  var f=r.forecast,a=r.actual;
  if(f==null||f==='')return{label:'No Forecast',color:'var(--text3)',bg:'rgba(150,150,150,.1)'};
  if(a==null||a==='')return{label:'Pending',color:'var(--yellow)',bg:'rgba(202,138,4,.12)'};
  if(Number(a)>=Number(f))return{label:'✅ Matched',color:'var(--green)',bg:'rgba(22,163,74,.12)'};
  return{label:'❌ Unmatched',color:'var(--red)',bg:'rgba(220,38,38,.12)'};
}
export async function sfUpdateField(id,field,value){
  var r=sfRows.find(function(x){return x.id===id});if(!r)return;
  if(field==='forecast'||field==='actual'){r[field]=value===''?null:Number(value)}
  else{r[field]=value}
  r.updatedAt=new Date().toISOString();
  r.updatedBy=state.currentUser?state.currentUser.displayName:'';
  await sfSaveToFirestore();sfRender();
}
export async function sfDeleteRow(id){
  var r=sfRows.find(function(x){return x.id===id});if(!r)return;
  if(!confirm('Delete forecast for '+r.member+' on '+r.date+'?'))return;
  sfRows=sfRows.filter(function(x){return x.id!==id});
  await sfSaveToFirestore();sfRender();showToast('Deleted','error');
}
export function sfOpenModal(){
  var sel=document.getElementById('fSfMember');
  sel.innerHTML='';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  if(state.currentUser&&getTeamMembers().indexOf(state.currentUser.displayName)>=0)sel.value=state.currentUser.displayName;
  // Default date: today if viewing current month, else 1st of viewed month
  var today=sfTodayStr();
  document.getElementById('fSfDate').value=(today.slice(0,7)===sfViewMonth)?today:sfViewMonth+'-01';
  document.getElementById('fSfForecast').value='';
  document.getElementById('fSfNote').value='';
  document.getElementById('sfModalOverlay').classList.add('open');
}
export function sfCloseModal(){document.getElementById('sfModalOverlay').classList.remove('open')}
export async function sfSaveRow(){
  var m=document.getElementById('fSfMember').value;
  var date=document.getElementById('fSfDate').value;
  var f=document.getElementById('fSfForecast').value;
  if(!m){showToast('Select member','error');return}
  if(!date){showToast('Pick a date','error');return}
  if(f===''){showToast('Enter forecast number','error');return}
  // If the picked date is in a different month, switch the view to that month first
  var mth=date.slice(0,7);
  if(mth!==sfViewMonth){
    sfViewMonth=mth;sfFollowMonth=(mth===sfCurMonth());
    await sfLoad();sfListener();
  }
  if(sfRows.some(function(r){return r.member===m&&r.date===date})){showToast(m+' already has a forecast on '+date,'error');return}
  sfRows.push({id:'sf_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),date:date,member:m,forecast:Number(f),actual:null,note:document.getElementById('fSfNote').value.trim(),updatedAt:new Date().toISOString(),updatedBy:state.currentUser?state.currentUser.displayName:''});
  await sfSaveToFirestore();sfCloseModal();sfRender();showToast('Forecast added for '+m);
}
function sfPopulateMemberFilter(){
  var sel=document.getElementById('sfMemberFilter');if(!sel)return;
  var cur=sel.value||'all';
  var names={};sfRows.forEach(function(r){if(r.member)names[r.member]=1});
  sel.innerHTML='<option value="all">All Members</option>'+Object.keys(names).map(function(n){return'<option>'+escHtml(n)+'</option>'}).join('');
  sel.value=cur;
}
export function sfRender(){
  var el=document.getElementById('sfTable');if(!el)return;
  document.getElementById('sfMonthPick').value=sfViewMonth;
  var mLabel=new Date(sfViewMonth+'-01T12:00:00').toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  document.getElementById('sfDateLabel').textContent=mLabel+(sfViewMonth===sfCurMonth()?' (Current)':'');
  sfPopulateMemberFilter();
  var mf=document.getElementById('sfMemberFilter').value;
  var list=sfRows.filter(function(r){return mf==='all'||r.member===mf});
  // Month stats
  var tf=0,ta=0,matched=0,unmatched=0,shortfall=0;
  list.forEach(function(r){
    if(r.forecast!=null)tf+=Number(r.forecast);
    if(r.actual!=null)ta+=Number(r.actual);
    var s=sfStatus(r);
    if(s.label.indexOf('Matched')>=0&&s.label.indexOf('Unmatched')===-1)matched++;
    if(s.label.indexOf('Unmatched')>=0){unmatched++;shortfall+=Math.max(0,Number(r.forecast)-Number(r.actual))}
  });
  var ach=tf>0?Math.round(ta/tf*100):null;
  var achColor=ach==null?'var(--text3)':ach>=100?'var(--green)':ach>=70?'var(--yellow)':'var(--red)';
  document.getElementById('sfStats').innerHTML=
    '<div class="adhoc-stat as-total"><div class="stat-label">Month Forecast</div><div class="stat-value">'+tf+'</div></div>'+
    '<div class="adhoc-stat as-progress"><div class="stat-label">Month Actual</div><div class="stat-value" style="color:var(--blue)">'+ta+'</div></div>'+
    '<div class="adhoc-stat as-completed"><div class="stat-label">Achievement</div><div class="stat-value" style="color:'+achColor+'">'+(ach==null?'—':ach+'%')+'</div></div>'+
    '<div class="adhoc-stat as-completed"><div class="stat-label">Matched</div><div class="stat-value" style="color:var(--green)">'+matched+'</div></div>'+
    '<div class="adhoc-stat as-failed"><div class="stat-label">Unmatched</div><div class="stat-value" style="color:var(--red)">'+unmatched+'</div></div>'+
    '<div class="adhoc-stat as-pending"><div class="stat-label">Number Not Met</div><div class="stat-value" style="color:var(--red)">'+shortfall+'</div></div>';
  // Per-member month cards
  var perM={};
  sfRows.forEach(function(r){
    if(!r.member)return;
    var o=perM[r.member]=perM[r.member]||{f:0,a:0,m:0,u:0};
    if(r.forecast!=null)o.f+=Number(r.forecast);
    if(r.actual!=null)o.a+=Number(r.actual);
    var s=sfStatus(r);
    if(s.label.indexOf('Unmatched')>=0)o.u++;else if(s.label.indexOf('Matched')>=0)o.m++;
  });
  var mc='';
  Object.keys(perM).forEach(function(name){
    var o=perM[name];var meta=state.MEMBERS[name]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var pct=o.f>0?Math.round(o.a/o.f*100):null;
    var pctColor=pct==null?'var(--text3)':pct>=100?'var(--green)':pct>=70?'var(--yellow)':'var(--red)';
    mc+='<div style="border:1px solid var(--border);border-radius:10px;padding:10px 14px;background:var(--surface);min-width:150px">'+
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><span class="assignee-chip" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(name[0])+' '+escHtml(name)+'</span></div>'+
      '<div style="font-size:11px;color:var(--text2);line-height:1.8">Forecast: <strong>'+o.f+'</strong> · Actual: <strong>'+o.a+'</strong><br>✅ '+o.m+' · ❌ '+o.u+' · <strong style="color:'+pctColor+'">'+(pct==null?'—':pct+'%')+'</strong></div>'+
      '<div style="height:4px;background:var(--surface2);border-radius:2px;margin-top:6px;overflow:hidden"><div style="height:100%;width:'+Math.min(100,pct||0)+'%;background:'+pctColor+'"></div></div>'+
    '</div>';
  });
  document.getElementById('sfMemberCards').innerHTML=mc;
  // Group rows by date, newest date first
  var byDate={};
  list.forEach(function(r){var d=r.date||'?';(byDate[d]=byDate[d]||[]).push(r)});
  var dates=Object.keys(byDate).sort().reverse();
  var today=sfTodayStr();
  var h='<table class="adhoc-table"><thead><tr><th>Date</th><th>Sales Member</th><th>Forecast #</th><th>Actual #</th><th>Status</th><th>Gap</th><th>Notes</th><th>Last Update</th><th></th></tr></thead><tbody>';
  if(!dates.length)h+='<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:24px">No forecasts for '+escHtml(mLabel)+' yet. Click "+ Add Forecast".</td></tr>';
  dates.forEach(function(d){
    var rows=byDate[d];
    var dLab=new Date(d+'T12:00:00').toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});
    var dayF=0,dayA=0;rows.forEach(function(r){if(r.forecast!=null)dayF+=Number(r.forecast);if(r.actual!=null)dayA+=Number(r.actual)});
    var dayM=0,dayU=0;rows.forEach(function(r){var s=sfStatus(r);if(s.label.indexOf('Unmatched')>=0)dayU++;else if(s.label.indexOf('Matched')>=0)dayM++});
    var isToday=(d===today);
    h+='<tr><td colspan="9" style="background:'+(isToday?'var(--brand-light)':'var(--surface2)')+';font-weight:700;font-size:12px;padding:8px 12px;color:'+(isToday?'var(--brand)':'var(--text2)')+'">'+dLab+(isToday?' · 📍 Today':'')+' — Forecast: '+dayF+' · Actual: '+dayA+(dayM?' · ✅ '+dayM:'')+(dayU?' · ❌ '+dayU:'')+'</td></tr>';
    rows.forEach(function(r){
      var meta=state.MEMBERS[r.member]||{color:'#999',bg:'rgba(150,150,150,.1)'};
      var s=sfStatus(r);
      var gap=(r.forecast!=null&&r.actual!=null)?(Number(r.actual)-Number(r.forecast)):null;
      var gapHtml=gap==null?'<span style="color:var(--text3)">—</span>':(gap>=0?'<span style="color:var(--green);font-weight:600">+'+gap+'</span>':'<span style="color:var(--red);font-weight:600">'+gap+'</span>');
      var upd=r.updatedAt?new Date(r.updatedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})+' '+new Date(r.updatedAt).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})+(r.updatedBy?' · '+escHtml(r.updatedBy):''):'—';
      h+='<tr>'+
        '<td style="font-family:var(--mono);font-size:12px;color:var(--text3)">'+escHtml(r.date||'')+'</td>'+
        '<td><span class="assignee-chip" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(r.member[0]||'?')+' '+escHtml(r.member)+'</span></td>'+
        '<td><input type="number" min="0" value="'+(r.forecast==null?'':r.forecast)+'" onchange="sfUpdateField(\''+r.id+'\',\'forecast\',this.value)" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-family:var(--mono);font-size:13px" placeholder="—"></td>'+
        '<td><input type="number" min="0" value="'+(r.actual==null?'':r.actual)+'" onchange="sfUpdateField(\''+r.id+'\',\'actual\',this.value)" style="width:80px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-family:var(--mono);font-size:13px" placeholder="—"></td>'+
        '<td><span style="background:'+s.bg+';color:'+s.color+';padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;white-space:nowrap">'+s.label+'</span></td>'+
        '<td>'+gapHtml+'</td>'+
        '<td><input value="'+escHtml(r.note||'')+'" onchange="sfUpdateField(\''+r.id+'\',\'note\',this.value)" style="width:130px;padding:6px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-size:12px" placeholder="note..."></td>'+
        '<td style="color:var(--text3);font-size:11px;white-space:nowrap">'+upd+'</td>'+
        '<td><button class="action-btn delete" onclick="sfDeleteRow(\''+r.id+'\')">✕</button></td>'+
      '</tr>';
    });
  });
  h+='</tbody></table>';
  el.innerHTML=h;
}
