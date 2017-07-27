'use strict';

var utils = require('../../../utils');
var Context = require('../../abstract/context');

var doc = global.document;

function CodeBlock (mode, editor, options) {
  Context.call(this, mode, editor, options);
}

utils.inherit(CodeBlock, Context);

CodeBlock.id = CodeBlock.prototype.name = 'codeblock';

CodeBlock.prototype.wrap = function (nodes) {
  var pre = doc.createElement('pre');
  var code = doc.createElement('code');
  pre.appendChild(code);

  for(var c = 0, l = nodes.length; c < l; c++) {
    var node = nodes[c];
    // Strip out any inline content like bold or links
    if(node.nodeType === Node.ELEMENT_NODE) {
      node = doc.createTextNode(node.textContent || '');
    }
    code.appendChild(node);
  }
  code.normalize();
  return pre;
};

CodeBlock.prototype.unwrap = function (node) {
  // If we're wrapped in <pre><code> we want to unwrap both elements
  if(node.tagName === 'PRE' && node.childNodes.length === 1 && node.childNodes[0].tagName === 'CODE') {
    return Array.prototype.slice.call(node.childNodes[0].childNodes);
  }
  // Otherwise we want to preserve the contents of the unwrap
  return Array.prototype.slice.call(node.childNodes);
};

CodeBlock.prototype.isActive = function (node) {
  return node && node.nodeName === 'PRE' && node.childNodes.length === 1 && node.childNodes[0].nodeName === 'CODE';
};

CodeBlock.prototype.allowPhrasingEdits = function () {
  return false;
};

module.exports = CodeBlock;
