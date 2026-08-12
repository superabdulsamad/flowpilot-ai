// ============================================================
// AI AGENT — AI AGENT section, FEATURE 1 DAILY BRIEFING,
// FEATURE 2 SMART ALERTS
// Ported from the original monolith. The assistant's display name has
// been renamed to "FlowPilot AI" wherever it appears as UI text.
// ============================================================
import { db, doc, getDoc, setDoc } from '../services/db.js';
import { state } from '../state.js';
import { showToast } from '../utils/dom.js';
import { getTasks, getActiveCourse } from './tasks.js';
import { getAdhocTasks } from './adhocTasks.js';
import { getDtTasks } from './dailyTasks.js';
import { tmGetRecord, tmMsToHM } from './timeManagement.js';
import { switchAppTab } from '../main.js';

var AI_MODEL='claude-sonnet-4-6';
var AI_MODEL_FALLBACK='claude-haiku-4-5-20251001';
var aiOpen=false;
var aiConversation=[];
var aiTyping=false;

function aiNormalizeKey(raw){
  if(!raw)return'';
  var k=String(raw).trim();
  k=k.replace(/^Bearer\s+/i,'');
  k=k.replace(/^["']+|["']+$/g,'');
  k=k.replace(/\s+/g,'');
  return k;
}
function aiValidateKeyFormat(key){return/^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]+$/.test(key)}
function aiGetKey(){return aiNormalizeKey(localStorage.getItem('eg_aikey')||'')}
export function aiClearKey(){
  localStorage.removeItem('eg_aikey');
  var inp=document.getElementById('aiKeyInput');
  if(inp)inp.value='';
  var st=document.getElementById('aiKeyStatus');
  if(st)st.textContent='Key cleared. Paste a new one from Anthropic console.';
  document.getElementById('aiKeyStrip').style.display='flex';
  showToast('API key cleared','error');
}
function aiShowKeyStrip(msg){
  document.getElementById('aiKeyStrip').style.display='flex';
  var st=document.getElementById('aiKeyStatus');
  if(st&&msg)st.textContent=msg;
}
async function aiTestKey(key){
  var testKey=aiNormalizeKey(key||aiGetKey());
  if(!testKey)return{ok:false,msg:'No key entered'};
  if(!aiValidateKeyFormat(testKey))return{ok:false,msg:'Invalid format — key must look like sk-ant-api03-...'};
  try{
    var res=await fetch(aiApiUrl(),{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':testKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
      body:JSON.stringify({model:AI_MODEL_FALLBACK,max_tokens:16,messages:[{role:'user',content:'Reply OK'}]})
    });
    var data=await res.json();
    if(!res.ok){
      var msg=(data.error&&data.error.message)?data.error.message:('HTTP '+res.status);
      return{ok:false,msg:msg,status:res.status};
    }
    return{ok:true};
  }catch(e){
    return{ok:false,msg:e.message||'Network error'};
  }
}
export async function aiSetKey(val){
  var key=aiNormalizeKey(val);
  var st=document.getElementById('aiKeyStatus');
  if(!key){if(st)st.textContent='Paste your full API key first.';showToast('Paste your API key','error');return}
  if(!aiValidateKeyFormat(key)){
    if(st)st.textContent='✕ Invalid format. Copy the entire key — it starts with sk-ant-api03-';
    showToast('Invalid key format','error');
    return;
  }
  if(st)st.textContent='Testing key with Anthropic...';
  var test=await aiTestKey(key);
  if(!test.ok){
    localStorage.removeItem('eg_aikey');
    if(st)st.textContent='✕ Rejected: '+test.msg+'. Create a new key at console.anthropic.com (old keys may be revoked).';
    showToast('Key rejected: '+test.msg,'error');
    return;
  }
  localStorage.setItem('eg_aikey',key);
  document.getElementById('aiKeyStrip').style.display='none';
  if(st)st.textContent='';
  showToast('API key verified ✓');
}
function aiCheckKey(){
  var key=aiGetKey();
  if(!key||!aiValidateKeyFormat(key)){
    aiShowKeyStrip(key&&!aiValidateKeyFormat(key)?'Stored key looks malformed — paste a fresh sk-ant-api03-... key.':'');
    return false;
  }
  document.getElementById('aiKeyStrip').style.display='none';
  return true;
}
function aiInvalidateKey(reason){
  localStorage.removeItem('eg_aikey');
  aiShowKeyStrip(reason||'Your API key was rejected. Paste a new one from console.anthropic.com');
  var inp=document.getElementById('aiKeyInput');
  if(inp)inp.value='';
}

// Anthropic requires user-first, alternating messages — normalize before API call
function aiBuildApiMessages(){
  var msgs=aiConversation.filter(function(m){return m.role==='user'||m.role==='assistant'});
  while(msgs.length&&msgs[0].role!=='user')msgs.shift();
  var out=[];
  msgs.forEach(function(m){
    if(out.length&&out[out.length-1].role===m.role){
      out[out.length-1].content+='\n\n'+m.content;
    }else{
      out.push({role:m.role,content:m.content});
    }
  });
  return out.slice(-10);
}

function aiFormatReply(text){
  return text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*?<\/li>(\n|$))+/gs,function(m){return'<ul>'+m+'</ul>'})
    .replace(/\n/g,'<br>');
}

