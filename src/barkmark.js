'use strict';

var Manager = require('./manager');

var manager = new Manager();

function barkmark (textarea, options) {
  return manager.get(textarea, options);
}

barkmark.find = function (textarea) {
  return manager.find(textarea);
};

barkmark.strings = require('./strings');

module.exports = barkmark;
