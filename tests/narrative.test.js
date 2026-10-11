import test from 'node:test';
import strict from 'node:assert/strict';
import { fixture, linkFixture } from './mvu-fixture.js';
import { installInjection } from '../src/host.js';
import { ASYNC_MARKER, clone, hash, stable, chatHashes, historyChanged, validateState, narrativeMessages } from '../src/core.js';
import { ACTION_MARKER, resultText, validateReview, favoriteIntent, normalizeCandidates, unsettledNarrative } from '../src/narrative.js';
import { ModelConnection } from '../src/model.js';

const story = '你在院中发动深蓝，温热力量涌过双掌。穿云游燕掌法在真实试演中成形，掌力贯透枝叶，轻灵腾挪已经可以稳定完成。你没有再度消耗源质，保留已有拂风绵掌，下一步由你决定。';
async function setup(t, { settle = true } = {}) {
  const f = fixture(), handlers = new Map();
  f.ctx.eventTypes = Object.fromEntries(['CHAT_CHANGED','GENERATION_STARTED','GENERATION_STOPPED','GENERATION_ENDED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SWIPED','MESSAGE_RECEIVED','CHARACTER_MESSAGE_RENDERED','CHAT_COMPLETION_PROMPT_READY','GENERATE_AFTER_COMBINE_PROMPTS'].map(n=>[n,n]));
  f.ctx.eventSource = { on(name, fn) { const a = handlers.get(name) || []; a.push(fn); handlers.set(name, a); }, removeListener(name, fn) { handlers.set(name,(handlers.get(name)||[]).filter(h=>h!==fn)); }, async emit(name,...args) { for (const h of handlers.get(name)||[]) await h(...args); } };
  f.emit = (name,...args) => f.ctx.eventSource.emit(name,...args);
  f.app.bridge = installInjection({ context:()=>f.ctx, store:f.store, extraInjection:s=>f.app.roleInjection(s)+f.app.narrativeInjection(s) });
  f.app.attachChatHooks(); f.ctx.onlineStatus = 'connected';
  t.after(()=>{clearTimeout(f.app.roleTimer);clearTimeout(f.app.syncTimer); f.app.bridge.cleanup();});
  f.calls = [];
  f.ctx.generate = async (type,options={})=>{
    f.calls.push({type,options});
    await f.emit('GENERATION_STARTED',type,options,false);
    if (f.beforePrompt) await f.beforePrompt();
    const request = {chat:f.ctx.chat.map(m=>({role:m.is_user?'user':'assistant',content:m.mes}))};
    await f.emit('CHAT_COMPLETION_PROMPT_READY',request); f.prompt = request;
    if(f.fail) throw new Error('network lost');
    if(f.stop) { await f.emit('GENERATION_STOPPED'); return; }
    const old = f.ctx.chat.at(-1), raw = clone(old.variables[old.swipe_id||0]);
    const text = f.text ?? story;
    if (type==='continue') old.mes += '\n'+text;
    else if (type==='regenerate') { f.ctx.chat.pop(); await f.emit('MESSAGE_DELETED',f.ctx.chat.length); f.ctx.chat.push({is_user:false,name:f.ctx.name2,mes:text,swipe_id:0,variables:[raw]}); }
    else if (type==='swipe') { old.swipe_id=(old.swipe_id||0)+1; old.mes=text; old.variables[old.swipe_id]=raw; }
    else f.ctx.chat.push({is_user:false,name:f.ctx.name2,mes:text,swipe_id:0,variables:[raw]});
    const index=f.ctx.chat.length-1;
    await f.emit('MESSAGE_RECEIVED',index,type);
    if(f.endBeforeRender) await f.emit('GENERATION_ENDED',f.ctx.chat.length);
    if(!f.noRender) await f.emit('CHARACTER_MESSAGE_RENDERED',index,type);
    if(!f.endBeforeRender) await f.emit('GENERATION_ENDED',f.ctx.chat.length);
    return text;
  };
  await linkFixture(f); await f.app.generate(); if(settle) await f.app.execute();
  f.action = ()=>f.store.read().narrativeActions[0];
  return f;
}
const packet = f => f.prompt.chat.map(m=>typeof m.content==='string'?m.content:'').join('\n');

