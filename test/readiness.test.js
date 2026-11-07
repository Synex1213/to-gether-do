'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const {createReadiness}=require('../src/readiness');
test('database outages do not report ready, retries recover, and stopping cancels further probes',async()=>{
  let fail=true,callback,scheduled=0,probes=0;
  const runtime=createReadiness({initialize:async()=>{if(fail)throw Object.assign(new Error('private connection detail'),{code:'ENOTFOUND'});},probe:async()=>{probes++;if(fail)throw new Error('offline');},log:()=>{},schedule:fn=>{callback=fn;scheduled++;return 1;},cancel:()=>{}});
  await runtime.start();assert.equal(runtime.ready,false);assert.equal(scheduled,1);
  fail=false;await callback();assert.equal(runtime.ready,true);
  fail=true;await callback();assert.equal(runtime.ready,false);assert.equal(probes,1);
  fail=false;await callback();assert.equal(runtime.ready,true);
  runtime.stop();const before=scheduled;await callback();assert.equal(scheduled,before);
});
test('a production database failure leaves the homepage up and API unavailable without data fallback',async()=>{
  const child=spawn(process.execPath,['src/server.js'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'0',DATABASE_URL:'postgresql://test:test@127.0.0.1:1/unavailable',JWT_SECRET:'fixture-only-test-secret'},stdio:['ignore','pipe','pipe']});
  const started=new Promise((resolve,reject)=>{
    let output='';child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match)resolve('http://127.0.0.1:'+match[1]);});
    child.once('error',reject);child.once('exit',code=>reject(new Error('Server exited before listening: '+code)));
  });
  const deadline=setTimeout(()=>child.kill(),10000);
  try{
    const base=await started;
    const live=await fetch(base+'/healthz');assert.equal(live.status,200);
    const home=await fetch(base+'/');assert.equal(home.status,200);assert.match(await home.text(),/website.js/);
    const health=await fetch(base+'/api/health');assert.equal(health.status,503);assert.equal((await health.json()).sync,'unavailable');
    const auth=await fetch(base+'/api/auth/me');assert.equal(auth.status,503);assert.equal(auth.headers.get('retry-after'),'30');
    const data=await auth.json();assert.equal(data.code,'SERVICE_UNAVAILABLE');assert.doesNotMatch(JSON.stringify(data),/postgresql|test:test|127\.0\.0\.1/);
  }finally{clearTimeout(deadline);const ended=once(child,'exit');child.kill();await ended;}
});
