import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { saveArchive, archiveSource, archiveCurrent } from '../src/archives.js';
import { archiveSources, normalizeArchiveChanges, applyArchiveChanges, archiveChangeTarget, archivePrompt } from '../src/archive-review.js';
import { clone, validateState } from '../src/core.js';
function setup(){const f=fixture();const r=saveArchive(f.power,{type:'population',name:'耐寒工蜂',status:'active',fields:{scale:'一小群',traits:'耐寒',location:'北坡'}},archiveSource(f.ctx.chat,'确认'));f.ctx.chat.push({is_user:false,mes:'耐寒工蜂现有二十只，耐寒并具备夜视能力，全部位于北坡。'});const raw={archiveId:r.id,type:'population',name:r.name,status:'active',fields:{traits:'耐寒、夜视'},sourceIndex:1,quote:'耐寒工蜂现有二十只，耐寒并具备夜视能力，全部位于北坡。',ruleQuote:f.power.rules.slice(0,12)};return {...f,r,raw};}
const normalize=(f,raw=f.raw)=>normalizeArchiveChanges({changes:[raw]},f.power,archiveSources(f.ctx.chat,f.state,f.power),f.ctx.chat);
test('existing identity corrects compatible AI category without converting archive or dropping fields',()=>{const f=setup();const c=normalize(f,{...f.raw,type:'member'})[0];strict.equal(c.type,'population');strict.equal(c.id,f.r.id);strict.equal(c.recovery,undefined);});
test('incompatible AI category fails with object name and separate explanation',()=>{const f=setup();strict.throws(()=>normalize(f,{...f.raw,type:'record',fields:{description:'工蜂变多了'}}),/耐寒工蜂.*分类.*字段不兼容/);});
