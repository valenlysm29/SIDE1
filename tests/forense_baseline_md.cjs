'use strict';
// Reproduce pre-existing production-test failures with the financial engine at 9c8d176.
const path=require('node:path'),Module=require('node:module'),{execFileSync}=require('node:child_process');
const file=path.resolve('js/financial_model.js'),baseline=new Module(file);
baseline.filename=file;baseline.paths=Module._nodeModulePaths(path.dirname(file));
baseline._compile(execFileSync('git',['show','9c8d176:js/financial_model.js'],{encoding:'utf8'}),file);
baseline.loaded=true;require.cache[file]=baseline;
require('./md_logic.test.cjs');
