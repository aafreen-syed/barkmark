'use strict';

var utils = require('../../../utils');
var htmlUtils = require('../utils');
var Command = require('../../abstract/command');
var strings = require('../../../strings');

var doc = global.document;

var CODE_NODES = ['CODE'];

function CodeCommand (mode, editor, options) {
  Command.call(this, mode, editor, options);
}

utils.inherit(CodeCommand, Command);

CodeCommand.id = CodeCommand.prototype.name = 'code';

CodeCommand.prototype.run = function (ctx) {
  ctx.selections.forEach(function (sel) {
    if(sel.range.collapsed) {
      // We're in a collapsed selection, just insert text here
      var code = doc.createElement('code');
      code.textContent = strings.placeholders['code'] || 'code';
      if(sel.start.nodeType === Node.TEXT_NODE) {
        sel.start.parentNode.insertBefore(code, sel.start.nextSibling);
      } else {
        sel.start.appendChild(code);
      }
      sel.range.selectNode(code);
      return;
    }

    var removingCode,
      mixedContent = false; // We assume we have all one type of content

    sel.topLevelNodes.forEach(function (node) {
      var isAlreadyCode = !!htmlUtils.findPhrasingElement(node, CODE_NODES);

      mixedContent = mixedContent || (typeof removingCode  !== 'undefined' && isAlreadyCode !== removingCode);
      removingCode = removingCode || isAlreadyCode;
    });

    if (mixedContent|| !removingCode) {
      htmlUtils.wrapPhrasingContent(sel.topLevelNodes, 'code', CODE_NODES);
    } else {
      htmlUtils.unwrapPhrasingContent(sel.topLevelNodes, CODE_NODES);
    }
  });

  // Normalize Text Nodes
  this.mode.surface.current().normalize();
};

CodeCommand.prototype.isActive = function (ctx) {
  var isCode;

  for (var s = 0, l = ctx.selections.length; s < l; s++) {
    var sel = ctx.selections[s];

    for(var t = 0, tl = sel.topLevelNodes.length; t < tl; t++) {
      var node = sel.topLevelNodes[t];

      var isAlreadyCode = !!htmlUtils.findPhrasingElement(node, CODE_NODES);

      if (typeof isCode  !== 'undefined' && isAlreadyCode !== isCode) {
        // We can return immediately if we hit mixed content
        return 'mixed';
      }
      isCode = isCode || isAlreadyCode;
    }
  }

  return isCode;
};

module.exports = CodeCommand;
