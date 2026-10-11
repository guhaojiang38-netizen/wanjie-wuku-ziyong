import test from 'node:test';
import strict from 'node:assert/strict';
import { resolveArchiveEvidence } from '../src/archive-evidence.js';
import { fixture } from './mvu-fixture.js';
import { archiveSources, normalizeArchiveChanges, applyArchiveChanges } from '../src/archive-review.js';
const sources=[{index:5,content:'本命剑已经修复完成，可以正常使用。'},{index:9,content:'青禾器灵保留\n原有记忆，完成换形。'}];
test('one-based or batch-position mistakes recover only unique literal evidence in captured sources',()=>{
 strict.equal(resolveArchiveEvidence(6,'本命剑已经修复完成',sources).index,5);
 strict.equal(resolveArchiveEvidence(0,'本命剑已经修复完成',sources).index,5);
 strict.equal(resolveArchiveEvidence('5','本命剑已经修复完成',sources).index,5);
});
test('whitespace-only formatting changes recover original literal quote for persistence',()=>{
 const e=resolveArchiveEvidence(9,'青禾器灵保留原有记忆',sources);strict.equal(e.quote,'青禾器灵保留\n原有记忆');strict.ok(e.source.content.includes(e.quote));
});
test('recovered source identity participates in duplicate merge and remains literally anchored',()=>{
 const f=fixture(),s=archiveSources(f.ctx.chat,f.state,f.power),raw={type:'skill',name:'拂风绵掌',status:'active',fields:{level:'已掌握'},sourceIndex:1,quote:'你已掌握拂风绵掌',ruleQuote:f.power.rules.slice(0,20)};
 const changes=normalizeArchiveChanges({changes:[raw,{...raw,sourceIndex:0}]},f.power,s,f.ctx.chat);strict.equal(changes.length,1);strict.equal(changes[0].source.anchor.index,0);
 applyArchiveChanges(f.power,changes,s,new Map([[0,null]]),f.ctx.chat);strict.equal(Object.keys(f.power.archives).length,1);
});
