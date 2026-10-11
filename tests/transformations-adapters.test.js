import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {fixture} from './mvu-fixture.js';import {transformationsCases,transformationsProposals} from './transformations-fixture.js';
import {importBook,createPower,clone,hash,stable,validateState} from '../src/core.js';import {validateAdapter,applyAdapter} from '../src/adapters.js';
import {creationConfig,creationPrompt} from '../src/creation.js';import {archiveSources,normalizeArchiveChanges} from '../src/archive-review.js';
import {statisticsDashboard} from '../src/specialized-records.js';import {WorkbenchUI} from '../src/ui.js';import {memoryPlan} from '../src/archive-memory.js';
const entries=importBook(JSON.parse(fs.readFileSync(process.env.WJWK_TEST_BOOK,'utf8').replace(/^\uFEFF/,'')),'V4.1'),cases=transformationsCases(entries);
function setup(c){const f=fixture();f.power=clone(c.power);f.state.powers={[f.power.id]:f.power};f.app.powerId=f.power.id;f.ctx.chat.push({is_user:false,mes:c.story,swipe_id:0});f.app.refresh();return f;}
function pending(f,raw){const s=f.app.contextSnapshot(),p=s.state.powers[f.power.id],sources=archiveSources(f.ctx.chat,s.state,p,{rescan:true});return {captured:f.app.store.capture(),contextHash:hash(stable(s.hashes)),powerId:p.id,sources,changes:normalizeArchiveChanges({changes:raw},p,sources,f.ctx.chat),creationResults:[],terminalResults:[]};}
for(const c of cases){test(c.name+': original match, declarative dashboard and one-goal operation',()=>{const p=clone(c.power),config=creationConfig(p);validateAdapter(config);assert.equal(statisticsDashboard(p,[]).sections.length,c.sections);assert.equal(creationPrompt(p,[],'拟定下一步').operationId,'draft');assert.equal(statisticsDashboard(p,[]).sections.every(s=>s.records.length===0),true);p.primaryRules+='new version';assert.equal(statisticsDashboard(p,[]),null);});
 test(c.name+': batch save, same-object repeat preserves scope and memory',async()=>{const f=setup(c);let d=pending(f,transformationsProposals(c));await f.app.commitArchiveReview(d,new Map(d.changes.map((_,i)=>[i,null])));let p=f.app.store.read().powers[f.power.id],ids=Object.keys(p.archives);assert.equal(ids.length,c.rows.length);d=pending(f,transformationsProposals(c));await f.app.commitArchiveReview(d,new Map(d.changes.map((r,i)=>[i,r.id])));p=f.app.store.read().powers[f.power.id];assert.deepEqual(Object.keys(p.archives),ids);assert(Object.values(p.archives).every(r=>!r.history.length));const view=statisticsDashboard(p,f.ctx.chat);assert.equal(view.sections.reduce((n,s)=>n+s.records.length,0),c.rows.length);const ui=Object.create(WorkbenchUI.prototype),html=ui.specializedStatistics(p,f.ctx.chat,false);assert.equal((html.match(/data-dashboard-section=/g)||[]).length,c.sections);assert(!html.includes('<input'));const state=f.app.store.read(),memory=memoryPlan(state,f.ctx.chat,c.rows.map(r=>r[1]).join('、'),{auto:true,budget:12000,selections:{}});assert(memory.packet.includes(c.rows[0][1]));validateState(clone(state));assert.equal(f.replacementCount,0);f.ctx.chat[1].mes='来源完全改写';assert.equal(statisticsDashboard(p,f.ctx.chat).sections.reduce((n,s)=>n+s.counts.active+s.counts.working+s.counts.planned,0),view.sections.reduce((n,s)=>n+s.counts.active+s.counts.working+s.counts.planned,0));assert.equal(statisticsDashboard(p,f.ctx.chat).sections.reduce((n,s)=>n+s.counts.stale,0),0);});}





