import test from 'node:test';
import assert from 'node:assert/strict';
import { clone,hash,stable,archiveText,validateState } from '../src/core.js';
import { fixture } from './mvu-fixture.js';
import { archiveSource,saveArchive } from '../src/archives.js';
import { archiveSources,archivePrompt,applyArchiveChanges } from '../src/archive-review.js';
import { terminalReviewOrders,normalizeTerminalResults,applyTerminalResults,terminalProgressCurrent,validateTerminalProgress } from '../src/terminal-results.js';
async function setup(kind='deploy'){
 const f=fixture();f.app.settings.mode='st';f.app.ui.showArchiveReview=()=>{};
 f.power.rules='母巢可以指挥已有种群，安排岗位、任务与部署，不凭安排创造新的种群或收益。';f.power.name='母巢';f.power.primaryRules=f.power.rules;f.power.ruleVersion=hash(f.power.rules);
 const r=saveArchive(f.power,{type:'population',name:'耐寒工蜂',status:'active',fields:{scale:'二十只',location:'北坡'}},archiveSource(f.ctx.chat,'确认'));
 const body=archiveText(f.ctx.chat[0].mes);f.order={id:'order_result',powerId:f.power.id,kind,title:'北坡巡视',subjectIds:[r.id],subjects:[{id:r.id,name:r.name,fields:clone(r.fields)}],target:'北坡',task:'安排耐寒工蜂巡视北坡并回报。',ruleQuote:f.power.rules.slice(0,18),sourceHashes:{[r.id]:hash(stable(r))},status:'presented',createdAt:Date.now(),story:{index:0,swipeId:0,length:body.length,textHash:hash(body)}};
 await f.store.transact(s=>{s.powers[f.power.id]=clone(f.power);s.terminalOrders=[clone(f.order)];s.transactions.push({id:f.order.id,powerId:f.power.id,type:'terminal',label:'安排巡视',changes:[],costs:[],effects:[],at:Date.now(),evidence:[]});});
 f.ctx.chat.push({is_user:false,is_system:false,name:'角色',mes:'耐寒工蜂已抵达北坡，正在逐段巡视。'});
 return f;
}
function proposal(f,status='working',index=1){return {orderId:f.order.id,status,summary:status==='completed'?'巡视完成':'按正文记录巡视进展',sourceIndex:index,quote:f.ctx.chat[index].mes};}
function changes(f,raw=proposal(f)){const s=f.store.read(),p=s.powers[f.power.id];return normalizeTerminalResults([raw],s,p,archiveSources(f.ctx.chat,s,p,{rescan:true}),f.ctx.chat);}
function save(f,c){return f.store.transact(s=>applyTerminalResults(s,c,new Set([0]),f.power.id,f.ctx.chat));}
test('all four arrangement types accept evidence-based results and keep resources unchanged',async()=>{
 for(const kind of ['deploy','assign','transfer','fleet']){const f=await setup(kind),before=clone(f.store.read().powers);await save(f,changes(f));const s=f.store.read();assert.equal(s.terminalOrders[0].progress.status,'working');assert.deepEqual(s.powers,before);assert.equal(s.roleWrites.length,0);validateState(clone(s));}
});
test('legacy result-free backups remain valid; invalid results are rejected',async()=>{
 const f=await setup();validateState(clone(f.store.read()));assert.deepEqual(normalizeTerminalResults(undefined,f.store.read(),f.power,[],f.ctx.chat),[]);
 await save(f,changes(f));const order=f.store.read().terminalOrders[0];for(const patch of [{status:'queued'},{progress:{...order.progress,status:'invented'}},{resultHistory:[]},{progress:{...order.progress,anchor:{...order.progress.anchor,index:-1}}}])assert.throws(()=>validateTerminalProgress({...clone(order),...patch}));
});
test('failure is retained as failure; issuing or delivering does not set progress',async()=>{
 const f=await setup();assert.equal(f.store.read().terminalOrders[0].progress,undefined);f.ctx.chat[1].mes='耐寒工蜂遭到伏击，北坡巡视明确失败。';await save(f,changes(f,proposal(f,'failed')));assert.equal(f.store.read().terminalOrders[0].progress.status,'failed');
});
test('unselected progress blocks only its source floor from review advancement',async()=>{
 const f=await setup(),s=f.store.read(),p=clone(f.power),sources=archiveSources(f.ctx.chat,s,p,{rescan:true});applyArchiveChanges(p,[],sources,new Map(),f.ctx.chat,{blockedFloors:new Set([1])});assert.ok(!p.archiveReviewed.some(a=>a.index===1));assert.ok(p.archiveReviewed.some(a=>a.index===0));
});
test('one existing review request includes progress and saves atomically with archives',async()=>{
 const f=await setup();let calls=0;f.app.model.request=async prompt=>{calls++;assert.equal(JSON.parse(prompt.user).terminalOrders[0].id,f.order.id);return JSON.stringify({changes:[],terminalResults:[proposal(f)]});};
 await f.store.transact(s=>{s.powers[f.power.id].autoArchiveReview=true;s.powers[f.power.id].autoArchiveSave=true;});
 await f.app.reviewArchives({powerId:f.power.id,rescan:true,autoSave:true});assert.equal(calls,1);assert.equal(f.store.read().terminalOrders[0].progress.status,'working');assert.ok(f.store.read().powers[f.power.id].archiveReviewed.some(a=>a.index===1));
});
test('manual review previews results without committing; skipped result remains pending',async()=>{
 const f=await setup();f.app.model.request=async()=>JSON.stringify({changes:[],terminalResults:[proposal(f)]});await f.app.reviewArchives({rescan:true});assert.equal(f.store.read().terminalOrders[0].progress,undefined);
 await f.app.commitArchiveReview(f.app.pendingArchiveReview,new Map(),{terminalChosen:new Set()});assert.equal(f.store.read().terminalOrders[0].progress,undefined);assert.ok(!f.store.read().powers[f.power.id].archiveReviewed.some(a=>a.index===1));
});


test('skipped result on a previously reviewed floor remains eligible for a later update',async()=>{
 const f=await setup(),s=f.store.read(),p=clone(f.power),sources=archiveSources(f.ctx.chat,s,p,{rescan:true});p.archiveReviewed=sources.map(({index,swipeId,length,textHash,format})=>({index,swipeId,length,textHash,format}));
 applyArchiveChanges(p,[],sources,new Map(),f.ctx.chat,{blockedFloors:new Set([1])});assert.ok(archiveSources(f.ctx.chat,s,p).some(a=>a.index===1));
});
test('failed result commit rolls back review cursor and result history together',async()=>{
 const f=await setup();f.app.model.request=async()=>JSON.stringify({changes:[],terminalResults:[proposal(f)]});await f.app.reviewArchives({rescan:true});
 const pending=f.app.pendingArchiveReview;pending.terminalResults[0].beforeHash='invalid';const before=clone(f.store.read());await assert.rejects(()=>f.app.commitArchiveReview(pending,new Map(),{terminalChosen:new Set([0])}));assert.deepEqual(f.store.read(),before);
});
