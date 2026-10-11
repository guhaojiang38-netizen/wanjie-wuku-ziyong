// Local visual checks; source themes are read as data, external requests are blocked.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, relative, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(process.env.WJWK_NODE_MODULES + '/package.json');
const { chromium } = require('playwright');
const output = process.env.WJWK_SCREENSHOTS;
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const path = resolve('.', '.' + decodeURIComponent(new URL(req.url, 'http://local').pathname));
    const rel = relative(process.cwd(), path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('path');
    res.setHeader('Content-Type', { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[extname(path)] || 'application/octet-stream');
    res.end(await readFile(path));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
let browser;
try {
  browser = await chromium.launch({ headless: true, executablePath: process.env.WJWK_BROWSER_EXECUTABLE });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [], results = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/tests/preview.html`);
  await page.locator('[data-action="toggle"]').click();
  await page.locator('[data-action="manage"]').first().click();
  await page.locator('[data-action="add-mmlc"]').click();
  await page.evaluate(async () => {
    const app = globalThis.wanjie_wuku_general_instance, { saveArchive, archiveSource } = await import('/src/archives.js');
    await app.store.transact(s => {
      const p = s.powers.builtin_mmlc_statistics;
      for (const [type, module, name, status, fields] of [
        ['environment', 'land', '青岚福地', 'active', { changes: '三亩灵田与引水渠已建成', conditions: '灵气稳定，东坡仍待开垦' }],
        ['member', 'sect', '青岚宗内门', 'active', { role: '十二名弟子，李青负责灵田' }],
        ['research', 'fleet', '玄黄舰', 'working', { progress: '舰体完成七成，阵法尚未装配' }]
      ]) saveArchive(p, { type, module, name, status, fields }, archiveSource(SillyTavern.getContext().chat, '固定演示'));
    }); app.settings.mode = 'st'; app.refresh();
  });
  const themes = ['双色盒子-浅色毛玻璃', '双色盒子-深色毛玻璃', '微信读书夜间模式', '微信读书护眼羊皮纸版', '微信读书护眼绿色版'];
  for (const [i, name] of themes.entries()) {
    const theme = JSON.parse((await readFile(resolve(process.env.WJWK_THEME_DIR, name + '.json'), 'utf8')).replace(/^\uFEFF/, ''));
    const vars = { '--SmartThemeBodyColor': theme.main_text_color, '--SmartThemeBlurTintColor': theme.blur_tint_color, '--SmartThemeQuoteColor': theme.quote_text_color };
    await page.evaluate(({ vars, css }) => {
      let style = document.querySelector('#test-theme');
      if (!style) { style = document.createElement('style'); style.id = 'test-theme'; document.head.append(style); }
      style.textContent = css;
      for (const [key, value] of Object.entries(vars)) document.documentElement.style.setProperty(key, value);
    }, { vars, css: theme.custom_css || '' });
    const colors = await page.evaluate(() => {
      const root = document.querySelector('.wjwk');
      const sample = document.createElement('span'); root.append(sample);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      const read = key => {
        sample.style.color = `var(${key})`;
        ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = getComputedStyle(sample).color; ctx.fillRect(0, 0, 1, 1);
        const rgba = [...ctx.getImageData(0, 0, 1, 1).data];
        assertOpaque(rgba); return `rgb(${rgba.slice(0, 3).join(',')})`;
      };
      const assertOpaque = rgba => { if (rgba[3] !== 255) throw Error('palette must be opaque'); };
      const result = Object.fromEntries(['--wk-bg', '--wk-text', '--wk-muted', '--wk-cyan', '--wk-error'].map(k => [k, read(k)]));
      sample.remove(); return result;
    });
    const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);
    const lum = value => rgb(value).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((a, v, i) => a + v * [.2126, .7152, .0722][i], 0);
    const contrast = key => { const a = lum(colors[key]), b = lum(colors['--wk-bg']); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    assert.ok(contrast('--wk-text') >= 4.5, `${name}: body contrast`);
    assert.ok(contrast('--wk-muted') >= 4.5, `${name}: muted contrast ${contrast('--wk-muted')}`);
    assert.ok(contrast('--wk-cyan') >= 4.5, `${name}: accent contrast`);
    const tile = await page.locator('.wjwk-mmlc-tile').first().evaluate(n => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      const rgb = value => { ctx.fillStyle = value; ctx.fillRect(0, 0, 1, 1); return `rgb(${[...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).join(',')})`; };
      return { bg: rgb(getComputedStyle(n).backgroundColor), text: rgb(getComputedStyle(n.querySelector('strong')).color) };
    });
    const tileA = lum(tile.bg), tileB = lum(tile.text);
    assert.ok((Math.max(tileA, tileB) + .05) / (Math.min(tileA, tileB) + .05) >= 4.5, `${name}: actual tile contrast ${JSON.stringify(tile)}`);
    assert.equal(await page.locator('.wjwk-mmlc-tile').count(), 8);
    await page.screenshot({ path: resolve(output, `theme-${i}-desktop.png`) });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => {
      const root = document.querySelector('.wjwk-window');
      return document.documentElement.scrollWidth <= innerWidth && root.scrollWidth <= root.clientWidth + 1;
    }), true, `${name}: narrow viewport overflow`);
    await page.screenshot({ path: resolve(output, `theme-${i}-mobile.png`) });
    await page.locator('.wjwk-mmlc-tile[data-section="land"]').click();
    await page.locator('.wjwk-current-overview [data-action="open-archive"]').first().click();
    await page.locator('.wjwk-modal:not([hidden])').waitFor();
    assert.ok(await page.locator('[name="name"]').count());
    await page.locator('[data-action="dialog-close"]').click();
    await page.locator('.wjwk-mmlc-back [data-action="mmlc-section"]').click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    results.push({ name, colors, bodyContrast: contrast('--wk-text'), mutedContrast: contrast('--wk-muted') });
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'theme-checks.json'), JSON.stringify(results, null, 2));
  console.log('PASS: five user themes, opaque readable palette, WCAG AA body/muted/accent contrast, 390px layout, eight MMLC modules and detail open/close. Mock host; external requests blocked.');
} finally { await browser?.close(); server.close(); }
