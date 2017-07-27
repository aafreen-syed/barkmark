'use strict';

var utils = require('../../../utils');
var Context = require('../../abstract/context');

var doc = global.document;

function Blockquote (mode, editor, options) {
  Context.call(this, mode, editor, options);
}

utils.inherit(Blockquote, Context);

Blockquote.id = Blockquote.prototype.name = 'blockquote';

Blockquote.prototype.wrap = function (nodes) {
  var quote = doc.createElement('blockquote');
  for(var c = 0, l = nodes.length; c < l; c++) {
    quote.appendChild(nodes[c]);
  }
  return quote;
};

Blockquote.prototype.unwrap = function (node) {
  // No special unwrap needed
  return Array.prototype.slice.call(node.childNodes);
};

Blockquote.prototype.isActive = function (node) {
  return node && node.nodeName === 'BLOCKQUOTE';
};

module.exports = Blockquote;
