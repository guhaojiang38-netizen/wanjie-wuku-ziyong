import test from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID } from '../src/core.js';
import { getSettings, saveSettings, getApiKey, getConnectionProfiles, saveConnectionProfile, applyConnectionProfile, deleteConnectionProfile, DEFAULT_SETTINGS } from '../src/host.js';
import { connectionValues, connectionKey, themeId } from '../src/preferences.js';

function fixture() {
  const values = new Map();
  globalThis.localStorage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) };
  return { userHandle: 'preferences-test', extensionSettings: { [MODULE_ID]: { ...DEFAULT_SETTINGS, catalog: [{ id: 'keep-book' }], apiKey: 'legacy-secret', adapterLibrary: { revision: 4, configs: [] } } }, saveSettingsDebounced() {} };
}
const connection = (model, url = 'https://models.example.test/v1') => ({ ...DEFAULT_SETTINGS, mode: 'custom', baseUrl: url, model });

test('existing single connection and credential survive without requiring a scheme', async () => {
  const ctx = fixture();
  assert.equal(getApiKey(ctx), 'legacy-secret');
  assert.equal(getSettings(ctx).theme, 'follow');
  assert.deepEqual(getConnectionProfiles(ctx), []);
  await saveSettings({ ...getSettings(ctx), theme: 'green' }, ctx);
  assert.equal(getApiKey(ctx), 'legacy-secret');
  assert.equal(getSettings(ctx).theme, 'green');
});
test('two schemes restore independent addresses, models, credentials and parameters across chats', () => {
  const ctx = fixture();
  const a = saveConnectionProfile({ name: '日常整理', settings: { ...connection('a'), temperature: .2 }, apiKey: 'key-a' }, ctx);
  const b = saveConnectionProfile({ name: '深度推演', settings: connection('b', 'https://other.example.test/v1'), apiKey: 'key-b' }, ctx);
  ctx.chatId = 'another-chat';
  applyConnectionProfile(a, ctx);
  assert.equal(getApiKey(ctx), 'key-a'); assert.equal(getSettings(ctx).model, 'a'); assert.equal(getSettings(ctx).temperature, .2);
  applyConnectionProfile(b, ctx);
  assert.equal(getApiKey(ctx), 'key-b'); assert.match(getSettings(ctx).baseUrl, /other/);
  assert.equal(getSettings(ctx).catalog[0].id, 'keep-book');
  assert.equal(ctx.extensionSettings[MODULE_ID].adapterLibrary.revision, 4);
  assert.ok(!JSON.stringify(getSettings(ctx)).includes('key-'));
  assert.ok(!JSON.stringify(getConnectionProfiles(ctx)).includes('key-'));
});
test('stale ordinary settings cannot overwrite saved profiles or their keys', async () => {
  const ctx = fixture(), stale = getSettings(ctx);
  const id = saveConnectionProfile({ name: '方案A', settings: connection('a'), apiKey: 'secret-a' }, ctx);
  await saveSettings({ ...stale, theme: 'parchment' }, ctx);
  applyConnectionProfile(id, ctx); assert.equal(getApiKey(ctx), 'secret-a'); assert.equal(getSettings(ctx).theme, 'parchment');
});
test('update does not duplicate; duplicate names and invalid updates leave storage intact', () => {
  const ctx = fixture(), id = saveConnectionProfile({ name: '方案', settings: connection('a'), apiKey: 'key-a' }, ctx);
  saveConnectionProfile({ id, name: '重命名', settings: connection('b'), apiKey: 'key-b' }, ctx);
  assert.equal(getConnectionProfiles(ctx).length, 1); assert.equal(getApiKey(ctx), 'key-b');
  assert.throws(() => saveConnectionProfile({ name: '重命名', settings: connection('c'), apiKey: 'key-c' }, ctx), /同名/);
  assert.throws(() => saveConnectionProfile({ id, name: '方案', settings: { ...connection('a'), maxTokens: NaN }, apiKey: 'bad' }, ctx), /范围/);
  assert.equal(getApiKey(ctx), 'key-b');
});
test('delete shortcut keeps running connection and accounts remain isolated', () => {
  const ctx = fixture(), id = saveConnectionProfile({ name: '方案', settings: connection('a'), apiKey: 'key-a' }, ctx);
  deleteConnectionProfile(id, ctx); assert.equal(getApiKey(ctx), 'key-a'); assert.equal(getSettings(ctx).activeConnectionProfile, '');
  assert.deepEqual(getConnectionProfiles(ctx), []);
  const other = { ...ctx, userHandle: 'another-user', extensionSettings: {} };
  assert.deepEqual(getConnectionProfiles(other), []); assert.equal(getApiKey(other), '');
});
test('new draft cannot silently reuse another endpoint key; explicit clear and invalid themes', () => {
  assert.equal(connectionKey({ profileKeyPolicy: 'new' }, 'old-key'), '');
  assert.equal(connectionKey({ apiKey: 'new-key', profileKeyPolicy: 'new' }, 'old-key'), 'new-key');
  assert.equal(connectionKey({ clearKey: true }, 'old-key'), '');
  assert.equal(themeId('__proto__'), 'follow');
  assert.throws(() => connectionValues({ ...connection('a'), baseUrl: 'javascript:alert(1)' }), /地址/);
});
test('local unauthenticated API scheme keeps an empty key instead of borrowing the old credential', () => {
  const ctx = fixture();
  saveConnectionProfile({ name: '本地模型', settings: connection('local', 'http://127.0.0.1:11434/v1'), apiKey: '' }, ctx);
  assert.equal(getApiKey(ctx), '');
  assert.equal(getConnectionProfiles(ctx)[0].keyPresent, false);
  assert.equal(getSettings(ctx).model, 'local');
});
