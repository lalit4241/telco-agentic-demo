// Build a single offline file (dist/index.html + index.html) behind a light client-side password gate.
// The app markup + JS are AES-256-GCM encrypted with a PBKDF2-SHA-256 key derived from the password.
// The password comes from $TF_DEMO_PASSWORD or the git-ignored .demo-password file; it is never written out.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const R = (...p) => path.join(__dirname, ...p);
const src = (f) => fs.readFileSync(R('src', f), 'utf8');
const pw = process.env.TF_DEMO_PASSWORD || (fs.existsSync(R('.demo-password')) ? fs.readFileSync(R('.demo-password'), 'utf8').trim() : '');
if (!pw) { console.error('Set TF_DEMO_PASSWORD or create .demo-password (git-ignored) before building.'); process.exit(1); }
let n = 0;
const svg = (f) => { const k = ++n; return fs.readFileSync(R('docs', 'brand', f), 'utf8').trim().replace(/<svg /, '<svg aria-hidden="true" focusable="false" ')
  .replace(/id="(\w+)"/g, (m, id) => `id="${id}-${k}"`).replace(/url\(#(\w+)\)/g, (m, id) => `url(#${id}-${k})`); };
const js = ['sha256.js', 'data.js', 'engine.js', 'telcoforce.js', 'ui.js'].map(src).join('\n;\n');
const appHtml = src('app.template.html').replace(/\/\*TFMARK\*\//g, () => svg('telforce-mark.svg'));
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), iter = 250000, hsalt = crypto.randomBytes(16).toString('hex');
const key = crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256');
const c = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([c.update(JSON.stringify({ html: appHtml, js }), 'utf8'), c.final(), c.getAuthTag()]);
const payload = { v: 1, iter, salt: salt.toString('base64'), iv: iv.toString('base64'), hsalt, hash: crypto.createHash('sha256').update(hsalt + pw).digest('hex'), ct: ct.toString('base64') };
const gate = src('gate.js').replace('/*PAYLOAD*/null', () => JSON.stringify(payload)).replace(/<\/script/gi, '<\\/script');
const fav = 'data:image/svg+xml,' + encodeURIComponent(fs.readFileSync(R('docs', 'brand', 'favicon.svg'), 'utf8').trim());
const html = src('index.template.html').replace('/*CSS*/', () => src('styles.css')).replace('/*FAVICON*/', fav)
  .replace('/*TFLOCKUP*/', () => svg('telforce-lockup-light.svg')).replace('/*GATE*/', () => gate);
if (html.includes(pw)) { console.error('Refusing to write: password found in output'); process.exit(1); }
fs.mkdirSync(R('dist'), { recursive: true });
fs.writeFileSync(R('dist', 'index.html'), html);
fs.writeFileSync(R('index.html'), html);
console.log('dist/index.html + index.html', (html.length / 1024).toFixed(1) + ' KB (app encrypted, AES-256-GCM, PBKDF2 ' + iter + ')');
