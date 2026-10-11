// Redirect existing QA outputs to this review without touching historical evidence.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const existsOriginal = fs.existsSync.bind(fs);
const destination = path.join(root, 'tests', 'output', 'revision-2026-10-05');
const targets = [[path.join(root, 'tests', 'output'), path.join(destination, 'isolated')], [path.join(root, 'output', 'pdf'), path.join(destination, 'pdf')]];
function redirect(value) {
  if (typeof value !== 'string') return value;
  const absolute = path.resolve(value);
  if (absolute === destination || absolute.startsWith(destination + path.sep)) return value;
  for (const [source, target] of targets) if (absolute === source || absolute.startsWith(source + path.sep)) return path.join(target, path.relative(source, absolute));
  return value;
}
for (const object of [fs, fs.promises]) for (const name of ['mkdir','mkdirSync','writeFile','writeFileSync','appendFile','appendFileSync','createWriteStream','createReadStream','readFile','readFileSync','readdir','readdirSync','existsSync','stat','statSync','access','accessSync','open','openSync','unlink','unlinkSync','rm','rmSync','utimes','utimesSync']) {
  if (typeof object[name] !== 'function') continue;
  const original = object[name].bind(object);
  object[name] = (file, ...args) => {
    let target = redirect(file);
    // Some delivered suites consume historical HTML fixtures as input. They
    // may be read from the original location; outputs still stay isolated.
    if (['readFile','readFileSync','createReadStream'].includes(name) && typeof file === 'string' && /\.(?:html|js)$/.test(file) && target !== file && !existsOriginal(target)) target = file;
    return original(target, ...args);
  };
}
// External PDF readers receive the same isolated filename as Node writers.
const childProcess = require('node:child_process');
for (const name of ['execFile','execFileSync','spawn','spawnSync']) {
  const original = childProcess[name].bind(childProcess);
  childProcess[name] = (command, args, ...rest) => original(command, Array.isArray(args) ? args.map((value, index) => {
    if (typeof value !== 'string') return value;
    if (path.isAbsolute(value)) return redirect(value);
    if (/python(?:\.exe)?$/i.test(command) && args[index - 1] === '-c') return value.replaceAll("Path('tests/output/", "Path('tests/output/revision-2026-10-05/isolated/");
    return value;
  }) : args, ...rest);
}
// Download.saveAs sends its path to Playwright's driver instead of using this
// process's fs functions. Give that suite concrete isolated output paths too.
const Module = require('node:module');
const compileOriginal = Module.prototype._compile;
Module.prototype._compile = function(content, filename) {
  if (filename === path.join(root, 'tests', 'teacher_report_pdf_ui.cjs')) content = content
    .replace("path.join(__dirname,'output/teacher-pdf')", "path.join(__dirname,'output/revision-2026-10-05/isolated/teacher-pdf')")
    .replace("path.join(root,'output/pdf')", "path.join(root,'tests/output/revision-2026-10-05/pdf')");
  return compileOriginal.call(this, content, filename);
};
for (const name of ['copyFile','copyFileSync','rename','renameSync']) if (fs[name]) {
  const original = fs[name].bind(fs);
  fs[name] = (from, to, ...args) => original(redirect(from), redirect(to), ...args);
}
