'use strict';

var doc = global.document;

function Context (mode, editor, options) {
  this.mode = mode;
  this.editor = editor;
  this.options = options || {};
}

Context.prototype.wrap = function (nodes) {
  var div = doc.createElement('div');
  for(var c = 0, l = nodes.length; c < l; c++) {
    div.appendChild(nodes[c]);
  }
  return div;
};

Context.prototype.unwrap = function (node) {
  return node.childNodes;
};

Context.prototype.isActive = function () {
  return false;
};

Context.prototype.isAvailable = function () {
  return true;
};

module.exports = Context;
