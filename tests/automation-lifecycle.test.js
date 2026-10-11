import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';
import { createPower } from '../src/core.js';
import { MMLC_ENTRY } from '../src/mmlc.js';
import { AIActivity } from '../src/ai-activity.js';
const wait = (ms=510) => new Promise(r=>setTimeout(r,ms));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function setup(){const f=fixture();f.app.settings.mode='st';f.app.ui.showArchiveReview=()=>{};return f;}
const answer=()=>JSON.stringify({changes:[]});

test('cancelled old request cannot clear a newer request or report old validation phase',async()=>{
 const f=setup(),old=deferred(),fresh=deferred();let calls=0;const phases=[];
 f.app.aiActivity={phase:p=>phases.push(p),cancel(){}};
 f.app.model.request=()=>++calls===1?old.promise:fresh.promise;
 const first=f.app.query({},f.app.contextSnapshot());const rejected=assert.rejects(first,{name:'AbortError'});
 f.app.cancel();const second=f.app.query({},f.app.contextSnapshot());const controller=f.app.controller;
 old.resolve(answer());await rejected;assert.equal(f.app.controller,controller);assert.equal(f.app.busy,true);assert.equal(phases.filter(p=>p==='整理与校验结果').length,0);
 fresh.resolve(answer());await second;assert.equal(f.app.busy,false);assert.equal(f.app.controller,null);
});

test('cancel before queued review starts performs no API call',async()=>{
 const f=setup();let calls=0;f.app.model.request=async()=>{calls++;return answer();};
 const work=f.app.reviewArchives();const rejected=assert.rejects(work,{name:'AbortError'});f.app.cancel();await rejected;
 assert.equal(calls,0);assert.equal(f.app.pendingArchiveReview,null);assert.equal(f.app.archiveReviewJob,null);
});

test('repeated manual review shares one request and leaves one preview',async()=>{
 const f=setup(),response=deferred();let calls=0;f.app.model.request=()=>{calls++;return response.promise;};
 const one=f.app.reviewArchives({rescan:true});const two=f.app.reviewArchives({rescan:true});await Promise.resolve();assert.equal(calls,1);
 response.resolve(answer());await Promise.all([one,two]);assert.ok(f.app.pendingArchiveReview);assert.equal(f.app.archiveReviewJob,null);
});

test('review claim spans asynchronous save and blocks other review intent',async()=>{
 const f=setup(),saving=deferred();await f.app.togglePlayerAutoSave();f.app.model.request=async()=>answer();
 f.app.commitArchiveReview=async()=>{await saving.promise;};
 const work=f.app.reviewArchives({automatic:true,autoSave:true});await wait(10);assert.equal(f.app.busy,false);assert.ok(f.app.archiveReviewJob);
 await assert.rejects(async()=>f.app.reviewArchives({rescan:true}),/已有成果整理/);
 f.app.schedulePlayerReview('normal');await wait();assert.ok(f.app.playerAutoQueued);assert.equal(f.app.playerReviewTimer,null);
 f.app.playerAutoQueued=null;saving.resolve();await work;assert.equal(f.app.archiveReviewJob,null);
});

test('automatic queue waits for MVU and resumes on existing completion event without extra requests',async()=>{
 const f=setup(),listeners=new Map();f.ctx.eventSource={on:(n,cb)=>listeners.set(n,cb),removeListener(){}};f.ctx.eventTypes={};
 let parsing=true,calls=0;f.engine.isDuringExtraAnalysis=()=>parsing;f.app.attachRoleHooks();
 await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});f.app.reviewArchives=async()=>{calls++;};
 f.app.schedulePlayerReview('normal');await wait();assert.equal(calls,0);assert.ok(f.app.playerAutoQueued);assert.equal(f.app.archiveAutoStatus[f.power.id],'等待变量更新完成');
 parsing=false;listeners.get(f.engine.events.VARIABLE_UPDATE_ENDED)();await wait();assert.equal(calls,1);clearTimeout(f.app.roleTimer);
});

test('MVU starting after timer is scheduled retains queue until ready',async()=>{
 const f=setup();let parsing=false,calls=0;f.engine.isDuringExtraAnalysis=()=>parsing;
 await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});f.app.reviewArchives=async()=>{calls++;};
 f.app.schedulePlayerReview('normal');parsing=true;await wait();assert.equal(calls,0);assert.ok(f.app.playerAutoQueued);
 parsing=false;f.app.resumePlayerReview();await wait();assert.equal(calls,1);
});

