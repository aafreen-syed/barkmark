'use strict';

var utils = require('../../utils');
var Surface = require('./surface');
var Chunks = require('./chunks');
var Commands = require('./commands');
var Contexts = require('./contexts');
var Mode = require('../abstract/mode');

function Markdown (editor, options) {
  Mode.apply(this, arguments);
  this.surface = new Surface(editor, options);
  this.shortcuts.attach(this.surface.current());

  // Add commands
  Commands.forEach((function (Command) {
    this.addCommand(new Command(this, editor));
  }).bind(this));
}

utils.inherit(Markdown, Mode);

Markdown.id = Markdown.prototype.name = 'markdown';

Markdown.prototype.show = function () {
  // Register mode contexts

  // Add commands to command bar
  this.getCommands().forEach((function (command) {
    this.editor.addCommandButton(command);
  }).bind(this));

  // Show the editing surface
  var cl = this.surface.current().classList;
  cl.remove('wk-hide');
};

Markdown.prototype.hide = function () {
  // Unregister mode contexts

  // Remove commands from the command bar
  this.getCommands().forEach((function (command) {
    this.editor.removeCommandButton(command);
  }).bind(this));

  // Hide the editing surface
  var cl = this.surface.current().classList;
  cl.add('wk-hide');
};

Markdown.Surface  = Markdown.prototype.Surface  = Surface;
Markdown.Chunks   = Markdown.prototype.Chunks   = Chunks;
Markdown.Commands = Markdown.prototype.Commands = Commands;
Markdown.Contexts = Markdown.prototype.Contexts = Contexts;

module.exports = Markdown;
