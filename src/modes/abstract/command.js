'use strict';

function Command (mode, editor, options) {
  this.mode = mode;
  this.editor = editor;
  this.options = options || {};
  this.boundExecution = this.execute.bind(this);
}

Command.prototype.run = function () {
  return;
};

Command.prototype.execute = function () {
  return this.run(this.mode.getSelection());
};

Command.prototype.isActive = function () {
  return false;
};

Command.prototype.isAvailable = function () {
  return true;
};

Command.prototype.isPhrasingEdit = function () {
  return true;
};

Command.prototype.registerShortcut = function (shortcuts) {
  if(this.options.shortcut) {
    shortcuts.add(this.options.shortcut, !!this.options.shift, this.boundExecution);
  }
  return this;
};

Command.prototype.unregisterShortcut = function (shortcuts) {
  if(this.options.shortcut) {
    shortcuts.remove(this.options.shortcut, !!this.options.shift, this.boundExecution);
  }
  return this;
};

module.exports = Command;