function aiApiUrl(){
  var host=window.location.hostname;
  if(host==='localhost'||host==='127.0.0.1')return'http://localhost:8010/proxy/v1/messages';
  return'https://api.anthropic.com/v1/messages';
}

async function aiCallAnthropic(systemPrompt,messages,model){
  var key=aiGetKey();
  var res=await fetch(aiApiUrl(),{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key':key,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-direct-browser-access':'true'
    },
    body:JSON.stringify({model:model,max_tokens:800,system:systemPrompt,messages:messages})
  });
  var data=await res.json();
  if(!res.ok){
    var msg=(data.error&&data.error.message)?data.error.message:('HTTP '+res.status);
    var err=new Error(msg);
    err.status=res.status;
    err.data=data;
    throw err;
  }
  if(!data.content||!data.content[0]||!data.content[0].text)throw new Error('Empty response from API');
  return data.content[0].text;
}

// MEMORY — save/load per user in Firestore
async function aiSaveMemory(summary){
  if(!state.currentUser)return;
  try{
    await setDoc(doc(db,'agent',state.currentUser.username),{
      summary:summary,
      savedAt:new Date().toISOString(),
      displayName:state.currentUser.displayName
    });
  }catch(e){}
}
async function aiLoadMemory(){
  if(!state.currentUser)return null;
  try{
    var snap=await getDoc(doc(db,'agent',state.currentUser.username));
    if(snap.exists())return snap.data();
  }catch(e){}
  return null;
}

// Build context snapshot from live app data
function aiGetContext(){
  if(!state.currentUser)return'No user session.';
  var todayStr=new Date().toISOString().split('T')[0];
  var tasks=[];
  try{tasks=getTasks()||[]}catch(e){tasks=[]}
  var adhoc=getAdhocTasks();
  var daily=getDtTasks();
  var course=getActiveCourse()||'(none)';
  var done=tasks.filter(function(t){return t.status==='Done'}).length;
  var wip=tasks.filter(function(t){return t.status==='WIP'}).length;
  var pending=tasks.filter(function(t){return t.status==='Pending'}).length;
  var overdue=tasks.filter(function(t){return t.status!=='Done'&&t.due&&t.due<todayStr}).length;

  // My tasks
  var myTasks=tasks.filter(function(t){return t.assignee&&t.assignee.includes(state.currentUser.displayName)});

  // Adhoc summary
  var adhocPending=adhoc.filter(function(t){return t.progress!=='Completed'}).length;
  var adhocFailed=adhoc.filter(function(t){return t.sysStatus==='Failed'&&t.progress!=='Completed'}).length;
  var myAdhoc=adhoc.filter(function(t){return t.assignee===state.currentUser.displayName&&t.progress!=='Completed'});

  // Daily tasks
  var dtDone=daily.filter(function(t){return t.done}).length;
  var dtTotal=daily.length;

  // Team attendance today
  var teamStatus=Object.keys(state.MEMBERS).map(function(m){
    var r=tmGetRecord(m,todayStr);
    return m+': '+(r&&r.in?(r.out?'Done ('+tmMsToHM(r.workedMs||0)+')':'Clocked In'):'Not In');
  }).join('\n');

  // Per-member task load
  var memberLoad=Object.keys(state.MEMBERS).map(function(m){
    var mt=tasks.filter(function(t){return t.assignee&&t.assignee.includes(m)});
    var md=mt.filter(function(t){return t.status==='Done'}).length;
    var mp=mt.filter(function(t){return t.status==='Pending'||t.status==='WIP'}).length;
    var ma=adhoc.filter(function(t){return t.assignee===m&&t.progress!=='Completed'}).length;
    return m+' — Tasks: '+mt.length+' ('+md+' done, '+mp+' active), Adhoc pending: '+ma;
  }).join('\n');

  return [
    '=== FLOWPILOT AI COMMAND CENTER — LIVE DATA ===',
    'Date: '+todayStr,
    'Current User: '+state.currentUser.displayName+' ('+state.currentUser.role+')',
    'Active Course: '+course,
    '',
    '--- TASK MANAGEMENT ---',
    'Total: '+tasks.length+' | Done: '+done+' | WIP: '+wip+' | Pending: '+pending+' | Overdue: '+overdue,
    '',
    'My tasks ('+state.currentUser.displayName+'):',
    myTasks.length?myTasks.slice(0,10).map(function(t){return'  ['+t.status+'] '+t.id+' — '+t.name+(t.due?' (due '+t.due+')':"")}).join('\n'):'  None assigned',
    '',
    '--- ADHOC TASKS ---',
    'Total: '+adhoc.length+' | Pending: '+adhocPending+' | Failed/Overdue: '+adhocFailed,
    'My adhoc tasks:',
    myAdhoc.length?myAdhoc.slice(0,8).map(function(t){return'  ['+t.sysStatus+'/'+t.progress+'] '+t.name+' (end: '+t.endDate+')'}).join('\n'):'  None',
    '',
    '--- DAILY TASKS TODAY ---',
    dtDone+'/'+dtTotal+' completed',
    '',
    '--- TEAM ATTENDANCE TODAY ---',
    teamStatus,
    '',
    '--- TEAM TASK LOAD ---',
    memberLoad,
    '=== END ==='
  ].join('\n');
}

