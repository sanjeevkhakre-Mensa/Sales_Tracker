'use strict';
// Loads src/Model.js the three ways it runs in production:
//  - node:    require() (CommonJS export)
//  - gas:     plain script in a shared global scope (Apps Script V8)
//  - browser: ModelFactory.toString() injected into a fresh context
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MODEL_PATH = path.join(__dirname, '..', '..', 'src', 'Model.js');

function source() {
  return fs.readFileSync(MODEL_PATH, 'utf8');
}

function loadNode() {
  delete require.cache[require.resolve(MODEL_PATH)];
  return require(MODEL_PATH);
}

function loadGas() {
  const ctx = vm.createContext({});
  vm.runInContext(source(), ctx, { filename: 'Model.js' });
  return { Model: ctx.Model, ModelFactory: ctx.ModelFactory };
}

function loadBrowser() {
  const { ModelFactory } = loadGas();
  const ctx = vm.createContext({});
  vm.runInContext('var Model = (' + ModelFactory.toString() + ')();', ctx, { filename: 'App.html' });
  return ctx.Model;
}

module.exports = { MODEL_PATH, source, loadNode, loadGas, loadBrowser, Model: loadNode() };