test('optional MVU absent does not block archive-only automatic work',async()=>{
 const f=setup();f.app.role.engine=()=>undefined;let calls=0;await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});f.app.reviewArchives=async()=>{calls++;};
 f.app.schedulePlayerReview('normal');await wait();assert.equal(calls,1);
});

test('old cancelled auto runner cannot unlock a new runner or contaminate new chat notice',async()=>{
 const f=setup(),old=deferred(),fresh=deferred();let calls=0;await f.store.transact(n=>{n.powers[f.power.id].autoArchiveReview=true;});
 f.app.reviewArchives=()=>++calls===1?old.promise:fresh.promise;
 f.app.schedulePlayerReview('normal');await wait();f.app.cancel();f.ctx.chatId='next-chat';f.app.refresh();f.app.lastPlayerAuto=null;
 await f.store.transact(n=>{n.powers[f.power.id]=structuredClone(f.power);n.powers[f.power.id].autoArchiveReview=true;});f.app.refresh();f.app.schedulePlayerReview('normal');await wait();assert.equal(calls,2);const running=f.app.playerAutoRunning;
 f.app.ui.notice=null;old.reject(new Error('old API failed'));await wait(10);assert.equal(f.app.playerAutoRunning,running);assert.equal(f.app.ui.notice,null);
 fresh.resolve();await wait(10);assert.equal(f.app.playerAutoRunning,null);
});

test('cancelled activity cannot overwrite new task display during late cleanup',async()=>{
 const seen=[],old=deferred(),fresh=deferred();const activity=new AIActivity(s=>seen.push(s));
 const first=activity.run('old',()=>old.promise);activity.cancel();assert.equal(seen.at(-1).status,'cancelled');
 const second=activity.run('fresh',()=>fresh.promise);old.resolve();await first;assert.equal(activity.current.label,'fresh');assert.equal(seen.at(-1).label,'fresh');assert.equal(seen.at(-1).status,'running');
 fresh.resolve();await second;assert.equal(seen.at(-1).status,'success');
});


test('cancelled response cannot create preview even when transport resolved before cancellation',async()=>{
 const f=setup(),response=deferred();f.app.model.request=()=>response.promise;
 const work=f.app.reviewArchives();const rejected=assert.rejects(work,{name:'AbortError'});await Promise.resolve();
 response.resolve(answer());f.app.cancel();await rejected;assert.equal(f.app.pendingArchiveReview,null);assert.equal(Object.keys(f.store.read().powers[f.power.id].archives).length,0);
});

test('archive-only manual review does not change MVU data or write count',async()=>{
 const f=setup();const before=JSON.stringify(f.getRaw());f.app.model.request=async()=>answer();await f.app.reviewArchives();
 assert.equal(JSON.stringify(f.getRaw()),before);assert.equal(f.replacementCount,0);
});


test('MVU starting between backlog batches pauses remaining work and resumes without duplicate saved floors',async()=>{
 const f=setup();let parsing=false,calls=0;f.engine.isDuringExtraAnalysis=()=>parsing;
 for(let i=0;i<13;i++)f.ctx.chat.push({is_user:false,mes:'新增角色正文，记录当前经历。'});
 await f.store.transact(n=>{const p=n.powers[f.power.id];p.autoArchiveReview=true;p.autoArchiveSave=true;p.autoArchiveStart=0;p.archiveAuto={every:12,context:0};});
 f.app.model.request=async()=>{calls++;if(calls===1)parsing=true;return answer();};
 f.app.schedulePlayerReview('normal');await wait();assert.equal(calls,1);assert.equal(f.store.read().powers[f.power.id].archiveReviewed.length,12);assert.ok(f.app.playerAutoQueued);
 parsing=false;f.app.resumePlayerReview();await wait();assert.equal(calls,2);assert.equal(f.store.read().powers[f.power.id].archiveReviewed.length,14);assert.equal(f.app.playerAutoQueued,null);
});


test('review freezes selected power before deferred start',async()=>{
 const f=setup();await f.store.transact(n=>{const other=createPower(MMLC_ENTRY);n.powers[other.id]=other;});
 f.app.model.request=async prompt=>{assert.equal(JSON.parse(prompt.user).rules,f.power.rules);return answer();};
 const work=f.app.reviewArchives();f.app.powerId=MMLC_ENTRY.id;await work;assert.equal(f.app.pendingArchiveReview.powerId,f.power.id);
});