// Force the panel open and greet if this is the first message of the
// session — used by the command palette's "ai" command (runCmd in
// main.js), which in the original inlined this same logic directly.
export function aiOpenPanel(){
  aiOpen=true;
  document.getElementById('aiPanel').classList.add('open');
  if(!aiConversation.length)aiGreet();
}

// Show/hide panel
export function aiToggle(){
  aiOpen=!aiOpen;
  document.getElementById('aiPanel').classList.toggle('open',aiOpen);
  if(aiOpen&&aiConversation.length===0){aiGreet()}
}

// Greeting on first open
async function aiGreet(){
  var memory=await aiLoadMemory();
  var greeting='Hi '+state.currentUser.displayName+'! 👋 I\'m your FlowPilot AI assistant. I can see all your live task data right now.';

  if(memory&&memory.summary){
    var strip=document.getElementById('aiMemoryStrip');
    document.getElementById('aiMemoryText').textContent='Last session: '+memory.summary;
    strip.classList.add('show');
    greeting+='\n\n**Last time** I noted: '+memory.summary;
  }

  aiAddMsg('agent',greeting);
  // UI-only greeting — do NOT push to aiConversation (API requires user-first messages)
}

// Add message to UI
function aiAddMsg(role,text){
  var div=document.createElement('div');
  div.className='ai-msg '+role;
  // simple markdown — bold, bullet
  var html=text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/^- (.+)$/gm,'<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs,'<ul>$1</ul>')
    .replace(/\n/g,'<br>');
  div.innerHTML=html;
  document.getElementById('aiMessages').appendChild(div);
  document.getElementById('aiMessages').scrollTop=99999;
  return div;
}

// Send message
export async function aiSend(){
  var input=document.getElementById('aiInput');
  var text=input.value.trim();
  if(!text||aiTyping)return;
  input.value='';
  aiAsk(text);
}

