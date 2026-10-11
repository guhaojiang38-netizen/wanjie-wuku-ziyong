import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.WJWK_NODE_MODULES+'/package.json');const {chromium}=require('playwright');
const server=createServer(async(req,res)=>{try{const path=resolve('.','.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(process.cwd()))throw Error('path');res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;try {
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);
 await page.locator('[data-action="toggle"]').waitFor();
 await page.evaluate(async()=>{
  const {AIActivity}=await import('/src/ai-activity.js');
  window.activity=new AIActivity(state=>globalThis.wanjie_wuku_general_instance.ui.setAIActivity(state));
  window.work=activity.run('自动更新 · 漫漫长路',()=>new Promise(resolve=>window.finish=resolve));
  activity.phase('等待 AI 回复');
 });
 const card=page.locator('.wjwk-ai-activity');await card.waitFor();assert.equal(await page.locator('.wjwk-window').isVisible(),false);
 await page.waitForTimeout(450);assert.match(await card.locator('[data-ai-time]').textContent(),/[0-9]+\.[0-9] 秒/);
 let box=await card.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391&&box.y+box.height<180);
 await page.evaluate(async()=>{finish();await work;});assert.equal(await card.getAttribute('data-status'),'success');
 await page.locator('[data-action="ai-status-close"]').click();assert.equal(await card.isVisible(),false);
 await page.evaluate(async()=>{await activity.run('校验结果',async()=>{throw Error('<img src=x onerror=alert(1)> 校验失败');}).catch(()=>{});});
 assert.equal(await card.getAttribute('data-status'),'error');assert.equal(await card.locator('img').count(),0);assert.match(await card.textContent(),/校验失败/);
 await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/ai-status-mobile.png'});
 await page.locator('[data-action="ai-status-close"]').click();
 await page.evaluate(()=>{window.work=activity.run('拟定安排',()=>new Promise(resolve=>window.finish=resolve));});
 await card.waitFor();await page.locator('[data-action="ai-status-close"]').click();
 assert.equal(await page.evaluate(()=>activity.current.status),'running');
 await page.evaluate(async()=>{finish();await work;});assert.equal(await card.isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS: closed-panel activity, elapsed timer, mobile bounds, success/error, safe text, dismiss without cancellation');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
