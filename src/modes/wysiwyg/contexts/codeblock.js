'use strict';

var doc = global.document;

function CodeBlock (editor) {
  this.editor = editor;
}

CodeBlock.prototype.wrap = function (contents) {
  var pre = doc.createElement('pre');
  var code = doc.createElement('code');
  pre.appendChild(code);

  for(var c = 0, l = contents.length; c < l; c++) {
    code.appendChild(contents);
  }
  return code;
};

CodeBlock.prototype.unwrap = function (el) {
  // If we're wrapped in <pre><code> we want to unwrap both elements
  if(el.tagName === 'PRE' && el.childNodes.length === 1 && el.childNodes[0].tagName === 'CODE') {
    return el.childNodes[0].childNodes;
  }
  // Otherwise we want to preserve the contents of the unwrap
  return el.childNodes;
};

module.exports = CodeBlock;
