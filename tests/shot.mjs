// Utilitário de inspeção visual: abre o jogo no WebKit (iPhone) e tira capturas.
import { webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
const OUT = process.env.SHOT_DIR || 'tests/shots';
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });
const port = 8099;
const srv = spawn(process.execPath, ['tools/serve.mjs', 'game', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices[process.env.DEVICE || 'iPhone 13'] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + e.stack));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(`http://localhost:${port}/`);
await page.waitForTimeout(800);
const steps = process.argv.slice(2);
let i = 0;
for (const st of steps) {
  if (st.startsWith('click:')) { await page.click(st.slice(6), { timeout: 3000 }).catch((e) => errors.push('click fail ' + st)); await page.waitForTimeout(400); }
  else if (st.startsWith('text:')) { await page.getByText(st.slice(5), { exact: false }).first().click({ timeout: 3000 }).catch((e) => errors.push('text fail ' + st)); await page.waitForTimeout(500); }
  else if (st.startsWith('tap:')) { const [x, y] = st.slice(4).split(',').map(Number); await page.mouse.click(x, y); await page.waitForTimeout(500); }
  else if (st.startsWith('tile:')) {
    const [tx, ty] = st.slice(5).split(',').map(Number);
    const box = await page.locator('canvas.board').boundingBox();
    const T = box.width / 7;
    await page.mouse.click(box.x + T * tx + T / 2, box.y + T * ty + T / 2);
    await page.waitForTimeout(700);
  }
  else if (st.startsWith('act:')) { await page.locator('.act', { hasText: st.slice(4) }).first().click({ timeout: 3000 }).catch((e) => errors.push('act fail ' + st)); await page.waitForTimeout(500); }
  else if (st.startsWith('wait:')) await page.waitForTimeout(Number(st.slice(5)));
  else if (st.startsWith('eval:')) { const r = await page.evaluate(st.slice(5)).catch((e) => 'ERR ' + e.message); console.log('eval =>', JSON.stringify(r)); }
  else if (st.startsWith('shot:')) { await page.screenshot({ path: `${OUT}/${st.slice(5)}.png` }); console.log('shot', st.slice(5)); }
  i++;
}
console.log(errors.length ? errors.join('\n') : 'sem erros');
await browser.close();
srv.kill();
