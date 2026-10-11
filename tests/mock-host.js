// Development-only host. These examples are not a universal power specification.
const handlers = new Map();
const eventSource = { on(event, fn) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event).add(fn); }, removeListener(event, fn) { handlers.get(event)?.delete(fn); }, async emit(event, ...args) { for (const fn of handlers.get(event) || []) await fn(...args); } };
const eventTypes = Object.fromEntries(['APP_READY', 'CHAT_CHANGED', 'GENERATION_STARTED', 'GENERATION_ENDED', 'GENERATION_STOPPED', 'MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_RECEIVED', 'CHARACTER_MESSAGE_RENDERED', 'CHAT_COMPLETION_PROMPT_READY', 'GENERATE_AFTER_COMBINE_PROMPTS'].map(name => [name, name]));
const roleBook = {entries:{1:{uid:1,comment:'变量列表',content:'主角含因果点、源质点、功法和能力。功法记录品级、掌握程度与完整描述。'},2:{uid:2,comment:'[mvu_update]变量更新规则',content:'新增功法与能力必须保留已有记录，登记实际品级、掌握程度与完整效果描述。按真实投入更新资源，不重复扣付。'},3:{uid:3,comment:'[mvu_update]变量输出格式',content:'用 UpdateVariable 内的 JSONPatch 列表更新 stat_data。'}}};
const initialMvu = {stat_data:{主角:{因果点:3,源质点:6,功法:{拂风绵掌:{品级:3,掌握程度:'登堂',描述:'自编演示：已掌握的三品外功。'}},能力:{},境界:'凡人'}},schema:{type:'object',properties:{主角:{type:'object',properties:{功法:{type:'object',extensible:true},能力:{type:'object',extensible:true}}}}},initialized_lorebooks:{'自编角色规则':[]}};
const demoBook = { entries: { 1: { uid: 1, comment: '蝴蝶效应', content: '<蝴蝶效应>\n演示约定：使用因果点，按所得完整规格执行。\n{{user}}能够直接消耗1因果点，将一份固定基准底蕴永久叠加到自身\n</蝴蝶效应>' }, 2: { uid: 2, comment: '深蓝', content: '<深蓝>\n演示约定：根据已掌握能力锚点和当前身体状态，消耗源质点推演目标与现状之间的实际缺口。\n</深蓝>' }, 3: { uid: 3, comment: '置物栏', content: '<置物栏>\n演示约定：收纳已经持有的物品，记录位置与完整物品规格，不设货币。\n</置物栏>' } } };
demoBook.entries[4] = {uid:4,comment:'源堡',content:'<源堡>演示约定：保存已经成立的领域安排与封存记录，能力使用由正文承接。</源堡>'};
demoBook.entries[5] = {uid:5,comment:'熟练度状态栏',content:'<熟练度状态栏>演示约定：记录正文中已经形成的技艺进展，保留旧有掌握。</熟练度状态栏>'};
demoBook.entries[6] = {uid:6,comment:'签到',content:'<签到>演示约定：按真实经历的剧情周期登记，同一触发事项每周期结算一次。只有正文已结算后才登记结果，不按电脑日期发奖。</签到>'};
demoBook.entries[7] = {uid:7,comment:'人生模拟',content:'<人生模拟>演示约定：保存模拟正文已经形成的成果。可选数量以当次正文为准；等待条件的成果须在现实条件满足后选择。选择不是到账，正文兑现后登记，不重复发奖。</人生模拟>'};
// File previews can forbid storage. The demo then uses memory and says so clearly.
try { localStorage.setItem('wjwk-demo-probe', '1'); localStorage.removeItem('wjwk-demo-probe'); }
catch { const memory = new Map(); Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)), removeItem: k => memory.delete(k) } }); document.querySelector('.demo>small').textContent += ' · 仅内存保存，关页后重置'; }
let saved = JSON.parse(localStorage.getItem('wjwk-demo-host-v03') || 'null');
const ctx = { userHandle: 'demo-user', name1: '旅行者', name2: '引路人', mainApi: 'openai', characterId: 0, characters: [{ avatar: 'demo.png', name: '引路人', data:{extensions:{world:'自编角色规则'}} }], chatId: 'demo-chat', groupId: null, chat: saved?.chat || [{ is_user: false, name: '引路人', mes: '你停在道路交汇处，准备决定下一步行动。',swipe_id:0,variables:[JSON.parse(JSON.stringify(initialMvu))] }], chatMetadata: saved?.metadata || {}, extensionSettings: {}, accountStorage: localStorage, eventSource, eventTypes, getWorldInfoNames: () => ['开发示例规则','自编角色规则'], loadWorldInfo: async name => name === '自编角色规则' ? roleBook : demoBook, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }), saveSettingsDebounced() {}, async saveChat() { saved = JSON.parse(JSON.stringify({metadata:ctx.chatMetadata,chat:ctx.chat})); localStorage.setItem('wjwk-demo-host-v03', JSON.stringify(saved)); }, async generateRaw(params) {
  const request = { chat: [{ role: 'system', content: params.systemPrompt }, { role: 'user', content: params.prompt }] }; await eventSource.emit(eventTypes.CHAT_COMPLETION_PROMPT_READY, request); globalThis.demoLastRaw = request;
  if (globalThis.demoDelay) await new Promise(resolve => setTimeout(resolve, globalThis.demoDelay));
  const input = JSON.parse(params.prompt);
  if (input.task === '核对经营档案变化') {
    const source = input.sources.find(s => s.content.includes('工蜂已扩充至三十只'));
    const record = input.current.find(r => r.name === '耐寒工蜂');
    const mother = input.rules.includes('母巢'), ruleQuote = input.rules.includes('自编玩法：') ? input.rules.slice(input.rules.indexOf('自编玩法：'), input.rules.indexOf('自编玩法：') + 300) : input.rules.slice(0, 80);
    const guide = input.explainRules ? { summary: mother ? '以已有种群为基础，积累生态改造、巢群设施与研究成果。' : '依据当前词条规则，在正文中发展能力并留下成果。', abilities: mother ? [
      { name: '培育种群', description: '利用已有样本和适宜条件，尝试培育承担巡视、搬运等职责的种群。', ruleQuote },
      { name: '改造生态', description: '调节已有区域的生态条件，例如为育种区铺设保温菌毯。范围与效果由剧情确定。', ruleQuote },
      { name: '建设巢群', description: '投入实际材料，尝试建设育种池等设施；设施容量不会凭空增加。', ruleQuote },
      { name: '研究适应', description: '观察种群表现，逐步研究耐寒等特性；完成之前不能当成已经掌握。', ruleQuote },
    ] : [{ name: '规则中的能力', description: '按原文的条件使用能力；这里是固定离线示例，真实说明由已配置模型整理。', ruleQuote }] } : undefined;
    const changes = input.playerNote && record ? [{ archiveId: record.id, type: 'population', name: record.name, status: 'active', fields: { purpose: '北坡巡视' }, sourceIndex: -1, quote: input.playerNote, ruleQuote }] : source && record ? [{ archiveId: record.id, type: 'population', name: record.name, status: 'active', fields: { scale: '三十只', traits: '耐寒；夜视能力已稳定' }, sourceIndex: source.index, quote: '耐寒工蜂已扩充至三十只，夜视能力已稳定', ruleQuote }] : [];
    return JSON.stringify({ guide, changes, message: '固定自编测试数据，不连接外部模型' });
  }
  if (input.task === '核对武库管理记录') {
    const changes = [];
    for (const rule of input.rules) for (const source of input.sources) {
      const example = rule.name === '深蓝' ? ['研究方向','progress','继续研究轻灵步法的适配方向。'] : rule.name === '源堡' ? ['封存安排','arrangement','旧卷已封存在书房的木柜中。'] : rule.name === '熟练度状态栏' ? ['剑术练习记录','progress','剑术练习后，步法衔接比昨日稳定。'] : null;
      if (!example || !source.content.includes(example[2])) continue;
      const old = Object.values(input.current.find(p=>p.id===rule.id)?.records || {}).find(r=>r.label===example[0]);
      changes.push({powerId:rule.id,...(old?{recordId:old.id}:{}),label:example[0],category:example[1],value:example[2],status:'active',sourceIndex:source.index,quote:example[2],ruleQuote:rule.fullText.slice(rule.fullText.indexOf('演示约定'),rule.fullText.indexOf('演示约定')+16)});
    }
    return JSON.stringify({changes,message:'固定演示：三种管理记录，未发奖、未改角色变量。'});
  }
  if (input.task === '生成本场景行动意图') {
    const m = input.recentNarrative.at(-1); if (!m) return JSON.stringify({actions:[],message:'请先补充当前场景。'});
    const records = input.archiveContext.items, bees = records.find(r=>r.name==='耐寒工蜂'), area = records.find(r=>r.name==='北坡育种区');
    const food = /粮|食物|饲料/.test(input.requestedGoal + input.unsentDraft);
    const examples = food ? [
      ['respond','调整工蜂分工','我先让部分耐寒工蜂在北坡育种区附近搜集可用饲料，保留必要的巡视力量，观察是否能缓解眼前的食物压力。','直接处理当前短缺，同时保留已有防护。','附近饲料是否可食尚不明确。',[bees?.id]],
      ['investigate','查清短缺来源','我检查育种区的消耗与储备，分别观察幼体喂养和工蜂活动，先找出食物压力主要来自哪里。','把生产不足和消耗过大区分开，再决定投入方向。','实际消耗与储备尚无明确统计。',[area?.id]],
      ['prepare','先试小块饲料区','我在北坡育种区划出一小块试验区域，尝试培育可供工蜂食用的本地植物，先观察适应情况，再决定是否扩大。','为持续供给作准备，不把尝试当成已经投产。','植物适应性与培育条件仍需确认。',[area?.id]]
    ] : bees ? [
      ['respond','让已有工蜂分路巡视','我让已有耐寒工蜂沿北坡育种区周边分路巡视，先观察附近动静，再决定是否向外推进。','利用已建立的种群回应眼前的不确定环境。','工蜂实际感知距离尚未明确。',[bees.id]],
      ['develop','检验低温部署','我安排一部分耐寒工蜂在育种区边缘进行短程活动，观察低温下的行动与返回情况，再调整部署。','先检验既有特性的实际表现，为后续部署提供依据。','耐寒特性的持续时间和极限尚未明确。',[bees.id]],
      ['prepare','划定育种区缓冲带','我沿北坡育种区外围检查保温菌毯与避风边界，标记薄弱位置，准备下一轮维护的优先顺序。','维护已经建成的环境，减少后续育种受干扰的机会。','边界薄弱点尚待实地检查。',[area?.id]]
    ] : [['investigate','检验当前已有能力','我在安全的位置检验已掌握能力的实际表现，记录影响后续选择的限制，再决定下一步行动。','先利用已掌握的事实，避免直接假定未知能力已经获得。','实际效果仍需在正文中观察。',[]]];
    return JSON.stringify({actions:examples.map(([kind,label,goal,benefit,uncertainty,ids])=>({kind,label,goal,benefit,uncertainty,archiveIds:ids.filter(Boolean),sourceIndex:m.index,sceneQuote:m.content.slice(0,Math.min(80,m.content.length)),ruleQuote:input.selectedRule.fullText.slice(0,Math.min(60,input.selectedRule.fullText.length))})),message:'固定自编响应，仅验证协议和界面。'});
  }
  if (input.task === '核对行动正文') {
    const quote = input.narrative.slice(0, 100);
    return JSON.stringify({checks:['intent','activation',...input.action.effects.map((_,i)=>`effect:${i}`),'agency','settlement'].map(item=>({item,ok:true,quotes:[quote],reason:'固定演示响应，仅用于观察核对界面；真实环境由玩家检查这些证据是否充分。'})),message:'演示证据，请核对正文。'});
  }
  const mapped = op => {
    const isPalm = op.effects?.[0]?.name?.includes('穿云');
    const path = isPalm?'/主角/功法/穿云游燕掌法':`/主角/能力/${op.effects[0].name}`;
    return {variableUpdates:[{op:'add',path,value:isPalm?{品级:8,掌握程度:'精妙',描述:op.effects[0].description}:{名称:op.effects[0].name,描述:op.effects[0].description,永久:true}}],roleRuleQuote:'新增功法与能力必须保留已有记录',roleChecks:[{ruleId:input.roleContract.rules.find(r=>r.kind==='update').id,quote:'新增功法与能力必须保留已有记录',paths:[path],reason:'把已确定所得登记为新的实际记录，保留原有功法，不改变确定的规格。'}]};
  };
  if (input.task === '映射已确定操作的角色变量') return JSON.stringify(mapped(input.operation));
  if (input.roleContract && !input.task.includes('核算')) {
    const p=input.state,r=Object.values(p.resources)[0],rule=input.selectedRule.fullText;
    const palm=p.name==='深蓝', name=palm?'穿云游燕掌法（八品精妙）':'演示本源能力';
    const op={label:name,description:'自编演示：保留旧掌法，新增明确能力。',ready:true,ruleQuote:rule.slice(rule.indexOf('演示约定'),rule.indexOf('演示约定')+16),requirements:[],costs:r?[{kind:'resource',id:r.id,amount:palm?'6':'1'}]:[],effects:[{type:'asset_grant',name,kind:'永久能力',quantity:'1',permanent:true,description:palm?'八品精妙掌法；轻灵腾挪、掌力贯透，完整承接当前身体与已有掌法锚点。':'自编演示的一份固定肉体与灵魂底蕴，保留既有能力。'}]};
    return JSON.stringify({operations:[{...op,...mapped(op)}],message:'已生成自编角色变量方案，尚未执行。'});
  }
  if (input.task.includes('核算')) {
    const p = input.currentState[0], rule = input.selectedRules[0], r = Object.values(p.resources)[0];
    return JSON.stringify({ events: [{ powerId: p.id, label: '新增因果收益', ruleQuote: rule.fullText.slice(rule.fullText.indexOf('演示约定'), rule.fullText.indexOf('演示约定') + 16), ready: true, costs: [], effects: [{ type: 'resource_credit', id: r.id, amount: '2' }], evidence: ['你救下了迷路的旅人，获得两点因果收益。'] }], message: '测试宿主：一项已发生的新收益。' });
  }
  const p = input.state, r = Object.values(p.resources)[0], rule = input.selectedRule.fullText;
  return JSON.stringify({ operations: [{ label: p.name === '深蓝' ? '呼吸法 · 第二阶段' : '测试兑换成果', description: '依据当前已成立事实生成的明确测试方案。', ready: true, ruleQuote: rule.slice(rule.indexOf('演示约定'), rule.indexOf('演示约定') + 16), requirements: p.name === '深蓝' ? ['已经掌握基础呼吸法，当前处于第一阶段'] : [], costs: r ? [{ kind: 'resource', id: r.id, amount: '2' }] : [], effects: [{ type: 'asset_grant', name: '呼吸法第二阶段', kind: '已掌握能力', quantity: '1', permanent: true, description: '已掌握第二阶段呼吸节律与相应运转方法，在当前身体承载范围内稳定使用。测试规格，不代表原世界书定价。' }] }], message: '测试宿主：方案尚未执行。' });
} };
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('/api/chats/')) return new Response(JSON.stringify([{ chat_metadata: saved?.metadata || {} },...(saved?.chat || [])]), { headers: { 'Content-Type': 'application/json' } });
  // A reserved .test origin demonstrates discovery without any network request.
  if (String(url).startsWith('https://models.example.test/')) {
    if (String(url).endsWith('/models') && options?.method === 'GET') return new Response(JSON.stringify({ data:[{id:'demo-embedding'},{id:'demo-chat-fast'},{id:'demo-chat-reasoning'}] }), { headers: {'Content-Type':'application/json'} });
    if (String(url).endsWith('/chat/completions') && options?.method === 'POST') { const body = JSON.parse(options.body); const raw = await ctx.generateRaw({systemPrompt:body.messages[0].content,prompt:body.messages[1].content}); return new Response(JSON.stringify({choices:[{message:{content:raw}}]}), {headers:{'Content-Type':'application/json'}}); }
  }
  return new Response('测试宿主禁止访问外部模型，请在真实酒馆配置连接。', { status: 403 });
};
globalThis.SillyTavern = { getContext: () => ctx };
globalThis.demoContext = ctx;
ctx.onlineStatus = 'connected';
ctx.generate = async (type, options = {}) => {
  await eventSource.emit(eventTypes.GENERATION_STARTED, type, options, false);
  const request = {chat:ctx.chat.map(m=>({role:m.is_user?'user':'assistant',content:m.mes}))};
  await eventSource.emit(eventTypes.CHAT_COMPLETION_PROMPT_READY, request); globalThis.demoLastMain = request;
  if (globalThis.demoStoryFailure) { await eventSource.emit(eventTypes.GENERATION_STOPPED); throw new Error('自编演示：主叙事生成中断'); }
  const injected = request.chat.map(m=>m.content).join('\n'), match = injected.match(/已确认行动数据：\n([^\n]+)\n\[\/WJWK_NARRATIVE_ACTION_V1\]/);
  const actions = match ? JSON.parse(match[1]) : [];
  const story = actions.length ? actions.map(a => `你停在院中，将注意力落在${a.label}上。${a.before.name}回应了这一次明确选择，温热的力量从胸腹向双掌贯通，旧有经验逐渐融入新的运转节律。${a.effects.map(e=>`这一次取得的${e.name || e.label || '成果'}已经成形：${e.description || e.value || e.amount}。`).join('')}你只在原地试演，身形随步法轻转，掌力贯透树叶却不伤枝干，切实感到了此前没有的变化。引路人望着这一幕，停下脚步观察。已确认的消耗已经完成，正文没有再次扣付；下一步仍由你决定。`).join('\n\n') : '你沿着庭院小径前行，等待下一次选择。';
  const source = ctx.chat.findLast(m => m.variables?.[m.swipe_id || 0]?.stat_data), raw = source ? deepCopy(source.variables[source.swipe_id || 0]) : deepCopy(initialMvu);
  ctx.chat.push({is_user:false,name:ctx.name2,mes:story,swipe_id:0,variables:[raw]});
  const index = ctx.chat.length-1;
  await eventSource.emit(eventTypes.MESSAGE_RECEIVED,index,type);
  await eventSource.emit(eventTypes.CHARACTER_MESSAGE_RENDERED,index,type);
  await eventSource.emit(eventTypes.GENERATION_ENDED,ctx.chat.length);
  const display = document.getElementById('demo-story'); if (display) display.textContent = story;
  drawRole(); await ctx.saveChat(); return story;
};
const deepCopy = value => JSON.parse(JSON.stringify(value));
globalThis.Mvu = {
  events:{VARIABLE_UPDATE_ENDED:'demo-mvu-ended'},isDuringExtraAnalysis:()=>false,
  getMvuData(options){return deepCopy(options.type==='chat'?ctx.chatMetadata.variables||{}:ctx.chat[options.message_id]?.variables?.[ctx.chat[options.message_id]?.swipe_id||0]||{});},
  async parseMessage(text,data){const next=deepCopy(data),patches=JSON.parse(text.match(/<JSONPatch>([\s\S]*?)<\/JSONPatch>/)[1]);for(const patch of patches){const parts=patch.path.slice(1).split('/').map(s=>s.replace(/~1/g,'/').replace(/~0/g,'~'));const leaf=parts.pop();let parent=next.stat_data;for(const part of parts)parent=parent[part];if(Array.isArray(parent)&&patch.op==='add')parent.splice(leaf==='-'?parent.length:Number(leaf),0,deepCopy(patch.value));else parent[leaf]=deepCopy(patch.value);}return next;},
  async replaceMvuData(data,options){if(options.type==='chat')ctx.chatMetadata.variables=deepCopy(data);else ctx.chat[options.message_id].variables[ctx.chat[options.message_id].swipe_id||0]=deepCopy(data);drawRole();await eventSource.emit('demo-mvu-ended');}
};
globalThis.TavernHelper = {getCharWorldbookNames:()=>({primary:'自编角色规则',additional:[]}),getWorldbook:async name=>Object.values((name==='自编角色规则'?roleBook:demoBook).entries).map(e=>({uid:e.uid,name:e.comment,content:e.content,enabled:!e.disable})),async setChatMessages(messages,options={}){for(const m of messages)if(m.message!==undefined){ctx.chat[m.message_id].mes=m.message;if(ctx.chat[m.message_id].swipes)ctx.chat[m.message_id].swipes[ctx.chat[m.message_id].swipe_id||0]=m.message;}if(options.refresh!=='none')drawRole();}};
function drawRole(){const stat=ctx.chat.findLast(m=>m.variables?.[m.swipe_id||0]?.stat_data)?.variables?.[0]?.stat_data?.主角;const el=document.getElementById('demo-role-state');if(el)el.textContent=JSON.stringify(stat,null,2);const receipts=document.getElementById('demo-message-receipts');if(receipts)receipts.innerHTML=ctx.chat.flatMap(m=>(m.mes.match(/<WJWK-status>[\s\S]*?<\/WJWK-status>/g)||[])).map(text=>'<details><summary>状态栏更新简报</summary>'+text.replace(/<\/?WJWK-status>/g,'')+'</details>').join('');}
drawRole();
globalThis.demoEmit = (event, ...args) => eventSource.emit(eventTypes[event], ...args);
globalThis.demoAppend = async mes => { const source = ctx.chat.findLast(m => m.variables?.[m.swipe_id || 0]?.stat_data); ctx.chat.push({ is_user: false, name: '引路人', mes, variables: source ? [deepCopy(source.variables[source.swipe_id || 0])] : [] }); await eventSource.emit(eventTypes.MESSAGE_RECEIVED, ctx.chat.length - 1); };
globalThis.demoNextTurn = async (continueSameFloor = false) => {
  const app = globalThis.wanjie_wuku_general_instance;
  if (app && (app.busy || app.mainBusy || app.committing)) return;
  const type = continueSameFloor ? 'continue' : 'normal', previous = ctx.chat.findLast(m => !m.is_user && !m.is_system);
  const raw = deepCopy(previous.variables[previous.swipe_id || 0]);
  await eventSource.emit(eventTypes.GENERATION_STARTED, type, {}, false);
  const request = { chat: [{ role: 'user', content: '我用已掌握的功法帮助旅人，继续前进。' }] };
  await eventSource.emit(eventTypes.CHAT_COMPLETION_PROMPT_READY, request); globalThis.demoLastMain = request;
  const story = '你凭借已掌握的功法穿过城门，为旅人指路，获得两点源质。';
  raw.stat_data.主角.源质点 += 2;
  const text = `${story}\n<UpdateVariable><JSONPatch>[{"op":"replace","path":"/主角/源质点","value":${raw.stat_data.主角.源质点}}]</JSONPatch></UpdateVariable>`;
  if (continueSameFloor) { previous.mes += `\n${text}`; previous.variables[previous.swipe_id || 0] = raw; if (previous.swipes) previous.swipes[previous.swipe_id || 0] = previous.mes; }
  else { ctx.chat.push({ is_user: true, name: ctx.name1, mes: '我帮助旅人，继续前进。' }, { is_user: false, name: ctx.name2, mes: text, variables: [raw] }); }
  const index = ctx.chat.length - 1;
  await eventSource.emit(eventTypes.GENERATION_ENDED, ctx.chat.length);
  await eventSource.emit(eventTypes.MESSAGE_RECEIVED, index, type);
  ctx.chat[index].swipe_id ??= 0; ctx.chat[index].mes += '\n\n<StatusPlaceHolderImpl/>';
  await eventSource.emit(eventTypes.CHARACTER_MESSAGE_RENDERED, index, type);
  await eventSource.emit('demo-mvu-ended'); drawRole();
  const display = document.getElementById('demo-story'); if (display) display.textContent = story;
  await ctx.saveChat();
};
for (const [id, sameFloor] of [['demo-next-turn', false], ['demo-continue', true]]) document.getElementById(id)?.addEventListener('click', () => globalThis.demoNextTurn(sameFloor));
document.getElementById('demo-narrative').addEventListener('click', async () => { const data = { chat: [{ role: 'user', content: '继续故事' }] }; await eventSource.emit(eventTypes.CHAT_COMPLETION_PROMPT_READY, data); globalThis.demoLastMain = data; document.getElementById('demo-prompt-state').textContent = `已收到 ${data.chat.length} 条请求内容；武库事实${data.chat.length > 1 ? '已注入' : '尚未接入'}。`; });

