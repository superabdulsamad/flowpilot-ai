// ============================================================
// SHARED DOM / FORMATTING HELPERS
// Used across every feature module. Ported mostly verbatim from the
// original monolith's UTILS section (and a couple of small helpers that
// were duplicated across sections there).
// ============================================================

export function today(){return new Date().toISOString().split('T')[0]}
export function formatDate(d){if(!d)return'—';var p=d.split('-');return p[2]+'/'+p[1]+'/'+p[0].slice(2)}
export function dueClass(d){if(!d)return'ok';if(d<today())return'overdue';return(new Date(d)-new Date())/864e5<=3?'soon':'ok'}
export function statusBadge(s){var m={Done:'status-done',WIP:'status-wip',Pending:'status-pending',HOLD:'status-hold'};return'<span class="status-badge '+(m[s]||'status-pending')+'"><span class="status-dot"></span>'+s+'</span>'}
export function prioBadge(p){if(!p)return'';return'<span class="priority-badge pri-'+p.toLowerCase()+'">'+p+'</span>'}
export function escHtml(s){if(s==null)return'';return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
export function showToast(msg,ty){var t=document.getElementById('toast');t.textContent=msg;t.style.borderLeftColor=ty==='error'?'var(--red)':'var(--green)';t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2500)}
export function colorToBg(c){var m=c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);if(!m)return'rgba(150,150,150,.1)';return'rgba('+parseInt(m[1],16)+','+parseInt(m[2],16)+','+parseInt(m[3],16)+',.12)'}

// memberChip/avatarEl need access to the live MEMBERS map (shared state) to
// resolve a member's color — imported here rather than passed in, matching
// how the original inline functions closed over the top-level `MEMBERS` var.
import { state } from '../state.js';

export function memberChip(n){if(!n)return'';return n.split(',').map(function(x){x=x.trim();if(!x)return'';var m=state.MEMBERS[x]||{color:'#999',bg:'rgba(150,150,150,.1)'};return'<span class="assignee-chip" style="background:'+m.bg+';color:'+m.color+'">'+escHtml(x[0])+' '+escHtml(x)+'</span>'}).join('')}
export function avatarEl(n){var m=state.MEMBERS[n]||{color:'#999',bg:'rgba(150,150,150,.1)'};return'<div class="avatar" style="background:'+m.bg+';color:'+m.color+'">'+escHtml((n||'?')[0])+'</div>'}
