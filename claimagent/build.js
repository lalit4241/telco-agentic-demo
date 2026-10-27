// Build a single offline file (dist/index.html + index.html) behind the same kind of client-side password
// gate as TelForce / IntentBridge, but with ClaimAgent's own password. The app markup + JS are AES-256-GCM
// encrypted with a PBKDF2-SHA-256 key derived from the password. The password comes from
// $CLAIMAGENT_DEMO_PASSWORD or a git-ignored claimagent/.demo-password file only (deliberately no fallback
// to the shared TF_DEMO_PASSWORD or intentbridge/.demo-password). It is never written into the page.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const R = (...p) => path.join(__dirname, ...p);
const readPw = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '');
const pw = process.env.CLAIMAGENT_DEMO_PASSWORD || readPw(R('.demo-password'));
if (!pw) { console.error('Set CLAIMAGENT_DEMO_PASSWORD or create claimagent/.demo-password (git-ignored) before building.'); process.exit(1); }

const bundled = esbuild.buildSync({
  absWorkingDir: __dirname,
  entryPoints: [R('src', 'app.js')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  write: false,
  legalComments: 'none',
});
const js = bundled.outputFiles[0].text;
const appHtml = fs.readFileSync(R('src', 'app.template.html'), 'utf8');
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), iter = 250000, hsalt = crypto.randomBytes(16).toString('hex');
const key = crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256');
const c = crypto.createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([c.update(JSON.stringify({ html: appHtml, js }), 'utf8'), c.final(), c.getAuthTag()]);
const payload = { v: 1, iter, salt: salt.toString('base64'), iv: iv.toString('base64'), hsalt, hash: crypto.createHash('sha256').update(hsalt + pw).digest('hex'), ct: ct.toString('base64') };
const gate = fs.readFileSync(R('src', 'gate.js'), 'utf8').replace('/*PAYLOAD*/null', () => JSON.stringify(payload)).replace(/<\/script/gi, '<\\/script');
const fav = "data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect rx='6' width='32' height='32' fill='#0e7c86'/><text x='16' y='22' text-anchor='middle' font-family='Segoe UI,sans-serif' font-size='14' font-weight='700' fill='white'>CA</text></svg>");
const html = fs.readFileSync(R('src', 'index.template.html'), 'utf8')
  .replace('/*CSS*/', () => fs.readFileSync(R('src', 'styles.css'), 'utf8'))
  .replace('/*FAVICON*/', fav)
  .replace('/*GATE*/', () => gate);
if (gate.includes(pw) || html.includes(pw)) { console.error('Refusing to write: password found in output'); process.exit(1); }
for (const needle of ['Mrs Ellis', 'HO-26-000101', 'ignore all previous', 'Tech Mahindra', 'TechM']) {
  if (html.includes(needle)) { console.error('Refusing to write: cleartext demo content in output: ' + needle); process.exit(1); }
}
fs.mkdirSync(R('dist'), { recursive: true });
fs.writeFileSync(R('dist', 'index.html'), html);
fs.writeFileSync(R('index.html'), html);
console.log('dist/index.html + index.html', (html.length / 1024).toFixed(1) + ' KB (app encrypted, AES-256-GCM, PBKDF2 ' + iter + ')');
