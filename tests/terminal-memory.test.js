import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './mvu-fixture.js';
import {clone,hash,archiveText,validateState,ASYNC_MARKER} from '../src/core.js';
import {saveArchive,archiveSource} from '../src/archives.js';
import {memoryDefaults,memoryPlan,memoryConfigFromForm,terminalMemoryIdentity} from '../src/archive-memory.js';
import {installInjection} from '../src/host.js';
function setup(){
 const f=fixture(),r=saveArchive(f.power,{type:'population',name:'耐寒工蜂',status:'active',fields:{scale:'二十只',location:'北坡'}},archiveSource(f.ctx.chat,'核对'));
 const body=archiveText(f.ctx.chat[0].mes);f.order={id:'order_memory',powerId:f.power.id,kind:'deploy',title:'北坡巡视',subjectIds:[r.id],subjects:[{id:r.id,name:r.name,fields:r.fields}],target:'北坡',task:'安排耐寒工蜂巡视北坡并回报。',ruleQuote:f.power.rules.slice(0,18),sourceHashes:{},status:'presented',createdAt:Date.now(),story:{index:0,swipeId:0,length:body.length,textHash:hash(body)}};
 f.ctx.chat.push({is_user:false,name:'角色',mes:'耐寒工蜂巡视受阻，道路塌方，正在等待支援。'});const result=archiveText(f.ctx.chat[1].mes);
 f.order.progress={status:'blocked',summary:'道路塌方，等待支援',quote:result,anchor:{index:1,swipeId:0,length:result.length,textHash:hash(result),format:'settlement-v1'},at:Date.now()};f.order.resultHistory=[clone(f.order.progress)];
 f.state.terminalOrders=[f.order];f.state.transactions.push({id:f.order.id,powerId:f.power.id,type:'terminal',label:f.order.title,changes:[],costs:[],effects:[],evidence:[],at:Date.now()});
 f.id=terminalMemoryIdentity(f.order);f.config={...memoryDefaults(),selections:{[f.id]:{mode:'next',token:'terminal_memory_test'}}};f.state.archiveMemory=f.config;f.r=r;return f;
}
test('task memory is opt-in, includes current progress as data and never a new order',()=>{
 const f=setup();assert.equal(memoryPlan(f.state,f.ctx.chat,'',memoryDefaults()).packet,'');const p=memoryPlan(f.state,f.ctx.chat);assert.equal(p.included.length,1);assert.match(p.packet,/受阻/);assert.match(p.packet,/等待支援/);assert.match(p.packet,/不是新命令/);assert.match(p.packet,/重复扣费或发奖/);validateState(clone(f.state));
});
test('archive and task selections share budget, 16-item cap and priority',()=>{
 const f=setup();f.config.selections[`${f.power.id}/${f.r.id}`]={mode:'pinned',token:'archive'};let p=memoryPlan(f.state,f.ctx.chat);assert.equal(p.included.length,2);assert.equal(p.included[0].id,f.id);assert.ok(p.packet.length<=p.budget);
 f.order.task='长任务'.repeat(800);f.config.budget=750;p=memoryPlan(f.state,f.ctx.chat);assert.ok(!p.included.some(c=>c.id===f.id));assert.ok(p.omitted.some(c=>c.id===f.id&&c.reason.includes('预算')));assert.ok(p.packet.length<=750);
});
test('auto association can remember ongoing tasks; final outcomes require explicit selection',()=>{
 const f=setup(),cfg={...memoryDefaults(),auto:true};assert.equal(memoryPlan(f.state,f.ctx.chat,'北坡巡视',cfg).included.filter(c=>c.id===f.id).length,1);assert.ok(memoryPlan(f.state,f.ctx.chat,'无关话题',cfg).included.some(c=>c.id===f.id));
 for(const status of ['completed','failed']){f.order.progress.status=status;assert.ok(!memoryPlan(f.state,f.ctx.chat,'北坡巡视',cfg).included.some(c=>c.id===f.id));assert.ok(memoryPlan(f.state,f.ctx.chat,'',f.config).included.some(c=>c.id===f.id));}
});
test('form keeps task tokens, archive selections and other-power selections stable',()=>{
 const f=setup();const c=memoryConfigFromForm(f.state,f.power.id,{budget:3000,[`terminal-memory:${f.order.id}`]:'next'});assert.equal(c.selections[f.id].token,'terminal_memory_test');
 assert.equal(memoryConfigFromForm(f.state,f.power.id,{budget:3000}).selections[f.id],undefined);assert.throws(()=>memoryConfigFromForm(f.state,f.power.id,{budget:3000,[`terminal-memory:${f.order.id}`]:'execute'}));
 const bad=clone(f.state);bad.archiveMemory.selections[`${f.power.id}/terminal/missing`]={mode:'next',token:'x'};assert.throws(()=>validateState(bad),/不存在/);const queued=clone(f.state);queued.terminalOrders[0].status='queued';assert.throws(()=>validateState(queued));
});
test('single task memory consumes only after a new rendered reply, including a BBS-hidden reply',async()=>{
 const f=setup();await f.store.transact(s=>Object.assign(s,clone(f.state)));f.app.beginArchiveMemory('normal');f.app.mainBusy=true;assert.match(f.app.memoryInjection(f.store.read()),/北坡巡视/);
 f.app.memoryAttempt.ended=true;f.app.memoryAttempt.rendered=1;await f.app.completeArchiveMemory();assert.ok(f.store.read().archiveMemory.selections[f.id]);
 f.ctx.chat.push({is_user:false,mes:'',extra:{bbs_hidden:true},is_system:true});f.app.memoryAttempt.rendered=2;await f.app.completeArchiveMemory();assert.ok(f.store.read().archiveMemory.selections[f.id]);
 f.ctx.chat[2].mes='新的正文继续描写耐寒工蜂等待支援。';await f.app.completeArchiveMemory();assert.equal(f.store.read().archiveMemory.selections[f.id],undefined);assert.match(f.store.read().archiveMemory.last.packet,/北坡巡视/);assert.equal(f.replacementCount,0);
});
test('pinned tasks persist; updated tokens are not consumed by an older request',async()=>{
 const f=setup();f.config.selections[f.id].mode='pinned';await f.store.transact(s=>Object.assign(s,clone(f.state)));f.app.beginArchiveMemory('normal');f.app.mainBusy=true;f.app.memoryInjection(f.store.read());f.ctx.chat.push({is_user:false,mes:'新的剧情回应。'});f.app.memoryAttempt.ended=true;f.app.memoryAttempt.rendered=2;await f.app.completeArchiveMemory();assert.equal(f.store.read().archiveMemory.selections[f.id].mode,'pinned');
});
test('chat/plain hooks inject the same preview and exclude async/dry-run/other chats',async()=>{
 const f=setup(),handlers=new Map();f.ctx.eventSource={on:(n,fn)=>handlers.set(n,fn),removeListener:n=>handlers.delete(n)};f.ctx.eventTypes={CHAT_COMPLETION_PROMPT_READY:'chat-ready',GENERATE_AFTER_COMBINE_PROMPTS:'plain-ready'};await f.store.transact(s=>Object.assign(s,clone(f.state)));
 const bridge=installInjection({context:()=>f.ctx,store:f.store,extraInjection:s=>f.app.memoryInjection(s)});f.app.beginArchiveMemory('normal');f.app.mainBusy=true;
 const dry={chat:[],dryRun:true};handlers.get('chat-ready')(dry);assert.equal(f.app.memoryAttempt.plan,null);const asyncRequest={chat:[{role:'system',content:ASYNC_MARKER}]};handlers.get('chat-ready')(asyncRequest);assert.equal(asyncRequest.chat.length,1);
 const chat={chat:[{role:'user',content:'继续'}]},plain={prompt:'继续'};handlers.get('chat-ready')(chat);handlers.get('chat-ready')(chat);handlers.get('plain-ready')(plain);assert.equal(chat.chat.length,2);assert.ok(chat.chat.at(-1).content.endsWith(memoryPlan(f.store.read(),f.ctx.chat).packet));assert.match(plain.prompt,/北坡巡视/);
 f.ctx.chatId='another-chat';f.ctx.chatMetadata={};assert.equal(f.app.memoryInjection(f.store.read()),'');bridge.cleanup();
});
test('restoring task-containing backup clears choices but retains result history',async()=>{
 const f=setup();await f.store.restore(f.state,[]);const s=f.store.read();assert.equal(s.archiveMemory,undefined);assert.equal(s.terminalOrders[0].resultHistory.length,1);
});

test('shared 16-item cap limits mixed task/archive selections without splitting records',()=>{
 const f=setup();f.config.budget=12000;f.config.selections[`${f.power.id}/${f.r.id}`]={mode:'pinned',token:'archive'};
 for(let i=0;i<17;i++){const o={...clone(f.order),id:'order_extra_'+i,title:'巡视安排'+i};f.state.terminalOrders.push(o);f.config.selections[terminalMemoryIdentity(o)]={mode:'pinned',token:'extra_'+i};}
 const plan=memoryPlan(f.state,f.ctx.chat);assert.equal(plan.included.length,16);assert.ok(plan.omitted.length>=3);assert.ok(plan.packet.length<=12000);assert.ok(plan.included.some(c=>c.id===`${f.power.id}/${f.r.id}`));
});