for(const [index,recordId,details,story,status] of [
 [0,'sequences',{history:'改名青锋并迁至同级玄界，青界二转记录继续保留'},'青铜剑改名青锋并迁至同级玄界，没有客观新增上升空间，青界二转记录继续保留，不刷新次数。','active'],
 [1,'foundations',{growth:'已融合真实外来星核形成新结构',state:'新上位基准已成立'},'星纹舟后来已融合真实外来星核，形成新结构，此次新上位基准已成立。','active'],
 [2,'slot',{task:'空闲',progress:'实际等待满6小时，未留额外进度',state:'任务已完成'},'剧情又经过四小时，免费槽实际等待满六小时，竹筷守卫升变已经完成，槽位现为空闲。','active'],
 [3,'opponents',{remaining:'剑术尚未取，灵目新增远距识别成长'},'白鹤后来已经形成灵目远距识别的新成长，剑术仍未取，此刻没有新对决也没有再次复制。','active'],
 [4,'pending',{state:'已实际交割兑现，原暂存结束'},'赤宝石交割条件已恢复，原交换现在实际交割，原暂存资格兑现结束，没有再付第二枚砂砾。','ended'],
 [5,'forms',{state:'当前化身赤龙，承接原觉醒'},'你再次化身赤龙，原赤龙焰心觉醒完整恢复，这只是原形态切换，没有新建第二条赤龙道路。','active']
])test(cases[index].name+': later narrative updates stable record without clobbering other records',async()=>{
 const c=cases[index],f=setup(c);let d=pending(f,transformationsProposals(c));await f.app.commitArchiveReview(d,new Map(d.changes.map((_,i)=>[i,null])));
 const before=f.app.store.read().powers[f.power.id],target=Object.values(before.archives).find(r=>r.specific.recordId===recordId),others=Object.values(before.archives).filter(r=>r.id!==target.id).map(clone),priorFields=clone(target.specific.fields);
 f.ctx.chat.push({is_user:false,mes:story,swipe_id:0});f.app.refresh();
 const update={type:'record',name:target.name,status,fields:{description:story},recordId,details,sourceIndex:2,quote:story,ruleQuote:f.power.primaryRules.slice(0,30)};d=pending(f,[update]);await f.app.commitArchiveReview(d,new Map([[0,target.id]]));
 const after=f.app.store.read().powers[f.power.id];assert.equal(Object.keys(after.archives).length,c.rows.length);assert.equal(after.archives[target.id].status,status);for(const [k,v] of Object.entries(details))assert.equal(after.archives[target.id].specific.fields[k],v);for(const [k,v] of Object.entries(priorFields))if(!Object.hasOwn(details,k))assert.equal(after.archives[target.id].specific.fields[k],v);for(const row of others)assert.deepEqual(after.archives[row.id],row);assert.equal(f.replacementCount,0);
});
test('slot remains working across refresh; candidate remains planned and old life form remains usable',async()=>{
 for(const index of [2,5]){const c=cases[index],f=setup(c);const d=pending(f,transformationsProposals(c));await f.app.commitArchiveReview(d,new Map(d.changes.map((_,i)=>[i,null])));const before=clone(f.app.store.read().powers[f.power.id].archives);f.app.refresh();assert.deepEqual(f.app.store.read().powers[f.power.id].archives,before);const view=statisticsDashboard(f.app.store.read().powers[f.power.id],f.ctx.chat);assert.equal(view.sections.find(s=>s.id===(index===2?'branches':'definitions')).counts.planned,1);if(index===2)assert.equal(view.sections.find(s=>s.id==='slot').counts.working,1);else assert.equal(view.sections.find(s=>s.id==='forms').counts.active,2);}
});

test('higher framework creates separate promotion sequence while old framework and object stay intact',async()=>{
 const c=cases[0],f=setup(c);let d=pending(f,transformationsProposals(c));await f.app.commitArchiveReview(d,new Map(d.changes.map((_,i)=>[i,null])));const before=clone(f.app.store.read().powers[f.power.id].archives);
 const story='青铜剑稳定进入客观更高的天界并取得真实新增上升空间，天界新序列实际完成一转，青界旧二转记录保留。';f.ctx.chat.push({is_user:false,mes:story,swipe_id:0});f.app.refresh();
 d=pending(f,[{type:'record',name:'青铜剑天界序列',status:'active',fields:{description:story},recordId:'sequences',details:{target:'青铜剑',framework:'天界，真实新增上升空间',count:'天界已确认一转'},sourceIndex:2,quote:story,ruleQuote:f.power.primaryRules.slice(0,30)}]);await f.app.commitArchiveReview(d,new Map([[0,null]]));const after=f.app.store.read().powers[f.power.id];assert.equal(Object.keys(after.archives).length,c.rows.length+1);for(const [id,row] of Object.entries(before))assert.deepEqual(after.archives[id],row);assert.equal(statisticsDashboard(after,f.ctx.chat).sections.find(s=>s.id==='sequences').counts.active,2);
});
test('life switch updates both current and stored forms without deleting either growth path',async()=>{
 const c=cases[5],f=setup(c);let d=pending(f,transformationsProposals(c));await f.app.commitArchiveReview(d,new Map(d.changes.map((_,i)=>[i,null])));const before=f.app.store.read().powers[f.power.id],forms=Object.values(before.archives).filter(r=>r.specific.recordId==='forms'),core=Object.values(before.archives).find(r=>r.specific.recordId==='core');
 const story='你已从人类切换回赤龙，当前只有赤龙形态，人类生命道路仍入库保留焰心熔铸，赤龙原觉醒恢复，共同核心未变。';f.ctx.chat.push({is_user:false,mes:story,swipe_id:0});f.app.refresh();
 const raw=forms.map(row=>({type:'record',name:row.name,status:'active',fields:{description:story},recordId:'forms',details:{state:row.name==='赤龙生命道路'?'当前化身赤龙，承接原觉醒':'已入库人类，当前未化身，熔铸保留'},sourceIndex:2,quote:story,ruleQuote:f.power.primaryRules.slice(0,30)}));d=pending(f,raw);await f.app.commitArchiveReview(d,new Map(d.changes.map((_,i)=>[i,forms[i].id])));const after=f.app.store.read().powers[f.power.id];assert.equal(Object.keys(after.archives).length,c.rows.length);for(const row of forms){assert.equal(after.archives[row.id].specific.fields.growth,row.specific.fields.growth);assert.equal(after.archives[row.id].specific.fields.features,row.specific.fields.features);}assert.deepEqual(after.archives[core.id],core);
});
