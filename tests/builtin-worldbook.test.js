import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {builtinEntries,builtinWorldbookInfo,withBuiltinCatalog,upgradeBuiltinPower,builtinPowerId} from '../src/builtin-worldbook.js';
import {importBook,createPower,emptyState,validateState,clone,stable,hash,upgradeResources,inferResources,extractPanelBalances} from '../src/core.js';
import {managementProfile} from '../src/management-profiles.js';
import {creationConfig,creationPrompt,normalizeCreation,creationCurrent} from '../src/creation.js';
import {CREATION_PRESETS} from '../src/creation-presets.js';
import {validateAdapter,assertAdapterFields,applyAdapter} from '../src/adapters.js';
import {fixture} from './mvu-fixture.js';
import {saveArchive,archiveSource} from '../src/archives.js';
import {archiveSources,normalizeArchiveChanges} from '../src/archive-review.js';
import {statisticsDashboard} from '../src/specialized-records.js';
import {memoryPlan} from '../src/archive-memory.js';
const read=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const entries=builtinEntries(),entry=name=>entries.find(e=>e.name===name);
const old=process.env.WJWK_PREVIOUS_BOOK?importBook(read(process.env.WJWK_PREVIOUS_BOOK),'旧武库'):null;
const previousAdapters=process.env.WJWK_PREVIOUS_ADAPTERS?read(process.env.WJWK_PREVIOUS_ADAPTERS):null;

