'use strict';

var doc = global.document;

function Blockquote (editor) {
  this.editor = editor;
}

Blockquote.prototype.wrap = function (contents) {
  var quote = doc.createElement('blockquote');
  for(var c = 0, l = contents.length; c < l; c++) {
    quote.appendChild(contents);
  }
  return quote;
};

Blockquote.prototype.unwrap = function (el) {
  // No special unwrap for this, as <blockquote> tags will be expected to be mostly clean
  return el.childNodes;
};

module.exports = Blockquote;
