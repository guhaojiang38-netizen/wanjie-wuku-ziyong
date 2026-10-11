import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { requestMemorySnapshot, installInjection } from '../src/host.js';
import { saveArchive, archiveSource } from '../src/archives.js';
import { clone, hash, stable, validateState } from '../src/core.js';
import { terminalEligible, normalizeTerminalPlan, terminalPrompt, terminalVariableFields, normalizeTerminalUpdates, terminalOrderCurrent } from '../src/terminal.js';
async function setup(role=false){const f=fixture();f.power.name='母巢';f.power.rules='母巢可以指挥已有种群，安排岗位、任务与部署，不凭安排创造新的种群或收益。';f.power.primaryRules=f.power.rules;f.power.ruleVersion=hash(f.power.rules);const r=saveArchive(f.power,{type:'population',name:'耐寒工蜂',status:'active',fields:{scale:'二十只',traits:'耐寒',location:'北坡'}},archiveSource(f.ctx.chat,'确认'));f.app.role=f.bridge;f.app.settings.mode='st';f.app.ui.showTerminal=()=>{};f.app.ui.showTerminalPreview=(d)=>{f.preview=d;};
 if(role){f.ctx.chat[0].variables[0].stat_data.主角.耐寒工蜂={当前任务:'待命',数量:20};f.link.rules[1].content+=' 已有种群的当前任务按玩家确认的部署安排更新，数量不会因安排改变。';f.link.ruleVersion=hash(stable(f.link.rules));}
 await f.store.transact(n=>{n.powers[f.power.id]=clone(f.power);if(role)n.roleLink=clone(f.link);});f.r=r;f.raw={title:'工蜂北坡巡视',subjectIds:[r.id],target:'北坡',task:'安排耐寒工蜂负责北坡巡视，发现异常后报告。',ruleQuote:f.power.rules.slice(0,20),variableUpdates:[],roleChecks:[]};f.app.model.request=async()=>JSON.stringify({plan:f.raw});return f;}
