import test from 'node:test';
import a from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { configuredProfiles, managementProfile, assertProfileRegistration, coverageRows, PROFILE_FAMILIES } from '../src/management-profiles.js';
import { importBook, inferResources, emptyState, createPower, clone, stable, validateState, buildInjection } from '../src/core.js';
import { managementPrompt, managementMethods } from '../src/management.js';
import { profilePanel, coveragePanel, coverageResults } from '../src/profile-view.js';
import { WorkbenchUI } from '../src/ui.js';
const data = configuredProfiles();
const original = process.env.WJWK_TEST_BOOK ? await readFile(process.env.WJWK_TEST_BOOK) : null;
const entries = original ? importBook(JSON.parse(original.toString('utf8').replace(/^\uFEFF/,'')), '任意导入文件名') : [];
test('coverage inventory accounts for all 119 entries, 111 primary powers and 8 support entries', () => {
  a.equal(data.entries.length,119);a.equal(new Set(data.entries.map(e=>e.name)).size,119);
  a.equal(data.entries.filter(e=>e.role==='primary').length,111);a.equal(data.entries.filter(e=>e.role==='support').length,8);
  a.equal(data.entries.reduce((n,e)=>n+e.templates.length,0),470);
  for(const p of data.entries) { a.ok(PROFILE_FAMILIES[p.family]);a.ok(p.role==='support'||p.templates.length);if(p.parent)a.ok(data.entries.some(e=>e.name===p.parent&&e.role==='primary')); }
});
test('every source entry and every template matches the actual book, under a different filename', {skip:!original}, () => {
  a.equal(createHash('sha256').update(original).digest('hex'),data.sourceSha256);
  for(const e of entries) {
    const p=managementProfile(e);a.equal(p.verified,true,e.name);a.equal(p.match,'exact');
    for(const t of p.templates){a.ok(e.content.includes(t.ruleQuote),e.name+'/'+t.label);a.ok(t.ruleQuote.length>=6);a.ok(!inferResources(e).some(r=>t.label.includes(r.name)));}
  }
});
test('changed known rules and unknown powers receive generic templates; unchanged renamed content is recognized', {skip:!original}, () => {
  const e=entries.find(e=>e.name==='源堡'), changed=managementProfile({...e,content:e.content+'新增实际约束。'});
  a.equal(changed.verified,false);a.equal(changed.match,'changed');a.equal(changed.templates.length,3);a.ok(changed.templates.every(t=>!t.ruleQuote));
  const renamed=managementProfile({...e,name:'改名的源堡'});a.equal(renamed.verified,true);a.equal(renamed.match,'renamed');a.equal(renamed.name,'源堡');
  a.equal(managementProfile({name:'新权柄',content:'正文使用并保留重要成果。'}).match,'unknown');
});
test('attached supplemental rules do not defeat matching primary rules; returned configurations are isolated', {skip:!original}, () => {
  const e=entries.find(e=>e.name==='深蓝'), p=createPower(e,[entries.find(e=>e.name==='万界武库通用选项栏')]);
  const profile=managementProfile(p);a.equal(profile.verified,true);profile.templates[0].label='改坏';a.notEqual(managementProfile(p).templates[0].label,'改坏');
  const copy=configuredProfiles();copy.entries.length=0;a.equal(configuredProfiles().entries.length,119);
});
test('support entries cannot be primary registrations; variant checks include active powers and companions', {skip:!original}, () => {
  const support=entries.filter(e=>managementProfile(e).role==='support');
  for(const e of support)a.throws(()=>assertProfileRegistration(e,[],{}),/辅助规则/);
  const variants=entries.filter(e=>managementProfile(e).variantGroup);a.equal(variants.length,2);
  const p=createPower(variants[0]);a.throws(()=>assertProfileRegistration(variants[1],[],{[p.id]:p}),/先暂停/);
  a.throws(()=>assertProfileRegistration(variants[0],[variants[1]],{}),/不能在同次/);
  p.active=false;a.doesNotThrow(()=>assertProfileRegistration(variants[1],[],{[p.id]:p}));
  a.doesNotThrow(()=>assertProfileRegistration(variants[0],[],{[variants[0].id]:createPower(variants[0])}));
});
test('coverage separates unread configurations, verified imports, changed versions and unknown imports', {skip:!original}, () => {
  a.equal(coverageRows().filter(r=>r.status==='unread').length,119);
  a.equal(coverageRows(entries).filter(r=>r.status==='verified').length,119);
  const e=entries[0], changed={...e,content:e.content+'变化'}, unknown={id:'custom',name:'新权柄',content:'自编新内容',book:'自编'};
  const rows=coverageRows([changed,unknown]);a.equal(rows.length,120);a.equal(rows.find(r=>r.name===e.name).status,'changed');a.equal(rows.at(-1).status,'unknown');
  a.match(coverageResults([e,changed],emptyState(),'','fallback'),/已读取不同规则|同名规则已变/);
});
test('templates prepare a form without inventing a fact, spending resources or invoking a model', {skip:!original}, () => {
  const e=entries.find(e=>e.name==='源堡'), s=emptyState(), p=createPower(e);s.powers[p.id]=p;const before=stable(s);let shown;
  const fake={powerId:p.id,ensureStable:()=>({state:s,chatKey:'chat'}),ui:{showManagementRecord(...args){shown=args;}}};Object.assign(fake,managementMethods);
  fake.openManagementTemplate('template_0');a.equal(stable(s),before);a.equal(shown[1],null);a.equal(shown[2].label,'重要记录');a.equal(fake.managementDraft.captured.revision,0);
  a.throws(()=>fake.openManagementTemplate('template_999'),/模板不存在/);
  let html;WorkbenchUI.prototype.showManagementRecord.call({dialog(_title,body){html=body;}},p,null,shown[2]);
  a.match(html,/name="label"[^>]*value="重要记录"/);a.match(html,/name="value"[^>]*><\/textarea>/);a.match(html,/事实内容保持空白/);
});
test('model management receives optional guidance without promoting it to facts or changing main injection', {skip:!original}, () => {
  const s=emptyState(),p=createPower(entries.find(e=>e.name==='万物尽头'));s.powers[p.id]=p;
  const before=stable(s), prompt=managementPrompt(s,[]), payload=JSON.parse(prompt.user);
  a.equal(payload.managementGuidance[0].match,'exact');a.ok(payload.managementGuidance[0].templates.some(t=>t.label==='主要产线'));
  a.match(prompt.system,/不得为了填模板创造状态/);a.equal(stable(s),before);a.deepEqual(validateState(clone(s)).powers[p.id].managementRecords,{});
  a.doesNotMatch(buildInjection(s),/managementGuidance|template_0/);
});
test('source structural fields never create phantom wallets; explicit spendable fields remain', {skip:!original}, () => {
  for(const name of ['奇迹智子','文明之光系统','旅法师'])a.deepEqual(inferResources(entries.find(e=>e.name===name)),[],name);
  a.deepEqual(inferResources({name:'新体系',content:'<状态栏>\n当前重点：[建设]\n当前文明节点：[工业]\n当前位面与落点：[城市]\n当前锚点：[旧卷]\n当前灵点：[5点]\n火焰储量：[6]\n<结算与回执>'}).map(r=>r.name),['灵点','火焰']);
});
test('all source powers remain backup-compatible and have an honest management path', {skip:!original}, () => {
  const s=emptyState();for(const e of entries.filter(e=>managementProfile(e).role==='primary')){const p=createPower(e);s.powers[p.id]=p;a.match(profilePanel(p,false),/只帮助填写/);}
  a.equal(Object.keys(validateState(clone(s)).powers).length,111);
  a.match(coveragePanel([],s),/尚未读取核对/);a.match(coverageResults(entries,s,'预支'),/负势差/);
  const html=coverageResults(entries,s,'','support');a.equal((html.match(/class="wjwk-asset"/g)||[]).length,8);
});
test('coverage and template content cannot execute HTML from custom names or text', () => {
  const e={id:'custom',name:'<img src=x onerror=alert(1)>',content:'<script>bad()</script>',book:'<img>'},html=coveragePanel([e],emptyState())+profilePanel(e,false);
  a.doesNotMatch(html,/<img|<script>/);a.match(html,/&lt;img/);a.match(html,/未知词条/);
});
