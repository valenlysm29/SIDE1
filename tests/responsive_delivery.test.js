const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const responsivePath = path.join(root, 'responsive.css');
const responsive = fs.readFileSync(responsivePath, 'utf8');

test('student and teacher pages load the final responsive layer', () => {
  for (const file of ['index.html', 'docente.html']) {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(html, /<meta\s+name="viewport"[^>]*width=device-width/i);
    assert.match(html, /href="responsive\.css\?v=20260908-2"/);
  }
});

test('responsive layer covers target widths, orientation and accessibility preferences', () => {
  for (const query of [
    '@media (max-width: 1180px)',
    '@media (max-width: 820px)',
    '@media (max-width: 600px)',
    '@media (max-width: 380px)',
    '@media (max-height: 560px) and (orientation: landscape)',
    '@media (pointer: coarse)',
    '@media (prefers-reduced-motion: reduce)'
  ]) {
    assert.ok(responsive.includes(query), `Missing responsive query: ${query}`);
  }
});

test('responsive layer addresses every primary product surface', () => {
  for (const selector of [
    '.landing-content',
    '.profile-main',
    '.student-join-modal',
    '.tutorial-shell',
    '#decisionMenu .decision-topbar',
    '.company-summary',
    '.sim3d-hud',
    '.sidebar',
    '.content'
  ]) {
    assert.ok(responsive.includes(selector), `Missing primary surface: ${selector}`);
  }
});

test('responsive CSS has balanced blocks and no remote asset references', () => {
  const withoutComments = responsive.replace(/\/\*[\s\S]*?\*\//g, '');
  const opens = (withoutComments.match(/{/g) || []).length;
  const closes = (withoutComments.match(/}/g) || []).length;
  assert.equal(opens, closes);
  assert.doesNotMatch(responsive, /url\(\s*['"]?https?:/i);
});
