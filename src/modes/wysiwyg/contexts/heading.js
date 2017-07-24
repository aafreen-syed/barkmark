'use strict';

var doc = global.document;

function Heading (level, editor) {
  this.level = level || 1;
  this.editor = editor;
}

Heading.prototype.wrap = function (contents) {
  var header = doc.createElement('h' + this.level);
  for(var c = 0, l = contents.length; c < l; c++) {
    header.appendChild(contents);
  }
  return header;
};

Heading.prototype.unwrap = function (el) {
  // No special unwrap for this, as heading tags will be expected to be mostly clean
  return el.childNodes;
};

module.exports = Heading;
