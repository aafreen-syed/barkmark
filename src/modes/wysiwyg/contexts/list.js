'use strict';

var utils = require('../../../utils');
var Context = require('../../abstract/context');

var doc = global.document;

function List (mode, editor, options) {
  Context.call(this, mode, editor, options);
  this.ordered = !!options.ordered;

  Object.defineProperty(this, 'name', {
    enumerable: true,
    get: function () {
      return this.ordered ? 'ol' : 'ul';
    }
  });
}

utils.inherit(List, Context);

List.id = List.prototype.name = 'list';

List.prototype.wrap = function (nodes) {
  var list = doc.createElement(this.ordered ? 'ol' : 'ul');

  var currLI = doc.createElement('li');
  var brCount = 0;
  list.appendChild(currLI);

  for(var c = 0, l = nodes.length; c < l; c++) {
    var item = nodes[c];

    if(item.tagName === 'BR') {
      if(brCount++ !== 1) {
        currLI = doc.createElement('li');
        list.appendChild(currLI);
      }
      continue;
    }

    currLI.appendChild(item);
    brCount = 0;
  }

  return list;
};

List.prototype.unwrap = function (node) {
  var children = [];
  for(var e = 0, l = node.children.length; e < l; e++) {
    children.push.apply(children, node.children[e].childNodes);
    children.push(doc.createElement('br'));
  }

  // Remove the last <br>
  children.pop();

  return children;
};

List.prototype.isActive = function (node) {
  return node && (this.ordered && node.nodeName === 'OL') || (!this.ordered && node.nodeName === 'UL');
};

module.exports = List;
