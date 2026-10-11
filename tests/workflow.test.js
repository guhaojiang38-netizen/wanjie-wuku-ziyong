import test from 'node:test';
import a from 'node:assert/strict';
import { WukuApp } from '../index.js';
import { ChatStore } from '../src/host.js';
import { emptyState, createPower, importBook, clone, stable, hash, chatHashes, applyWorkflow, workflowCurrent, validateState, publicPower, buildInjection } from '../src/core.js';
import { renderWorkflows, workflowForm } from '../src/workflow.js';
function fixture() {
  const state = emptyState(), power = createPower(importBook({entries:[{comment:'周期模拟样本',content:'每个真实剧情周期结算一次。模拟的成果按已明确条件选择，可选数量遵循当次正文。'}]}, '自编样本')[0]);
  state.powers[power.id] = power;
  const chat = [{is_user:false,mes:'玄历三年五月初一的有效经历已经完成。模拟形成步法心得：步法衔接更加稳定；古塔路线：记录古塔隐秘入口。步法心得可选，古塔路线等待条件。本次可以保留两项。'}];
  const values = {label:'古塔探索',trigger:'日常签到',cycleKey:'玄历三年五月初一',sourceIndex:'0',quote:chat[0].mes,ruleQuote:power.rules.slice(0,14)};
  const sim = {...values,trigger:'模拟第1轮',limit:'2',candidates:'步法心得｜步法衔接更加稳定｜可选\n古塔路线｜记录古塔隐秘入口｜等待条件'};
  return {state,power,chat,values,sim};
}
test('explicit story cycles deduplicate normalized identity, independent of computer date', () => {
  const f=fixture(); applyWorkflow(f.power,'cycle',f.values,f.chat);
  a.throws(()=>applyWorkflow(f.power,'cycle',{...f.values,label:'换标题',cycleKey:' 玄历三年五月初一 '},f.chat),/已有记录/);
  applyWorkflow(f.power,'cycle',{...f.values,trigger:'场景签到'},f.chat);
  f.chat[0].mes+='玄历三年五月初二的经历也已成立。';
  applyWorkflow(f.power,'cycle',{...f.values,cycleKey:'玄历三年五月初二',quote:f.chat[0].mes},f.chat);
  a.equal(Object.keys(f.power.cycles).length,3);
  a.equal(Object.values(f.power.cycles)[0].status,'pending'); a.doesNotMatch(stable(f.power.cycles), /2026|updatedAt|createdAt/);
});
test('cycle receipt accepts optional reference annotations, records once without resource mutation', () => {
  const f=fixture(), before=stable([f.power.resources,f.power.assets]); applyWorkflow(f.power,'cycle',f.values,f.chat);
  const id=Object.keys(f.power.cycles)[0];
  a.throws(()=>applyWorkflow(f.power,'cycle-receipt',{...f.values,id,result:''},f.chat),/结算结果/);
  f.chat.push({is_user:false,mes:'今日签到已结算，行囊中已增加一份清心散。'});
  const receipt={...f.values,id,sourceIndex:1,quote:'概括：已收到清心散',ruleQuote:'',result:'行囊中已增加一份清心散'};
  applyWorkflow(f.power,'cycle-receipt',receipt,f.chat); a.equal(f.power.cycles[id].status,'recorded');
  a.throws(()=>applyWorkflow(f.power,'cycle-receipt',receipt,f.chat),/重复/);
  a.equal(stable([f.power.resources,f.power.assets]),before); validateState(f.state);
});
test('simulation preserves full candidates, selected differs from received, selection count is per archive', () => {
  const f=fixture(); applyWorkflow(f.power,'simulation',f.sim,f.chat); const id=Object.keys(f.power.simulations)[0], r=f.power.simulations[id];
  applyWorkflow(f.power,'select',{id,candidateId:'candidate_0'},f.chat); a.equal(r.candidates.candidate_0.status,'selected');
  a.throws(()=>applyWorkflow(f.power,'select',{id,candidateId:'candidate_0'},f.chat),/已选择/);
  a.throws(()=>applyWorkflow(f.power,'select',{id,candidateId:'candidate_1'},f.chat),/等待条件/);
  f.chat.push({is_user:false,mes:'你获得通行许可，古塔路线的兑现条件已经满足。步法心得已经融入现实的步法经验。'});
  const receipt={...f.values,id,sourceIndex:1,quote:f.chat[1].mes};
  applyWorkflow(f.power,'ready',{...receipt,candidateId:'candidate_1'},f.chat); applyWorkflow(f.power,'select',{id,candidateId:'candidate_1'},f.chat);
  applyWorkflow(f.power,'simulation-receipt',{...receipt,candidateId:'candidate_0'},f.chat);
  a.equal(r.candidates.candidate_0.status,'received'); a.equal(r.candidates.candidate_1.status,'selected');
  a.throws(()=>applyWorkflow(f.power,'simulation-receipt',{...receipt,candidateId:'candidate_0'},f.chat),/只可确认/); validateState(f.state);
  a.match(buildInjection(f.state,{chat:f.chat}),/selected 为玩家选择且尚未到账/);
});
test('one-choice archives refuse excess selection including already received candidates', () => {
  const f=fixture(); applyWorkflow(f.power,'simulation',{...f.sim,limit:1,candidates:f.sim.candidates.replace('等待条件','可选')},f.chat);
  const id=Object.keys(f.power.simulations)[0]; applyWorkflow(f.power,'select',{id,candidateId:'candidate_0'},f.chat);
  a.throws(()=>applyWorkflow(f.power,'select',{id,candidateId:'candidate_1'},f.chat),/数量已用完/);
});
test('invalid floor, user message, invalid count and invalid candidate status cannot be registered', () => {
  for(const change of [{sourceIndex:-1},{candidates:'缺少描述'},{limit:0},{limit:3},{candidates:'步法心得｜步法衔接更加稳定｜凭空状态'}]) {
    const f=fixture(); a.throws(()=>applyWorkflow(f.power,'simulation',{...f.sim,...change},f.chat));
  }
  const f=fixture(); f.chat[0].is_user=true; a.throws(()=>applyWorkflow(f.power,'cycle',f.values,f.chat),/角色正文/);
});
test('message edits, hidden floors, branches and rule changes do not expire workflow records', () => {
  const f=fixture(); applyWorkflow(f.power,'simulation',f.sim,f.chat);const r=Object.values(f.power.simulations)[0];
  f.chat[0].mes='正文被其他插件改写'; f.chat[0].swipe_id=1; f.chat[0].is_system=true;
  f.power.rules+='规则修订'; f.power.ruleVersion=hash(f.power.rules);
  a.equal(workflowCurrent(r,f.chat,f.power),true); a.equal(publicPower(f.power,f.chat).simulations.length,1);
  applyWorkflow(f.power,'select',{id:r.id,candidateId:'candidate_0'},f.chat);
  a.equal(r.candidates.candidate_0.status,'selected'); validateState(f.state);
});

