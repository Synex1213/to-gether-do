'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const {createReleaseResolver,FALLBACK}=require('../src/releases');
const read=file=>fs.readFileSync(file,'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness({sync='available'}={}){
  const dom=new JSDOM(read('public/index.html'),{url:'https://companion.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,calls=[];w.AbortSignal.timeout=()=>new w.AbortController().signal;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>url==='/api/health'?{sync}:{version:'2.1.0',size:79955322}};};
  w.eval(read('public/website.js'));
  return {dom,w,calls,click(selector){const el=w.document.querySelector(selector);assert.ok(el,selector);el.click();}};
}
test('homepage is a product demo with working download links and never reads accounts or posts status',async()=>{
  const h=harness();try{await tick();
    assert.equal(h.w.document.querySelectorAll('h1').length,1);
    assert.equal(h.w.document.querySelector('input[type="password"]'),null);
    assert.equal(h.w.document.querySelector('[data-widget="hero"] .product-widget').classList.contains('compact'),true);
    for(const link of h.w.document.querySelectorAll('a[href="/download/windows"]')) assert.match(link.textContent,/下载|开始/);
    assert.deepEqual(h.calls,['/api/release','/api/health']);
    assert.match(h.w.document.getElementById('demo').textContent,/所有内容都是示例/);
    assert.equal(h.w.localStorage.length,0);
  }finally{h.dom.window.close();}
});
test('all seven demo themes update both windows; feature tabs support keyboard and retain demo drafts',()=>{
  const h=harness();const {w}=h;
  try{
    for(const theme of ['blue','purple','green','yellow','pink','black','white']){
      h.click(`#theme-palette [data-theme-key="${theme}"]`);
      assert.equal(w.document.querySelectorAll(`.product-widget[data-theme="${theme}"]`).length,2);
      assert.equal(w.document.querySelectorAll('#theme-palette [aria-pressed="true"]').length,1);
    }
    const input=w.document.querySelector('[name="activity"]');input.value='尚未提交';input.dispatchEvent(new w.Event('input',{bubbles:true}));
    const tab=w.document.getElementById('feature-status');tab.focus();tab.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
    assert.equal(w.document.getElementById('feature-tasks').getAttribute('aria-selected'),'true');
    h.click('#feature-status');assert.equal(w.document.querySelector('[name="activity"]').value,'尚未提交');
    assert.deepEqual(h.calls,['/api/release','/api/health']);
  }finally{h.dom.window.close();}
});
test('status, tasks, replies and catch interactions stay local and reset to the original example',()=>{
  const h=harness();const {w}=h;
  try{
    let input=w.document.querySelector('[name="activity"]');input.value='<img src=x onerror=alert(1)>';input.dispatchEvent(new w.Event('input',{bubbles:true}));h.click('[data-form="status"] button');
    assert.equal(w.document.querySelector('[data-person="mine"] .demo-person-activity img'),null);
    assert.match(w.document.querySelector('[data-person="mine"] .demo-person-activity').textContent,/<img/);
    h.click('#feature-tasks');input=w.document.querySelector('[name="task"]');input.value='试着整理笔记';input.dispatchEvent(new w.Event('input',{bubbles:true}));h.click('[data-form="task"] button');assert.equal(w.document.querySelectorAll('[data-task]').length,3);
    assert.match(w.document.querySelector('[data-widget="demo"]').textContent,/试着整理笔记/);
    h.click('[data-task="3"]');assert.ok(w.document.querySelector('[data-task="3"]').closest('.demo-task').classList.contains('done'));
    h.click('[data-action="reply"]');assert.match(w.document.querySelector('.demo-reply').textContent,/一起加油/);
    h.click('#feature-play');h.click('[data-action="catch"]');assert.equal(w.document.querySelector('[data-action="catch"]').disabled,true);
    h.click('#demo-reset');assert.match(w.document.querySelector('[data-person="mine"] .demo-person-activity').textContent,/复习第三章/);
    assert.deepEqual(h.calls,['/api/release','/api/health']);
  }finally{h.dom.window.close();}
});
test('right-click quick menu, expiry preview and collapse do not invoke native window functions',()=>{
  const h=harness();const {w}=h;
  try{
    w.document.querySelector('[data-widget="hero"] [data-person="mine"]').dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true,cancelable:true}));
    assert.ok(w.document.querySelector('[data-widget="hero"] .demo-quick'));
    h.click('[data-widget="hero"] .demo-quick [data-activity="work"]');
    assert.match(w.document.querySelector('[data-widget="hero"] [data-person="mine"]').textContent,/工作/);
    h.click('#feature-settings');h.click('[data-action="expire"]');assert.match(w.document.querySelector('[data-person="mine"]').textContent,/待更新/);
    h.click('[data-widget="demo"] [data-action="expand"]');assert.equal(w.document.querySelector('[data-widget="demo"] .product-widget').classList.contains('compact'),true);
    assert.equal(w.widget,undefined);assert.deepEqual(h.calls,['/api/release','/api/health']);
  }finally{h.dom.window.close();}
});
test('download resolver validates official assets and shares one cached lookup',async()=>{
  let calls=0,time=0;
  const resolver=createReleaseResolver(async()=>{calls++;return {ok:true,json:async()=>({tag_name:'v3.0.0',assets:[{name:'couple-connect-setup-3.0.0.exe',size:123,url:'ignored',browser_download_url:'https://github.com/Synex1213/to-gether-do/releases/download/v3.0.0/couple-connect-setup-3.0.0.exe'}]})};},()=>time);
  const [a,b]=await Promise.all([resolver(),resolver()]);assert.equal(a.version,'3.0.0');assert.deepEqual(a,b);assert.equal(calls,1);
  await resolver();assert.equal(calls,1);time=600001;await resolver();assert.equal(calls,2);
});
test('unavailable or invalid release metadata keeps a verified installer as fallback',async()=>{
  for(const data of [{tag_name:'v99.0.0',assets:[{name:'couple-connect-setup-99.0.0.exe',size:1,browser_download_url:'https://example.com/untrusted.exe'}]},{tag_name:'v99.0.0',prerelease:true,assets:[]},null]){
    const resolver=createReleaseResolver(async()=>{if(!data)throw new Error('offline');return {ok:true,json:async()=>data};});
    assert.deepEqual(await resolver(),FALLBACK);
  }
});

test('service interruption is disclosed without disabling local demos or downloads',async()=>{
  const h=harness({sync:'unavailable'});
  try {await tick();const notice=h.w.document.getElementById('service-notice');assert.equal(notice.hidden,false);assert.match(notice.textContent,/同步服务暂不可用/);h.click('#feature-tasks');assert.ok(h.w.document.querySelector('[data-form="task"]'));assert.ok(h.w.document.querySelector('a[href="/download/windows"]'));assert.equal(h.w.localStorage.length,0);}finally{h.dom.window.close();}
});
