'use strict';

var Surface = require('./surface');
var Chunks = require('./chunks');

function Markdown (editor, options) {
  this.surface = new Surface(editor, options);
}

Markdown.name = Markdown.prototype.name = 'markdown';

Markdown.Surface = Surface;
Markdown.Chunks = Chunks;

module.exports = Markdown;