async function draft(f){f.app.openTerminal('deploy',f.r.id);const prev=globalThis.FormData;globalThis.FormData=class{getAll(){return [f.r.id];}};try{await f.app.draftTerminal({form:{},values:{kind:'deploy',goal:''}});}finally{globalThis.FormData=prev;}return f.app.terminalDraft;}
test('only established, current, correctly typed owned objects are eligible',async()=>{const f=await setup();strict.equal(terminalEligible(f.r,'deploy',f.power,f.ctx.chat),true);strict.equal(terminalEligible(f.r,'transfer',f.power,f.ctx.chat),false);strict.equal(terminalEligible({...f.r,status:'planned'},'deploy',f.power,f.ctx.chat),false);f.ctx.chat[0].swipe_id=1;strict.equal(terminalEligible(f.r,'deploy',f.power,f.ctx.chat),true);});
test('AI draft cannot add participants, fake targets, rewards or quantities',async()=>{const f=await setup();const req={kind:'deploy',subjectIds:[f.r.id]};for(const raw of [{...f.raw,subjectIds:['unknown']},{...f.raw,costs:[]},{...f.raw,effects:[]},{...f.raw,targetId:'missing'},{...f.raw,subjectIds:[f.r.id,f.r.id]}])strict.throws(()=>normalizeTerminalPlan(raw,f.power,f.ctx.chat,req));});
test('confirm queues an arrangement without changing archives, inventory or resources; duplicate confirmation rejects',async()=>{const f=await setup(),before=clone(f.store.read().powers[f.power.id]);await draft(f);const id=f.preview.order.id;await f.app.confirmTerminal({values:{}});const s=f.store.read();strict.equal(s.terminalOrders.length,1);strict.equal(s.terminalOrders[0].status,'queued');strict.deepEqual(s.powers[f.power.id],before);strict.equal(s.transactions.filter(t=>t.id===id).length,1);strict.equal(s.roleWrites.length,0);await strict.rejects(()=>f.app.confirmTerminal({values:{}}),/失效/);validateState(clone(s));});
test('stale preview or changed participant rejects before saving any order',async()=>{const f=await setup();await draft(f);f.ctx.chat[0].mes+='旧正文已改写。';await strict.rejects(()=>f.app.confirmTerminal({values:{}}));strict.equal(f.store.read().terminalOrders.length,0);});
test('draft cancellation has no effects; queued unsynced orders can be cancelled',async()=>{const f=await setup();await draft(f);strict.equal(f.store.read().terminalOrders.length,0);await f.app.confirmTerminal({values:{}});const id=f.store.read().terminalOrders[0].id;await f.app.cancelTerminal(id);strict.equal(f.store.read().terminalOrders[0].status,'cancelled');f.app.beginTerminal('normal');f.app.mainBusy=true;strict.equal(f.app.terminalInjection(f.store.read()),'');});
test('variable discovery is restricted to subject-specific existing arrangement strings; stock and character-wide fields reject',async()=>{const f=await setup(true),v=f.bridge.read(f.link),fields=terminalVariableFields(v,f.link,[f.r]);strict.deepEqual(fields.map(r=>r.path),['/主角/耐寒工蜂/当前任务']);for(const path of ['/主角/源质点','/主角/耐寒工蜂/数量','/主角/新对象/当前任务'])strict.throws(()=>normalizeTerminalUpdates([{op:'replace',path,value:'北坡'}],fields));strict.throws(()=>normalizeTerminalUpdates([{op:'add',path:fields[0].path,value:'北坡'}],fields));});
test('valid MVU preview and confirmed write keep quantities unchanged and use a single durable outbox',async()=>{const f=await setup(true),path='/主角/耐寒工蜂/当前任务';f.raw.variableUpdates=[{op:'replace',path,value:'安排耐寒工蜂负责北坡巡视'}];f.raw.roleChecks=[{ruleId:f.link.rules[1].id,quote:'已有种群的当前任务按玩家确认的部署安排更新',paths:[path],reason:'玩家确认已有工蜂执行巡视安排，只更新当前任务，数量与能力保持不变。'}];await draft(f);strict.ok(f.preview.rolePlan);const id=f.preview.order.id;await f.app.confirmTerminal({values:{syncVariables:'yes'}});const s=f.store.read();strict.equal(s.roleWrites.find(w=>w.id===id).status,'applied');strict.equal(f.getRaw().stat_data.主角.耐寒工蜂.当前任务,'安排耐寒工蜂负责北坡巡视');strict.equal(f.getRaw().stat_data.主角.耐寒工蜂.数量,20);strict.equal(f.replacementCount,1);strict.equal(s.terminalOrders.length,1);await strict.rejects(()=>f.app.cancelTerminal(id),/新安排调整/);});
test('failed MVU write stays pending; retry uses the same order and never queues duplicate settlement',async()=>{const f=await setup(true),path='/主角/耐寒工蜂/当前任务';f.raw.variableUpdates=[{op:'replace',path,value:'安排耐寒工蜂负责北坡巡视'}];f.raw.roleChecks=[{ruleId:f.link.rules[1].id,quote:'已有种群的当前任务按玩家确认的部署安排更新',paths:[path],reason:'仅同步已确认的巡视任务，不增减数量或其他属性。'}];await draft(f);f.writeHook=()=>{throw Error('暂时无法写回');};await f.app.confirmTerminal({values:{syncVariables:'yes'}});let s=f.store.read();strict.equal(s.roleWrites[0].status,'pending');const id=s.terminalOrders[0].id;f.app.beginTerminal('normal');f.app.mainBusy=true;strict.equal(f.app.terminalInjection(s),'');f.app.mainBusy=false;f.writeHook=null;await f.app.finishRoleWrite(id);s=f.store.read();strict.equal(s.roleWrites[0].status,'applied');strict.equal(s.terminalOrders.length,1);strict.equal(s.transactions.filter(t=>t.id===id).length,1);strict.equal(f.getRaw().stat_data.主角.耐寒工蜂.数量,20);});
test('invalid role updates degrade to an explicit preview warning without writing variables',async()=>{const f=await setup(true);f.raw.variableUpdates=[{op:'replace',path:'/主角/源质点',value:'999'}];await draft(f);strict.equal(f.preview.rolePlan,null);strict.ok(f.preview.variableWarning);strict.equal(f.replacementCount,0);await f.app.confirmTerminal({values:{}});strict.equal(f.store.read().roleWrites.length,0);});

test('an open terminal draft pauses queued archive updates; dismiss resumes without committing',async()=>{const f=await setup();await f.store.transact(n=>{n.powers[f.power.id].autoArchiveSave=true;n.powers[f.power.id].autoArchiveReview=true;});f.app.openTerminal('deploy',f.r.id);f.app.schedulePlayerReview('normal');strict.ok(f.app.playerAutoQueued);strict.ok(f.app.playerReviewTimer==null);f.app.dismissTerminal();strict.ok(f.app.playerReviewTimer);clearTimeout(f.app.playerReviewTimer);f.app.playerReviewTimer=null;strict.equal(f.store.read().terminalOrders.length,0);});

test('an object cannot receive overlapping queued arrangements or duplicate AI recommendations',async()=>{const f=await setup();await draft(f);await f.app.confirmTerminal({values:{}});let calls=0;f.app.model.request=async()=>{calls++;return JSON.stringify({plan:f.raw});};await strict.rejects(()=>draft(f),/待正文承接/);strict.equal(calls,0);strict.equal(f.store.read().terminalOrders.length,1);});

