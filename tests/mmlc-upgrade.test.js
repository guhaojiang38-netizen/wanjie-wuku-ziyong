import test from 'node:test';
import assert from 'node:assert/strict';
import { MMLC_ENTRY } from '../src/mmlc.js';
import { MMLC_CONFIG, MMLC_GAMEPLAY } from '../src/mmlc-config.js';
import { creationConfig, creationRules } from '../src/creation-config.js';
import { creationPrompt, normalizeCreation, creationCurrent, creationMethods } from '../src/creation.js';
import { createPower, emptyState, validateState, clone } from '../src/core.js';
import { saveArchive, archiveSource } from '../src/archives.js';
import { archivePrompt, normalizeArchiveChanges, applyArchiveChanges } from '../src/archive-review.js';
import { mmlcDashboard, mmlcFacts, mmlcLinked, mmlcRelations } from '../src/mmlc-view.js';
import { memoryPlan } from '../src/archive-memory.js';
import { WorkbenchUI } from '../src/ui.js';
const setup=()=>{const p=createPower(MMLC_ENTRY),s=emptyState();s.powers[p.id]=p;return {p,s};};
function add(p,name,module='land',fields={facilities:'已建成的试验炉'},links='',status='active',chat=[]){
 const d=MMLC_CONFIG.records.find(d=>d.id===module);
 return saveArchive(p,{type:'record',name,status,module,fields:{description:'正文确认已有'},specific:{adapterId:MMLC_CONFIG.id,recordId:module,version:'1.0.0',label:d.label,labels:Object.fromEntries(d.fields.map(f=>[f.id,f.label])),fields:{...fields,links}}},archiveSource(chat,'玩家确认已有成果'));
}
for(const def of MMLC_CONFIG.records)test('module AI fields persist and display: '+def.id,()=>{
 const {p,s}=setup(),note='已完成该对象的制造或修行，并确认其当前情况。';
 const raw={name:def.label+'对象',type:'record',module:def.id,status:'active',fields:{description:note},recordId:def.id,details:{[def.fields[0].id]:'已确认的完整情况'},sourceIndex:-1,quote:note,ruleQuote:p.rules.slice(0,20)};
 const changes=normalizeArchiveChanges({changes:[raw]},p,[],[],note),[r]=applyArchiveChanges(p,changes,[],new Map([[0,null]]),[]);
 assert.equal(r.specific.recordId,def.id);assert.equal(mmlcDashboard(p,[],def.id)[0].records[0].id,r.id);assert.equal(mmlcFacts(r)[0].label,def.fields[0].label);validateState(clone(s));
 const again=normalizeArchiveChanges({changes:[{...raw,archiveId:r.id}]},p,[],[],note);applyArchiveChanges(p,again,[],new Map([[0,r.id]]),[]);assert.equal(Object.keys(p.archives).length,1);
});
test('old archives remain readable and AI enriches the same identity',()=>{
 const {p}=setup(),old=saveArchive(p,{name:'旧玄黄舰',module:'fleet',type:'record',status:'active',fields:{description:'一艘舰船，舰体完好'}},archiveSource([],'玩家确认'));
 assert.match(mmlcFacts(old)[0].value,/一艘/);const note='旧玄黄舰一艘，舰体完好，目前在北海巡航。';
 const c=normalizeArchiveChanges({changes:[{archiveId:old.id,name:old.name,module:'fleet',type:'record',status:'active',fields:{description:note},recordId:'fleet',details:{quantity:'一艘',deployment:'北海巡航'},sourceIndex:-1,quote:note,ruleQuote:p.rules.slice(0,20)}]},p,[],[],note);
 applyArchiveChanges(p,c,[],new Map([[0,old.id]]),[]);assert.equal(Object.keys(p.archives).length,1);assert.equal(p.archives[old.id].history.length,1);assert.equal(p.archives[old.id].specific.fields.quantity,'一艘');
});
test('cross-module fields rejected; ordinary powers keep generic behavior',()=>{
 const {p}=setup(),note='玄黄舰已经完成制造并交付使用。';assert.throws(()=>normalizeArchiveChanges({changes:[{name:'玄黄舰',type:'record',module:'fleet',status:'active',fields:{description:note},recordId:'land',details:{facilities:'炉'},sourceIndex:-1,quote:note,ruleQuote:p.rules.slice(0,20)}]},p,[],[],note),/同一个模块/);
 const other=createPower({id:'plain',entryId:'0',name:'测试',content:'测试规则没有专属配置'});assert.equal(creationConfig(other),null);assert.equal(creationRules(other),other.rules);
});
test('relations resolve explicit exact names and historical aliases, never similar names',()=>{
 const {p}=setup(),a=add(p,'北坡福地'),b=add(p,'试验炉','land',{condition:'正常'},'北坡福地；北坡；未知对象');
 assert.equal(mmlcRelations(p,[]).length,1);assert.equal(mmlcLinked(p,[],a.id)[0].id,b.id);
 saveArchive(p,{...a,name:'青云福地'},a.source);assert.equal(mmlcLinked(p,[],b.id)[0].name,'青云福地');
 const ambiguous=add(p,'其他福地');ambiguous.history=[{...a,history:undefined}];assert.equal(mmlcRelations(p,[]).length,0);
});
test('quantities keep units and statuses without inventing totals',()=>{
 const {p}=setup();add(p,'一号舰队','fleet',{quantity:'三支舰队',availability:'一支在维修'});add(p,'二号舰','fleet',{quantity:'两艘',availability:'一艘可用'},'','working');
 const d=mmlcDashboard(p,[],'fleet')[0];assert.equal(d.records.length,2);assert.equal(mmlcFacts(d.records[0])[0].value,'三支舰队');assert.equal(d.records[1].status,'working');assert.equal(d.total,undefined);
});
test('module prompts include real gameplay reference and saved context, not initial asset grants',()=>{
 const {p}=setup();const r=add(p,'北海玄黄舰','fleet',{quantity:'一艘',deployment:'北海'}),spec=creationPrompt(p,[],'维修舰船','fleet'),body=JSON.parse(spec.prompt.user);
 assert.equal(body.operation.id,'fleet');assert.equal(body.current[0].id,r.id);assert.equal(body.current[0].module,'fleet');assert.match(body.rules,/不设演算货币/);assert.match(spec.prompt.system,/不能宣称玩家已拥有/);
 const quote=MMLC_GAMEPLAY.slice(0,24),item=normalizeCreation({title:'维修方案',content:'路线一修复舰体；路线二回场维修',conditions:'缺口待正文判定',ruleQuote:quote},p,{goal:'维修',operationId:'fleet',sources:spec.sources});
 assert.equal(creationCurrent(item,p,[]),true);assert.equal(item.status,'queued');assert.equal(Object.keys(p.archives).length,1);p.archives[r.id].specific.fields.quantity='两艘';assert.equal(creationCurrent(item,p,[]),false);
});
test('module schema automatically joins both manual and auto review prompt',()=>{
 const {p}=setup();for(const automatic of [false,true]){const prompt=archivePrompt(p,[],[],{automatic});assert.equal(JSON.parse(prompt.user).recordSchemas.length,8);assert.match(prompt.system,/links仅记录/);}
});
test('related facts join narrative memory with exclusions and ended state protected',()=>{
 const {p,s}=setup(),a=add(p,'北坡福地'),b=add(p,'试验炉','land',{condition:'正常'},a.name),c=add(p,'废弃炉','land',{condition:'已毁'},a.name,'ended');
 const config={auto:true,budget:12000,selections:{}};let plan=memoryPlan(s,[],a.name,config);assert.ok(plan.included.some(r=>r.id.endsWith('/'+b.id)));assert.ok(!plan.included.some(r=>r.id.endsWith('/'+c.id)));
 config.selections[p.id+'/'+b.id]={mode:'exclude',token:'t'};plan=memoryPlan(s,[],a.name,config);assert.ok(!plan.included.some(r=>r.id.endsWith('/'+b.id)));
});
test('module home displays concrete facts, visible assets, action entrance and escaped names',()=>{
 const {p,s}=setup();add(p,'<img src=x>玄黄舰','fleet',{quantity:'两艘',availability:'一艘维修'});const ui=Object.create(WorkbenchUI.prototype);ui.view={state:s};ui.mmlcSection='fleet';const html=ui.management(s,p,false,'st',null,[]);
 assert.match(html,/当前家底/);assert.match(html,/两艘/);assert.match(html,/一艘维修/);assert.match(html,/规划舰船部署/);assert.match(html,/data-action="creation-open" data-section="fleet"/);assert.doesNotMatch(html,/<img src=x>/);
});