export async function aiAsk(question){
  if(aiTyping)return false;
  if(!aiCheckKey()){showToast('Enter your Anthropic API key first','error');return false}
  aiTyping=true;
  document.getElementById('aiSendBtn').disabled=true;
  document.getElementById('aiChips').style.display='none';

  aiAddMsg('user',question);
  aiConversation.push({role:'user',content:question});

  var thinking=aiAddMsg('thinking','✦ Thinking...');

  var context=aiGetContext();
  var systemPrompt='You are FlowPilot AI — a smart, concise assistant for the FlowPilot AI Command Center.\n\n'+
    'You have access to LIVE data from the app right now:\n\n'+context+'\n\n'+
    'RULES:\n'+
    '- Be concise and specific. Use bullet points for lists.\n'+
    '- Reference actual task names, assignees, numbers from the data.\n'+
    '- Give actionable suggestions — not generic advice.\n'+
    '- If asked about a specific person, focus on their tasks.\n'+
    '- At the end of EVERY response, output this line exactly:\n'+
    '  [MEMORY: one sentence summary of what the user asked/did this session]\n'+
    '- Keep responses under 200 words unless asked for detail.';

  var apiMessages=aiBuildApiMessages();
  if(!apiMessages.length){
    thinking.className='ai-msg agent';
    thinking.textContent='Could not build message history. Please close and reopen the AI panel.';
    aiTyping=false;
    document.getElementById('aiSendBtn').disabled=false;
    return false;
  }

  try{
    var reply;
    try{
      reply=await aiCallAnthropic(systemPrompt,apiMessages,AI_MODEL);
    }catch(primaryErr){
      if(primaryErr.status===404||/model/i.test(primaryErr.message||'')){
        reply=await aiCallAnthropic(systemPrompt,apiMessages,AI_MODEL_FALLBACK);
      }else{
        throw primaryErr;
      }
    }

    var memMatch=reply.match(/\[MEMORY:\s*(.+?)\]/);
    if(memMatch){
      await aiSaveMemory(memMatch[1].trim());
      reply=reply.replace(/\[MEMORY:.*?\]/,'').trim();
      document.getElementById('aiMemoryText').textContent='Just noted: '+memMatch[1].trim();
      document.getElementById('aiMemoryStrip').classList.add('show');
    }

    thinking.className='ai-msg agent';
    thinking.innerHTML=aiFormatReply(reply);
    aiConversation.push({role:'assistant',content:reply});
    document.getElementById('aiMessages').scrollTop=99999;
    aiTyping=false;
    document.getElementById('aiSendBtn').disabled=false;
    return true;

  }catch(e){
    aiConversation.pop();
    thinking.className='ai-msg agent';
    var hint='';
    if(e.status===401||/invalid x-api-key|auth|api.?key/i.test(e.message||'')){
      aiInvalidateKey('Key rejected by Anthropic ('+(e.message||'invalid')+'). Paste a new key — old ones may be revoked or copied incorrectly.');
      hint='<br><br>Use <strong>Save &amp; Test</strong> above with a fresh key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style="color:var(--brand)">console.anthropic.com</a>';
    }else if(window.location.protocol==='file:'){
      hint='<br><br>Tip: Open this app via HTTPS hosting (Firebase, etc.) — not as a local file.';
    }
    thinking.innerHTML='⚠️ <strong>Could not reach Claude</strong><br>'+(e.message||'Unknown error')+hint;
    showToast('AI error: '+(e.message||'connection failed'),'error');
  }

  document.getElementById('aiMessages').scrollTop=99999;
  aiTyping=false;
  document.getElementById('aiSendBtn').disabled=false;
  return false;
}

window.aiToggle=aiToggle;window.aiSend=aiSend;window.aiAsk=aiAsk;window.aiSetKey=aiSetKey;window.aiClearKey=aiClearKey;
export function aiReset(){
  aiConversation=[];
  document.getElementById('aiMessages').innerHTML='';
  document.getElementById('aiChips').style.display='flex';
  document.getElementById('aiMemoryStrip').classList.remove('show');
  aiOpen=false;
  document.getElementById('aiPanel').classList.remove('open');
  switchAppTab('tasks');
  showToast('Returned to Task Management');
}
window.aiReset=aiReset;

// Show AI bubble after login
export function aiInit(){
  if(state.currentUser&&state.currentUser.role==='intern'){document.getElementById('aiBubble').style.display='none';return}
  document.getElementById('aiBubble').style.display='flex';
  var key=aiGetKey();
  if(key&&aiValidateKeyFormat(key)){
    document.getElementById('aiKeyStrip').style.display='none';
  }else{
    aiShowKeyStrip(key?'Stored key looks invalid — replace it.':'Add your Anthropic API key to enable AI.');
    document.getElementById('aiKeyInput').value='';
  }
  setTimeout(aiCheckDailyBriefing,3000);
  setTimeout(aiCheckSmartAlerts,5000);
}

// ============================================================
// FEATURE 1 — DAILY BRIEFING
// Auto-sends morning briefing once per day on login
// ============================================================
async function aiCheckDailyBriefing(){
  if(!aiCheckKey())return;
  if(!state.currentUser||(state.currentUser.role==='intern'))return;
  var todayStr=new Date().toISOString().split('T')[0];
  var lastBriefing=localStorage.getItem('eg_briefing_'+state.currentUser.username);
  if(lastBriefing===todayStr)return;

  aiOpen=true;
  document.getElementById('aiPanel').classList.add('open');
  if(aiConversation.length===0)await aiGreet();

  var hour=new Date().getHours();
  var timeOfDay=hour<12?'morning':hour<17?'afternoon':'evening';

  var briefingPrompt='Give me a concise '+timeOfDay+' briefing for '+todayStr+'. Include:\n'+
    '1. Who has not clocked in today\n'+
    '2. Top 3 most urgent overdue tasks across the team\n'+
    '3. Which team member has the highest pending load\n'+
    '4. One key action I should take right now\n'+
    'Keep it short and punchy — max 150 words.';

  var ok=await aiAsk(briefingPrompt);
  if(ok)localStorage.setItem('eg_briefing_'+state.currentUser.username,todayStr);
}