async function queued(){const f=await setup();await draft(f);await f.app.confirmTerminal({values:{}});return f;}
function sending(f,type='normal'){
 f.app.beginTerminal(type);f.app.mainBusy=true;const packet=f.app.terminalInjection(f.store.read());let actual=packet;
 f.app.observeTerminalRequest({read:marker=>requestMemorySnapshot(actual,marker)});
 return {packet,set:value=>actual=value};
}
async function received(f,{continueBody=null,hidden=false}={}){
 const a=f.app.terminalAttempt;
 if(continueBody!==null){f.ctx.chat.at(-1).mes=continueBody;a.rendered=f.ctx.chat.length-1;}
 else {f.ctx.chat.push({mes:'工蜂开始巡视北坡，暂未发现可报告的新成果。',is_user:false,is_system:hidden,extra:hidden?{bbs_hidden:true}:{},swipe_id:0});a.rendered=f.ctx.chat.length-1;}
 a.ended=true;f.app.mainBusy=false;await f.app.completeTerminal();
}
test('terminal consumes only observed arrangement packet and new completed story, once',async()=>{
 const f=await queued(),before=clone(f.store.read().powers);strict.ok(sending(f).packet);await received(f);
 strict.equal(f.store.read().terminalOrders[0].status,'presented');strict.deepEqual(f.store.read().powers,before);strict.equal(f.replacementCount,0);
 strict.equal(sending(f).packet,'');
});
test('unobserved, removed or altered request does not consume terminal queue',async()=>{
 for(const mode of ['unobserved','removed','altered']){const f=await queued(),req=sending(f);if(mode==='unobserved')f.app.terminalAttempt.reader=null;else req.set(mode==='removed'?'other plugin':req.packet.replace('北坡','南坡'));await received(f);strict.equal(f.store.read().terminalOrders[0].status,'queued',mode);}
});
test('terminal continuation requires appended story; rewrite alone retains pending arrangement',async()=>{
 const f=await queued();sending(f,'continue');await received(f,{continueBody:'完全重写的开场。'});strict.equal(f.store.read().terminalOrders[0].status,'queued');
 const g=await queued(),old=g.ctx.chat[0].mes;sending(g,'continue');await received(g,{continueBody:old+' 工蜂开始向北坡出发。'});strict.equal(g.store.read().terminalOrders[0].status,'presented');
});
test('hidden generated assistant story remains compatible with BaiBai floor hiding',async()=>{
 const f=await queued();sending(f);await received(f,{hidden:true});strict.equal(f.store.read().terminalOrders[0].status,'presented');
});
test('terminal recomputes packet after pause and never injects stale cached arrangement',async()=>{
 const f=await queued();strict.ok(sending(f).packet);const state=f.store.read();state.powers[f.power.id].active=false;strict.equal(f.app.terminalInjection(state),'');strict.deepEqual(f.app.terminalAttempt.ids,[]);
});
test('terminal ignores stopped attempt and old-chat completion',async()=>{
 const f=await queued();sending(f);f.app.terminalAttempt=null;await f.app.completeTerminal();strict.equal(f.store.read().terminalOrders[0].status,'queued');
 const g=await queued();sending(g);g.ctx.chatId='different';await received(g);g.ctx.chatId=f.ctx.chatId;strict.equal(g.store.read().terminalOrders[0].status,'queued');
});
test('chat and plain request bridge tracks downstream terminal packet removal',async()=>{
 for(const plain of [false,true]){const f=await queued(),handlers={};f.ctx.eventSource={on:(e,h)=>handlers[e]=h,removeListener(){}};f.ctx.eventTypes=plain?{GENERATE_AFTER_COMBINE_PROMPTS:'request'}:{CHAT_COMPLETION_PROMPT_READY:'request'};
 const bridge=installInjection({context:()=>f.ctx,store:f.store,extraInjection:s=>f.app.terminalInjection(s),onRequest:e=>f.app.observeTerminalRequest(e)});
 f.app.beginTerminal('normal');f.app.mainBusy=true;const data=plain?{prompt:'continue'}:{chat:[{role:'user',content:'continue'}]};handlers.request(data);strict.ok(f.app.terminalAttempt.reader().includes('WJWK_TERMINAL_ORDERS_V1'));
 if(plain)data.prompt='another plugin removed injection';else data.chat.splice(-1,1);await received(f);strict.equal(f.store.read().terminalOrders[0].status,'queued');bridge.cleanup();}
});
test('long terminal packet stays observable within bounded own-block reader',async()=>{
 const f=await queued();await f.store.transact(n=>{const o=n.terminalOrders[0];o.task='巡'.repeat(2000);o.subjects[0].fields={scale:'二十只',traits:'耐'.repeat(4000),location:'北'.repeat(3000)};});const req=sending(f);strict.ok(req.packet.length>8000);strict.equal(requestMemorySnapshot(req.packet,'WJWK_TERMINAL_ORDERS_V1').packet,req.packet.trim());await received(f);strict.equal(f.store.read().terminalOrders[0].status,'presented');
});
