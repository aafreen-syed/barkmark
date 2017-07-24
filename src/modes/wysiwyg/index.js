'use strict';

var utils = require('../../utils');
var Surface = require('./surface');
var Chunks = require('./chunks');
var Commands = require('./commands');
var Contexts = require('./contexts');
var Mode = require('../abstract/mode');

function WYSIWYG (editor, options) {
  Mode.apply(this, arguments);
  this.surface = new Surface(editor, options);
  this.shortcuts.attach(this.surface.current());

  // Add commands
  Commands.forEach((function (Command) {
    this.addCommand(new Command(editor));
  }).bind(this));
}

utils.inherit(WYSIWYG, Mode);

WYSIWYG.id = WYSIWYG.prototype.name = 'wysiwyg';

WYSIWYG.prototype.show = function () {
  // Register mode contexts

  // Add commands to command bar
  this.getCommands().forEach((function (command) {
    this.editor.addCommandButton(command);
  }).bind(this));

  // Show the editing surface
  var cl = this.surface.current().classList;
  cl.remove('wk-hide');
};

WYSIWYG.prototype.hide = function () {
  // Unregister mode contexts

  // Remove commands from the command bar
  this.getCommands().forEach((function (command) {
    this.editor.removeCommandButton(command);
  }).bind(this));

  // Hide the editing surface
  var cl = this.surface.current().classList;
  cl.add('wk-hide');
};

WYSIWYG.Surface  = WYSIWYG.prototype.Surface  = Surface;
WYSIWYG.Chunks   = WYSIWYG.prototype.Chunks   = Chunks;
WYSIWYG.Commands = WYSIWYG.prototype.Commands = Commands;
WYSIWYG.Contexts = WYSIWYG.prototype.Contexts = Contexts;

module.exports = WYSIWYG;
