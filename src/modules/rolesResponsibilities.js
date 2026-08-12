// ============================================================
// ROLES & RESPONSIBILITIES
// Ported from the original monolith's ROLES & RESPONSIBILITIES section.
// The first-run seed row's member (a real former team member) has been
// swapped for a fictional one from demoSeed.js's roster.
// ============================================================
import { db, doc, getDoc, setDoc, onSnapshot } from '../services/db.js';
import { state, getTeamMembers } from '../state.js';
import { escHtml, showToast } from '../utils/dom.js';
import { syncStart, syncDone, syncError } from './auth.js';

var rolesList=[],rolesSaving=false,unsubscribeRoles=null;
var rolesEditId=null;
export async function rolesSaveToFirestore(){
  if(rolesSaving)return;rolesSaving=true;syncStart();
  try{
    await setDoc(doc(db,'appdata','roles_responsibilities'),{data:rolesList,updatedAt:new Date().toISOString()});
    try{await setDoc(doc(db,'appdata','roles_responsibilities_backup'),{data:rolesList,backedUpAt:new Date().toISOString()})}catch(b){}
    try{localStorage.setItem('eg7_roles_resp',JSON.stringify(rolesList))}catch(x){}
    syncDone();
  }catch(e){syncError('Roles save failed');try{localStorage.setItem('eg7_roles_resp',JSON.stringify(rolesList))}catch(x){}}
  finally{rolesSaving=false}
}
export async function rolesLoadFromFirestore(){
  for(var attempt=0;attempt<3;attempt++){
    try{
      var snap=await getDoc(doc(db,'appdata','roles_responsibilities'));
      if(snap.exists()){
        rolesList=snap.data().data||[];
      }else if(!rolesList.length){
        rolesList=[{id:'role_'+Date.now(),member:'Sam',responsibility:'Website, reviews, blog management'}];
        await rolesSaveToFirestore();
      }
      return;
    }catch(e){
      if(attempt<2){await new Promise(function(r){setTimeout(r,700*(attempt+1))});continue}
      try{var r=localStorage.getItem('eg7_roles_resp');if(r)rolesList=JSON.parse(r)}catch(x){}
      return;
    }
  }
}
export function rolesStartListener(){
  if(unsubscribeRoles)unsubscribeRoles();
  unsubscribeRoles=onSnapshot(doc(db,'appdata','roles_responsibilities'),function(snap){
    if(snap.exists()&&!rolesSaving){
      var d=snap.data().data||[];
      if(!d.length&&rolesList.length)return;
      rolesList=d;
      if(document.getElementById('panelRoles').classList.contains('active'))rolesRender();
    }
  },function(){});
}
export function stopRolesListener(){if(unsubscribeRoles){unsubscribeRoles();unsubscribeRoles=null}}
function rolesPopulateMemberSelect(selected){
  var sel=document.getElementById('fRolesMember');
  if(!sel)return;
  sel.innerHTML='<option value="">Select member</option>';
  getTeamMembers().forEach(function(m){var o=document.createElement('option');o.value=m;o.textContent=m;sel.appendChild(o)});
  if(selected&&getTeamMembers().indexOf(selected)===-1){var lo=document.createElement('option');lo.value=selected;lo.textContent=selected;sel.appendChild(lo)}
  sel.value=selected||'';
}
export function rolesOpenModal(){
  rolesEditId=null;
  document.getElementById('rolesModalTitle').textContent='Add Responsibility';
  rolesPopulateMemberSelect('');
  document.getElementById('fRolesText').value='';
  document.getElementById('rolesModalOverlay').classList.add('open');
}
export function rolesEditItem(id){
  var r=rolesList.find(function(x){return x.id===id});if(!r)return;
  rolesEditId=id;
  document.getElementById('rolesModalTitle').textContent='Edit Responsibility';
  rolesPopulateMemberSelect(r.member||'');
  document.getElementById('fRolesText').value=r.responsibility||'';
  document.getElementById('rolesModalOverlay').classList.add('open');
}
export function rolesCloseModal(){document.getElementById('rolesModalOverlay').classList.remove('open');rolesEditId=null}
export async function rolesSaveItem(){
  var member=document.getElementById('fRolesMember').value.trim();
  var responsibility=document.getElementById('fRolesText').value.trim();
  if(!member){showToast('Member required','error');return}
  if(!responsibility){showToast('Responsibility required','error');return}
  var row={member:member,responsibility:responsibility,updatedAt:new Date().toISOString()};
  if(rolesEditId){
    var i=rolesList.findIndex(function(x){return x.id===rolesEditId});
    if(i>=0){row.id=rolesEditId;row.createdAt=rolesList[i].createdAt;rolesList[i]=row;showToast('Responsibility updated')}
  }else{
    row.id='role_'+Date.now();row.createdAt=new Date().toISOString();rolesList.push(row);showToast('Responsibility added');
  }
  await rolesSaveToFirestore();rolesCloseModal();rolesRender();
}
export async function rolesDeleteItem(id){
  if(!confirm('Delete this responsibility item?'))return;
  rolesList=rolesList.filter(function(r){return r.id!==id});
  await rolesSaveToFirestore();rolesRender();showToast('Deleted','error');
}
function rolesPopulateFilter(){
  var sel=document.getElementById('rolesMemberFilter');if(!sel)return;
  var cur=sel.value||'all';
  var names={};rolesList.forEach(function(r){if(r.member)names[r.member]=1});
  sel.innerHTML='<option value="all">All Members</option>'+Object.keys(names).map(function(n){return'<option>'+n+'</option>'}).join('');
  sel.value=cur;
}
export function rolesRender(){
  var el=document.getElementById('rolesWrap');if(!el)return;
  rolesPopulateFilter();
  var mf=document.getElementById('rolesMemberFilter').value;
  var list=rolesList.filter(function(r){return mf==='all'||r.member===mf});
  var owners={};rolesList.forEach(function(r){if(r.member)owners[r.member]=1});
  document.getElementById('rolesStats').innerHTML=
    '<div class="adhoc-stat as-total"><div class="stat-label">Mappings</div><div class="stat-value">'+rolesList.length+'</div></div>'+
    '<div class="adhoc-stat as-progress"><div class="stat-label">Members</div><div class="stat-value" style="color:var(--blue)">'+Object.keys(owners).length+'</div></div>';
  var h='<table class="adhoc-table"><thead><tr><th>Team Member</th><th>Responsibilities</th><th></th></tr></thead><tbody>';
  if(!list.length)h+='<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px">No roles mapped yet. Click "+ Add Responsibility".</td></tr>';
  list.forEach(function(r){
    var meta=state.MEMBERS[r.member]||{color:'#999',bg:'rgba(150,150,150,.1)'};
    var member='<span class="assignee-chip" style="background:'+meta.bg+';color:'+meta.color+'">'+escHtml(r.member[0]||'?')+' '+escHtml(r.member)+'</span>';
    h+='<tr><td>'+member+'</td><td style="color:var(--text2);font-size:12px">'+escHtml(r.responsibility||'')+'</td><td><div class="action-cell"><button class="action-btn" onclick="rolesEditItem(\''+r.id+'\')">✏️</button><button class="action-btn delete" onclick="rolesDeleteItem(\''+r.id+'\')">✕</button></div></td></tr>';
  });
  h+='</tbody></table>';
  el.innerHTML=h;
}
