import test from 'node:test';
import strict from 'node:assert/strict';
import { MMLC_ENTRY, MMLC_ID, mmlcModule, MMLC_MODULES } from '../src/mmlc.js';
import { createPower, emptyState, buildInjection, normalizeOperation, applyOperation, validateState, clone } from '../src/core.js';
import { archiveSources, archivePrompt, normalizeArchiveChanges, applyArchiveChanges } from '../src/archive-review.js';
import { archiveSource, saveArchive } from '../src/archives.js';
import { memoryPlan } from '../src/archive-memory.js';
import { WorkbenchUI } from '../src/ui.js';
import { fixture } from './mvu-fixture.js';
function setup(){const p=createPower(MMLC_ENTRY),state=emptyState();state.powers[p.id]=p;return {p,state};}
test('statistics has no currency or main-model rules injection, including mixed powers',()=>{
 const {p,state}=setup();strict.equal(p.id,MMLC_ID);strict.deepEqual(p.resources,{});strict.equal(buildInjection(state),'');
 const other=createPower({id:'test',entryId:'1',book:'test',name:'深蓝',content:'按原文推演已有能力'});state.powers[other.id]=other;
 state.transactions.push({powerId:p.id,label:'漫漫长路统计记录',changes:[]});
 const injected=buildInjection(state);strict.match(injected,/深蓝/);strict.doesNotMatch(injected,/漫漫长路|mmlc-statistics|MMLC-state/);
});
test('statistics cannot become executable operations or story settlement',()=>{
 const {p,state}=setup();strict.throws(()=>normalizeOperation({},p,state,''),/只统计/);
 strict.throws(()=>applyOperation(state,{id:'a',stateId:state.id,baseRevision:0,contextHash:'',powerId:p.id},'',[]),/只统计/);
});
test('MMLC raw evidence builds all outcome categories and keeps pending work separate',()=>{
 const {p,state}=setup();const chat=[{is_user:false,mes:'<MMLC-settle>本命剑修复完成，现在可以正常使用。</MMLC-settle><MMLC-state>玄黄舰图纸完成，实体尚未建造。</MMLC-state>'}];
 const sources=archiveSources(chat,state,p),ruleQuote=p.rules.slice(0,25);
 const raw=[{type:'record',name:'本命剑',status:'active',fields:{description:'修复完成，可以正常使用'},sourceIndex:0,quote:'本命剑修复完成，现在可以正常使用。',ruleQuote},
 {type:'research',name:'玄黄舰研究',status:'working',fields:{outcome:'图纸完成，实体尚未建造'},sourceIndex:0,quote:'玄黄舰图纸完成，实体尚未建造。',ruleQuote}];
 const changes=normalizeArchiveChanges({changes:raw},p,sources,chat);applyArchiveChanges(p,changes,sources,new Map([[0,null],[1,null]]),chat);
 strict.equal(Object.keys(p.archives).length,2);strict.equal(Object.keys(p.assets).length,0);validateState(clone(state));
 const again=normalizeArchiveChanges({changes:raw},p,sources,chat);applyArchiveChanges(p,again,sources,new Map(again.map((c,i)=>[i,c.id])),chat);strict.equal(Object.keys(p.archives).length,2);strict.equal(Object.values(p.archives)[0].history.length,0);
 const ui=Object.create(WorkbenchUI.prototype);ui.view={};const html=ui.management(state,p,false,'st',null,chat);strict.match(html,/法器丹药/);strict.match(html,/玄黄舰/);strict.match(html,/正在推进/);strict.doesNotMatch(html,/能做什么|场景建议|记录当前方向/);
});
test('dedicated AI instructions scope outcomes and skip ability explanations',()=>{
 const {p}=setup(),prompt=archivePrompt(p,[],[]);strict.equal(JSON.parse(prompt.user).explainRules,false);strict.match(prompt.system,/明确属于其他金手指则跳过/);strict.match(prompt.system,/MMLC-archive/);strict.match(prompt.system,/不生成玩法说明/);
});
test('saved outcomes can be selected for narrative without injecting full statistics rules',()=>{
 const {p,state}=setup();const r=saveArchive(p,{type:'member',name:'青禾器灵',status:'active',fields:{condition:'换形完成，保留记忆'}},archiveSource([],'玩家确认已有器灵'));
 const plan=memoryPlan(state,[],'青禾器灵',{auto:true,budget:3000,selections:{}});strict.equal(plan.included.length,2);strict.match(plan.packet,/换形完成/);strict.doesNotMatch(plan.packet,/漫漫长路成果统计：/);
});
test('statistics registration is idempotent, chat-local and never queries AI',async()=>{
 const f=fixture();let calls=0;f.app.query=async()=>{calls++;throw Error('unexpected API');};f.app.ui.closeDialog=()=>{};
 await f.app.action('add-mmlc',{});const first=f.store.read().powers[MMLC_ID];strict.ok(first);strict.equal(first.autoArchiveReview,false);strict.equal(f.app.powerId,MMLC_ID);
 await f.store.transact(next=>saveArchive(next.powers[MMLC_ID],{type:'record',name:'测试剑',status:'active',fields:{description:'已经完成制造'}},archiveSource(f.ctx.chat,'玩家确认')));
 await f.app.action('add-mmlc',{});strict.equal(Object.keys(f.store.read().powers[MMLC_ID].archives).length,1);strict.equal(calls,0);strict.equal(f.replacementCount,0);
});

