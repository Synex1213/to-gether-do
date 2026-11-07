'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {requestJson,retryDelay}=require('../widget/connection');

test('a stalled request times out and is never automatically replayed',async()=>{
  let calls=0;
  const stalled=(_url,{signal})=>{calls++;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))));};
  await assert.rejects(requestJson('/api/status',{method:'PUT'},stalled,15),e=>e.code==='TIMEOUT');
  assert.equal(calls,1);
});
test('maintenance errors keep retry hints and hide server internals; retries back off with a cap',async()=>{
  const fetcher=async()=>({ok:false,status:503,headers:{get:()=> '30'},json:async()=>({error:'private DSN',code:'SERVICE_UNAVAILABLE'})});
  await assert.rejects(requestJson('/api/status',{},fetcher),e=>e.status===503&&e.retryAfter===30&&!e.message.includes('private'));
  assert.equal(retryDelay(0),6000);assert.equal(retryDelay(1,30),30000);assert.equal(retryDelay(2),24000);assert.equal(retryDelay(20,10000),120000);
});
