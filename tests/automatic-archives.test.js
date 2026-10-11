import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { archiveSources, applyArchiveChanges } from '../src/archive-review.js';
import { normalizeArchiveRange, archiveRangeBounds } from '../src/archive-scope.js';
import { validateState, clone, chatHashes, hash, stable } from '../src/core.js';
const wait=()=>new Promise(r=>setTimeout(r,500));
function response(f,changes=true){return JSON.stringify({changes:changes?[{type:'skill',name:'拂风绵掌',status:'active',fields:{level:'已掌握'},sourceIndex:0,quote:'你已掌握拂风绵掌',ruleQuote:f.power.rules.slice(0,20)}]:[]});}
test('manual rescan rereads reviewed floors without erasing incremental cursors',async()=>{
 const f=fixture(),sources=archiveSources(f.ctx.chat,f.state,f.power);applyArchiveChanges(f.power,[],sources,new Map(),f.ctx.chat);
 strict.equal(archiveSources(f.ctx.chat,f.state,f.power).length,0);strict.equal(archiveSources(f.ctx.chat,f.state,f.power,{rescan:true}).length,1);
 let prompt;f.app.settings.mode='st';f.app.model.request=async p=>{prompt=JSON.parse(p.user);return response(f,false);};f.app.ui.showArchiveReview=()=>{};
 await f.store.transact(next=>{next.powers[f.power.id].archiveReviewed=clone(f.power.archiveReviewed);});await f.app.action('review-archives',{});strict.equal(prompt.sources.length,1);strict.ok(f.app.pendingArchiveReview);
});
test('custom inclusive floor range excludes user/system and does not silently truncate manual ranges',()=>{
 const f=fixture(),chat=Array.from({length:8},(_,i)=>({is_user:i%2===1,mes:`第${i+1}层测试角色正文。`}));
 f.power.archiveReadRange={mode:'range',from:3,to:7,recent:24};strict.deepEqual(archiveSources(chat,f.state,f.power,{rescan:true}).map(s=>s.index),[2,4,6]);
 f.power.archiveReadRange.to=null;strict.equal(archiveRangeBounds(f.power,10).to,10);
 f.power.archiveReadRange={mode:'recent',recent:3,from:1,to:null};strict.deepEqual(archiveSources(chat,f.state,f.power,{rescan:true}).map(s=>s.index),[6]);
 f.power.archiveReadRange.recent=100;strict.throws(()=>archiveSources(Array.from({length:90},()=>({mes:'已经完成了具体事项。'})),f.state,f.power,{rescan:true}),/80条/);
 strict.throws(()=>normalizeArchiveRange({mode:'range',from:7,to:3}),/结束不能早于开始/);
});
test('configured range persists chat locally and validates imported settings',async()=>{
 const f=fixture();f.app.ui.showArchiveRange=()=>{};f.app.openArchiveRange();await f.app.saveArchiveRange({values:{mode:'range',from:'1',to:'',recent:'6'}});
 strict.deepEqual(f.store.read().powers[f.power.id].archiveReadRange,{mode:'range',from:1,to:null,recent:24});validateState(clone(f.store.read()));
 const bad=clone(f.store.read());bad.powers[f.power.id].archiveReadRange.to=0;strict.throws(()=>validateState(bad));
});
test('busy automatic task is retained, duplicate events coalesce and quiet creates no task',async()=>{
 const f=fixture();f.app.settings.mode='st';await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});let calls=0;f.app.reviewArchives=async()=>{calls++;};
 f.app.schedulePlayerReview('quiet');strict.equal(f.app.playerAutoQueued,undefined);f.app.busy=true;f.app.schedulePlayerReview('normal');f.app.schedulePlayerReview('normal');await wait();strict.equal(calls,0);strict.ok(f.app.playerAutoQueued);
 f.app.busy=false;f.app.refresh();await wait();strict.equal(calls,1);f.app.schedulePlayerReview('normal');await wait();strict.equal(calls,1);
});
test('explicit automatic save persists validated changes and advances sources without confirmation',async()=>{
 const f=fixture();f.app.settings.mode='st';f.app.model.request=async()=>response(f);await f.app.togglePlayerAutoSave();strict.equal(f.store.read().powers[f.power.id].autoArchiveSave,true);
 f.app.schedulePlayerReview('normal');await wait();const p=f.store.read().powers[f.power.id];strict.equal(Object.values(p.archives).length,1);strict.equal(p.archiveReviewed.length,1);strict.equal(f.app.pendingArchiveReview,null);strict.equal(f.replacementCount,0);
});
test('existing review-only mode never silently becomes automatic save',async()=>{
 const f=fixture();f.app.settings.mode='st';f.app.model.request=async()=>response(f);await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});f.app.schedulePlayerReview('normal');await wait();strict.ok(f.app.pendingArchiveReview);strict.equal(Object.keys(f.store.read().powers[f.power.id].archives).length,0);
});
test('automatic parse failures do not advance sources or loop API calls and manual can retry',async()=>{
 const f=fixture();f.app.settings.mode='st';let calls=0;f.app.model.request=async()=>{calls++;return 'not JSON';};await f.app.togglePlayerAutoSave();f.app.schedulePlayerReview('normal');await wait();strict.equal(f.store.read().powers[f.power.id].archiveReviewed.length,0);f.app.schedulePlayerReview('normal');await wait();strict.equal(calls,1);
 f.app.ui.showArchiveReview=()=>{};f.app.model.request=async()=>{calls++;return response(f);};await f.app.action('review-archives',{});strict.equal(calls,2);strict.ok(f.app.pendingArchiveReview);
});
test('queued task is discarded on chat switch; invalid automatic save setting rejects',async()=>{
 const f=fixture();f.app.settings.mode='st';await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});let calls=0;f.app.reviewArchives=async()=>calls++;
 f.app.schedulePlayerReview('normal');f.ctx.chatId='another';await wait();strict.equal(calls,0);
 const bad=clone(f.state);bad.powers[f.power.id].autoArchiveSave='yes';strict.throws(()=>validateState(bad),/自动保存设置/);
});
test('local persistence failure cannot install automatic archive progress',async()=>{
 const f=fixture();f.app.settings.mode='st';f.app.model.request=async()=>response(f);await f.app.togglePlayerAutoSave();f.store.storageImpl.setItem=()=>{throw Error('quota');};
 await strict.rejects(()=>f.app.reviewArchives({silent:true,autoSave:true}),/本机备份写入失败/);strict.equal(Object.keys(f.store.read().powers[f.power.id].archives).length,0);strict.equal(f.store.read().powers[f.power.id].archiveReviewed.length,0);
});
test('queued latest generation survives an in-flight older analysis',async()=>{
 const f=fixture();f.app.settings.mode='st';await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});let release,calls=0;
 f.app.reviewArchives=async()=>{calls++;if(calls===1)await new Promise(r=>release=r);};f.app.schedulePlayerReview('normal');await wait();strict.equal(calls,1);
 f.ctx.chat.push({is_user:false,mes:'新的角色正文已经完成。'});f.app.schedulePlayerReview('normal');strict.ok(f.app.playerAutoQueued);release();await wait();strict.equal(calls,2);
});
