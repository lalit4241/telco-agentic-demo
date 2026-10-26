// Render TelForce brand SVGs to PNG (512/1024), favicons, and preview.png with headless Chrome.
const { chromium } = require('playwright-core');
const fs = require('fs'), path = require('path');
const D = __dirname, CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const read = (f) => fs.readFileSync(path.join(D, f), 'utf8');
(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage();
  const shot = async (svgFile, w, h, out) => {
    await p.setViewportSize({ width: w, height: h });
    const s = read(svgFile).replace(/width="\d+" height="\d+"/, `width="${w}" height="${h}"`);
    await p.setContent(`<html><body style="margin:0;background:transparent">${s}</body></html>`);
    await p.screenshot({ path: path.join(D, out), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  for (const s of [512, 1024]) await shot('telforce-mark.svg', s, s, `telforce-mark-${s}.png`);
  for (const n of ['telforce-lockup-light', 'telforce-lockup-dark']) for (const w of [512, 1024]) await shot(n + '.svg', w, Math.round(w * 128 / 640), `${n}-${w}.png`);
  for (const s of [32, 180]) await shot('favicon.svg', s, s, s === 180 ? 'apple-touch-icon.png' : 'favicon-32.png');
  await p.setViewportSize({ width: 1400, height: 460 });
  const sz = (f, w) => read(f).replace(/width="(\d+)" height="(\d+)"/, (m, a, c) => `width="${w}" height="${Math.round(w * c / a)}"`);
  const col = (bg, lbl, lk) => `<div style="background:${bg};padding:44px;display:flex;flex-direction:column;gap:30px">
    <div style="font-size:13px;letter-spacing:2px;color:${lbl};font-weight:600">${bg === '#fff' ? 'ON LIGHT' : 'ON DARK'}</div>
    <div style="display:flex;gap:28px;align-items:flex-end">${sz('telforce-mark.svg', 150)}${sz('telforce-mark.svg', 64)}${sz('favicon.svg', 32)}</div>
    ${sz(lk, 580)}</div>`;
  await p.setContent(`<html><body style="margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif">
  <div style="display:grid;grid-template-columns:1fr 1fr;height:460px">${col('#fff', '#5a6a85', 'telforce-lockup-light.svg')}${col('#032D60', '#90D0FE', 'telforce-lockup-dark.svg')}</div>
  <div style="position:absolute;bottom:12px;left:44px;font-size:11px;max-width:600px;color:#5a6a85;background:#fff;padding:4px 10px;border-radius:6px">TelForce: original artwork · #0176D3 #032D60 #90D0FE · not Salesforce or TM Forum artwork</div>
  </body></html>`);
  await p.screenshot({ path: path.join(D, 'preview.png') });
  await b.close();
  console.log('rendered PNGs + preview.png');
})();
