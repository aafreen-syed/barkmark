'use strict';

var utils = require('../../../utils');
var Context = require('../../abstract/context');

var doc = global.document;

function Heading (mode, editor, options) {
  Context.call(this, mode, editor, options);

  var level;
  Object.defineProperty(this, 'level', {
    enumerable: true,
    get: function () {
      return level;
    },
    set: function (val) {
      level = Math.min(6, Math.max(1, val || 1));
    },
  });
  this.level = options.level;

  Object.defineProperty(this, 'name', {
    enumerable: true,
    get: function () {
      return 'h' + this.level;
    }
  });
}

utils.inherit(Heading, Context);

Heading.id = Heading.prototype.name = 'heading';

Heading.prototype.wrap = function (nodes) {
  var header = doc.createElement('h' + this.level);
  for(var c = 0, l = nodes.length; c < l; c++) {
    header.appendChild(nodes[c]);
  }
  return header;
};

Heading.prototype.isActive = function (node) {
  return node && node.nodeName === ('H' + this.level);
};

module.exports = Heading;
