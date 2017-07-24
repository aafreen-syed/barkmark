'use strict';

var doc = global.document;

function Paragraph (editor) {
  this.editor = editor;
}

Paragraph.prototype.wrap = function (contents) {
  var p = doc.createElement('p');
  for(var c = 0, l = contents.length; c < l; c++) {
    p.appendChild(contents);
  }
  return p;
};

Paragraph.prototype.unwrap = function (el) {
  // No special unwrap for this, as <p> tags will be expected to be mostly clean
  return el.childNodes;
};

module.exports = Paragraph;
