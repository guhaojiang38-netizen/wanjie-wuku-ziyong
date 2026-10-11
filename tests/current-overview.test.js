import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { createPower } from '../src/core.js';
import { MMLC_ENTRY } from '../src/mmlc.js';
import { saveArchive, archiveSource } from '../src/archives.js';
import { currentOverview, overviewHighlights, overviewRecord } from '../src/current-overview.js';
import { WorkbenchUI } from '../src/ui.js';
function add(f,type,name,status,fields,module){return saveArchive(f.power,{type,name,status,fields,...(module?{module}:{})},archiveSource(f.ctx.chat,'玩家确认'));}

test('current state replaces previous values without counting history as extra objects',()=>{
 const f=fixture(),r=add(f,'population','耐寒工蜂','active',{scale:'二十只',purpose:'巡视北坡'});
 saveArchive(f.power,{id:r.id,type:r.type,name:r.name,status:'active',fields:{scale:'十五只，损失五只',purpose:'巡视北坡'}},archiveSource(f.ctx.chat,'已核对损失'));
 const before=JSON.stringify(f.power),o=currentOverview(f.power,f.ctx.chat);assert.equal(o.counts.active,1);assert.equal(o.groups[0].records[0].facts[0].value,'十五只，损失五只');assert.equal(JSON.stringify(f.power),before);
});

test('plans and unfinished blueprints never count as established ships; ended objects remain separate',()=>{
 const f=fixture();f.power=createPower(MMLC_ENTRY);
 add(f,'research','玄黄舰图纸','working',{progress:'仅完成图纸，尚未建造'},'fleet');add(f,'population','预备舰队','planned',{scale:'计划十二艘'},'fleet');add(f,'population','旧巡航舰','ended',{scale:'一艘，已毁'},'fleet');
 const g=currentOverview(f.power,f.ctx.chat).groups.find(g=>g.id==='fleet');assert.deepEqual(g.counts,{active:0,working:1,planned:1,ended:1});assert.deepEqual(overviewHighlights(g).map(r=>r.status),['working','planned']);assert.equal(currentOverview(f.power,f.ctx.chat).groups.length,8);
});

test('missing scale remains missing and mixed quantities are never added or parsed',()=>{
 const f=fixture();add(f,'population','工蜂','active',{scale:'十二只，其中两只待恢复'});add(f,'population','育种群','active',{purpose:'育种，数量未明确'});
 const o=currentOverview(f.power,f.ctx.chat);assert.equal(o.counts.active,2);const rows=o.groups[0].records;assert.ok(rows.some(r=>r.facts.some(f=>f.value==='十二只，其中两只待恢复')));assert.ok(!rows.find(r=>r.name==='育种群').facts.some(f=>f.key==='scale'));
});


test('limits stay visible, long facts are not sliced into misleading counts',()=>{
 const row=overviewRecord({id:'r',name:'试验群',type:'population',status:'active',fields:{scale:'十二只'+ '完整说明'.repeat(80),purpose:'试验',location:'北坡',traits:'耐寒',limits:'尚不能离开保温区'}});
 assert.equal(row.facts[0].compact,false);assert.ok(row.facts.some(f=>f.value==='尚不能离开保温区'));assert.ok(row.omittedFields>0);
});

test('overview is power-scoped and updates without API calls or extra persistence',()=>{
 const f=fixture();add(f,'skill','掌法','active',{level:'登堂'});const other=createPower(MMLC_ENTRY);const before=JSON.stringify(other);assert.equal(currentOverview(other,f.ctx.chat).counts.active,0);assert.equal(JSON.stringify(other),before);
 f.power.active=false;assert.equal(currentOverview(f.power,f.ctx.chat).paused,true);assert.equal(currentOverview(f.power,f.ctx.chat).counts.active,1);assert.equal(f.replacementCount,0);
});

test('overview text and IDs are escaped and long facts retain full-record affordance',()=>{
 const f=fixture();add(f,'record','<img src=x onerror=alert(1)>','active',{description:'秘密长文'.repeat(80),limits:'<script>bad</script>'});const ui=Object.create(WorkbenchUI.prototype);ui.view={};
 const html=ui.currentOverviewPanel(f.power,f.ctx.chat);assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);assert.match(html,/查看详情/);assert.match(html,/内容较长/);assert.doesNotMatch(html,/秘密长文秘密/);
});

test('module detail counts include only its module and exclude pending AI proposals',()=>{
 const f=fixture();f.power=createPower(MMLC_ENTRY);add(f,'facility','道场','active',{condition:'稳定'},'land');add(f,'member','内门弟子','working',{role:'正在入门'},'sect');
 const ui=Object.create(WorkbenchUI.prototype);ui.view={pendingArchiveReview:{changes:[{name:'未确认舰船'}]}};const html=ui.currentOverviewPanel(f.power,f.ctx.chat,'sect');assert.match(html,/已建立 0 · 进行中 1/);assert.doesNotMatch(html,/道场|未确认舰船/);
});