test('domain mapping separates sect lineage, items, fleet and cultivation without incidental keyword matches',()=>{
 for(const [name,type,expected]of [['道场内门弟子传承','bond','sect'],['传讯储物玉佩','record','items'],['玄黄舰图纸','research','fleet'],['金丹修为','skill','body'],['万象参真经','skill','arts'],['北坡福地','environment','land']])strict.equal(mmlcModule({name,type,fields:{description:'玄黄舰'}}),expected);
 strict.equal(MMLC_MODULES.length,8);strict.equal(mmlcModule({name:'青禾',type:'member',module:'sect'}),'sect');
});
test('AI module assignment persists through backup, updates and manual corrections',()=>{
 const {p,state}=setup(),note='弟子青禾已经正式加入内门。',ruleQuote=p.rules.slice(0,20),raw={type:'member',name:'青禾',module:'sect',status:'active',fields:{role:'内门弟子'},sourceIndex:-1,quote:note,ruleQuote};
 const c=normalizeArchiveChanges({changes:[raw]},p,[],[],note);const [saved]=applyArchiveChanges(p,c,[],new Map([[0,null]]),[]);strict.equal(saved.module,'sect');validateState(clone(state));
 saveArchive(p,{id:saved.id,type:'member',name:'青禾',status:'active',fields:{role:'内门弟子',condition:'负责药园'}},archiveSource([],'玩家确认'));strict.equal(p.archives[saved.id].module,'sect');strict.equal(p.archives[saved.id].history[0].module,'sect');
 strict.throws(()=>normalizeArchiveChanges({changes:[{...raw,module:'unknown'}]},p,[],[],note),/模块归属/);
 const copy=clone(state);copy.powers[p.id].archives[saved.id].module='unknown';strict.throws(()=>validateState(copy),/模块归属/);
});
test('legacy records remain readable and all domain entrances exist in an empty dashboard',()=>{
 const {p,state}=setup(),ui=Object.create(WorkbenchUI.prototype);ui.view={};let html=ui.management(state,p,false,'st',null,[]);
 for(const module of MMLC_MODULES)strict.ok(html.includes(`data-section="${module.id}"`));
 const saved=saveArchive(p,{type:'bond',name:'道场内门弟子传承',status:'active',fields:{participants:'十二名弟子'}},archiveSource([],'玩家确认'));delete saved.module;validateState(clone(state));ui.mmlcSection='sect';html=ui.management(state,p,false,'st',null,[]);strict.match(html,/十二名弟子/);strict.doesNotMatch(html,/造物与伙伴/);
});
