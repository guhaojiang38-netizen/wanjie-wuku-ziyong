import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './mvu-fixture.js';
import {taskConnection,normalizeTaskRoutes} from '../src/task-routing.js';
import {getSettings,getApiKey,saveSettings,saveConnectionProfile,saveTaskRoutes,resolveTaskConnection,deleteConnectionProfile,getConnectionProfiles,accountSecrets,DEFAULT_SETTINGS} from '../src/host.js';
import {ModelConnection} from '../src/model.js';
const conn=model=>({...DEFAULT_SETTINGS,mode:'custom',baseUrl:'https://example.test/v1',model});
test('all tasks default to current connection; explicit routes do not mutate it',()=>{
 const settings=conn('default'),p={...conn('record-model'),id:'a',name:'整理',apiKey:'record-key'};
 assert.equal(taskConnection('archive',settings,'current-key',[p]).settings.model,'default');
 settings.taskRoutes={archive:'a'};const r=taskConnection('archive',settings,'current-key',[p]);assert.equal(r.apiKey,'record-key');assert.equal(r.settings.model,'record-model');assert.equal(settings.model,'default');
 assert.equal(taskConnection('creation',settings,'current-key',[p]).apiKey,'current-key');
 assert.throws(()=>taskConnection('archive',{...settings,mode:'off'},'current-key',[p]),/关闭/);
});
test('invalid and disabled assignments fail explicitly; missing routes never choose another billed model',()=>{
 assert.throws(()=>normalizeTaskRoutes({bad:'a'},[]));assert.throws(()=>normalizeTaskRoutes({setup:'gone'},[]));
 assert.throws(()=>taskConnection('setup',{...conn('a'),taskRoutes:{setup:'gone'}},'',[]),/不存在/);
 assert.throws(()=>normalizeTaskRoutes({archive:'x'},[{id:'x',mode:'off'}]));
});
test('task routes persist across chats, keep keys private, survive stale settings and clean deleted references',async()=>{
 const f=fixture();globalThis.localStorage=f.storage;
 const a=saveConnectionProfile({name:'日常',settings:conn('a'),apiKey:'key-a'},f.ctx),b=saveConnectionProfile({name:'拟定',settings:conn('b'),apiKey:'key-b'},f.ctx);
 const stale=getSettings(f.ctx);saveTaskRoutes({archive:a,creation:b},f.ctx);f.ctx.chatId='another';
 assert.equal(resolveTaskConnection('archive',f.ctx).apiKey,'key-a');assert.equal(resolveTaskConnection('creation',f.ctx).apiKey,'key-b');assert.equal(getApiKey(f.ctx),'key-b');
 await saveSettings({...stale,theme:'night'},f.ctx);assert.equal(getSettings(f.ctx).taskRoutes.archive,a);
 assert(!JSON.stringify(getSettings(f.ctx)).includes('key-'));assert(!JSON.stringify(getConnectionProfiles(f.ctx)).includes('key-'));assert(accountSecrets(f.ctx).includes('key-a'));
 deleteConnectionProfile(a,f.ctx);assert.equal(getSettings(f.ctx).taskRoutes.archive,'');assert.equal(resolveTaskConnection('archive',f.ctx).settings.model,'b');
 assert(!JSON.stringify(f.store.read()).includes('taskRoutes'));assert(!JSON.stringify(f.store.read()).includes('key-a'));
});
test('per-request transport uses routed endpoint, key and model without changing shared connection',async()=>{
 const requests=[],base=conn('default'),model=new ModelConnection({context:()=>({}),settings:()=>base,getKey:()=>'default-key',fetchImpl:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>({choices:[{message:{content:'{}'}}]})};}});
 await model.request({system:'s',user:'{}'},{connection:{settings:{...conn('special'),baseUrl:'https://special.test/v1'},apiKey:'special-key'}});
 await model.request({system:'s',user:'{}'});
 assert.match(requests[0].url,/special/);assert.equal(requests[0].options.headers.Authorization,'Bearer special-key');assert.equal(JSON.parse(requests[0].options.body).model,'special');
 assert.equal(requests[1].options.headers.Authorization,'Bearer default-key');assert.equal(JSON.parse(requests[1].options.body).model,'default');
});
test('route resolution failure leaves app idle and never calls transport',async()=>{
 const f=fixture();f.app.settings={...conn('a'),taskRoutes:{archive:'missing'}};let calls=0;f.app.model.request=async()=>{calls++;return '{}';};
 await assert.rejects(f.app.query({system:'s',user:'{}'},f.app.contextSnapshot(),{task:'archive'}),/不存在/);assert.equal(f.app.busy,false);assert.equal(calls,0);
});
