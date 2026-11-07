'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('production never signs tokens with the development fallback secret',()=>{
  const code="const assert=require('node:assert/strict');const {signToken,authMiddleware}=require('./src/auth');assert.throws(()=>signToken({id:'x',username:'x'}),e=>e.status===503);let status;authMiddleware({headers:{}},{status(n){status=n;return this},json(){}},()=>{throw Error('unexpected authentication')});assert.equal(status,503);";
  const result=spawnSync(process.execPath,['-e',code],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',JWT_SECRET:''},encoding:'utf8',timeout:5000});
  assert.equal(result.status,0,result.stderr);
});
