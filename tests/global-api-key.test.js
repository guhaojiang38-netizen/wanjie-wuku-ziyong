import test from 'node:test';
import strict from 'node:assert/strict';
import { getSettings, getApiKey, saveSettings, DEFAULT_SETTINGS } from '../src/host.js';
import { MODULE_ID } from '../src/core.js';
import { WukuApp } from '../index.js';
function fixture(t, { denyLocal = false } = {}) {
  const memory = new Map(); let saves = 0;
  const oldStorage = globalThis.localStorage, oldST = globalThis.SillyTavern;
  globalThis.localStorage = { getItem: k => memory.get(k), setItem: (k,v) => { if (denyLocal) throw Error('denied'); memory.set(k,v); } };
  const ctx = { userHandle: 'key-test', chatId: 'one', chatMetadata: {}, extensionSettings: {}, saveSettingsDebounced: () => saves++ };
  globalThis.SillyTavern = { getContext: () => ctx };
  t.after(() => { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; if (oldST === undefined) delete globalThis.SillyTavern; else globalThis.SillyTavern = oldST; });
  return { ctx, memory, saves: () => saves };
}
test('global connection survives a new chat and recreated app without entering chat metadata', async t => {
  const f = fixture(t); await saveSettings({ ...DEFAULT_SETTINGS, mode:'custom', baseUrl:'https://example.test/v1', model:'test-model' }, f.ctx, 'fixture-secret');
  f.ctx.chatId = 'new-chat'; f.ctx.chatMetadata = {};
  const app = new WukuApp(); strict.equal(app.apiKey, 'fixture-secret'); strict.equal(app.settings.model, 'test-model'); strict.equal(app.settings.mode, 'custom'); strict.equal('apiKey' in app.settings, false); strict.deepEqual(f.ctx.chatMetadata, {}); strict.equal(f.saves(), 1);
  f.ctx.extensionSettings = {}; strict.equal(new WukuApp().apiKey, 'fixture-secret');
});
test('ordinary settings saves retain key, explicit clear removes it from both global stores', async t => {
  const f = fixture(t); await saveSettings(DEFAULT_SETTINGS, f.ctx, 'fixture-secret'); await saveSettings({ ...getSettings(f.ctx), position: { x:2,y:3 } }, f.ctx);
  strict.equal(getApiKey(f.ctx), 'fixture-secret'); await saveSettings(getSettings(f.ctx), f.ctx, ''); strict.equal(getApiKey(f.ctx), ''); strict.equal(f.ctx.extensionSettings[MODULE_ID].apiKey, ''); strict.ok([...f.memory.values()].every(v => !v.includes('fixture-secret')));
});
test('host settings retain credentials when browser local storage is denied', async t => {
  const f = fixture(t, { denyLocal:true }); await saveSettings(DEFAULT_SETTINGS, f.ctx, 'fixture-secret'); strict.equal(new WukuApp().apiKey, 'fixture-secret'); strict.equal(f.saves(), 1);
});
test('browser checkpoints are isolated by account', async t => {
  const f = fixture(t); await saveSettings(DEFAULT_SETTINGS, f.ctx, 'account-one-secret'); f.ctx.userHandle = 'account-two'; f.ctx.extensionSettings = {}; strict.equal(getApiKey(f.ctx), ''); await saveSettings(DEFAULT_SETTINGS, f.ctx, 'account-two-secret'); f.ctx.userHandle = 'key-test'; f.ctx.extensionSettings = {}; strict.equal(getApiKey(f.ctx), 'account-one-secret');
});
test('settings form saves, blank retains, and clear overrides replacement', async t => {
  fixture(t); const app = new WukuApp(); app.ui = { closeDialog() {} }; app.refresh = () => {}; app.notice = () => {}; app.cancel = () => {};
  const values = { ...DEFAULT_SETTINGS, mode:'custom', baseUrl:'https://example.test/v1', model:'test-model', apiKey:'fixture-secret' };
  await app.action('save-settings', { values }); strict.equal(new WukuApp().apiKey,'fixture-secret');
  await app.action('save-settings', { values: { ...values, apiKey:'' } }); strict.equal(new WukuApp().apiKey,'fixture-secret');
  await app.action('save-settings', { values: { ...values, apiKey:'ignored', clearKey:true } }); strict.equal(new WukuApp().apiKey,'');
});
