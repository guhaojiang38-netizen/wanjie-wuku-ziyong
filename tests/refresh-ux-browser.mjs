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
 await page.locator('[data-action="toggle"]').click();
 await page.addStyleTag({content:'.wjwk-main{max-height:180px!important;overflow:auto!important}.wjwk-sidebar{max-height:150px!important;overflow:auto!important}'});
 const run=await page.evaluate(async()=>{
  const app=wanjie_wuku_general_instance,ui=app.ui;
  const {createPower,importBook}=await import('/src/core.js');
  const power=createPower(importBook({entries:{1:{comment:'自编测试金手指',content:'根据已掌握能力消耗源质，推演下一阶段修行。'}}},'自编测试书')[0]);
  await app.store.transact(s=>{s.powers[power.id]=power;});
  ui.space='wuku';ui.tab='operations';app.powerId=power.id;app.refresh();
  ui.panel.querySelector('.wjwk-sidebar-tools').open=true;
  const field=ui.panel.querySelector('[data-goal]');field.value='准备推演新的修行方向';field.dispatchEvent(new Event('input',{bubbles:true}));field.focus();field.setSelectionRange(2,6,'backward');
  ui.panel.querySelector('.wjwk-main').scrollTop=85;ui.panel.querySelector('.wjwk-sidebar').scrollTop=65;
  const before={main:ui.panel.querySelector('.wjwk-main').scrollTop,side:ui.panel.querySelector('.wjwk-sidebar').scrollTop};
  app.refresh();await new Promise(r=>setTimeout(r,30));
  const fresh=ui.panel.querySelector('[data-goal]');
  return {before,after:{main:ui.panel.querySelector('.wjwk-main').scrollTop,side:ui.panel.querySelector('.wjwk-sidebar').scrollTop},open:ui.panel.querySelector('.wjwk-sidebar-tools').open,focused:document.activeElement===fresh,value:fresh.value,start:fresh.selectionStart,end:fresh.selectionEnd,direction:fresh.selectionDirection};
 });
 if(process.env.WJWK_REPRO_ONLY){console.log(JSON.stringify(run));}
 else{
  assert.ok(run.before.main>0&&run.before.side>0);assert.deepEqual(run.after,run.before);assert.equal(run.open,true);assert.equal(run.focused,true);assert.equal(run.value,'准备推演新的修行方向');assert.equal(run.start,2);assert.equal(run.end,6);assert.equal(run.direction,'backward');
  const scoped=await page.evaluate(async()=>{
   const app=wanjie_wuku_general_instance,ui=app.ui;
   ui.tab='management';app.refresh();
   const scopeReset=!ui.panel.querySelector('.wjwk-sidebar-tools').open;
   const legacy=ui.panel.querySelector('[data-legacy-management]');if(legacy)legacy.open=true;
   await new Promise(r=>setTimeout(r,25));app.refresh();await new Promise(r=>setTimeout(r,25));
   const restored=ui.panel.querySelector('[data-legacy-management]');
   const lazy=!restored||restored.open&&restored.querySelector('[data-legacy-content]').innerHTML.length>0;
   await app.action('settings',{});const key=ui.modal.querySelector('[name="profileName"]');key.focus();key.value='synthetic-unsaved';app.refresh();
   const modal=document.activeElement===key&&key.value==='synthetic-unsaved';ui.closeDialog();
   const oldId=app.currentKey;SillyTavern.getContext().chatId='refresh-ux-another-chat';app.refresh();
   return {scopeReset,lazy,modal,chatReset:oldId!==app.currentKey&&!ui.panel.querySelector('.wjwk-sidebar-tools')?.open};
  });
  assert.deepEqual(scoped,{scopeReset:true,lazy:true,modal:true,chatReset:true});
  assert.equal(await page.evaluate(()=>{
   const ui=wanjie_wuku_general_instance.ui,main=ui.panel.querySelector('.wjwk-main');
   main.insertAdjacentHTML('beforeend','<details open><summary>duplicate identity</summary></details><details><summary>duplicate identity</summary></details>');
   const twins=[...main.querySelectorAll('details')].filter(n=>n.querySelector('summary')?.textContent==='duplicate identity');
   const saved=ui.capturePanel();twins[0].remove();ui.restorePanel(saved);const untouched=!twins[1].open;twins[1].remove();return untouched;
  }),true);
  await page.screenshot({path:resolve(out,'refresh-desktop.png')});await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>{
   const app=wanjie_wuku_general_instance,ui=app.ui;ui.space='wuku';ui.tab='operations';app.refresh();
   const field=ui.panel.querySelector('[data-goal]');field.focus();field.setSelectionRange(1,4);
   const main=ui.panel.querySelector('.wjwk-main');main.scrollTop=55;const top=main.scrollTop;
   app.refresh();const fresh=ui.panel.querySelector('[data-goal]');
   return top>0&&ui.panel.querySelector('.wjwk-main').scrollTop===top&&document.activeElement===fresh&&fresh.selectionStart===1&&fresh.selectionEnd===4;
  });assert.equal(mobile,true);
  await page.screenshot({path:resolve(out,'refresh-mobile.png')});
  assert.deepEqual(errors,[]);console.log('PASS: same-scope scroll/details/focus/caret preservation, lazy details, modal isolation, tab/chat reset. Mock only.');
 }
}finally{await browser?.close();server.close();}
