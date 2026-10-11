import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, relative, extname, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.WJWK_NODE_MODULES+'/package.json');
const {chromium}=require('playwright');
const out=process.env.WJWK_SCREENSHOTS;await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const path=resolve('.','.'+decodeURIComponent(new URL(req.url,'http://local').pathname)),rel=relative(process.cwd(),path);
 if(rel.startsWith('..')||isAbsolute(rel))throw Error('path');
 res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1400,height:980},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);
 const result=await page.evaluate(async()=>{
  const {WukuApp}=await import('/index.js');
  const old=wanjie_wuku_general_instance,ctx=SillyTavern.getContext(),oldRoot=old.ui.root,oldFab=oldRoot.querySelector('.wjwk-fab');
  const before=JSON.stringify(old.store.read()),settings=JSON.stringify(old.settings);
  old.ui.setAIActivity({id:1,label:'释放测试',phase:'等待回复',status:'running',startedAt:performance.now()});
  old.destroy();old.destroy();
  const cleaned=!oldRoot.isConnected && old.ui.aiTick===null && old.ui.aiHide===null && old.ui.positionFrame===null;
  oldFab.click();window.dispatchEvent(new Event('resize'));
  old.ui.setAIActivity({id:2,status:'running'});old.refresh();old.scheduleRoleRead();old.scheduleSync();
  const failed=new WukuApp();failed.refresh=()=>{throw Error('fixture startup failure');};
  let failedClean=false;try{await failed.start();}catch{failedClean=failed.destroyed&&!document.getElementById('wjwk-root')&&failed.chatHooks.length===0;}
  if(!failedClean)throw Error('partial startup cleanup failed');
  const fresh=new WukuApp();await fresh.start();globalThis.wanjie_wuku_general_instance=fresh;
  const preserved=before===JSON.stringify(fresh.store.read()) && settings===JSON.stringify(fresh.settings);
  return {cleaned,preserved,roots:document.querySelectorAll('#wjwk-root').length,oldEventsAborted:old.ui.eventController.signal.aborted,oldTimers:old.roleTimer===null&&old.syncTimer===null};
 });
 assert.deepEqual(result,{cleaned:true,preserved:true,roots:1,oldEventsAborted:true,oldTimers:true});
 await page.locator('[data-action="toggle"]').click();await page.locator('[data-action="theme"]').click();
 await page.locator('[data-action="set-theme"][data-theme="parchment"]').click();
 assert.equal(await page.locator('#wjwk-root').getAttribute('data-theme'),'parchment');
 await page.screenshot({path:resolve(out,'reinitialized-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:resolve(out,'reinitialized-mobile.png')});
 await page.evaluate(()=>wanjie_wuku_general_instance.destroy());
 await page.waitForTimeout(250);
 assert.equal(await page.locator('#wjwk-root').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: idempotent teardown, disconnected DOM and cancelled UI timers/events; reinitialize one working root with unchanged ledger/settings; desktop/mobile. Mock only.');
}finally{await browser?.close();server.close();}
