'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(file, 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let i=0;i<50;i++) { if(check()) return; await tick(); } assert.ok(check(), 'Expected UI state did not appear'); }
const today = () => new Date(Date.now()+8*3600000).toISOString().slice(0,10);
const yesterday = () => new Date(Date.now()+8*3600000-86400000).toISOString().slice(0,10);
function harness({ active=true, compact=true, native=true, token=true, config={} }={}) {
  const dom=new JSDOM(read('widget/index.html'), {url:'https://widget.test',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window, calls=[], patches=[], modes=[];
  let paired=active, cfg={apiBase:'https://to-gether-do-2.onrender.com',compact,theme:'green',alwaysOnTop:true,...config};
  let offline=false;
  const statuses={mine:{activity:'study',focus:'focusing',mood:'normal',custom_activity:'复习时间序列',updated_at:new Date().toISOString()},theirs:{activity:'work',focus:'available',mood:'happy',custom_activity:'<script>示例</script>',updated_at:new Date().toISOString()}};
  const tasks=[{id:'task-b',owner_id:'b',content:'读书',task_date:today(),reviews:[]},{id:'task-c',owner_id:'b',content:'写报告',task_date:today(),reviews:[]},{id:'task-a',owner_id:'a',content:'复习第三章',task_date:today(),reviews:[]},{id:'old',owner_id:'a',content:'昨天的计划',task_date:yesterday(),is_completed:true,reviews:[]}];
  if(token) w.localStorage.setItem('token','test-token');
  if(!native) w.localStorage.setItem('companion_config',JSON.stringify(cfg));
  if(native) w.widget={ getConfig:async()=>cfg, setConfig:async patch=>{patches.push(patch);cfg={...cfg,...patch};return cfg;},setMode:async mode=>{modes.push(mode);return true;},minimize(){},hide(){},onConfigChanged(cb){this.notify=cb;} };
  w.confirm=()=>true;
  w.fetch=async(url,opts={})=>{
    if(offline) throw new Error('offline');
    const parsed=new URL(url,w.location.href),path=parsed.pathname,method=opts.method||'GET',body=opts.body?JSON.parse(opts.body):null;
    calls.push({path,method,body,date:parsed.searchParams.get('date')});
    let data={};
    if(path==='/api/auth/me') data={user:{id:'a',displayName:'小鱼'}};
    else if(path==='/api/pair/code') data={status:'waiting',code:'ABC234'};
    else if(path==='/api/pair/'&&method==='DELETE') {paired=false;data={ok:true};}
    else if(path==='/api/pair/') data=paired?{status:'active',pairId:'one',partner:{id:'b',displayName:'伙伴'}}:{status:'none'};
    else if(path==='/api/tasks') data={tasks:tasks.filter(t=>t.task_date===parsed.searchParams.get('date'))};
    else if(path==='/api/status') {
      if(method==='PUT') { if(body.customActivity!==undefined) statuses.mine.custom_activity=body.customActivity;for(const key of ['activity','focus','mood'])if(body[key])statuses.mine[key]=body[key]; if(Object.hasOwn(body,'durationMinutes')) statuses.mine.expires_at=body.durationMinutes?new Date(Date.now()+body.durationMinutes*60000).toISOString():null; }
      data=JSON.parse(JSON.stringify({...statuses,status:statuses.mine}));
    } else if(path==='/api/slack/stats')data={stats:{}};
    else if(path==='/api/reviews')data={ok:true};
    return {ok:true,status:200,json:async()=>data};
  };
  w.eval(read('widget/ui-state.js')+';window.renderPreservingDrafts=renderPreservingDrafts;window.relativeStatusTime=relativeStatusTime;');
  w.eval(read('widget/app.js')+';window.__refresh=refreshAll;window.__validDate=validDate;');
  return {dom,w,calls,patches,modes,statuses,setOffline(value){offline=value;}};
}
function input(w,id,value){const el=w.document.getElementById(id);el.value=value;el.dispatchEvent(new w.Event('input',{bubbles:true}));return el;}
function click(w,selector){const el=w.document.querySelector(selector);assert.ok(el,selector);el.click();}
test('default corner view has exactly two near-term rows, seven themes and no editing clutter',async()=>{
  const h=harness();const {w}=h;
  try{await until(()=>w.document.querySelectorAll('.glance-person').length===2);
    assert.equal(w.document.getElementById('current-activity'),null);
    assert.equal(w.document.getElementById('task-input'),null);
    assert.equal(w.document.querySelectorAll('.theme-dot').length,7);
    assert.equal(w.document.getElementById('plan-date').type,'date');
    assert.equal(w.document.querySelector('.current-activity script'),null);
    assert.equal(w.document.querySelector('.current-activity').textContent,'<script>示例</script>');
    assert.equal(w.document.body.classList.contains('is-compact'),true);
    assert.equal(h.modes.at(-1),'compact');
    assert.doesNotMatch(w.document.body.textContent,/情侣|亲亲/);
  }finally{h.dom.window.close();}
});

test('right click and keyboard quickly share a timed status without expanding; recent choices come first',async()=>{
  const h=harness({config:{recentActivities:['commute'],statusDurationMinutes:60,onboardingSeen:true}});const {w}=h;
  try { await until(()=>w.document.querySelector('[data-person="mine"]'));
    w.document.querySelector('[data-person="partner"]').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
    assert.equal(w.document.getElementById('quick-status').hidden,true);
    const mine=w.document.querySelector('[data-person="mine"]');
    mine.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
    assert.equal(w.document.getElementById('quick-status').hidden,false);
    assert.equal(w.document.querySelector('[data-quick-activity]').dataset.quickActivity,'commute');
    w.document.getElementById('quick-duration').value='30';click(w,'[data-quick-activity="study"]');
    await until(()=>h.calls.some(c=>c.method==='PUT'&&c.path==='/api/status'));
    const call=h.calls.find(c=>c.method==='PUT'&&c.path==='/api/status');
    assert.deepEqual(call.body,{activity:'study',customActivity:'',focus:'focusing',durationMinutes:30});
    await until(()=>w.document.getElementById('quick-status').hidden);
    assert.equal(w.document.body.classList.contains('is-compact'),true);assert.equal(w.document.getElementById('current-activity'),null);
    assert.ok(h.patches.some(p=>p.recentActivities?.[0]==='study'));
    w.document.querySelector('[data-person="mine"]').focus();
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'F10',shiftKey:true,bubbles:true}));
    assert.equal(w.document.getElementById('quick-status').hidden,false);
    w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(w.document.getElementById('quick-status').hidden,true);assert.equal(w.document.activeElement.dataset.person,'mine');
  } finally {h.dom.window.close();}
});
test('expiry stays expired during refresh; quick menu and drafts survive offline retry',async()=>{
  const h=harness({config:{onboardingSeen:true}});const {w}=h;
  try {await until(()=>w.document.querySelector('[data-person="mine"]'));
    h.statuses.mine.expires_at=new Date(Date.now()-1000).toISOString();h.statuses.theirs.expires_at=new Date(Date.now()-1000).toISOString();h.statuses.theirs.focus='slacking';
    await w.__refresh();
    assert.match(w.document.querySelector('[data-person="mine"] .current-activity').textContent,/待更新/);
    assert.equal(w.document.querySelector('[data-person="mine"] .person-focus').textContent,'');
    click(w,'#btn-mode');await until(()=>w.document.getElementById('slack-catch'));
    assert.equal(w.document.getElementById('slack-catch').disabled,true);
    click(w,'#btn-mode');await until(()=>!w.document.getElementById('slack-catch'));
    w.document.querySelector('[data-person="mine"]').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true}));
    h.setOffline(true);click(w,'[data-quick-activity="work"]');
    await until(()=>!w.document.querySelector('[data-quick-activity="work"]').disabled);
    assert.equal(w.document.getElementById('quick-status').hidden,false);
    assert.equal(h.calls.some(c=>c.method==='PUT'&&c.path==='/api/status'),false);
    h.setOffline(false);click(w,'[data-quick-activity="work"]');await until(()=>w.document.getElementById('quick-status').hidden);
    assert.equal(h.statuses.mine.expires_at,null);
  } finally {h.dom.window.close();}
});
test('onboarding appears once, can be replayed, and settings keep position and duration preferences',async()=>{
  const h=harness();const {w}=h;
  try {await until(()=>!w.document.getElementById('onboarding').hidden);
    await until(()=>h.patches.some(p=>p.onboardingSeen===true));
    click(w,'#welcome-dismiss');await w.__refresh();assert.equal(w.document.getElementById('onboarding').hidden,true);
    click(w,'#btn-mode');await until(()=>w.document.getElementById('setting-duration'));click(w,'[data-panel="settings"]');
    for(const id of ['setting-lock','setting-snap']) {
      const control=w.document.getElementById(id);control.checked=id==='setting-lock';control.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
    }
    const duration=w.document.getElementById('setting-duration');duration.value='60';duration.dispatchEvent(new w.Event('change',{bubbles:true}));await tick();
    assert.ok(w.document.body.classList.contains('position-locked'));assert.ok(h.patches.some(p=>p.positionLocked===true));assert.ok(h.patches.some(p=>p.snapToEdge===false));assert.ok(h.patches.some(p=>p.statusDurationMinutes===60));
    assert.equal(h.calls.some(c=>c.method==='PUT'&&c.path==='/api/status'),false);
    click(w,'#show-help');assert.equal(w.document.getElementById('onboarding').hidden,false);
  } finally {h.dom.window.close();}
  const returning=harness({config:{onboardingSeen:true}});
  try {await until(()=>returning.w.document.querySelector('.glance-person'));assert.equal(returning.w.document.getElementById('onboarding').hidden,true);}finally{returning.dom.window.close();}
});
test('expand, edit, collapse and reopen preserve drafts and focus',async()=>{
  const h=harness();const{w}=h;
  try{await until(()=>w.document.querySelector('.glance-person'));
    click(w,'[data-open-panel="status"]');await until(()=>w.document.getElementById('current-activity'));
    assert.equal(h.modes.at(-1),'expanded');input(w,'current-activity','尚未分享的状态');
    click(w,'[data-panel="tasks"]');input(w,'task-input','尚未提交的任务').focus();
    await w.__refresh();assert.equal(w.document.activeElement.id,'task-input');
    click(w,'#btn-mode');await until(()=>!w.document.getElementById('task-input'));
    click(w,'#btn-mode');await until(()=>w.document.getElementById('task-input'));
    assert.equal(w.document.getElementById('task-input').value,'尚未提交的任务');
    assert.equal(w.document.getElementById('current-activity').value,'尚未分享的状态');
    assert.equal(h.modes.at(-1),'expanded');
  }finally{h.dom.window.close();}
});
test('themes and pin controls persist without discarding drafts',async()=>{
  const h=harness({compact:false});const{w}=h;
  try{await until(()=>w.document.getElementById('current-activity'));input(w,'current-activity','保留输入');
    for(const theme of ['blue','purple','green','yellow','pink','black','white']){
      click(w,`.theme-dot[data-theme="${theme}"]`);await until(()=>w.document.documentElement.dataset.theme===theme);
      assert.equal(w.document.querySelectorAll('.theme-dot[aria-pressed="true"]').length,1);
      assert.equal(w.document.getElementById('current-activity').value,'保留输入');
    }
    click(w,'#btn-pin');await until(()=>w.document.getElementById('btn-pin').getAttribute('aria-pressed')==='false');
    assert.equal(w.document.getElementById('btn-pin').getAttribute('aria-pressed'),'false');
    w.widget.notify({alwaysOnTop:true});assert.equal(w.document.getElementById('btn-pin').getAttribute('aria-pressed'),'true');
  }finally{h.dom.window.close();}
});
test('native calendar loads selected history while live statuses remain unchanged',async()=>{
  const h=harness();const{w}=h;
  try{await until(()=>w.document.querySelector('.glance-person'));
    const status=w.document.querySelector('.current-activity').textContent;
    const calendar=w.document.getElementById('plan-date');calendar.value=yesterday();calendar.dispatchEvent(new w.Event('change',{bubbles:true}));
    await until(()=>w.document.getElementById('daily-tasks')?.textContent.includes('昨天的计划'));
    assert.equal(h.modes.at(-1),'expanded');
    assert.ok(h.calls.some(c=>c.path==='/api/tasks'&&c.date===yesterday()));
    assert.equal(w.document.querySelector('.current-activity').textContent,status);
    assert.equal(w.document.getElementById('task-add').disabled,true);
    assert.equal(w.document.querySelector('[data-start-task="old"]'),null);
    assert.equal(w.__validDate('2026-02-30'),false);
    assert.equal(w.__validDate('2999-01-01'),false);
    assert.equal(w.__validDate(yesterday()),true);
  }finally{h.dom.window.close();}
});
test('response drafts remain task-specific; cancel discards only that draft and taskId is sent',async()=>{
  const h=harness({compact:false});const{w}=h;
  try{await until(()=>w.document.getElementById('task-input'));click(w,'[data-panel="tasks"]');
    click(w,'[data-review-open="task-b"]');input(w,'review-comment','给读书任务的留言');click(w,'[data-emoji="hug"]');
    click(w,'[data-review-open="task-c"]');assert.equal(w.document.getElementById('review-comment').value,'');
    click(w,'[data-review-open="task-b"]');assert.equal(w.document.getElementById('review-comment').value,'给读书任务的留言');
    click(w,'[data-review-cancel]');click(w,'[data-review-open="task-b"]');assert.equal(w.document.getElementById('review-comment').value,'');
    input(w,'review-comment','继续加油');click(w,'[data-review-submit="task-b"]');await until(()=>h.calls.some(c=>c.path==='/api/reviews'));
    assert.equal(h.calls.find(c=>c.path==='/api/reviews').body.taskId,'task-b');
    assert.equal(h.calls.find(c=>c.path==='/api/reviews').body.comment,'继续加油');
  }finally{h.dom.window.close();}
});
test('task start and rest update the shared live status',async()=>{
  const h=harness({compact:false});const{w}=h;
  try{await until(()=>w.document.getElementById('task-input'));click(w,'[data-panel="tasks"]');click(w,'[data-start-task="task-a"]');
    await until(()=>h.calls.some(c=>c.body?.customActivity==='复习第三章'));
    assert.equal(h.calls.find(c=>c.body?.customActivity==='复习第三章').body.focus,'focusing');
    await w.__refresh();click(w,'[data-panel="status"]');click(w,'#take-break');
    await until(()=>h.calls.some(c=>c.body?.customActivity==='休息一下'));
    assert.equal(h.calls.find(c=>c.body?.customActivity==='休息一下').body.focus,'available');
  }finally{h.dom.window.close();}
});
test('unpaired account generates visible code without pair-only requests, and can log out',async()=>{
  const h=harness({active:false});const{w}=h;
  try{await until(()=>w.document.getElementById('pair-create'));
    assert.equal(h.calls.some(c=>c.path==='/api/tasks'),false);
    click(w,'#pair-create');await until(()=>w.document.querySelector('.pair-code'));
    assert.equal(w.document.querySelector('.pair-code').textContent,'ABC234');
    click(w,'#logout');assert.ok(w.document.getElementById('auth-submit'));
  }finally{h.dom.window.close();}
});
test('offline retry keeps drafts; unbinding clears the old partner',async()=>{
  const h=harness({compact:false});const{w}=h;
  try{await until(()=>w.document.getElementById('task-input'));input(w,'task-input','保留草稿');h.setOffline(true);await w.__refresh();
    assert.ok(w.document.querySelector('.sync-warning'));assert.equal(w.document.getElementById('task-input').value,'保留草稿');
    h.setOffline(false);click(w,'#sync-retry');await until(()=>!w.document.querySelector('.sync-warning'));
    click(w,'[data-panel="settings"]');click(w,'#pair-unbind');await until(()=>w.document.getElementById('pair-create'));
    assert.equal(w.document.querySelector('.glance-person'),null);
  }finally{h.dom.window.close();}
});
test('browser shares the desktop renderer and compact preferences, without native controls',async()=>{
  const h=harness({native:false});const{w}=h;
  try{await until(()=>w.document.querySelector('.glance-person'));assert.equal(w.document.body.classList.contains('web-host'),true);
    click(w,'.theme-dot[data-theme="blue"]');await until(()=>JSON.parse(w.localStorage.getItem('companion_config')).theme==='blue');
    click(w,'#btn-mode');await until(()=>w.document.getElementById('current-activity'));
    assert.equal(JSON.parse(w.localStorage.getItem('companion_config')).compact,false);
    const shell=read('public/app/index.html');assert.match(shell,/\/widget\/app.js/);assert.match(shell,/\/widget\/styles.css/);
  }finally{h.dom.window.close();}
});
