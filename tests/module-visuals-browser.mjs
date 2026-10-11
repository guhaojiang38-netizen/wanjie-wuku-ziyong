// Production UI in a mock host. No external API, real chat, or world evolution.
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,isAbsolute,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.WJWK_NODE_MODULES+'/package.json')('playwright');
const out=process.env.WJWK_SCREENSHOTS;await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
  const path=resolve('.','.'+decodeURIComponent(new URL(req.url,'http://local').pathname)),rel=relative(process.cwd(),path);
  if(rel.startsWith('..')||isAbsolute(rel))throw Error('path');
  res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});
  const page=await browser.newPage({viewport:{width:1440,height:1040},reducedMotion:'reduce'}),errors=[],matrix=[];
  page.on('pageerror',e=>errors.push(e.message));let externalRequests=0;
  await page.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();externalRequests++;return r.abort();});
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);
  await page.waitForFunction(()=>globalThis.wanjie_wuku_general_instance);
  await page.locator('[data-action="toggle"]').click();
  const seed=await page.evaluate(async()=>{
    const app=wanjie_wuku_general_instance;
    const {createPower}=await import('/src/core.js'),{builtinEntries}=await import('/src/builtin-worldbook.js');
    const {MMLC_ENTRY}=await import('/src/mmlc.js'),{saveArchive,archiveSource}=await import('/src/archives.js');
    const entries=builtinEntries(),arsenal=createPower(entries.find(e=>e.name==='绝对生产力')),
      taishi=createPower(entries.find(e=>e.name.startsWith('太始天（完整版'))),journey=createPower(MMLC_ENTRY);
    for(const power of [arsenal,taishi,journey]){
      const facts=power===journey?[['environment','东坡药圃','active',{changes:'灵泉供给稳定，原有药圃改造完成。'}],['population','巡航舰队','working',{scale:'12艘；11艘可用、1艘待修'}],['skill','青木回元诀','active',{level:'已掌握',effect:'保留已有传承'}]]:
        power===taishi?[['environment','始生原界','active',{conditions:'生命源流；既有生态持续发展'}],['member','裴昭宁','working',{role:'主持灵圃改良',location:'九霄仙域·青梧岭'}],['research','世界研究安排','planned',{goal:'拟研究源流配合，尚未开始'}]]:
        [['facility','符文工坊','active',{condition:'稳定运行',purpose:'制作与修复已有器具'}],['research','复合材料验证','working',{progress:'基础配方已完成，等待实物测试'}],['record','灵纹护甲','active',{description:'三套完好，尚未分配'}]];
      for(const [type,name,status,fields]of facts)saveArchive(power,{type,name,status,fields},archiveSource(SillyTavern.getContext().chat,'离线视觉测试数据，不是实际剧情'));
    }
    await app.store.transact(s=>{for(const p of [arsenal,taishi,journey])s.powers[p.id]=p;});
    app.settings.mode='off';app.ui.space='wuku';app.ui.tab='management';app.powerId=arsenal.id;app.refresh();
    return {ids:{arsenal:arsenal.id,taishi:taishi.id,journey:journey.id},state:JSON.stringify(app.store.read())};
  });
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1040});
    for(const appearance of ['arsenal','journey','taishi']){
      await page.evaluate(({id,appearance})=>{const app=wanjie_wuku_general_instance;app.powerId=id;app.ui.space=appearance==='journey'?'mmlc':appearance==='taishi'?'taishi':'wuku';app.ui.tab='management';app.ui.mmlcSection=null;app.refresh();}, {id:seed.ids[appearance],appearance});
      assert.equal(await page.locator('#wjwk-root').getAttribute('data-appearance'),appearance);
      const counts=await page.locator('.wjwk-saved-stats strong').allTextContents();
      assert.deepEqual(counts,appearance==='taishi'?['1','1','1']:['2','1','0']);
      for(const theme of ['follow','light','dark','night','parchment','green']){
        await page.evaluate(theme=>{const app=wanjie_wuku_general_instance;app.settings.theme=theme;app.ui.applyTheme(app.settings);},theme);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        const overflowing=await page.locator('.wjwk-window').evaluate(panel=>[...panel.querySelectorAll('.wjwk-main,.wjwk-current-overview,.wjwk-mmlc-tile,.wjwk-player-hero,.wjwk-mmlc-hero')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.className));
        assert.deepEqual(overflowing,[],`${appearance}/${theme}/${width}`);
        if(['light','dark'].includes(theme))await page.locator('.wjwk-window').screenshot({path:`${out}/${appearance}-${theme}-${width}.png`,animations:'disabled'});
        matrix.push({appearance,theme,width});
      }
      if(appearance==='journey'){
        assert.equal(await page.locator('.wjwk-mmlc-tile').count(),8);
        await page.locator('.wjwk-mmlc-tile[data-section="fleet"]').click();
        await page.getByRole('heading',{name:'玄黄舰',exact:true}).waitFor();
        assert.match((await page.locator('.wjwk-mmlc-records').allTextContents()).join('\n'),/11艘可用/);
        await page.locator('.wjwk-mmlc-back [data-action="mmlc-section"]').click();
      }else if(appearance==='taishi'){
        await page.locator('.wjwk-mmlc-tile[data-section="companions"]').click();
        await page.locator('[data-taishi-record] [data-action="open-archive"]').first().click();
        assert.equal(await page.locator('.wjwk-modal').isVisible(),true);
        await page.locator('[data-action="dialog-close"]').click();
        await page.locator('.wjwk-content [data-action="taishi-section"]').first().click();
      }else{
        await page.locator('.wjwk-current-overview [data-action="open-archive"]').first().click();
        assert.equal(await page.locator('.wjwk-modal').isVisible(),true);
        assert.equal(await page.locator('#wjwk-root').getAttribute('data-appearance'),appearance);
        await page.locator('[data-action="dialog-close"]').click();
      }
    }
  }
  // Switching modules and themes must never change saved archives, IDs or histories.
  assert.equal(await page.evaluate(()=>JSON.stringify(wanjie_wuku_general_instance.store.read())),seed.state);
  const reset=await page.evaluate(()=>{const app=wanjie_wuku_general_instance;app.ui.render({state:null,noChat:true,settings:app.settings});return app.ui.root.dataset.appearance;});
  assert.equal(reset,'arsenal');assert.equal(await page.locator('[data-no-chat-home]').count(),1);
  assert.deepEqual(errors,[]);assert.equal(externalRequests,0);
  await writeFile(out+'/module-visuals.json',JSON.stringify({matrix,errors,externalRequests,savedStateUnchanged:true,countsFromSavedRecords:true,moduleNavigation:true,detailDialogs:true,noChatReset:true,realHostTested:false,installed:false},null,2));
  console.log('PASS 36 module/theme/viewport combinations; saved state unchanged; real archive details, MMLC module navigation, empty-chat reset; no external calls. Mock host only.');
}finally{await browser?.close();server.close();}
