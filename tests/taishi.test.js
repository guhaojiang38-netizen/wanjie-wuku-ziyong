import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './mvu-fixture.js';
import {createPower,clone,validateState} from '../src/core.js';
import {builtinEntries} from '../src/builtin-worldbook.js';
import {isTaishi,taishiConfig,taishiSection,protectTaishiBaseline} from '../src/taishi.js';
import {powerSpace} from '../src/space-controller.js';
import {archiveSource,saveArchive,archiveCurrent} from '../src/archives.js';
import {archivePrompt,archiveSources,normalizeArchiveBatch} from '../src/archive-review.js';
import {creationConfig} from '../src/creation-config.js';
const entry=()=>builtinEntries().find(e=>e.name.startsWith('太始天（完整版'));
async function setup(){const f=fixture();f.app.ui.closeDialog=()=>{};f.app.ui.showArchiveReview=()=>{};await f.app.openTaishi();f.app.settings.mode='st';return f;}
const change=(name,id='world',type='environment')=>({name,type,status:'active',fields:type==='member'?{role:'太始天眷属，负责世界建设'}:{conditions:'成熟世界，独立运行'},recordId:id,details:id==='companion'?{world:'海蓝界',action:'建设灵圃',progress:'第一期完成'}:{stage:'成熟世界',setting:'保留个人设定'},sourceIndex:0,quote:''});
test('independent space recognizes full official rules, not a coincidental name',()=>{
 const p=createPower(entry());assert.equal(isTaishi(p),true);assert.equal(powerSpace(p),'taishi');
 assert.equal(isTaishi({...p,name:'太始天',primaryRules:'别的金手指'}),false);
 assert.equal(isTaishi({...p,id:'imported-existing-id',name:'我的诸界'}),true);
});
test('opening reuses old power identity, values, history, memory; no duplicate registration',async()=>{
 const f=fixture(),p=createPower({...entry(),id:'old-personal-identity'});
 saveArchive(p,{type:'environment',name:'海蓝界',status:'active',fields:{conditions:'已有世界'}},archiveSource(f.ctx.chat,'旧档案'));
 await f.store.transact(s=>{s.powers[p.id]=p;});const before=clone(f.store.read().powers[p.id]);
 f.app.ui.closeDialog=()=>{};await f.app.openTaishi();await f.app.openTaishi();
 assert.equal(f.app.powerId,p.id);assert.equal(f.app.ui.space,'taishi');assert.deepEqual(f.store.read().powers[p.id],before);
 assert.equal(Object.values(f.store.read().powers).filter(isTaishi).length,1);
});
test('schemas extend old stable identities and keep arbitrary worlds and companions separate',()=>{
 const c=taishiConfig();assert.equal(c.id,'wuku.primordial_world');assert.equal(c.records.find(r=>r.id==='world').fields.find(f=>f.id==='clock').label,'本世界内历');
 for(const id of ['world','inhabitants','available','growth','companion','development'])assert(c.records.some(r=>r.id===id));
 assert.equal(taishiSection({type:'member'}),'companions');assert.equal(taishiSection({type:'research'}),'development');
 assert.equal(taishiSection({type:'environment',specific:{recordId:'world'}}),'worlds');
 assert.equal(taishiSection({type:'environment'}),'other');
  assert.equal(taishiSection({type:'member',specific:{recordId:'available'}}),'available');
 assert(!JSON.stringify(c).includes('裴昭宁'));
});
test('manual and automatic review use same schema and retain world-local fields without inferred clock',async()=>{
 const f=await setup(),p=f.store.read().powers[f.app.powerId];const sources=archiveSources(f.ctx.chat,f.store.read(),p,{rescan:true});
 const prompt=archivePrompt(p,sources,f.ctx.chat,'',{state:f.store.read(),automatic:true});
 assert.match(prompt.system,/不用电脑时钟/);assert.match(prompt.system,/其他金手指/);assert(JSON.parse(prompt.user).recordSchemas.some(r=>r.id==='companion'));
 const batch=normalizeArchiveBatch({changes:[change('海蓝界'),change('赤砂界'),change('云岚','companion','member')]},p,sources,f.ctx.chat,'',f.store.read());
 assert.equal(batch.changes.length,3);assert.equal(batch.issues.length,0);
});
test('automatic record updates without selecting its page and third party text changes do not expire it',async()=>{
 const f=await setup(),id=f.app.powerId;await f.store.transact(s=>{s.powers[id].autoArchiveReview=true;s.powers[id].autoArchiveSave=true;s.powers[id].autoArchiveStart=0;});
 f.app.model.request=async()=>JSON.stringify({changes:[change('海蓝界'),change('云岚','companion','member')]});
 f.app.ui.space='wuku';f.app.powerId=f.power.id;
 await f.app.reviewArchives({powerId:id,automatic:true,autoSave:true,silent:true});
 let p=f.store.read().powers[id];assert.equal(Object.keys(p.archives).length,2);const ids=Object.keys(p.archives);
 assert(p.archiveUndo);assert.equal(f.replacementCount,0);
 f.ctx.chat[0].mes+='\n世界引擎附加面板更新';f.ctx.chat[0].is_system=true;f.ctx.chat[0].extra={bbs_hidden:true};
 assert(Object.values(p.archives).every(r=>archiveCurrent(r,f.ctx.chat)));
 await f.app.reviewArchives({powerId:id,rescan:true,autoSave:true,silent:true});p=f.store.read().powers[id];assert.deepEqual(Object.keys(p.archives),ids);validateState(f.store.read());
});
test('worldbook initialization previews adopted settings, saves no read cursor and never auto commits',async()=>{
 const f=await setup(),id=f.app.powerId;await f.store.transact(s=>{s.aiWorldbooks={mode:'manual',books:[{name:'我的世界',entryIds:['1']}]};});
 f.ctx.loadWorldInfo=async()=>({entries:{1:{uid:1,content:'海蓝界已经成熟，眷属云岚正在主持灵圃建设。'}}});let request;
 f.app.model.request=async prompt=>{request=prompt;return JSON.stringify({changes:[{...change('海蓝界'),sourceIndex:-1}]});};
 await f.app.reviewArchives({setupReferences:true,autoSave:true});
 assert.equal(Object.keys(f.store.read().powers[id].archives||{}).length,0);assert(f.app.pendingArchiveReview.setupReferences);assert.match(request.system,/世界书初始化/);
 const pending=f.app.pendingArchiveReview;assert.equal(pending.sources.length,0);assert.equal(pending.changes[0].source.type,'manual');assert.match(pending.changes[0].source.note,/个人世界书设定底稿/);
 await f.app.commitArchiveReview(pending,new Map([[0,null]]));
 assert.equal(Object.keys(f.store.read().powers[id].archives).length,1);assert.equal(f.store.read().powers[id].archiveReviewed.length,0);
 validateState(f.store.read());
});
test('baseline gap fill cannot roll back current fields or status, conflicts are reported',()=>{
 const before={status:'working',fields:{conditions:'新现状'},specific:{fields:{clock:'新内历'}}};
 const batch={issues:[],changes:[{name:'海蓝界',before,status:'active',patch:{conditions:'旧现状',location:'新地点'},specific:{fields:{clock:'旧内历',stage:'成熟'}}}]};
 protectTaishiBaseline(batch);assert.equal(batch.changes[0].patch.conditions,undefined);assert.equal(batch.changes[0].patch.location,'新地点');assert.equal(batch.changes[0].specific.fields.clock,'新内历');assert.equal(batch.changes[0].status,'working');assert.equal(batch.issues.length,1);
});
test('empty setting selection does not call model or hold the request lock',async()=>{
 const f=await setup();let calls=0;f.app.model.request=async()=>{calls++;return '{}';};
 await assert.rejects(f.app.reviewArchives({setupReferences:true}),/个人世界书/);assert.equal(calls,0);assert.equal(f.app.busy,false);
});
test('late initialization results from another chat cannot be saved',async()=>{
 const f=await setup();await f.store.transact(s=>{s.aiWorldbooks={mode:'manual',books:[{name:'我的世界',entryIds:['1']}]};});f.ctx.loadWorldInfo=async()=>({entries:{1:{uid:1,content:'海蓝界已经存在。'}}});
 let release;f.app.model.request=()=>new Promise(r=>release=r);const pending=f.app.reviewArchives({setupReferences:true});
 while(!release)await new Promise(r=>setTimeout(r,0));f.ctx.chatId='other-chat';release(JSON.stringify({changes:[{...change('海蓝界'),sourceIndex:-1}]}));
 await assert.rejects(pending);assert.equal(f.app.pendingArchiveReview,null);assert.equal(f.app.busy,false);
});