test('manual fallback binds an existing reply after missed lifecycle events without model, settlement or MVU writes', async t => {
  const f = await setup(t); f.app.ui.showManualStory = () => {};
  f.ctx.chat.push({ is_user: false, mes: story, swipe_id: 0 });
  const before = clone(f.store.read()), writes = f.replacementCount;
  f.app.openManualStory(f.action().id);
  await f.app.saveManualStory({ values: { sourceIndex: 1, quote: '穿云游燕掌法在真实试演中成形' } });
  strict.equal(f.action().status, 'confirmed'); strict.equal(f.action().result.manual, true);
  strict.equal(resultText(f.ctx, f.action()), '穿云游燕掌法在真实试演中成形');
  strict.equal(f.calls.length, 0); strict.equal(f.replacementCount, writes);
  strict.deepEqual(f.store.read().transactions, before.transactions); strict.equal(f.store.read().revision, before.revision);
  f.ctx.chat[1].mes = '这次没有使用掌法'; strict.throws(() => resultText(f.ctx, f.action()), /改写/);
  f.ctx.chat[1].mes = '你使用掌法，双掌之间的力量已经清楚地呈现出来。';
  f.app.openManualStory(f.action().id);
  await f.app.saveManualStory({ values: { sourceIndex: 1, quote: '双掌之间的力量已经清楚地呈现出来' } });
  strict.equal(f.action().presentations.length, 2); strict.equal(f.store.read().revision, before.revision);
});
test('manual fallback rejects forged quotes, user floors and changed branches while pending MVU stays independent', async t => {
  const f = await setup(t); f.app.ui.showManualStory = () => {};
  f.ctx.chat.push({ is_user: false, mes: story, swipe_id: 0 });
  f.ctx.chat.push({ is_user: true, mes: '玩家输入不能冒充承接正文' });
  await f.store.transact(next => { next.roleWrites[0].status = 'pending'; }, { facts: false });
  f.app.openManualStory(f.action().id);
  await strict.rejects(f.app.saveManualStory({ values: { sourceIndex: 1, quote: '并不存在的承接证据' } }), /逐字摘录/);
  await strict.rejects(f.app.saveManualStory({ values: { sourceIndex: 2, quote: '玩家输入不能冒充承接正文' } }), /逐字摘录/);
  f.ctx.chat[1].swipe_id = 1;
  await strict.rejects(f.app.saveManualStory({ values: { sourceIndex: 1, quote: '穿云游燕掌法在真实试演中成形' } }), /正文已变化/);
  f.ctx.chat[1].swipe_id = 0; f.app.openManualStory(f.action().id);
  await f.app.saveManualStory({ values: { sourceIndex: 1, quote: '穿云游燕掌法在真实试演中成形' } });
  strict.equal(f.store.read().roleWrites[0].status, 'pending'); strict.equal(f.action().status, 'confirmed');
});
test('a refresh deferred by a busy operation runs after the operation finishes', async t => {
  const f = await setup(t); let reads = 0;
  f.app.pullRoleBalances = async () => { reads++; };
  f.app.busy = true; f.app.scheduleRoleRead();
  await new Promise(resolve => setTimeout(resolve, 260));
  strict.equal(reads, 0); strict.equal(f.app.roleReadPending, true);
  f.app.busy = false; f.app.refresh();
  await new Promise(resolve => setTimeout(resolve, 260));
  strict.equal(reads, 1); strict.equal(f.app.roleReadPending, false);
});

