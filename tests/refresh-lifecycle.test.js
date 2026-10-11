import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './mvu-fixture.js';

test('refresh reuses its snapshot while direct diagnostic reads remain fresh', () => {
  const f = fixture(), read = f.store.read.bind(f.store);
  const snapshot = f.app.contextSnapshot();
  f.app.memoryDiagnostic = { chatKey: snapshot.chatKey, stateId: snapshot.state.id, outcome: 'ended' };
  let reads = 0; f.store.read = (...args) => { reads++; return read(...args); };
  f.app.refresh();
  assert.equal(reads, 1); assert.equal(f.app.ui.view.memoryDiagnostic, f.app.memoryDiagnostic);
  f.ctx.chatId = 'another-chat';
  assert.equal(f.app.memoryDiagnostics(), null); assert.equal(reads, 2);
});

test('both chat event and discovered switch cancel queued tasks without changing stored facts', async () => {
  for (const event of [true, false]) {
    const f = fixture(), before = JSON.stringify(f.store.read()), handlers = new Map();
    f.ctx.eventSource = { on: (name, fn) => handlers.set(name, fn) };
    f.ctx.eventTypes = { CHAT_CHANGED: 'chat-changed' }; f.app.attachChatHooks();
    let calls = 0; const controller = new AbortController(); f.app.controller = controller; f.app.busy = true;
    for (const name of ['syncTimer', 'roleTimer', 'playerReviewTimer']) f.app[name] = setTimeout(() => calls++, 20);
    const job = { cancelled: false }; f.app.archiveReviewJob = job;
    Object.assign(f.app, { mainBusy: true, roleReadPending: true, playerAutoQueued: {}, creationDraft: {}, terminalRequest: {}, memoryAttempt: {}, narrativeAttempt: {}, archiveAutoStatus: { old: '????' } });
    f.app.prepareResources = async () => {}; f.app.scheduleRoleRead = () => {};
    if (event) handlers.get('chat-changed')();
    else { f.ctx.chatId = 'new-chat'; f.app.refresh(); }
    await new Promise(resolve => setTimeout(resolve, 45));
    assert.equal(calls, 0); assert.equal(controller.signal.aborted, true); assert.equal(job.cancelled, true);
    for (const name of ['syncTimer', 'roleTimer', 'playerReviewTimer', 'playerAutoQueued', 'creationDraft', 'terminalRequest', 'memoryAttempt', 'narrativeAttempt']) assert.equal(f.app[name], null, name);
    assert.equal(f.app.mainBusy, false); assert.equal(f.app.roleReadPending, false); assert.deepEqual(f.app.archiveAutoStatus, {});
    f.ctx.chatId = 'mvu-fixture'; assert.equal(JSON.stringify(f.store.read()), before);
  }
});
