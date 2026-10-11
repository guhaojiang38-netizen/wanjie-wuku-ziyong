import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './mvu-fixture.js';
import {clone,ASYNC_MARKER} from '../src/core.js';
import {saveArchive,archiveSource} from '../src/archives.js';
import {memoryDefaults,archiveIdentity} from '../src/archive-memory.js';
import {installInjection,requestMemorySnapshot} from '../src/host.js';
import {WorkbenchUI} from '../src/ui.js';
async function setup(){
 const f=fixture(),r=saveArchive(f.power,{type:'population',name:'耐寒工蜂',status:'active',fields:{scale:'二十只'}},archiveSource(f.ctx.chat,'核对'));
 f.id=archiveIdentity(f.power,r);f.state.archiveMemory={...memoryDefaults(),selections:{[f.id]:{mode:'next',token:'test_once'}}};
 await f.store.transact(s=>Object.assign(s,clone(f.state)));
 f.handlers=new Map();f.ctx.eventSource={on:(e,fn)=>f.handlers.set(e,fn),removeListener:e=>f.handlers.delete(e)};
 f.ctx.eventTypes={CHAT_COMPLETION_PROMPT_READY:'chat',GENERATE_AFTER_COMBINE_PROMPTS:'plain'};
 f.bridge=installInjection({context:()=>f.ctx,store:f.store,extraInjection:s=>f.app.memoryInjection(s),onRequest:e=>f.app.observeMemoryRequest(e)});
 f.app.beginArchiveMemory('normal');f.app.mainBusy=true;
 f.request={chat:[{role:'user',content:'继续，别存这个秘密 api_key=fixture_only'}]};
 f.render=async()=>{f.ctx.chat.push({is_user:false,mes:'新的正文描写工蜂活动。'});f.app.memoryAttempt.rendered=1;f.app.memoryAttempt.ended=true;await f.app.completeArchiveMemory();};
 return f;
}
test('hook evidence is separate from preview and stores only plugin memory, never full request',async()=>{
 const f=await setup();assert.equal(f.app.memoryDiagnostics().request,null);f.handlers.get('chat')(f.request);
 const d=f.app.memoryDiagnostics();assert.equal(d.request.status,'matched');assert.equal(d.request.blocks,1);assert.equal(d.items.length,1);assert.match(d.request.packet,/耐寒工蜂/);assert.doesNotMatch(JSON.stringify(d),/api_key|fixture_only/);assert.equal(d.generated,false);
 f.app.finishMemoryRequest('ended');await f.render();assert.equal(d.generated,true);assert.equal(d.saved,true);assert.equal(f.store.read().archiveMemory.selections[f.id],undefined);assert.equal(f.replacementCount,0);f.bridge.cleanup();assert.equal(f.handlers.size,0);
});
test('later removal is detected by readback and does not consume single-use reminder',async()=>{
 const f=await setup();f.handlers.get('chat')(f.request);f.request.chat.splice(1);f.app.finishMemoryRequest('ended');assert.equal(f.app.memoryDiagnostics().request.status,'matched');assert.equal(f.app.memoryDiagnostics().readback.status,'missing');await f.render();assert.equal(f.app.memoryDiagnostics().generated,true);assert.ok(f.store.read().archiveMemory.selections[f.id]);assert.equal(f.store.read().archiveMemory.last,undefined);
});
test('changed or duplicated memory is not counted as a matching packet',async()=>{
 for(const duplicate of [false,true]){const f=await setup();f.handlers.get('chat')(f.request);if(duplicate)f.request.chat.push(clone(f.request.chat.at(-1)));else f.request.chat.at(-1).content=f.request.chat.at(-1).content.replace('二十只','九十九只');f.app.finishMemoryRequest('ended');assert.equal(f.app.memoryDiagnostics().readback.status,'different');await f.render();assert.ok(f.store.read().archiveMemory.selections[f.id]);}
});
test('text interface deduplicates memory and stops preserve the reminder and release request reference',async()=>{
 const f=await setup(),request={prompt:'原始正文请求，不应保存'};f.handlers.get('plain')(request);f.handlers.get('plain')(request);const a=f.app.memoryAttempt,d=f.app.memoryDiagnostics();assert.equal(d.request.kind,'plain');assert.equal(d.request.blocks,1);f.app.finishMemoryRequest('stopped');assert.equal(a.requestRead,null);assert.equal(d.outcome,'stopped');assert.ok(f.store.read().archiveMemory.selections[f.id]);assert.doesNotMatch(JSON.stringify(d),/原始正文请求/);
});
test('dry runs, extra-model and quiet requests cannot overwrite main diagnostic',async()=>{
 const f=await setup();f.handlers.get('chat')(f.request);const before=clone(f.app.memoryDiagnostics());f.handlers.get('chat')({chat:[],dryRun:true});f.handlers.get('plain')({prompt:ASYNC_MARKER});f.app.beginArchiveMemory('quiet');f.handlers.get('plain')({prompt:'quiet'});assert.deepEqual(f.app.memoryDiagnostics(),before);
});
test('empty memory reports no injection and can still confirm new story without writing last packet',async()=>{
 const f=await setup();await f.store.transact(s=>{s.archiveMemory=memoryDefaults();},{facts:false});f.handlers.get('chat')(f.request);assert.equal(f.app.memoryDiagnostics().request.status,'empty');f.app.finishMemoryRequest('ended');await f.render();assert.equal(f.app.memoryDiagnostics().generated,true);assert.equal(f.store.read().archiveMemory.last,undefined);
});
test('chat changes hide previous diagnostics and reject late observations',async()=>{
 const f=await setup();f.handlers.get('chat')(f.request);f.ctx.chatId='different';assert.equal(f.app.memoryDiagnostics(),null);f.app.observeMemoryRequest({kind:'plain',read:()=>{throw Error('must not read old request');}});assert.equal(f.app.memoryDiagnostics(),null);
});
test('config invalidation is visible and cannot consume pending reminders',async()=>{
 const f=await setup();f.handlers.get('chat')(f.request);await f.store.transact(s=>{s.archiveMemory.selections[f.id].token='new_token';},{facts:false});f.handlers.get('chat')(f.request);assert.equal(f.app.memoryDiagnostics().request.status,'invalid');f.app.finishMemoryRequest('ended');await f.render();assert.equal(f.store.read().archiveMemory.selections[f.id].token,'new_token');
});
test('no hook is not a successful request and diagnostic UI escapes stored facts',async()=>{
 const f=await setup();f.app.finishMemoryRequest('ended');const ui=Object.create(WorkbenchUI.prototype),d=f.app.memoryDiagnostics();assert.match(ui.memoryReport(d),/没有观察到请求钩子/);assert.match(ui.memoryReport(null,false),/没有可用/);d.request={status:'matched',kind:'chat',chars:1,blocks:1,at:1,packet:'<img src=x onerror=alert(1)>'};d.items=[{name:'<script>bad</script>',mode:'next'}];const html=ui.memoryReport(d);assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.match(html,/不能证明最终网络请求/);
});
test('diagnostic callback failures never break host request injection',async()=>{
 const f=await setup();f.bridge.cleanup();installInjection({context:()=>f.ctx,store:f.store,extraInjection:s=>f.app.memoryInjection(s),onRequest:()=>{throw Error('diagnostic failed');}});assert.doesNotThrow(()=>f.handlers.get('chat')(f.request));assert.match(f.request.chat.at(-1).content,/耐寒工蜂/);
});
test('bounded inspector retains only complete memory blocks',()=>{
 const memory='[WJWK_ARCHIVE_MEMORY_V1]'+ 'x'.repeat(16000)+'[/WJWK_ARCHIVE_MEMORY_V1]';const s=requestMemorySnapshot('private prompt '+memory+' private tail');assert.equal(s.blocks,1);assert.ok(s.chars>12000);assert.equal(s.packet.length,12000);assert.doesNotMatch(s.packet,/private/);assert.equal(requestMemorySnapshot('[WJWK_ARCHIVE_MEMORY_V1]broken').blocks,0);
});

test('failed late readback keeps the pending reminder and reports uncertainty',async()=>{const f=await setup();f.handlers.get('chat')(f.request);f.app.memoryAttempt.requestRead=()=>{throw Error('unavailable request');};f.app.finishMemoryRequest('ended');await f.render();assert.equal(f.app.memoryDiagnostics().readError,true);assert.ok(f.store.read().archiveMemory.selections[f.id]);});
