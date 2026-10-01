'use strict';
// Serve a historical code snapshot in memory, preserving the working tree and
// sharing the exact same local binary assets for before/after browser checks.
const {execFileSync} = require('node:child_process');

function browserGitBaseline(root, ref) {
  const sources = new Map();
  if (!ref) return sources;
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', ref, '--', 'index.html', 'js', 'services', 'css'], {cwd: root, encoding: 'utf8'}).trim().split(/\r?\n/);
  for (const file of files.filter(file => /\.(?:html|js|mjs|css)$/.test(file))) {
    sources.set('/' + file, execFileSync('git', ['show', `${ref}:${file}`], {cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024}));
  }
  return sources;
}

module.exports = {browserGitBaseline};
