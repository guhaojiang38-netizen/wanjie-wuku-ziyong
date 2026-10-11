import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { fixture } from './mvu-fixture.js';
import { MODULE_ID } from '../src/core.js';

test('destroy removes only owned listeners, aborts work, is idempotent and preserves stored facts', async () => {
 const f=fixture(), source=new EventEmitter(); f.ctx.eventSource=source;
 f.ctx.eventTypes={CHAT_CHANGED:'chat',MESSAGE_RECEIVED:'message'};
 const foreign=()=>{}; source.on('chat',foreign); f.app.attachChatHooks(); f.app.attachChatHooks();
 assert.equal(source.listenerCount('chat'),2,'reattaching does not duplicate listeners');
 f.app.attachRoleHooks(); assert.equal(source.listenerCount(f.engine.events.VARIABLE_UPDATE_ENDED),1);
 let cleanup=0,disposed=0,refreshes=0; f.app.bridge.cleanup=()=>cleanup++;
 f.app.ui.destroy=()=>disposed++;
 const listener=()=>refreshes++;f.app.storeListener=listener;f.store.listeners.add(listener);f.store.listeners.add(foreign);
 const before=JSON.stringify(f.store.read()),controller=new AbortController();f.app.controller=controller;
 globalThis[`${MODULE_ID}_instance`]=f.app;
 f.app.destroy();f.app.destroy();
 assert.equal(controller.signal.aborted,true); assert.equal(cleanup,1);assert.equal(disposed,1);
 assert.equal(source.listenerCount('chat'),1);assert.equal(source.listeners('chat')[0],foreign);
 assert.equal(source.listenerCount('message'),0);assert.equal(source.listenerCount(f.engine.events.VARIABLE_UPDATE_ENDED),0);
 assert.equal(f.store.listeners.has(listener),false);assert.equal(f.store.listeners.has(foreign),true);
 assert.equal(globalThis[`${MODULE_ID}_instance`],undefined);
 f.app.scheduleRoleRead();f.app.scheduleSync();f.app.refresh();await f.app.action('refresh',{});
 assert.equal(f.app.roleTimer,null);assert.equal(f.app.syncTimer,null);assert.equal(refreshes,0);
 assert.equal(JSON.stringify(f.store.read()),before);
 await assert.rejects(f.app.query({},f.app.contextSnapshot()),/实例已释放/);
});

test('late transport response after destruction is rejected and cannot create a preview', async () => {
 const f=fixture(); f.app.settings.mode='st';let resolve;
 f.app.model.request=()=>new Promise(r=>resolve=r);
 const work=f.app.query({},f.app.contextSnapshot());const rejected=assert.rejects(work,{name:'AbortError'});
 f.app.destroy();resolve(JSON.stringify({changes:[]}));await rejected;
 assert.equal(f.app.pendingArchiveReview,null);assert.equal(f.app.controller,null);
});

test('destroy cannot clear another instance global ownership',()=>{
 const f=fixture(),newer={};globalThis[`${MODULE_ID}_instance`]=newer;
 f.app.destroy();assert.equal(globalThis[`${MODULE_ID}_instance`],newer);delete globalThis[`${MODULE_ID}_instance`];
});