test('bundled book has only latest named rules and keeps author text intact',()=>{
  assert.equal(entries.length,119);assert.equal(new Set(entries.map(e=>e.name)).size,119);
  assert.equal(entry('升变之印').entryId,'122');assert(!entry('绝对适应'));assert(!entry('自定义式'));
  assert(entry('绝对适应（新版）'));assert(entry('自定义'));
  assert.equal(builtinWorldbookInfo().authorEntries,120);
  if(process.env.WJWK_AUTHOR_BOOK){const author=importBook(read(process.env.WJWK_AUTHOR_BOOK));assert.equal(author.length,120);for(const e of entries)assert.equal(e.content,author.find(a=>a.entryId===e.entryId).content);}
  const copy=builtinEntries();copy[0].content='changed';assert.notEqual(builtinEntries()[0].content,'changed');
});
test('all latest rules have management configuration and 58 reviewed presets match',()=>{
  for(const e of entries)assert.equal(managementProfile(e).match,'exact',e.name);
  assert(!managementProfile(entry('人生模拟')).workflows.includes('simulation'),'三重奖励不沿用候选选择入口');
  assert.equal(entries.filter(e=>creationConfig(createPower(e))).length,58);
  for(const config of CREATION_PRESETS){validateAdapter(config);const e=entries.find(e=>config.target.primaryHashes.includes(hash(e.content)));assert(e,config.id);assert(config.operations.every(o=>e.content.includes(o.ruleQuote)));}
});
test('new open-ended abilities do not invent wallets from descriptive overviews',()=>{
  for(const name of ['绝对生产力','绝对掌握','绝对口胡','败家生财','仙境再现','信息全知者','绝对适应（新版）','知见障','自定义'])assert.deepEqual(inferResources(entry(name)),[],name);
});
test('catalog is available without chat and preserves customized material',()=>{
  const fork={...entry('自定义'),id:'custom-fork',book:'自编',content:'只修改本地骰子，自编限定规则。'};
  const catalog=withBuiltinCatalog([fork]);assert.equal(catalog.length,120);assert.deepEqual(catalog[0],fork);
  assert.equal(stable(withBuiltinCatalog(catalog)),stable(catalog));
  const f=fixture();assert.equal(f.app.settings.catalog.filter(e=>e.book==='万界武库V4.1 · 内置').length,119);
});
test('old catalog upgrades in place and duplicate author seal is collapsed',{skip:!old},()=>{
  const catalog=withBuiltinCatalog(old);assert.equal(catalog.length,119);
  for(const name of ['万界网购','人生模拟','升变之印']){const e=catalog.find(e=>e.name===name);assert.equal(e.id,old.find(e=>e.name===name).id);assert.equal(e.content,entry(name).content);}
  assert(!catalog.some(e=>e.name==='自定义式'||e.name==='绝对适应'));
  assert.equal(withBuiltinCatalog([...entries,{...old.find(e=>e.name==='升变之印'),book:entry('升变之印').book}]).filter(e=>e.name==='升变之印').length,1);
});
test('re-registering renamed official entries reuses the saved power identity',{skip:!old},()=>{
  for(const [before,after] of [['绝对适应','绝对适应（新版）'],['自定义式','自定义'],['升变之印','升变之印']]){
    const p=createPower(old.find(e=>e.name===before));assert.equal(builtinPowerId(entry(after),{[p.id]:p}),p.id);
    upgradeBuiltinPower(p);assert.equal(builtinPowerId(entry(after),{[p.id]:p}),p.id);
  }
  const fork=createPower({...entry('自定义'),id:'fork',content:'只改骰子的自编规则。'});assert.equal(builtinPowerId(entry('自定义'),{fork}),entry('自定义').id);
});
for(const name of ['至高亡灵主宰','万界网购','人生模拟','升变之印','绝对适应','自定义式'])test(name+': upgrades rules once, keeps records and identity',{skip:!old},()=>{
  const p=createPower(old.find(e=>e.name===name)),s=emptyState();s.powers[p.id]=p;
  const row=saveArchive(p,{type:'record',name:'已成立成果',status:'active',fields:{description:'跨回合保留，不因新规则失效'}},archiveSource([],'玩家已有记录'));
  saveArchive(p,{id:row.id,type:'record',name:row.name,status:'active',fields:{description:'后来取得进一步成长'}},archiveSource([],'后续记录'));
  s.archiveMemory.selections[p.id+'/'+row.id]={mode:'pinned',token:'test-token'};
  const records=stable(p.archives),wallet=stable(p.resources),id=p.id,created=p.createdAt;
  assert(upgradeBuiltinPower(p));assert.equal(p.id,id);assert.equal(p.createdAt,created);assert.equal(stable(p.archives),records);
  if(name!=='人生模拟')assert.equal(stable(p.resources),wallet);
  assert.equal(managementProfile(p).match,'exact');assert.equal(s.archiveMemory.selections[p.id+'/'+row.id].mode,'pinned');
  assert.equal(upgradeBuiltinPower(p),false);validateState(clone(s));
  assert(memoryPlan(s,[],'已成立成果',{auto:true,budget:6000,selections:s.archiveMemory.selections}).packet.includes('后来取得进一步成长'));
});
test('changed simulation companion is upgraded with its primary rules',{skip:!old},()=>{
  const p=createPower(old.find(e=>e.name==='人生模拟'),[old.find(e=>e.name==='人生模拟·模拟格式')]);
  upgradeBuiltinPower(p);assert.equal(p.rules,entry('人生模拟').content+'\n\n'+entry('人生模拟·模拟格式').content);
  const custom={id:'custom-rule',entryId:'custom',name:'自编附加规则',content:'仅使用东方世界背景，不替换成其他背景。'};
  const q=createPower(old.find(e=>e.name==='万界网购'),[custom]);upgradeBuiltinPower(q);assert(q.rules.endsWith(custom.content));
});
test('simulation opportunities are cumulative, keep wallet ID and parse new status label',{skip:!old},()=>{
  const p=createPower(old.find(e=>e.name==='人生模拟')),r=Object.values(p.resources)[0],id=r.id;r.balance='7';r.name='今日模拟次数';
  upgradeBuiltinPower(p);upgradeResources(p);assert.equal(Object.keys(p.resources).length,1);assert.equal(p.resources[id].name,'模拟次数');assert.equal(p.resources[id].balance,'7');
  assert.equal(inferResources(entry('人生模拟'))[0].id,id);
  assert.equal(extractPanelBalances(p,[{is_user:false,mes:'<WJWK-status>【人生模拟·总览】\n可用模拟次数：[9次]\n</WJWK-status>'}])[id].balance,'9');
});
test('custom rule forks and standalone MMLC are never overwritten',()=>{
  const p=createPower({...entry('万界网购'),content:entry('万界网购').content+'\n自编特别条款。'}),before=stable(p);
  assert.equal(upgradeBuiltinPower(p),false);assert.equal(stable(p),before);
  const f=fixture(),demo=stable(f.power);assert.equal(upgradeBuiltinPower(f.power),false);assert.equal(stable(f.power),demo);
});
test('updated schemas preserve all old field IDs and recognized shipped bindings use new preset',{skip:!old||!previousAdapters},()=>{
  for(const id of ['wuku.undead_sovereign','wuku.shopping','wuku.life_simulation','wuku.possibility_seal']){
    const before=previousAdapters.find(c=>c.id===id),after=CREATION_PRESETS.find(c=>c.id===id);assertAdapterFields(before,after);
    const e=old.find(e=>before.target.primaryHashes.includes(hash(e.content))),p=createPower(e);applyAdapter(p,before);
    upgradeBuiltinPower(p);assert.equal(creationConfig(p).version,'2.0.0');
  }
  const p=createPower(old.find(e=>e.name==='人生模拟')),custom=clone(previousAdapters.find(c=>c.id==='wuku.life_simulation'));custom.id='local.custom';applyAdapter(p,custom);
  const binding=stable(p.adapterBinding);upgradeBuiltinPower(p);assert.equal(stable(p.adapterBinding),binding);
});
test('pre-upgrade queued proposals remain history and cannot execute against changed rules',{skip:!old},()=>{
  const p=createPower(old.find(e=>e.name==='人生模拟')),item=normalizeCreation({title:'旧方案',content:'观察路线',conditions:'待正文处理',ruleQuote:p.primaryRules.slice(0,30)},p,{goal:'目标'});
  upgradeBuiltinPower(p);assert.equal(creationCurrent(item,p,[]),false);assert.equal(item.status,'queued');
});
test('normal chat preparation upgrades recognized rules without model or variable calls',{skip:!old},async()=>{
  const f=fixture(),p=createPower(old.find(e=>e.name==='人生模拟'));f.state.powers={[p.id]:p};let calls=0;f.app.model.generate=()=>{calls++;throw Error('unexpected AI call');};
  await f.app.prepareResources();assert.equal(f.store.read().powers[p.id].primaryRules,entry('人生模拟').content);assert.equal(calls,0);assert.equal(f.replacementCount,0);
});