test('settlement durably queues intent with before/after power and exact MVU changes',async t=>{
  const f=await setup(t); const a=f.action(); strict.equal(a.status,'waiting');
  strict.equal(Object.values(a.before.resources)[0].balance,'6'); strict.equal(Object.values(a.after.resources)[0].balance,'0');
  strict.match(a.intent,/保留原有拂风绵掌/); strict.ok(a.variableChanges.some(c=>c.path==='/主角/源质点')); strict.equal(f.replacementCount,1);
  strict.equal(validateState(clone(f.store.read())).narrativeActions[0].id,a.id);
});
test('confirm and unfold invokes normal host generation and presents an action exactly once',async t=>{
  const f=await setup(t,{settle:false}); await f.app.execute({story:'now'});
  strict.equal(f.calls[0].type,'normal'); strict.equal(f.calls[0].options.skipWIAN,false); strict.equal(f.replacementCount,1);
  strict.match(packet(f),new RegExp(ACTION_MARKER)); strict.match(packet(f),/发动前的真实状态/); strict.match(packet(f),/不得重报价、再次扣款/);
  strict.equal(f.action().status,'presented'); strict.equal(resultText(f.ctx,f.action()),story);
  strict.equal(f.store.read().transactions.filter(t=>t.type==='operation').length,1);
});
test('deferred choice rides the next native main reply without an async narrative call',async t=>{
  const f=await setup(t); strict.equal(f.calls.length,0); await f.ctx.generate('normal'); strict.equal(f.action().status,'presented'); strict.match(packet(f),/穿云游燕掌法/);
});
test('normal generation ending before render still binds only after final render',async t=>{
  const f=await setup(t); f.endBeforeRender=true; await f.app.unfoldStory(); strict.equal(f.action().status,'presented');
});
test('a missing render does not turn an arbitrary API string into accepted narrative',async t=>{
  const f=await setup(t); f.noRender=true; await f.app.unfoldStory(); strict.equal(f.action().status,'waiting'); strict.equal(f.replacementCount,1);
});
test('main generation failure can retry narrative without repeating MVU or price',async t=>{
  const f=await setup(t); f.fail=true; await f.app.unfoldStory(); strict.equal(f.action().status,'waiting'); strict.equal(f.replacementCount,1);
  f.fail=false; await f.app.unfoldStory(); strict.equal(f.action().status,'presented'); strict.equal(f.replacementCount,1); strict.equal(Object.values(f.store.read().powers[f.power.id].resources)[0].balance,'0');
});
test('stopped generation remains pending even when the host later emits generation-ended',async t=>{
  const f=await setup(t);f.stop=true;await f.app.unfoldStory();await f.emit('GENERATION_ENDED');strict.equal(f.action().status,'waiting');strict.equal(f.action().result,undefined);
});
test('empty output remains pending',async t=>{const f=await setup(t);f.text='';await f.app.unfoldStory();strict.equal(f.action().status,'waiting');});
test('nonempty unrelated reply is only presented, never automatically confirmed',async t=>{
  const f=await setup(t);f.text='远处的风吹过树林，你还没有展开刚才的行动。';await f.app.unfoldStory();strict.equal(f.action().status,'presented');strict.equal(f.action().confirmedAt,undefined);
  await f.app.setStoryStatus(f.action().id,'waiting');strict.equal(f.action().status,'waiting');strict.equal(f.replacementCount,1);
});
test('quiet, dry-run and multimodal async requests do not consume an action',async t=>{
  const f=await setup(t);await f.emit('GENERATION_STARTED','quiet',{},false);
  const quiet={chat:[{role:'user',content:'背景分析'}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',quiet);strict.doesNotMatch(JSON.stringify(quiet),new RegExp(ACTION_MARKER));strict.equal(f.action().status,'waiting');
  await f.emit('GENERATION_STARTED','normal',{},true);const dry={chat:[{role:'user',content:'计数'}],dryRun:true};await f.emit('CHAT_COMPLETION_PROMPT_READY',dry);strict.equal(dry.chat.length,1);strict.equal(f.action().attempts,0);
  await f.emit('GENERATION_STARTED','normal',{},false);const asyncRequest={chat:[{role:'system',content:[{type:'text',text:ASYNC_MARKER}]}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',asyncRequest);strict.equal(asyncRequest.chat.length,1);strict.equal(f.app.narrativeAttempt.prompted,false);await f.emit('GENERATION_STOPPED');
});
test('plain completion carries the same packet; async plain prompt is excluded',async t=>{
  const f=await setup(t);await f.emit('GENERATION_STARTED','normal',{},false);const p={prompt:'角色、世界书与预设正文'};await f.emit('GENERATE_AFTER_COMBINE_PROMPTS',p);strict.match(p.prompt,new RegExp(ACTION_MARKER));
  const raw={prompt:ASYNC_MARKER};await f.emit('GENERATE_AFTER_COMBINE_PROMPTS',raw);strict.equal(raw.prompt,ASYNC_MARKER);await f.emit('GENERATION_STOPPED');
});
test('an existing composer draft is preserved and keeps the action deferred',async t=>{
  const f=await setup(t);const old=globalThis.document;globalThis.document={querySelector:()=>({value:'玩家尚未发送的草稿'})};
  try{await f.app.unfoldStory();strict.equal(f.calls.length,0);strict.equal(f.action().status,'waiting');strict.match(f.app.ui.notice.message,/草稿/);}finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
test('unconnected or old host preserves the queue with an explicit fallback',async t=>{
  const f=await setup(t);f.ctx.onlineStatus='no_connection';await strict.rejects(f.app.unfoldStory(),/尚未连接/);strict.equal(f.action().status,'waiting');
  delete f.ctx.generate;await strict.rejects(f.app.unfoldStory(),/下一条消息/);strict.equal(f.replacementCount,1);
});
test('pending MVU write prevents narrative generation until write retry succeeds',async t=>{
  const f=await setup(t,{settle:false});f.corruptReadback=true;await f.app.execute({story:'now'});strict.equal(f.calls.length,0);strict.equal(f.store.read().roleWrites[0].status,'pending');
  await strict.rejects(f.app.unfoldStory(),/写回/);f.corruptReadback=false;await f.app.finishRoleWrite(f.action().id);await f.app.unfoldStory();strict.equal(f.action().status,'presented');strict.equal(f.replacementCount,1);
});
test('regenerate and swipe reuse the same settled event and update only its narrative binding',async t=>{
  const f=await setup(t);await f.app.unfoldStory();await f.app.pullRoleBalances();await f.app.setStoryStatus(f.action().id,'confirmed');
  f.text=story+'枝叶在新的掌风里轻轻摆动。';await f.ctx.generate('regenerate');strict.equal(f.action().status,'presented');strict.match(packet(f),new RegExp(ACTION_MARKER));strict.equal(historyChanged(f.store.read(),chatHashes(f.ctx.chat)),false);
  f.text=story+'这一次你将动作放得更慢。';await f.ctx.generate('swipe');strict.equal(f.action().result.swipeId,1);strict.equal(f.replacementCount,1);strict.equal(f.store.read().transactions.filter(t=>t.type==='operation').length,1);
});
test('stopped action never rides the next main turn and its costs remain settled',async t=>{
  const f=await setup(t);await f.app.setStoryStatus(f.action().id,'stopped');await f.ctx.generate('normal');strict.doesNotMatch(packet(f),new RegExp(ACTION_MARKER));strict.equal(f.action().status,'stopped');strict.equal(f.replacementCount,1);
});
test('restore abandons old narrative attempts and never executes old patches',async t=>{
  const f=await setup(t);await f.store.restore(clone(f.store.read()),chatHashes(f.ctx.chat));strict.equal(f.action().status,'stopped');strict.equal(f.store.read().roleLink,null);strict.equal(f.replacementCount,1);
});
test('literal evidence checks reject forged coverage and missing individual effects',()=>{
  const action={effects:[{}]},items=['intent','activation','effect:0','agency','settlement'];
  const data={checks:items.map(item=>({item,ok:true,quotes:['温热力量涌过双掌'],reason:'文本中的实际说明'}))};strict.equal(validateReview(data,action,story).covered,true);
  data.checks[0].quotes=['从未出现在正文里的伪造证据'];strict.throws(()=>validateReview(data,action,story),/不在对应正文/);
  strict.throws(()=>validateReview({checks:[]},action,story),/缺少/);
});
test('model review stays advisory and requires a final player confirmation',async t=>{
  const f=await setup(t);await f.app.unfoldStory();f.app.model.request=async()=>JSON.stringify({checks:['intent','activation','effect:0','agency','settlement'].map(item=>({item,ok:true,quotes:['温热力量涌过双掌'],reason:'演示核对依据'}))});
  await f.app.reviewStory(f.action().id);strict.equal(f.action().review.covered,true);strict.equal(f.action().status,'presented');await f.app.setStoryStatus(f.action().id,'confirmed');strict.equal(f.action().status,'confirmed');strict.equal(f.replacementCount,1);
});
test('rendered action text is excluded from second settlement while later continuation remains',async t=>{
  const f=await setup(t);await f.app.unfoldStory();let ns=unsettledNarrative(f.ctx.chat,f.store.read(),narrativeMessages(f.ctx.chat,1));strict.equal(ns.length,0);
  f.ctx.chat[1].mes+='\n你之后帮旅人找到道路，获得了两点源质。';ns=unsettledNarrative(f.ctx.chat,f.store.read(),narrativeMessages(f.ctx.chat,1));strict.equal(ns.length,1);strict.doesNotMatch(ns[0].content,/发动深蓝/);strict.match(ns[0].content,/获得了两点源质/);strict.equal(resultText(f.ctx,f.action()),story);
});
test('favorite actions store intent only and do not debit or retain patches',async t=>{
  const f=await setup(t);const before=Object.values(f.store.read().powers[f.power.id].resources)[0].balance;await f.app.saveFavorite();const a=f.store.read().favoriteActions[0];strict.equal(a.costs,undefined);strict.equal(a.patches,undefined);strict.equal(a.effects,undefined);
  f.app.ui.goal='';await f.app.action('use-favorite',{id:a.id});strict.equal(f.app.ui.goal,a.goal);strict.equal(f.app.selected,null);strict.equal(Object.values(f.store.read().powers[f.power.id].resources)[0].balance,before);
  const s=clone(f.store.read());s.favoriteActions[0].patches=[];strict.throws(()=>validateState(s),/旧交易/);
});
test('scene suggestions are rule-backed draft intents and never execute transactions',async t=>{
  const f=await setup(t); const previousDocument=globalThis.document;
  const input={value:'保留原有草稿',dispatchEvent(){},focus(){}};globalThis.document={getElementById:()=>input};
  t.after(()=>{globalThis.document=previousDocument;});
  f.app.ui.setSceneBusy=()=>{};f.app.ui.showSceneSuggestions=()=>{};f.app.ui.setOpen=()=>{};
  f.app.model.request=async prompt=>{const user=JSON.parse(prompt.user),m=user.recentNarrative.at(-1);return JSON.stringify({actions:[{kind:'investigate',label:'在院中试掌',goal:'我利用已有掌法观察力量的实际表现。',benefit:'先了解已有能力的表现，再决定后续方向。',uncertainty:'',archiveIds:[],sourceIndex:m.index,sceneQuote:m.content.slice(0,12),ruleQuote:f.power.rules.slice(0,16)}]});};
  const before=stable(f.store.read());await f.app.sceneActions();strict.equal(f.app.ui.view.sceneCandidates.length,1);await f.app.action('select-scene',{index:'0'});
  strict.match(input.value,/^保留原有草稿/);strict.match(input.value,/观察/);strict.equal(stable(f.store.read()),before);strict.equal(f.replacementCount,1);
  strict.throws(()=>normalizeCandidates({actions:[{label:'坏动作',goal:'虚构货币',ruleQuote:'没有这条原文规则'}]},f.power),/真实词条/);
});

test('reload preserves a queued action; next generation needs no second execution',async t=>{
  const f=await setup(t);f.app.narrativeAttempt=null;await f.store.transact(next=>{next.narrativeActions[0].status='generating';},{facts:false});await f.app.unfoldStory();strict.equal(f.action().status,'presented');strict.equal(f.replacementCount,1);
});

test('same-floor continue preserves the original MVU write and the continuation cursor',async t=>{
  const f=await setup(t);await f.ctx.generate('continue');await f.app.pullRoleBalances();strict.equal(f.action().status,'presented');strict.equal(f.app.ui.view.historyMismatch,false);strict.equal(f.store.read().syncTail.index,0);strict.equal(resultText(f.ctx,f.action()).trim(),story);strict.equal(f.replacementCount,1);
});
test('a second unfold click while the first prompt is running cannot duplicate generation',async t=>{
  const f=await setup(t);let release;f.beforePrompt=()=>new Promise(resolve=>{release=resolve;});const first=f.app.unfoldStory();await new Promise(resolve=>setTimeout(resolve,0));await strict.rejects(f.app.unfoldStory(),/等待当前/);release();await first;strict.equal(f.calls.length,1);strict.equal(f.replacementCount,1);
});
test('chat switch during main generation cannot attach the old action to the new chat',async t=>{
  const f=await setup(t);const old=clone(f.store.read());f.beforePrompt=async()=>{f.ctx.chatId='another-chat';f.ctx.chatMetadata={};await f.emit('CHAT_CHANGED');};await f.app.unfoldStory();strict.equal(f.store.read().narrativeActions?.length || 0,0);strict.equal(f.replacementCount,1);strict.equal(old.narrativeActions[0].status,'waiting');
});

test('chat injection mutates the array reference held by actual SillyTavern prompt assembly',async t=>{
  const f=await setup(t);await f.emit('GENERATION_STARTED','normal',{},false);const retained=[{role:'user',content:'正文请求'}],request={chat:retained};await f.emit('CHAT_COMPLETION_PROMPT_READY',request);strict.equal(request.chat,retained);strict.match(retained.at(-1).content,new RegExp(ACTION_MARKER));await f.emit('GENERATION_STOPPED');
});
test('a quiet request nested after main-start does not get the main action packet',async t=>{
  const f=await setup(t);await f.emit('GENERATION_STARTED','normal',{},false);await f.emit('GENERATION_STARTED','quiet',{},false);const background={chat:[{role:'user',content:'其他扩展背景分析'}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',background);strict.doesNotMatch(JSON.stringify(background),new RegExp(ACTION_MARKER));await f.emit('GENERATION_ENDED');await f.app.unfoldStory();strict.equal(f.action().status,'presented');strict.equal(f.replacementCount,1);
});

test('an unrelated old-floor redraw after generation-end cannot cancel the awaited main reply',async t=>{
  const f=await setup(t);await f.emit('GENERATION_STARTED','normal',{},false);const p={chat:[{role:'user',content:'展开行动'}]};await f.emit('CHAT_COMPLETION_PROMPT_READY',p);await f.emit('GENERATION_ENDED');await f.emit('CHARACTER_MESSAGE_RENDERED',0,'normal');strict.equal(f.action().status,'generating');
  f.ctx.chat.push({is_user:false,name:f.ctx.name2,mes:story,swipe_id:0,variables:[clone(f.getRaw())]});await f.emit('CHARACTER_MESSAGE_RENDERED',1,'normal');strict.equal(f.action().status,'presented');strict.equal(f.replacementCount,1);
});
test('supplemental story retries preserve all old presentation spans against double rewards',async t=>{
  const f=await setup(t);await f.app.unfoldStory();await f.app.setStoryStatus(f.action().id,'waiting');f.text='你补上此前未能清晰描述的试演，掌力贯透枝叶，并没有再次发动或提升。';await f.app.unfoldStory();strict.equal(f.action().presentations.length,2);
  const ns=unsettledNarrative(f.ctx.chat,f.store.read(),narrativeMessages(f.ctx.chat,1));strict.equal(ns.length,0);strict.equal(f.replacementCount,1);strict.equal(f.store.read().transactions.filter(t=>t.type==='operation').length,1);
});