// ============================================================
// FEATURE 2 — SMART ALERTS
// Detects patterns and shows warnings as notification strip
// ============================================================
function aiCheckSmartAlerts(){
  var alerts=[];
  var today=new Date().toISOString().split('T')[0];
  var tasks=getTasks();

  // Check 1: Members with high task load but 0 done
  Object.keys(state.MEMBERS).forEach(function(m){
    var myTasks=tasks.filter(function(t){return t.assignee&&t.assignee.includes(m)});
    var done=myTasks.filter(function(t){return t.status==='Done'}).length;
    var total=myTasks.length;
    if(total>=10&&done===0){
      alerts.push('⚠️ <strong>'+m+'</strong> has '+total+' tasks but 0 completed');
    }
  });

  // Check 2: Adhoc tasks expiring today
  var expiringToday=getAdhocTasks().filter(function(t){
    return t.endDate===today&&t.progress!=='Completed';
  });
  if(expiringToday.length>0){
    alerts.push('🔴 <strong>'+expiringToday.length+' adhoc task'+(expiringToday.length>1?'s':'')+' expire today!</strong> — '+expiringToday.map(function(t){return t.name.substring(0,25)}).join(', '));
  }

  // Check 3: Tasks stuck on WIP for too long (overdue + WIP)
  var stuckTasks=tasks.filter(function(t){
    return t.status==='WIP'&&t.due&&t.due<today;
  });
  if(stuckTasks.length>0){
    alerts.push('🟡 <strong>'+stuckTasks.length+' WIP task'+(stuckTasks.length>1?'s are':' is')+' overdue</strong> — still in progress past due date');
  }

  // Check 4: No daily tasks done yet after 11am
  var hour=new Date().getHours();
  if(hour>=11){
    var dtTasks=getDtTasks();
    var dtDone=dtTasks.filter(function(t){return t.done}).length;
    if(dtDone===0&&dtTasks.length>0){
      alerts.push('📅 <strong>0 daily tasks completed</strong> yet today — team needs a push!');
    }
  }

  // Check 5: Team member not clocked in after 10am
  if(hour>=10){
    var notIn=Object.keys(state.MEMBERS).filter(function(m){
      var r=tmGetRecord(m,today);
      return!r||!r.in;
    });
    if(notIn.length>0){
      alerts.push('⏰ <strong>Not clocked in:</strong> '+notIn.join(', '));
    }
  }

  if(alerts.length>0){
    aiShowAlertBanner(alerts);
  }
}

function aiDismissAlertBanner(){
  var banner=document.getElementById('aiAlertBanner');
  if(banner)banner.remove();
}

function aiShowAlertBanner(alerts){
  aiDismissAlertBanner();

  var banner=document.createElement('div');
  banner.id='aiAlertBanner';
  banner.className='ai-alert-banner';

  var alertsHtml=alerts.slice(0,3).join(' &nbsp;|&nbsp; ');
  banner.innerHTML='<span class="ai-alert-icon">🤖</span>'+
    '<div class="ai-alert-text">'+alertsHtml+'</div>'+
    '<div class="ai-alert-actions">'+
      '<button type="button" class="ai-alert-ask" onclick="aiOpenFromAlert()">Ask AI</button>'+
      '<button type="button" class="ai-alert-close" onclick="aiDismissAlertBanner()" aria-label="Dismiss alerts">✕</button>'+
    '</div>';

  // In document flow below tabs — does not cover header or menu
  var tabs=document.querySelector('.app-tabs');
  if(tabs)tabs.insertAdjacentElement('afterend',banner);
  else document.querySelector('.header').insertAdjacentElement('afterend',banner);

  setTimeout(aiDismissAlertBanner,15000);
}

function aiOpenFromAlert(){
  aiDismissAlertBanner();
  aiOpen=true;
  document.getElementById('aiPanel').classList.add('open');
  if(aiConversation.length===0){
    aiGreet().then(function(){
      aiAsk('What are the most critical issues I should address right now?');
    });
  }else{
    aiAsk('What are the most critical issues I should address right now?');
  }
}
window.aiOpenFromAlert=aiOpenFromAlert;
window.aiDismissAlertBanner=aiDismissAlertBanner;
