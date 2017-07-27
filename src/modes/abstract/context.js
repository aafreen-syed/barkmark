'use strict';

function Context (mode, editor, options) {
  this.mode = mode;
  this.editor = editor;
  this.options = options || {};
}

Context.prototype.wrap = function () {
  return '';
};

Context.prototype.unwrap = function () {
  return '';
};

Context.prototype.isActive = function () {
  return false;
};

Context.prototype.isAvailable = function () {
  return true;
};

Context.prototype.allowPhrasingEdits = function () {
  return true;
};

module.exports = Context;
