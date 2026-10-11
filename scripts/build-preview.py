"""Bundle an offline demo of the exact extension modules; no external requests."""
from pathlib import Path
import json
import sys

project = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]) if len(sys.argv) > 1 else project / '万界武库-v0.4.0-交互演示.html'
modules = {name: (project / path).read_text(encoding='utf-8') for name, path in {
    'profilesData':'src/management-profiles-data.js', 'profiles':'src/management-profiles.js', 'profileView':'src/profile-view.js', 'archives':'src/archives.js', 'archiveReview':'src/archive-review.js', 'archiveMemory':'src/archive-memory.js', 'playerHome':'src/player-home.js', 'workflow':'src/workflow.js', 'management':'src/management.js', 'receipt':'src/receipt.js', 'core': 'src/core.js', 'host': 'src/host.js', 'model': 'src/model.js',
    'narrative':'src/narrative.js', 'narrativeController':'src/narrative-controller.js', 'mvu':'src/mvu.js', 'ui': 'src/ui.js', 'entry': 'index.js', 'mock': 'tests/mock-host.js',
}.items()}
data = json.dumps(modules, ensure_ascii=False).replace('</', '<\\/')
bootstrap = r'''
const sources = MODULE_DATA;
const url = source => URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
const receiptURL = url(sources.receipt);
const replaceReceipt = source => source.replaceAll("from './receipt.js'", `from '${receiptURL}'`);
const coreURL = url(replaceReceipt(sources.core));
const replaceCore = source => replaceReceipt(source).replaceAll("from './core.js'", `from '${coreURL}'`);
const profilesDataURL = url(sources.profilesData);
const profilesURL = url(replaceCore(sources.profiles).replaceAll("from './management-profiles-data.js'", `from '${profilesDataURL}'`));
const profileViewURL = url(sources.profileView.replaceAll("from './management-profiles.js'", `from '${profilesURL}'`));
const replaceProfiles = source => source.replaceAll("from './management-profiles.js'", `from '${profilesURL}'`);
const hostURL = url(replaceCore(sources.host));
const mvuURL = url(replaceCore(sources.mvu).replaceAll("from './host.js'", `from '${hostURL}'`));
const modelURL = url(replaceCore(sources.model));
const managementURL = url(replaceProfiles(replaceCore(sources.management)).replaceAll("from './host.js'", `from '${hostURL}'`));
const workflowURL = url(replaceCore(sources.workflow).replaceAll("from './host.js'", `from '${hostURL}'`));
const archivesURL = url(replaceProfiles(replaceCore(sources.archives)).replaceAll("from './host.js'", `from '${hostURL}'`));
const replaceArchive = source => replaceCore(source).replaceAll("from './host.js'", `from '${hostURL}'`).replaceAll("from './archives.js'", `from '${archivesURL}'`);
const playerHomeURL = url(replaceArchive(sources.playerHome));
const replacePlayerHome = source => source.replaceAll("from './player-home.js'", `from '${playerHomeURL}'`);
const archiveReviewURL = url(replacePlayerHome(replaceArchive(sources.archiveReview)));
const archiveMemoryURL = url(replaceArchive(sources.archiveMemory));
const narrativeURL = url(replaceCore(sources.narrative));
const uiURL = url(replacePlayerHome(replaceProfiles(replaceCore(sources.ui))).replaceAll("from './archive-review.js'", `from '${archiveReviewURL}'`).replaceAll("from './archive-memory.js'", `from '${archiveMemoryURL}'`).replaceAll("from './narrative.js'", `from '${narrativeURL}'`).replaceAll("from './archives.js'", `from '${archivesURL}'`).replaceAll("from './profile-view.js'", `from '${profileViewURL}'`).replaceAll("from './workflow.js'", `from '${workflowURL}'`).replaceAll("from './management.js'", `from '${managementURL}'`));
const narrativeControllerURL = url(replaceCore(sources.narrativeController).replaceAll("from './archives.js'", `from '${archivesURL}'`).replaceAll("from './host.js'", `from '${hostURL}'`).replaceAll("from './model.js'", `from '${modelURL}'`).replaceAll("from './narrative.js'", `from '${narrativeURL}'`));
const entryURL = url(sources.entry.replaceAll("from './src/player-home.js'", `from '${playerHomeURL}'`).replaceAll("from './src/archive-review.js'", `from '${archiveReviewURL}'`).replaceAll("from './src/archive-memory.js'", `from '${archiveMemoryURL}'`).replaceAll("from './src/archives.js'", `from '${archivesURL}'`).replaceAll("from './src/management-profiles.js'", `from '${profilesURL}'`).replaceAll("from './src/workflow.js'", `from '${workflowURL}'`).replaceAll("from './src/management.js'", `from '${managementURL}'`).replaceAll("from './src/narrative.js'", `from '${narrativeURL}'`).replaceAll("from './src/narrative-controller.js'", `from '${narrativeControllerURL}'`).replaceAll("from './src/core.js'", `from '${coreURL}'`).replaceAll("from './src/host.js'", `from '${hostURL}'`).replaceAll("from './src/model.js'", `from '${modelURL}'`).replaceAll("from './src/mvu.js'", `from '${mvuURL}'`).replaceAll("from './src/ui.js'", `from '${uiURL}'`));
await import(url(sources.mock));
await import(entryURL);
const core = await import(coreURL);
const archiveAPI = await import(archivesURL);
let attempts = 0;
const timer = setInterval(async () => {
  const app = globalThis.wanjie_wuku_general_instance;
  if (!app) { if (++attempts > 40) clearInterval(timer); return; }
  clearInterval(timer);
  const ctx = SillyTavern.getContext();
  const entries = core.importBook(await ctx.loadWorldInfo(), '开发示例规则');
  entries.push(...core.importBook({entries:{101:{comment:'母巢',content:'<母巢>自编离线演示：记录已经建立的种群、生态改造、设施和研究。此示例不代表原世界书规则。</母巢>'}}}, '自编经营示例'));
  entries.push(...core.importBook({entries:{201:{comment:'自编同行名册',content:'自编离线演示：记录已经存在的同行成员和双方已成立的约定，记录不创建人物、能力或契约。'},202:{comment:'自编技艺笔记',content:'自编离线演示：记录正文中已掌握的技艺程度与练习进展；尝试不是成功，不推算经验和升级。'}}}, '自编扩展示例'));
  app.settings.catalog = entries; app.settings.mode = 'st'; app.settings.baseUrl = 'https://models.example.test/v1';
  if (!Object.keys(app.store.read().powers).length) {
    await app.store.transact(state => {
      for (const entry of entries) {
        const p = core.createPower(entry);
        for (const r of Object.values(p.resources)) r.balance = p.name === '蝴蝶效应' ? '3' : '6';
        if (p.name === '深蓝') p.assets.demo_skill = {id:'demo_skill',name:'基础呼吸法',kind:'已有能力',quantity:'1',permanent:true,description:'已经掌握第一阶段，当前身体可稳定运转。'};
        if (p.name === '母巢') {
          const source = archiveAPI.archiveSource(ctx.chat, '自编离线示例，仅用于预览');
          for (const example of [
            {type:'population',name:'耐寒工蜂',status:'active',fields:{scale:'一小群',traits:'耐寒；适合低温环境',purpose:'巡视与搬运',location:'北坡育种区'}},
            {type:'population',name:'夜行侦察蜂',status:'planned',fields:{traits:'计划强化暗处感知',limits:'尚未开始育种'}},
            {type:'environment',name:'北坡育种区',status:'active',fields:{location:'北坡山坳',changes:'铺设保温菌毯，形成避风区',conditions:'低温、湿润',scale:'一片小型育种区',related:'耐寒工蜂'}},
            {type:'facility',name:'初代育种池',status:'active',fields:{purpose:'维持工蜂幼体生长',location:'北坡育种区',condition:'稳定运行',limits:'容量尚未明确'}},
            {type:'research',name:'低温繁育适应',status:'working',fields:{goal:'提高低温条件下的繁育稳定性',progress:'已观察首批工蜂的适应情况',outcome:'初步具备耐寒特性',limits:'繁育效果仍待验证'}}
          ]) archiveAPI.saveArchive(p, example, source);
        }
        state.powers[p.id] = p;
      }
      state.historyAnchor = core.chatHashes(ctx.chat); state.syncCursor = ctx.chat.length;
      state.transactions.push({id:core.uid('demo'),label:'演示起始事实',type:'manual',changes:['演示数据：蝴蝶效应 3 因果点；深蓝 6 源质点和基础呼吸法；置物栏无货币。'],at:Date.now(),atMessage:ctx.chat.length,costs:[],effects:[],evidence:[]});
    });
  }
  const extraEntries = entries.filter(e=>['自编同行名册','自编技艺笔记'].includes(e.name));
  if (extraEntries.some(e=>!app.store.read().powers[e.id])) await app.store.transact(state=>{
    for (const e of extraEntries) {
      if (state.powers[e.id]) continue;
      const p = core.createPower(e), source = archiveAPI.archiveSource(ctx.chat, '自编离线扩展示例，人工核对事实');
      const examples = e.name === '自编同行名册' ? [
        {type:'member',name:'巡路纸偶',status:'active',fields:{role:'探路与传递消息',traits:'可移动；不具备战斗能力',location:'北坡入口',condition:'等待新的巡查委托',limits:'可控范围需在正文确认'}},
        {type:'bond',name:'北坡巡查约定',status:'active',fields:{participants:'旅行者与巡路纸偶',terms:'仅接受旅行者确认的巡查委托',obligations:'明确路线；回报观察到的情况',condition:'约定有效',limits:'不保证巡查成功'}}
      ] : [
        {type:'skill',name:'基础剑术',status:'active',fields:{level:'入门',progress:'能够慢速完成基础动作',effect:'已掌握站姿与基础挥剑',limits:'移动中衔接仍不稳定'}},
        {type:'research',name:'步剑衔接练习',status:'working',fields:{goal:'让移动与基础挥剑衔接',progress:'刚开始练习',limits:'尚未形成稳定成果'}}
      ];
      for (const row of examples) archiveAPI.saveArchive(p,row,source);
      state.powers[p.id]=p;
    }
  });
  // Only this self-authored preview entry gains illustrative mechanics. Never touch imported worldbooks.
  const homePower = Object.values(app.store.read().powers).find(p=>p.name==='母巢' && p.source?.book==='自编经营示例');
  if (homePower && !homePower.rules.includes('自编玩法：')) await app.store.transact(next => {
    const p = next.powers[homePower.id];
    p.rules += '\n自编玩法：可在已有样本与适宜条件下尝试培育承担巡视、搬运职责的种群；可调节已建立区域的生态条件，例如铺设保温菌毯；可投入实际材料尝试建设育种池等设施；可观察种群表现并逐步研究耐寒等适应特性。范围、材料投入、容量和最终效果由正文确定，不保证尝试成功，未完成研究不视为已掌握。';
    p.primaryRules = p.rules; p.ruleVersion = core.hash(p.rules); delete p.playerGuide;
  }, { facts: false });
  app.powerId = Object.values(app.store.read().powers).find(p=>p.name==='母巢')?.id;
  app.refresh(); app.selected = app.ui.view.operations[0] || null;
  app.ui.goal = '以已有拂风绵掌为锚点，推演穿云游燕掌法（八品精妙）；保留原有功法。';
  app.refresh(); app.ui.setOpen(true);
}, 50);
'''.replace('MODULE_DATA', data)
html = (project / 'tests/preview.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="../style.css">', '<style>' + (project / 'style.css').read_text(encoding='utf-8') + '</style>')
html = html.replace('<script type="module" src="./mock-host.js"></script><script type="module" src="../index.js"></script>', '<script type="module">' + bootstrap + '</script>')
html = html.replace('右下角的“武库”按钮加载真实扩展代码。此页只模拟酒馆接口，模型调用返回固定测试数据，不连接外部模型。', '玩家首页预览 v0.11.0-dev.1。母巢内容均为自编示例：可添加种群、环境、设施和研究，编辑后查看历史。所有操作只在离线测试宿主中保存，不连接外部模型。可在场景建议中填写目标，比较行动方向，再写入未发送正文草稿。新增成员、技艺、契约档案。模型为固定离线数据，不证明真实模型质量。')
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(html, encoding='utf-8')
print(json.dumps({'file': str(output), 'bytes': output.stat().st_size}, ensure_ascii=False))
