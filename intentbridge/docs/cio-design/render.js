// Renders the CIO SVGs to PNG (1080p and 4K) and PDF with headless Chrome.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const D = __dirname, CHROME = process.env.CHROME || '/usr/bin/google-chrome';
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const html = f => `<!doctype html><html><head><style>@page{size:1920px 1080px;margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${fs.readFileSync(path.join(D, f), 'utf8')}</body></html>`;
  for (const [name, scales, pdf] of [['intentbridge-cio-architecture', [1, 2], true], ['intentbridge-cio-one-glance', [1, 2], true]]) {
    for (const s of scales) {
      const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: s });
      await p.setContent(html(name + '.svg')); await p.evaluate(() => document.fonts.ready);
      await p.screenshot({ path: path.join(D, name + (s === 2 ? '@4k' : '') + '.png') }); await p.close();
    }
    if (pdf) {
      const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
      await p.setContent(html(name + '.svg')); await p.evaluate(() => document.fonts.ready);
      await p.pdf({ path: path.join(D, name + '.pdf'), width: '1920px', height: '1080px', printBackground: true, pageRanges: '1' }); await p.close();
    }
  }
  await b.close(); console.log('rendered');
})();
