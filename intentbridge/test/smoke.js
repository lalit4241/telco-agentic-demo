// Headless-Chrome smoke test of dist/index.html using playwright-core + system Chrome.
const { chromium } = require('playwright-core');
const path = require('path'), fs = require('fs');
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const URL = process.env.URL || 'file://' + path.join(__dirname, '..', 'dist', 'index.html');
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
  await page.goto(URL);
  await page.waitForSelector('#kpis .kpi');
  check('Page loads with KPI strip', (await page.$$('#kpis .kpi')).length >= 10);

  // Journey A step by step until the human step
  await page.click('[data-scen="b2b"]');
  for (let i = 0; i < 7; i++) await page.click('#btn-step');
  const st = await page.getAttribute('#run-status', 'data-status');
  check('Journey A pauses for AM confirmation', st === 'waiting', st);
  const seqArrows = await page.$$eval('#seq svg line', (l) => l.length);
  check('Sequence diagram rendered', seqArrows > 10, seqArrows + ' lines');
  await page.click('nav button[data-tab="queue"]');
  await page.click('[data-approve]');
  await page.click('nav button[data-tab="demo"]');
  await page.click('#btn-run');
  check('Journey A completes after approval', (await page.getAttribute('#run-status', 'data-status')) === 'done');
  const evText = await page.textContent('#events');
  check('Trace shows TMF921, TMF648, TMF641, TMF656', ['TMF921', 'TMF648', 'TMF641', 'TMF656'].every((t) => evText.includes(t)));

  // Journey B over cap -> supervisor
  await page.click('[data-scen="consumer"]');
  await page.selectOption('#param-customer', 'CUST-1004');
  await page.click('#btn-run');
  check('Journey B (over cap) completes', (await page.getAttribute('#run-status', 'data-status')) === 'done');
  await page.click('nav button[data-tab="queue"]');
  const qText = await page.textContent('#tab');
  check('£72.50 credit waiting for supervisor', qText.includes('£72.50') && qText.includes('Credit above cap'));
  const pendingBefore = await page.$$eval('[data-approve]', (b) => b.length);
  await page.click('.qitem:has-text("£72.50") [data-approve]');
  const pendingAfter = await page.$$eval('[data-approve]', (b) => b.length);
  check('Approving changes state', pendingAfter === pendingBefore - 1 && (await page.textContent('#tab')).includes('created ADJ-'));

  // Other scenarios
  for (const [scen, param] of [['consumer', 'CUST-1001'], ['consumer', 'CUST-1002'], ['consumer', 'CUST-1003'], ['noc'], ['field'], ['product'], ['care']]) {
    await page.click('nav button[data-tab="demo"]');
    await page.click(`[data-scen="${scen}"]`);
    if (param) await page.selectOption('#param-customer', param);
    await page.click('#btn-run');
    const s = await page.getAttribute('#run-status', 'data-status');
    check(`Scenario ${scen}${param ? ' ' + param : ''} completes`, s === 'done', s);
  }
  await page.click('[data-surf="slack"]');
  const surf = await page.textContent('#surface');
  check('Slackforce (simulated) shows channel messages', surf.includes('#noc-major-incidents'));

  // Fabric: audit chain
  await page.click('nav button[data-tab="fabric"]');
  check('Audit chain intact', (await page.textContent('#verify-out')).includes('intact'));
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'fabric.png'), fullPage: false });
  await page.click('#btn-tamper');
  check('Tampering detected', (await page.textContent('#verify-out')).includes('broken'));

  // Evals
  await page.click('nav button[data-tab="evals"]');
  await page.click('#btn-evals');
  const score = await page.textContent('#eval-score');
  check('Agent Evals all pass', /^(\d+) \/ \1 passed$/.test(score.trim()), score);

  // CIO
  await page.click('nav button[data-tab="cio"]');
  check('CIO calculator base total £59.0m', (await page.textContent('#calc-total')) === '£59.0m');
  await page.click('[data-preset="stretch"]');
  const stretch = await page.textContent('#calc-total');
  check('Preset changes the total', stretch !== '£59.0m', stretch);
  await page.click('[data-preset="base"]');
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'cio.png') });

  // API explorer
  await page.click('nav button[data-tab="api"]');
  await page.selectOption('#api-tool', 'bill.list');
  await page.selectOption('#api-agent', 'billing');
  await page.click('#btn-api');
  check('API explorer returns TMF678 JSON', (await page.textContent('#api-out')).includes('CustomerBill'));

  // Final demo screenshot: fresh run of Journey B for Sarah
  await page.click('#btn-reset');
  await page.click('nav button[data-tab="demo"]');
  await page.click('[data-scen="consumer"]');
  await page.selectOption('#param-customer', 'CUST-1004');
  await page.click('#btn-run');
  await page.click('[data-surf="customer"]');
  await page.click('.events details');
  await page.screenshot({ path: path.join(__dirname, '..', 'docs', 'live-demo.png') });

  check('No console errors', errors.length === 0, errors.join(' | '));
  fs.writeFileSync(path.join(__dirname, '..', 'test', 'smoke-results.json'), JSON.stringify({ url: URL, chrome: CHROME, at: new Date().toISOString(), results, errors }, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} smoke checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
