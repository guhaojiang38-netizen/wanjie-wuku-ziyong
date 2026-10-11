import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(process.env.WJWK_NODE_MODULES+'/package.json');const {chromium}=require('playwright');
const server=createServer(async(req,res)=>{try{const path=resolve('.','.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(process.cwd()))throw Error('path');res.setHeader('Content-Type',{'.js':'text/javascript','.css':'text/css','.html':'text/html'}[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.WJWK_BROWSER_EXECUTABLE});const page=await browser.newPage({viewport:{width:1400,height:980}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);await page.locator('[data-action="toggle"]').click();await page.locator('[data-action="manage"]').first().click();await page.locator('[data-action="add-mmlc"]').click();await page.getByRole('heading',{name:'漫漫长路',exact:true}).waitFor();
 await page.evaluate(async()=>{
 const app=globalThis.wanjie_wuku_general_instance,{saveArchive,archiveSource}=await import('/src/archives.js');
 await app.store.transact(next=>{const p=next.powers.builtin_mmlc_statistics;for(const [type,module,name,status,fields] of [
 ['environment','land','北坡生态区','active',{changes:'完成保温菌毯改造',conditions:'低温，需维持保温'}],
 ['population','land','耐寒工蜂','active',{scale:'二十只，其中两只休养',purpose:'北坡巡视',limits:'不能离开保温区'}],
 ['research','fleet','玄黄舰图纸','working',{progress:'图纸已完成，舰船尚未制造'}],
 ['member','sect','内门弟子','active',{role:'李青负责灵田，人数未明确'}],
 ['record','items','旧玉佩','ended',{description:'已经遗失'}]])saveArchive(p,{type,module,name,status,fields},archiveSource(SillyTavern.getContext().chat,'固定演示'));});app.refresh();
 });
 assert.equal(await page.locator('.wjwk-mmlc-tile').count(),8);assert.match(await page.locator('.wjwk-mmlc-tile[data-section="fleet"]').textContent(),/0 项成果/);assert.match(await page.locator('.wjwk-mmlc-tile[data-section="fleet"]').textContent(),/图纸已完成，舰船尚未制造/);
 assert.match(await page.locator('.wjwk-mmlc-tile[data-section="sect"]').textContent(),/人数未明确/);
 await page.locator('.wjwk-mmlc-tile[data-section="land"]').click();await page.locator('.wjwk-current-overview').waitFor();assert.match(await page.locator('.wjwk-current-overview').textContent(),/二十只，其中两只休养/);assert.match(await page.locator('.wjwk-current-overview').textContent(),/不能离开保温区/);
 await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/overview-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:process.env.WJWK_SCREENSHOTS+'/overview-mobile.png',fullPage:true});
 await page.locator('.wjwk-current-overview [data-action="open-archive"]').filter({hasText:'查看详情'}).first().click();await page.locator('.wjwk-modal').waitFor();assert.ok(await page.locator('[name="name"]').count());await page.locator('[data-action="dialog-close"]').click();
 await page.evaluate(()=>{const app=globalThis.wanjie_wuku_general_instance;SillyTavern.getContext().chat[0].swipe_id=1;app.refresh();});assert.match(await page.locator('.wjwk-current-overview').textContent(),/来源待核对/);assert.doesNotMatch(await page.locator('.wjwk-current-overview').textContent(),/二十只/);
 assert.deepEqual(errors,[]);console.log('PASS: module summaries distinguish owned/planned/working/ended, literal quantities/limits, desktop/mobile, detail navigation, changed-source removal; mock only');
}finally{await browser?.close();server.close();}
