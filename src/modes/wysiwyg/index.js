'use strict';

var Surface = require('./surface');
var Chunks = require('./chunks');

function WYSIWYG (editor, options) {
  this.surface = new Surface(editor, options);
}

WYSIWYG.name = WYSIWYG.prototype.name = 'wysiwyg';

WYSIWYG.Surface = Surface;
WYSIWYG.Chunks = Chunks;

module.exports = WYSIWYG;
