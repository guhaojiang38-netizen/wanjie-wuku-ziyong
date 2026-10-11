import test from 'node:test';
import strict from 'node:assert/strict';
import { ModelConnection, endpoints, modelEndpoints, normalizeModelList, chooseListedModel } from '../src/model.js';

const prompt = { system: '格式', user: '事实' };
const settings = { mode: 'custom', baseUrl: 'https://example.test', model: 'model', timeoutSeconds: 10 };
test('endpoint paths preserve a supplied v1 or complete endpoint', () => { strict.deepEqual(endpoints('https://example.test/v1/'), ['https://example.test/v1/chat/completions']); strict.equal(endpoints('https://example.test/chat/completions').length, 1); strict.equal(endpoints('https://example.test').length, 2); strict.throws(() => endpoints('javascript:alert(1)')); strict.throws(() => endpoints('https://secret@example.test')); });
test('only a route mismatch permits the v1 fallback; no auth/rate/server retries', async () => {
  for (const status of [401, 429, 500, 404]) { const calls = []; const model = new ModelConnection({ context: () => null, settings: () => settings, getKey: () => 'session-key', fetchImpl: async (url, request) => { calls.push({ url, request }); return calls.length === 1 ? { ok: false, status } : { ok: true, json: async () => ({ choices: [{ message: { content: '{"operations":[]}' } }] }) }; } });
    if (status === 404) strict.equal(await model.request(prompt), '{"operations":[]}'); else await strict.rejects(model.request(prompt));
    strict.equal(calls.length, status === 404 ? 2 : 1); strict.equal(calls[0].request.headers.Authorization, 'Bearer session-key'); strict.equal(JSON.parse(calls[0].request.body).messages.length, 2);
  }
});
test('disabled connection sends no network requests', async () => { let count = 0; const model = new ModelConnection({ settings: () => ({ mode: 'off' }), getKey: () => '', fetchImpl: async () => { count++; } }); await strict.rejects(model.request(prompt)); strict.equal(count, 0); });
test('cancelled shared ST call ignores its late result and does not stop main generation', async () => {
  let resolveRaw, params; const model = new ModelConnection({ context: () => ({ generateRaw: p => { params = p; return new Promise(resolve => { resolveRaw = resolve; }); } }), settings: () => ({ mode: 'st', timeoutSeconds: 10 }), getKey: () => '' }); const controller = new AbortController(); const pending = model.request(prompt, { signal: controller.signal }); await new Promise(resolve => setTimeout(resolve, 0)); controller.abort(); await strict.rejects(pending, /取消/); strict.equal(model.rawPending, true); strict.equal('responseLength' in params, false); resolveRaw('late'); await new Promise(resolve => setTimeout(resolve, 0)); strict.equal(model.rawPending, false);
});
test('independent abort is propagated to the HTTP request', async () => { const controller = new AbortController(); controller.abort(); const model = new ModelConnection({ settings: () => settings, getKey: () => '', fetchImpl: async (_url, req) => { strict.equal(req.signal.aborted, true); throw new DOMException('aborted', 'AbortError'); } }); await strict.rejects(model.request(prompt, { signal: controller.signal }), /取消/); });
test('model list supports base, v1 and complete generation addresses', () => { strict.deepEqual(modelEndpoints('https://example.test'), ['https://example.test/models', 'https://example.test/v1/models']); strict.deepEqual(modelEndpoints('https://example.test/v1/chat/completions'), ['https://example.test/v1/models']); strict.deepEqual(modelEndpoints('https://example.test/v1/models'), ['https://example.test/v1/models']); });
test('model list normalizes, sorts and deduplicates common compatible provider responses', () => { strict.deepEqual(normalizeModelList({ data: [{ id: 'model10' }, { id: 'model2' }, { id: 'model2' }, {}] }), ['model2', 'model10']); strict.deepEqual(normalizeModelList({ models: ['a', { name: 'b' }] }), ['a', 'b']); strict.throws(() => normalizeModelList({ data: [] })); strict.throws(() => normalizeModelList({ error: 'unauthorized' })); });
test('first selection skips obvious non-chat models while refresh preserves the player selection', () => { strict.equal(chooseListedModel(['a-embedding', 'chat-a', 'chat-b']), 'chat-a'); strict.equal(chooseListedModel(['chat-a'], 'my-custom-model'), 'my-custom-model'); strict.equal(chooseListedModel(['text-embedding', 'whisper']), ''); });
test('fetching models uses the draft key and GET without requiring a selected generation model', async () => {
  const calls = []; const model = new ModelConnection({ settings: () => ({ mode: 'off', model: '' }), getKey: () => 'old-key', fetchImpl: async (url, req) => { calls.push({ url, req }); return { ok: true, json: async () => ({ data: [{ id: 'chat-model' }] }) }; } });
  strict.deepEqual(await model.listModels({ baseUrl: 'https://example.test/v1', apiKey: 'draft-key' }), ['chat-model']); strict.equal(calls[0].req.method, 'GET'); strict.equal(calls[0].req.headers.Authorization, 'Bearer draft-key'); strict.equal('body' in calls[0].req, false);
});
test('models path fallback only applies to 404/405 and failures never leak the API key', async () => {
  for (const status of [401,403,429,500,404]) { let calls = 0; const model = new ModelConnection({ getKey: () => 'session-secret', fetchImpl: async () => { calls++; return calls === 1 ? { ok: false, status } : { ok: true, json: async () => ({ data: [{ id: 'chat' }] }) }; } });
    if (status === 404) await model.listModels({ baseUrl: 'https://example.test' }); else await strict.rejects(model.listModels({ baseUrl: 'https://example.test' }), error => !error.message.includes('session-secret'));
    strict.equal(calls, status === 404 ? 2 : 1);
  }
});
test('aborting model discovery cancels HTTP without creating a generation call', async () => { const controller = new AbortController(); controller.abort(); const model = new ModelConnection({ getKey: () => '', fetchImpl: async (_url, req) => { strict.equal(req.signal.aborted, true); throw new DOMException('aborted','AbortError'); } }); await strict.rejects(model.listModels({ baseUrl: 'https://example.test' }, { signal: controller.signal }), /取消/); });
