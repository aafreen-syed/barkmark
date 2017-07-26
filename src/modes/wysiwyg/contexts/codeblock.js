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
    code.appendChild(nodes[c]);
  }
  return code;
};

CodeBlock.prototype.unwrap = function (node) {
  // If we're wrapped in <pre><code> we want to unwrap both elements
  if(node.tagName === 'PRE' && node.childNodes.length === 1 && node.childNodes[0].tagName === 'CODE') {
    return node.childNodes[0].childNodes;
  }
  // Otherwise we want to preserve the contents of the unwrap
  return node.childNodes;
};

CodeBlock.prototype.isActive = function (node) {
  return node && node.nodeName === 'PRE' && node.childNodes.length === 1 && node.childNodes[0].nodeName === 'CODE';
};

module.exports = CodeBlock;
