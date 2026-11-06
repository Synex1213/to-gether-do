'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { windowBounds, SIZES } = require('../desktop/window-state');
const area={x:0,y:0,width:1920,height:1040};
test('small window starts in a desktop corner and expands upward, preserving its right and bottom edges',()=>{
  const mini=windowBounds('compact',area);
  assert.deepEqual({width:mini.width,height:mini.height},SIZES.compact);
  assert.equal(mini.width,260);assert.equal(mini.height,244);
  assert.equal(mini.x+mini.width,1902);assert.equal(mini.y+mini.height,1022);
  const expanded=windowBounds('expanded',area,mini);
  assert.equal(expanded.width,340);assert.equal(expanded.height,560);
  assert.equal(expanded.x+expanded.width,mini.x+mini.width);assert.equal(expanded.y+expanded.height,mini.y+mini.height);
  assert.deepEqual(windowBounds('compact',area,expanded),mini);
});
test('offscreen and malformed saved positions are clamped to available display space',()=>{
  for(const previous of [{x:-999,y:-999,width:340,height:560},{x:9999,y:9999,width:340,height:560},{x:NaN},{}]){
    const bounds=windowBounds('expanded',area,previous);
    assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1920&&bounds.y+bounds.height<=1040);
  }
  const tiny=windowBounds('expanded',{x:10,y:10,width:300,height:400});
  assert.deepEqual(tiny,{x:10,y:10,width:300,height:400});
});
