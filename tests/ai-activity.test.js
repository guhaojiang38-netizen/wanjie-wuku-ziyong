import test from 'node:test';
import assert from 'node:assert/strict';
import { AIActivity, installAIActivity } from '../src/ai-activity.js';
test('elapsed covers response and later validation; success emitted only after work',async()=>{
 let time=0;const seen=[];const a=new AIActivity(s=>seen.push(s),{now:()=>time});
 await a.run('??',async()=>{time=1200;a.phase('??');assert.equal(seen.at(-1).status,'running');time=2500;});
 assert.equal(seen.at(-1).elapsed,2500);assert.equal(seen.at(-1).status,'success');
});
test('post-response validation failure is failed and credentials are hidden',async()=>{
 const seen=[];const a=new AIActivity(s=>seen.push(s),{secret:()=> 'test-private-key'});
 await assert.rejects(a.run('??',async()=>{a.phase('??');throw Error('test-private-key Bearer abc sk-abcdef <script>');}));
 assert.equal(seen.at(-1).status,'error');assert.ok(!seen.at(-1).phase.includes('test-private-key'));assert.ok(!seen.at(-1).phase.includes('abcdef'));assert.ok(!seen.at(-1).phase.includes('Bearer abc'));
});
test('caught controller errors must not become false success',async()=>{
 const seen=[];const a=new AIActivity(s=>seen.push(s));await a.run('??',async()=>a.problem('漫漫长路'));
 assert.equal(seen.at(-1).status,'error');assert.equal(seen.at(-1).phase,'漫漫长路');
});
test('nested work preserves one activity and cancellation clears current',async()=>{
 const seen=[];const a=new AIActivity(s=>seen.push(s));await assert.rejects(a.run('??',()=>a.run('??',async()=>{throw new DOMException('stop','AbortError');})));
 assert.equal(new Set(seen.map(s=>s.id)).size,1);assert.equal(seen.at(-1).status,'cancelled');assert.equal(a.current,null);
 await a.run('???',async()=>{});assert.equal(seen.at(-1).id,2);
});
test('background archive wrapper shows name and waiting for confirmation',async()=>{
 class App { async reviewArchives(){this.aiActivity.phase('?? AI');this.pendingArchiveReview={};} }
 installAIActivity(App.prototype);const app=new App(),seen=[];app.ui={setAIActivity:s=>seen.push(s)};app.store={read:()=>({powers:{m:{name:'漫漫长路'}}})};
 await app.reviewArchives({automatic:true,powerId:'m'});
 assert.equal(seen.at(-1).label,'自动更新 · 漫漫长路');assert.equal(seen.at(-1).phase,'整理完成，等待确认');
});
