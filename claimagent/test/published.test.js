import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('published page uses the same AES-GCM gate and does not contain the demo in clear text', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /AES-256-GCM/);
  assert.match(html, /PBKDF2/);
  assert.match(html, /ClaimAgent/);
  assert.match(html, /Synthetic demo data/);
  assert.doesNotMatch(html, /Mrs Ellis/);
  assert.doesNotMatch(html, /HO-26-000101/);
  assert.doesNotMatch(html, /ignore all previous/i);
  assert.doesNotMatch(html, /Tech Mahindra|TechM/);
  const pwFile = new URL('../.demo-password', import.meta.url);
  if (fs.existsSync(pwFile)) assert.equal(html.includes(fs.readFileSync(pwFile, 'utf8').trim()), false);
});
