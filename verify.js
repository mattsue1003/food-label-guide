// 交付前檢查：頁數、每頁不溢出（含作答後）、自動作答拿滿星、零 JS 錯誤、手機不橫向溢出
//   NODE_PATH=<含 puppeteer-core 的 node_modules> node verify.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = 'file://' + path.join(__dirname, 'index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({executablePath: CHROME, headless: 'new'});
  let fail = 0;
  for (const [w, h] of [[1280, 720], [1600, 900], [390, 844]]) {
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await page.setViewport({width: w, height: h});
    await page.goto(URL, {waitUntil: 'load'});
    await sleep(400);
    const n = await page.evaluate(() => DECK.slides.length);
    const mob = await page.evaluate(() => document.body.classList.contains('mob'));
    const over = [];
    const check = async (k, tag) => {
      const r = await page.evaluate(() => { const d = document.querySelector('.slide.on');
        return {sh: d.scrollHeight, ch: d.clientHeight, sw: d.scrollWidth, cw: d.clientWidth}; });
      if (mob ? r.sw > r.cw + 1 : (r.sh > r.ch + 1 || r.sw > r.cw + 1)) over.push(`${k + 1}${tag}(${r.sh}/${r.ch},${r.sw}/${r.cw})`);
    };
    for (let k = 0; k < n; k++) {
      await page.evaluate(k => go(k), k); await sleep(120);
      await check(k, '');
      const t = await page.evaluate(k => DECK.slides[k].t, k);
      const click = sel => page.evaluate(sel => { const e = document.querySelector('.slide.on ' + sel); if (!e) throw new Error('missing ' + sel); e.click(); }, sel);
      if (t === 'choice') { const a = await page.evaluate(k => DECK.slides[k].ans, k); await click(`.opt[data-i="${a}"]`); }
      if (t === 'fill') {
        const ans = await page.evaluate(k => DECK.slides[k].lines.map(l => l.ans), k);
        for (const a of ans) await click(`.tile[data-w="${a}"]`);
        await click('.ck');
      }
      if (t === 'order') { const m = await page.evaluate(k => DECK.slides[k].items.length, k); for (let i = 0; i < m; i++) await click(`.tile[data-i="${i}"]`); await click('.ck'); }
      if (t === 'spot') { const ws = await page.evaluate(k => DECK.slides[k].cards.map((c, i) => c.w ? i : -1).filter(i => i >= 0), k); for (const i of ws) await click(`.scard[data-i="${i}"]`); }
      if (t === 'sort') {
        const its = await page.evaluate(k => DECK.slides[k].items.map(x => x.b), k);
        for (let i = 0; i < its.length; i++) { await click(`.pool .tile[data-i="${i}"]`); await click(`.bin[data-b="${its[i]}"]`); }
        await click('.ck');
      }
      if (t === 'movie') { await click('.tovote'); await click('.vo[data-i="0"]'); }
      if (['choice', 'fill', 'order', 'spot', 'sort', 'movie'].includes(t)) {
        await sleep(1300);
        await page.evaluate(() => { if (document.querySelector('#ans.on')) hideAns(); });
        await sleep(150);
        await check(k, '作答後');
      }
    }
    const [star, max] = await page.evaluate(() => [star, maxStar]);
    const ok = over.length === 0 && errs.length === 0 && star === max && n === 24;
    if (!ok) fail++;
    console.log(`${w}x${h}${mob ? '（手機模式）' : ''}  頁數 ${n}  星星 ${star}/${max}  溢出 ${over.length ? over.join(' ') : '無'}  JS 錯誤 ${errs.length ? errs.join(' | ') : '無'}  → ${ok ? 'OK' : '有問題'}`);
    await page.close();
  }
  // 講師手冊
  const p2 = await browser.newPage(); const e2 = [];
  p2.on('pageerror', e => e2.push(e.message));
  await p2.goto(URL + '#notes', {waitUntil: 'load'}); await sleep(300);
  const items = await p2.evaluate(() => document.querySelectorAll('.nt-it').length);
  console.log(`講師手冊 #notes：${items} 頁、JS 錯誤 ${e2.length ? e2.join(' | ') : '無'}`);
  if (items !== 24 || e2.length) fail++;
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
