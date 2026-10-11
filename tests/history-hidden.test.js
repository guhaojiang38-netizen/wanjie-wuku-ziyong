import test from 'node:test';
import assert from 'node:assert/strict';
import { chatHashes, historyChanged } from '../src/core.js';
const message = () => ({is_user:false,is_system:false,name:'角色',swipe_id:0,mes:'既有剧情正文。<UpdateVariable>旧更新</UpdateVariable>'});
test('explicit BBS hide flag can change system identity without rewriting dialogue',()=>{
 const m=message(),state={historyAnchor:chatHashes([m])};m.is_system=true;m.extra={bbs_hidden:true};
 assert.equal(historyChanged(state,chatHashes([m])),false);
 m.extra.bbs_hidden=false;m.is_system=false;assert.equal(historyChanged(state,chatHashes([m])),false);
});
test('hidden messages still detect text, user, swipe and variable instruction changes',()=>{
 const original=message(),state={historyAnchor:chatHashes([original])};
 for(const changes of [{mes:'改写正文。'},{is_user:true},{swipe_id:1},{mes:original.mes.replace('旧更新','新更新')}]){
  const m={...original,is_system:true,extra:{bbs_hidden:true},...changes};assert.equal(historyChanged(state,chatHashes([m])),true);
 }
});
test('ordinary system identity changes are not silently ignored; cache observes hide marker',()=>{
 const m=message(),state={historyAnchor:chatHashes([m])};m.is_system=true;
 assert.equal(historyChanged(state,chatHashes([m])),true);
 m.extra={bbs_hidden:true};assert.equal(historyChanged(state,chatHashes([m])),false);
});

import { archiveSources } from '../src/archive-review.js';
import { archiveSource, archiveCurrent, isArchiveDialogue } from '../src/archives.js';
import { emptyState } from '../src/core.js';
test('hidden original remains readable and existing outcome evidence stays valid',()=>{
 const m={is_user:false,is_system:false,name:'角色',mes:'母巢已经培育了十只工蜂。'},chat=[m],state=emptyState(),power={id:'nest',ruleVersion:'r',archiveStart:0,archives:{}};
 const source=archiveSource(chat,'已有成果'),record={source};
 m.is_system=true;m.extra={bbs_hidden:true};
 assert.equal(archiveSources(chat,state,power,{rescan:true}).length,1);
 assert.equal(archiveCurrent(record,chat),true);
 const hiddenAnchor={historyAnchor:chatHashes(chat)};m.is_system=false;delete m.extra.bbs_hidden;
 assert.equal(historyChanged(hiddenAnchor,chatHashes(chat)),false);
 assert.equal(isArchiveDialogue({is_system:true,is_user:false}),false);
 assert.equal(isArchiveDialogue({is_system:true,is_user:true,extra:{bbs_hidden:true}}),false);
});
