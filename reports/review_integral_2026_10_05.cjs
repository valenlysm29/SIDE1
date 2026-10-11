// Run the delivered suites sequentially with output isolation, avoiding a broad
// copy of historical OneDrive evidence. Application and original tests are intact.
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const preload = path.join(__dirname, 'review_output_isolation_2026_10_05.cjs');
process.env.NODE_OPTIONS = ((process.env.NODE_OPTIONS || '') + ' --require ' + JSON.stringify(preload)).trim();
require(preload);
const filename = path.join(root, 'tests', 'run_integral.cjs');
const source = fs.readFileSync(filename, 'utf8')
  .replace('backupOutputs();save();', "preservation={isolatedOutput:true, historicalOutputsUntouched:true};save();")
  .replaceAll('preserveEvidence();', '')
  .replaceAll('restoreOutputs();', '');
const runner = new Module(filename, module);
runner.filename = filename;
runner.paths = Module._nodeModulePaths(path.dirname(filename));
runner._compile(source, filename);
