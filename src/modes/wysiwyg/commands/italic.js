'use strict';

var utils = require('../../../utils');
var htmlUtils = require('../utils');
var Command = require('../../abstract/command');
var strings = require('../../../strings');

var doc = global.document;

var ITALIC_NODES = ['EM', 'I'];

function ItalicCommand (mode, editor, options) {
  options = utils.defaultsDeep(options || {}, {
    shortcut: 'i',
    shift: false
  });
  Command.call(this, mode, editor, options);
}

utils.inherit(ItalicCommand, Command);

ItalicCommand.id = ItalicCommand.prototype.name = 'italic';

ItalicCommand.prototype.run = function (ctx) {
  console.log(ctx);

  ctx.selections.forEach(function (sel) {
    if(sel.range.collapsed) {
      // We're in a collapsed selection, just insert text here
      var em = doc.createElement('em');
      em.textContent = strings.placeholders['italic'] || 'italic';
      if(sel.start.nodeType === Node.TEXT_NODE) {
        sel.start.parentNode.insertBefore(em, sel.start.nextSibling);
      } else {
        sel.start.appendChild(em);
      }
      sel.range.selectNode(em);
      return;
    }

    var removingItalic,
      mixedContent = false; // We assume we have all one type of content

    sel.topLevelNodes.forEach(function (node) {
      var isAlreadyItalic = !!htmlUtils.findPhrasingElement(node, ITALIC_NODES);

      mixedContent = mixedContent || (typeof removingItalic  !== 'undefined' && isAlreadyItalic !== removingItalic);
      removingItalic = removingItalic || isAlreadyItalic;
    });

    if (mixedContent|| !removingItalic) {
      htmlUtils.wrapPhrasingContent(sel.topLevelNodes, 'em', ITALIC_NODES);
    } else {
      htmlUtils.unwrapPhrasingContent(sel.topLevelNodes, ITALIC_NODES);
    }
  });

  // Normalize Text Nodes
  this.mode.surface.current().normalize();
};

ItalicCommand.prototype.isActive = function (ctx) {
  var isItalic;

  for (var s = 0, l = ctx.selections.length; s < l; s++) {
    var sel = ctx.selections[s];

    for(var t = 0, tl = sel.topLevelNodes.length; t < tl; t++) {
      var node = sel.topLevelNodes[t];

      var isAlreadyItalic = !!htmlUtils.findPhrasingElement(node, ITALIC_NODES);

      if (typeof isItalic  !== 'undefined' && isAlreadyItalic !== isItalic) {
        // We can return immediately if we hit mixed content
        return 'mixed';
      }
      isItalic = isItalic || isAlreadyItalic;
    }
  }

  return isItalic;
};

module.exports = ItalicCommand;