globalThis.demoManagementTurn = async () => {
  const mes = '继续研究轻灵步法的适配方向。旧卷已封存在书房的木柜中。剑术练习后，步法衔接比昨日稳定。';
  ctx.chat.push({is_user:false,name:ctx.name2,mes,swipe_id:0});
  await ctx.saveChat(); await eventSource.emit(eventTypes.MESSAGE_RECEIVED,ctx.chat.length-1,'normal');
  const display=document.getElementById('demo-story');if(display)display.textContent=mes;
};
const managementButton = document.getElementById('demo-management-turn');
managementButton?.addEventListener('click',()=>globalThis.demoManagementTurn());

globalThis.demoWorkflowTurn = async (receipt = false) => {
  const mes = receipt ? '旅途第七日签到已经结算，行囊中已增加一份清心散。步法心得已经融入现实的步法经验。你获得通行许可，古塔路线的兑现条件已经满足。' : '旅途第七日的有效经历已经成立。人生模拟形成两项候选：步法心得，步法衔接更加稳定；古塔路线，记录古塔隐秘入口。步法心得可选，古塔路线等待条件。本次可以选择一项。';
  ctx.chat.push({is_user:false,name:ctx.name2,mes,swipe_id:0}); await ctx.saveChat();
  await eventSource.emit(eventTypes.MESSAGE_RECEIVED,ctx.chat.length-1,'normal');
  const display=document.getElementById('demo-story'); if(display)display.textContent=mes;
};
document.getElementById('demo-workflow-turn')?.addEventListener('click',()=>globalThis.demoWorkflowTurn());
document.getElementById('demo-workflow-receipt')?.addEventListener('click',()=>globalThis.demoWorkflowTurn(true));

document.getElementById('demo-archive-change')?.addEventListener('click', () => globalThis.demoAppend('自编经营测试：耐寒工蜂已扩充至三十只，夜视能力已稳定。北坡育种区仍保持原有生态。'));
