/**
 * Model.js — PURE business logic for Live SO Tracker.
 * No Apps Script APIs, no outer-scope references: ModelFactory must stay
 * self-contained so its source can be shipped to the browser via
 * ModelFactory.toString() and re-instantiated there.
 * Rules/aliases are passed in from Config.js; never hard-code them here.
 */
function ModelFactory() {
  'use strict';

  var VERSION = '0.1.0';

  return {
    VERSION: VERSION
  };
}

var Model = ModelFactory();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Model;
  module.exports.ModelFactory = ModelFactory;
}