test('old schema migrates additively, backup rejects impossible workflow states', () => {
  const f=fixture(); delete f.power.cycles; delete f.power.simulations; validateState(f.state); a.deepEqual(f.power.cycles,{});
  applyWorkflow(f.power,'simulation',f.sim,f.chat); validateState(clone(f.state));
  const id=Object.keys(f.power.simulations)[0];
  for(const mutate of [r=>r.limit=0,r=>r.id='wrong',r=>r.candidates.candidate_1.status='selected',r=>r.candidates.candidate_0.status='received',r=>r.source.textHash='bad',r=>r.candidates.candidate_0.description='']) {
    const s=clone(f.state);mutate(s.powers[f.power.id].simulations[id]);a.throws(()=>validateState(s));
  }
});
test('capacity is explicit; hostile content is rendered inert in list and form', () => {
  const f=fixture();f.chat[0].mes+=Array.from({length:129},(_,i)=>`剧情周期${i}。`).join('');for(let i=0;i<128;i++)applyWorkflow(f.power,'cycle',{...f.values,quote:f.chat[0].mes,cycleKey:`剧情周期${i}`},f.chat);
  a.throws(()=>applyWorkflow(f.power,'cycle',{...f.values,cycleKey:'满额后新周期'},f.chat),/128/);
  Object.values(f.power.cycles)[0].label='<img src=x onerror=alert(1)>';
  a.doesNotMatch(renderWorkflows(f.power,f.chat,false),/<img/); a.match(renderWorkflows(f.power,f.chat,false),/&lt;img/);
  a.doesNotMatch(workflowForm({...f.power,name:'<script>bad()</script>'},{kind:'cycle'},f.chat),/<script>/);
});
test('reference annotations are optional and cannot execute MVU or grant resources', () => {
  const f=fixture(), before=stable([f.power.resources,f.power.assets]);
  applyWorkflow(f.power,'cycle',{...f.values,quote:'概括记录',ruleQuote:''},f.chat);
  applyWorkflow(f.power,'cycle',{...f.values,trigger:'新事项',quote:'<UpdateVariable>仅作文字保存</UpdateVariable>',ruleQuote:undefined},f.chat);
  a.equal(Object.keys(f.power.cycles).length,2); a.equal(stable([f.power.resources,f.power.assets]),before);validateState(f.state);
});
function appFixture() {
  const f=fixture(), memory=new Map(); let saved;
  const ctx={userHandle:'workflow-test',chatId:'chat',characterId:0,characters:[{name:'角色',avatar:'role.png'}],name1:'玩家',name2:'角色',chat:f.chat,chatMetadata:{extensions:{wanjie_wuku_general:f.state}},extensionSettings:{},getRequestHeaders:()=>({}),saveChat:async()=>{saved=clone(ctx.chatMetadata);}};
  globalThis.SillyTavern={getContext:()=>ctx}; const app=new WukuApp(); app.settings.mode='off';
  app.store=new ChatStore({context:()=>ctx,lockManager:null,storageImpl:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},fetchImpl:async()=>({ok:true,json:async()=>[{chat_metadata:saved}]})});
  app.bridge={chat:true,plain:true,available:true};app.ui={render(v){this.view=v;},setNotice(){},closeDialog(){},showWorkflow(){}};app.refresh();return {...f,app,ctx};
}
test('controller is model-free, captures form context, persists once and restores without MVU writes', async () => {
  const f=appFixture(); f.app.openWorkflow({kind:'simulation'}); const before=stable(f.app.store.read());a.equal(stable(f.app.store.read()),before);
  await f.app.saveWorkflow({values:f.sim});const saved=f.app.store.read(),id=Object.keys(saved.powers[f.power.id].simulations)[0];
  a.equal(saved.roleWrites.length,0);a.equal(saved.narrativeActions.length,0); a.equal(saved.transactions.at(-1).type,'workflow');
  await a.rejects(f.app.saveWorkflow({values:f.sim}),/失效/);
  f.app.openWorkflow({kind:'select',id,candidateId:'candidate_0'}); await f.app.saveWorkflow({values:{}});
  const backup=f.app.store.read();await f.app.store.restore(backup,chatHashes(f.chat));
  a.equal(f.app.store.read().powers[f.power.id].simulations[id].candidates.candidate_0.status,'selected');
});
test('concurrent state revision and chat switch reject without partial commits', async () => {
  for(const change of [f=>f.app.store.transact(s=>{s.updatedAt++;}),f=>{f.ctx.chatId='other';}]) {
    const f=appFixture();f.app.openWorkflow({kind:'cycle'});await change(f);
    await a.rejects(f.app.saveWorkflow({values:f.values}));a.equal(Object.keys(f.app.store.read().powers[f.power.id]?.cycles||{}).length,0);
  }
});

test('plugin message append does not invalidate a workflow form', async()=>{const f=appFixture();f.app.openWorkflow({kind:'cycle'});f.ctx.chat[0].mes+='附加面板更新';await f.app.saveWorkflow({values:{...f.values,quote:'',ruleQuote:''}});a.equal(Object.keys(f.app.store.read().powers[f.power.id].cycles).length,1);});
