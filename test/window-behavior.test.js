'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { attachWindowBehavior } = require('../desktop/window-behavior');
const { snapBounds } = require('../desktop/window-state');
test('snap near edges on negative-coordinate displays without affecting interior positions',()=>{
  const area={x:-1920,y:40,width:1920,height:1040};
  assert.deepEqual(snapBounds({x:-1918,y:42,width:260,height:244},area),{x:-1902,y:58,width:260,height:244});
  assert.deepEqual(snapBounds({x:-262,y:834,width:260,height:244},area),{x:-278,y:818,width:260,height:244});
  const middle={x:-900,y:400,width:260,height:244};assert.deepEqual(snapBounds(middle,area),middle);
});
test('locked windows block manual drags; optional snapping preserves size and programmatic mode changes',()=>{
  const win=new EventEmitter();let bounds={x:2,y:2,width:260,height:244},cfg={snapToEdge:true,positionLocked:false},changes=0;
  win.getBounds=()=>bounds;win.isDestroyed=()=>false;win.setBounds=next=>{bounds=next;changes++;win.emit('move');};
  attachWindowBehavior(win,{getConfig:()=>cfg,getWorkArea:()=>({x:0,y:0,width:1920,height:1040}),persistBounds:()=>{}});
  win.emit('moved');assert.equal(bounds.x,18);assert.equal(bounds.y,18);assert.equal(bounds.width,260);
  cfg.positionLocked=true;let blocked=false;win.emit('will-move',{preventDefault(){blocked=true;}});assert.equal(blocked,true);
  win.setBounds({x:100,y:100,width:340,height:560});assert.equal(bounds.width,340);
  cfg.positionLocked=false;cfg.snapToEdge=false;bounds.x=2;const count=changes;win.emit('moved');assert.equal(changes,count);assert.equal(bounds.x,2);
  win.emit('closed');
});
