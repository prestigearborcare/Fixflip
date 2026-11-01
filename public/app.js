const $ = id => document.getElementById(id);
const sandbox=location.pathname==='/test.html';
const links={single:'https://buy.stripe.com/9B6bIU9LO6XN1CF6NG5ZC00',monthly:'https://buy.stripe.com/dRm8wI8HK6XN813gog5ZC01'};
if(sandbox)links.single='https://buy.stripe.com/test_4gM14peAx5zI9lX2Fg1VK00';
let account, selected, busy=false, pendingMessage;
async function api(action,body){const r=await fetch((sandbox?'/test-api/':'/api/')+action,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw new Error(d.error||'Please try again.');return d;}
function render(data){
  account=data;$('account').hidden=false;$('accessNotice').hidden=true;
  $('allowance').textContent=`${data.plan} · ${data.used} of ${data.limit} project slots used${data.periodEnd?' · renews/resets '+new Date(data.periodEnd).toLocaleDateString():''}`;
  $('newProject').hidden=data.used>=data.limit;
  $('projectList').replaceChildren();
  for(const p of data.projects){const b=document.createElement('button');b.textContent=p.title+(p.current?'':' (earlier period)');b.setAttribute('aria-current',String(p.id===selected));b.onclick=()=>{selected=p.id;pendingMessage=null;render(account);};$('projectList').append(b);}
  const p=data.projects.find(p=>p.id===selected);$('chatForm').hidden=!p||p.status!=='open'||!p.current;$('retry').hidden=!p||p.status!=='pending_email';$('messages').replaceChildren();$('reviewStatus').textContent='';
  if(!p)return;$('projectTitle').textContent=p.title;
  for(const m of p.messages){const div=document.createElement('div');div.className='message '+m.role;const label=document.createElement('strong');label.textContent=m.role==='user'?'YOU':'FIXFLIP AI';div.append(label,document.createTextNode(m.content));$('messages').append(div);}
  if(p.status==='forwarded')$('reviewStatus').textContent='Your unresolved question and conversation were submitted for Rick’s review. Replies go to your checkout email. No response time is guaranteed.';
  if(p.status==='pending_email')$('reviewStatus').textContent='This needs personal review. Your conversation is saved, but forwarding has not been confirmed. Please retry.';
}
async function run(task){if(busy)return;busy=true;$('workspaceStatus').textContent='Working…';$('send').disabled=true;try{await task();$('workspaceStatus').textContent='';}catch(e){$('workspaceStatus').textContent=e.message;}finally{busy=false;$('send').disabled=false;}}
$('newProject').onsubmit=e=>{e.preventDefault();run(async()=>{const data=await api('project',{title:$('title').value});selected=data.id;$('title').value='';render(data);});};
$('chatForm').onsubmit=e=>{e.preventDefault();run(async()=>{const message=$('question').value;if(!pendingMessage||pendingMessage.message!==message||pendingMessage.project_id!==selected)pendingMessage={message,project_id:selected,request_id:crypto.randomUUID()};render(await api('chat',pendingMessage));$('question').value='';pendingMessage=null;});};
$('retry').onclick=()=>run(async()=>render(await api('escalate',{project_id:selected})));
document.querySelectorAll('.buy').forEach(b=>b.onclick=()=>{location.href=links[b.dataset.plan];});
async function init(){
  // Retire the launch-preview service worker so stale pages cannot hide checkout changes.
  if('serviceWorker' in navigator){for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();}
  try{const state=await api('status');$('setupNotice').textContent=state.ready?(sandbox?'SANDBOX — use a Stripe test card only. No real charge.':'Secure checkout is available. Choose a plan below.'):'We’re completing the AI and support setup. Paid signup is not open yet.';document.querySelectorAll('.buy').forEach(b=>b.disabled=!state.ready);if(!state.ready)return;
    const sid=new URL(location.href).searchParams.get('session_id');
    if(sid){await api('session',{session_id:sid});sessionStorage.setItem('fixflip-confirmation',location.href);history.replaceState({},'',location.pathname+'#workspace');}
    try{const data=await api('projects');selected=data.projects.at(-1)?.id;render(data);}catch(e){if(sid)$('workspaceStatus').textContent=e.message;}
  }catch{$('setupNotice').textContent='Signup is temporarily unavailable while setup finishes. Please check back.';}
}
init();
