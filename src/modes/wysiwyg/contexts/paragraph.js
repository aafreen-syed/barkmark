'use strict';

var utils = require('../../../utils');
var Context = require('../../abstract/context');

var doc = global.document;

function Paragraph (mode, editor, options) {
  Context.call(this, mode, editor, options);
}

utils.inherit(Paragraph, Context);

Paragraph.id = Paragraph.prototype.name = 'paragraph';

Paragraph.prototype.wrap = function (nodes) {
  var p = doc.createElement('p');
  for(var c = 0, l = nodes.length; c < l; c++) {
    p.appendChild(nodes[c]);
  }
  return p;
};

Paragraph.prototype.isActive = function (node) {
  return node && node.nodeName === 'P';
};

module.exports = Paragraph;
