'use strict';

var ShortcutManager = require('../../shortcuts');

function AbstractMode (editor, options) {
  this.editor = editor;
  this.options = options;
  this.commands = [];
  this.shortcuts = new ShortcutManager();
}

AbstractMode.id = AbstractMode.prototype.name = 'abstract';

AbstractMode.prototype.addCommand = function (command) {
  this.commands.push(command);
  command.registerShortcut(this.shortcuts);
};

AbstractMode.prototype.removeCommand = function (command) {
  var i = this.commands.indexOf(command);
  if(i < 0) {
    return false;
  }

  this.commands.splice(i, 1);
  command.unregisterShortcut(this.shortcuts);
};

AbstractMode.prototype.getCommands = function () {
  return this.commands;
};

AbstractMode.prototype.runCommand = function (name) {
  return this.commands[name].execute(this.surface.readSelection());
};

module.exports = AbstractMode;