const cases=[
  ['人生模拟','rewards','北港命途三重结算',{origin:'北港独立分支',strength:'实际继承金丹巅峰',talent:'永久新增观潮天赋',times:'本次返还并新增次数，现有9次'},'北港模拟有效结束，现实已继承金丹巅峰，获得永久观潮天赋，并返还和增加次数，储备九次。模拟中的矿场和同伴没有复制到现实。'],
  ['万界网购','orders','星砂订单',{item:'星砂两袋',valuation:'参考估值200',exchange:'平台即时兑换价80',quote:'市场有效买入报价100',member_price:'七折实付70',payment:'已付70',ownership:'已归属，尚在暂存',progress:'待领取'},'星砂参考估值200，平台即时兑换价80，市场有效买入报价100。已按七折支付70购得两袋，暂存待领取，后续领取不再扣费。'],
  ['绝对生产力','projects','青禾供给项目',{goal:'每天供给营地净水',conditions:'净化知识和设施已实际提供',delivery:'首日交付两桶，未来按项目持续供给'},'绝对生产力已提供净化知识与设施，青禾供给项目首日实际交付净水两桶，后续每天供给，不预记未来产出。'],
  ['败家生财','spending','营地购粮支出',{outgoing:'支付商人100银购买粮食',refund:'原额补回100银',extra:'额外新增20银；正常购粮另计'},'败家生财本次实际支付商人100银，商人收到100银并交付粮食，权能同步补回100银并额外产生20银。'],
  ['仙境再现','links','红灯与加速联系',{ends:'红色灯光与道路时间',effect:'灯光照射时道路行进时间减半',scope:'只在北门道路生效'},'仙境再现已建立红色灯光与道路时间的联系，仅在北门道路灯照范围令行进时间减半，没有开辟独立随身世界。'],
  ['自定义','rules','青禾每日增长定义',{scope:'仅青禾一族，不追溯历史',mechanism:'每日增长率已改为百分之十',output:'当前尚未经过一天，没有新增人口'},'自定义已将青禾一族每日增长率改为百分之十，立即生效；不追溯过去，尚未过一天，没有新增人口。'],
];
for(const [name,recordId,title,details,story]of cases)test(name+': AI-shaped update saves once and feeds long-term memory without direct resource writes',async()=>{
  const f=fixture(),p=createPower(entry(name));f.state.powers={[p.id]:p};f.app.powerId=p.id;f.ctx.chat.push({is_user:false,mes:story,swipe_id:0});f.app.refresh();
  const wallet=stable(p.resources);
  async function commit(){const snapshot=f.app.contextSnapshot(),power=snapshot.state.powers[p.id],sources=archiveSources(f.ctx.chat,snapshot.state,power,{rescan:true});const before=Object.values(power.archives||{}).find(r=>r.name===title);const raw={...(before?{archiveId:before.id}:{}),type:'record',name:title,status:'active',fields:{description:story},recordId,details,sourceIndex:1};const changes=normalizeArchiveChanges({changes:[raw]},power,sources,f.ctx.chat);await f.app.commitArchiveReview({captured:f.store.capture(),contextHash:hash(stable(snapshot.hashes)),powerId:p.id,sources,changes,creationResults:[],terminalResults:[]},new Map([[0,before?.id||null]]));}
  await commit();const saved=f.store.read().powers[p.id],record=Object.values(saved.archives)[0];assert.deepEqual(record.specific.fields,details);assert.equal(stable(saved.resources),wallet);assert.equal(f.replacementCount,0);
  await commit();const state=f.store.read(),power=state.powers[p.id];assert.equal(Object.keys(power.archives).length,1);assert.equal(power.archives[record.id].history.length,0);
  assert(statisticsDashboard(power,f.ctx.chat).sections.some(s=>s.records.some(r=>r.id===record.id)));
  assert(memoryPlan(state,f.ctx.chat,title,{auto:true,budget:10000,selections:{}}).packet.includes(Object.values(details)[0]));validateState(clone(state));
  const request=JSON.parse(creationPrompt(power,f.ctx.chat,'拟定下一步').prompt.user);assert.equal(request.operation.id,'draft');
});
