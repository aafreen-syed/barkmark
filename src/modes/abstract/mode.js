'use strict';

var ShortcutManager = require('../../shortcuts');

var doc = global.document;

function AbstractMode (editor, options) {
  this.editor = editor;
  this.options = options;
  this.contexts = [];
  this.commands = [];
  this.shortcuts = new ShortcutManager();
}

AbstractMode.id = AbstractMode.prototype.name = 'abstract';

AbstractMode.prototype.addContext = function (context) {
  this.contexts.push(context);
};

AbstractMode.prototype.removeContext = function (context) {
  var i = this.contexts.indexOf(context);
  if(i < 0) {
    return false;
  }

  this.contexts.splice(i, 1);
};

AbstractMode.prototype.getContexts = function () {
  return this.contexts;
};

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
  for(var c = 0, l = this.commands.length; c < l; c++) {
    if(this.commands[c].name === name) {
      return this.commands[c].execute(this.surface.readSelection());
    }
  }
  throw new Error('Unable to find a command with the given name ' + name);
};

AbstractMode.prototype.getSelection = function () {
  return doc.getSelection();
};

AbstractMode.prototype.getSelectionContext = function () {
  return this.defaultContext;
};

module.exports = AbstractMode;
