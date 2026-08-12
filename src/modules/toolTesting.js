// ============================================================
// TOOL TESTING & RESEARCH
// Ported from the original monolith's TOOL TESTING & RESEARCH section.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { escHtml, showToast } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';
import { isInternUser } from './interns.js';

var toolsList=[],toolsSaving=false,unsubscribeTools=null,ttEditId=null,toolsLoadOk=false;

export async function ttSaveToFirestore(){
  if(toolsSaving)return;toolsSaving=true;syncStart();
  try{
    await setDoc(doc(db,'appdata','tools'),{data:toolsList,updatedAt:new Date().toISOString()});
    try{await setDoc(doc(db,'appdata','tools_backup'),{data:toolsList,backedUpAt:new Date().toISOString()})}catch(b){}
    syncDone();
    try{if(toolsList.length)localStorage.setItem('eg7_tools',JSON.stringify(toolsList))}catch(x){}
  }catch(e){syncError('Tools save failed');try{localStorage.setItem('eg7_tools',JSON.stringify(toolsList))}catch(x){}}
  finally{toolsSaving=false}
}
export async function ttLoadFromFirestore(){
  toolsLoadOk=false;
  for(var attempt=0;attempt<3;attempt++){
    try{
      var snap=await getDoc(doc(db,'appdata','tools'));
      toolsLoadOk=true;
      if(snap.exists())toolsList=snap.data().data||[];
      try{if(toolsList.length)localStorage.setItem('eg7_tools',JSON.stringify(toolsList))}catch(x){}
      return;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,800*(attempt+1))});continue}
      toolsLoadOk=false;
      try{var a=localStorage.getItem('eg7_tools');if(a)toolsList=JSON.parse(a)}catch(x){}
    }
  }
}
export function ttListener(){
  if(unsubscribeTools)unsubscribeTools();
  unsubscribeTools=onSnapshot(doc(db,'appdata','tools'),function(snap){
    if(snap.exists()&&!toolsSaving){
      var d=snap.data().data||[];
      if(!d.length&&toolsList.length)return;
      toolsList=d;
      if(!isInternUser()&&document.getElementById('panelTools').classList.contains('active'))ttRender();
    }
  },function(){});
}
export function stopToolsListener(){if(unsubscribeTools){unsubscribeTools();unsubscribeTools=null}}
function ttPopulateAssignee(val){
  var sel=document.getElementById('fTtAssignee');sel.innerHTML='<option value="">— Unassigned —</option>';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  if(val&&getTeamMembers().indexOf(val)===-1){var o=document.createElement('option');o.value=val;o.textContent=val;sel.appendChild(o)}
  sel.value=val||'';
}
export function ttOpenModal(){ttEditId=null;document.getElementById('ttModalTitle').textContent='Add Tool / Research';document.getElementById('fTtName').value='';document.getElementById('fTtDesc').value='';document.getElementById('fTtSource').value='';document.getElementById('fTtFound').value='';document.getElementById('fTtStatus').value='Researching';ttPopulateAssignee('');document.getElementById('ttModalOverlay').classList.add('open')}
export function ttClose(){document.getElementById('ttModalOverlay').classList.remove('open');ttEditId=null}
export function ttEdit(id){var t=toolsList.find(function(x){return x.id===id});if(!t)return;ttEditId=id;document.getElementById('ttModalTitle').textContent='Edit Tool / Research';document.getElementById('fTtName').value=t.name||'';document.getElementById('fTtDesc').value=t.description||'';document.getElementById('fTtSource').value=t.source||'';document.getElementById('fTtFound').value=t.foundVia||'';document.getElementById('fTtStatus').value=t.status||'Researching';ttPopulateAssignee(t.assignee||'');document.getElementById('ttModalOverlay').classList.add('open')}
export async function ttSave(){
  var name=document.getElementById('fTtName').value.trim();
  if(!name){showToast('Tool name required','error');return}
  var src=document.getElementById('fTtSource').value.trim();
  if(src&&!/^https?:\/\//i.test(src))src='https://'+src;
  var d={name:name,description:document.getElementById('fTtDesc').value.trim(),source:src,foundVia:document.getElementById('fTtFound').value.trim(),status:document.getElementById('fTtStatus').value,assignee:document.getElementById('fTtAssignee').value};
  if(ttEditId){var i=toolsList.findIndex(function(x){return x.id===ttEditId});if(i>=0){d.id=ttEditId;d.createdAt=toolsList[i].createdAt;d.addedBy=toolsList[i].addedBy;toolsList[i]=d;showToast('Tool updated')}}
  else{d.id='tool_'+Date.now();d.createdAt=new Date().toISOString();d.addedBy=state.currentUser?state.currentUser.displayName:'';toolsList.push(d);showToast('Tool added')}
  await ttSaveToFirestore();ttClose();ttRender();
}
export async function ttDelete(id){
  if(!confirm('Delete this tool entry?'))return;
  toolsList=toolsList.filter(function(x){return x.id!==id});
  await ttSaveToFirestore();ttRender();showToast('Deleted','error');
}
function ttStatusBadge(s){
  var map={Researching:'var(--blue)',Testing:'var(--yellow)',Adopted:'var(--green)',Rejected:'var(--red)'};
  var bgmap={Researching:'var(--blue-bg)',Testing:'var(--yellow-bg)',Adopted:'var(--green-bg)',Rejected:'var(--red-bg)'};
  var c=map[s]||'var(--text3)',b=bgmap[s]||'var(--surface2)';
  return'<span style="background:'+b+';color:'+c+';padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600">'+(s||'—')+'</span>';
}
function ttPopulateFilter(){
  var sel=document.getElementById('ttAssigneeFilter'),cur=sel.value;
  var names={};toolsList.forEach(function(t){if(t.assignee)names[t.assignee]=1});
  sel.innerHTML='<option value="all">All Assignees</option>'+Object.keys(names).map(function(n){return'<option>'+n+'</option>'}).join('');
  sel.value=cur||'all';
}
export function ttRender(){
  ttPopulateFilter();
  var sf=document.getElementById('ttStatusFilter').value,af=document.getElementById('ttAssigneeFilter').value;
  var list=toolsList.filter(function(t){return(sf==='all'||t.status===sf)&&(af==='all'||t.assignee===af)});
  var st={Researching:0,Testing:0,Adopted:0,Rejected:0};toolsList.forEach(function(t){if(st[t.status]!=null)st[t.status]++});
  document.getElementById('ttStats').innerHTML=
    '<div class="adhoc-stat as-total"><div class="stat-label">Total</div><div class="stat-value">'+toolsList.length+'</div></div>'+
    '<div class="adhoc-stat as-progress"><div class="stat-label">Researching</div><div class="stat-value" style="color:var(--blue)">'+st.Researching+'</div></div>'+
    '<div class="adhoc-stat as-pending"><div class="stat-label">Testing</div><div class="stat-value" style="color:var(--yellow)">'+st.Testing+'</div></div>'+
    '<div class="adhoc-stat as-completed"><div class="stat-label">Adopted</div><div class="stat-value" style="color:var(--green)">'+st.Adopted+'</div></div>'+
    '<div class="adhoc-stat as-failed"><div class="stat-label">Rejected</div><div class="stat-value" style="color:var(--red)">'+st.Rejected+'</div></div>';
  var h='<table class="adhoc-table"><thead><tr><th>Tool / Research</th><th>Description</th><th>Source</th><th>Found Via</th><th>Assigned</th><th>Status</th><th></th></tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:24px">No tools yet. Click "+ Add Tool".</td></tr>';
  list.forEach(function(t){
    var meta=state.MEMBERS[t.assignee]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var src=t.source?'<a href="'+encodeURI(t.source)+'" target="_blank" rel="noopener" style="color:var(--brand);text-decoration:none">🔗 Open</a>':'<span style="color:var(--text3)">—</span>';
    var asg=t.assignee?'<span class="assignee-chip" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(t.assignee[0])+' '+escHtml(t.assignee)+'</span>':'<span style="color:var(--text3)">—</span>';
    h+='<tr><td style="font-weight:600">'+escHtml(t.name)+'</td>'+
      '<td style="max-width:240px;color:var(--text2);font-size:12px">'+(t.description?escHtml(t.description):'—')+'</td>'+
      '<td>'+src+'</td>'+
      '<td style="font-size:12px;color:var(--text2)">'+(t.foundVia?escHtml(t.foundVia):'—')+'</td>'+
      '<td>'+asg+'</td>'+
      '<td>'+ttStatusBadge(t.status)+'</td>'+
      '<td><div class="action-cell"><button class="action-btn" onclick="ttEdit(\''+t.id+'\')">✏️</button><button class="action-btn delete" onclick="ttDelete(\''+t.id+'\')">✕</button></div></td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('ttTable').innerHTML=h;
}
