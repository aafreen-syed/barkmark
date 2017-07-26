'use strict';

var utils = require('../../../utils');
var htmlUtils = require('../utils');
var Command = require('../../abstract/command');
var strings = require('../../../strings');

var doc = global.document;

var BOLD_NODES = ['STRONG', 'B'];

function BoldCommand (mode, editor, options) {
  options = utils.defaultsDeep(options || {}, {
    shortcut: 'b',
    shift: false
  });
  Command.call(this, mode, editor, options);
}

utils.inherit(BoldCommand, Command);

BoldCommand.id = BoldCommand.prototype.name = 'bold';

BoldCommand.prototype.run = function (ctx) {
  console.log(ctx);

  ctx.selections.forEach(function (sel) {
    if(sel.range.collapsed) {
      // We're in a collapsed selection, just insert text here
      var strong = doc.createElement('strong');
      strong.textContent = strings.placeholders['bold'] || 'bold';
      if(sel.start.nodeType === Node.TEXT_NODE) {
        sel.start.parentNode.insertBefore(strong, sel.start.nextSibling);
      } else {
        sel.start.appendChild(strong);
      }
      sel.range.selectNode(strong);
      return;
    }

    var removingBold,
      mixedContent = false; // We assume we have all one type of content

    sel.topLevelNodes.forEach(function (node) {
      var isAlreadyBold = !!htmlUtils.findPhrasingElement(node, BOLD_NODES);

      mixedContent = mixedContent || (typeof removingBold  !== 'undefined' && isAlreadyBold !== removingBold);
      removingBold = removingBold || isAlreadyBold;
    });

    if (mixedContent|| !removingBold) {
      htmlUtils.wrapPhrasingContent(sel.topLevelNodes, 'strong', BOLD_NODES);
    } else {
      htmlUtils.unwrapPhrasingContent(sel.topLevelNodes, BOLD_NODES);
    }
  });

  // Normalize Text Nodes
  this.mode.surface.current().normalize();
};

/*
BoldCommand.prototype.isActive = function (ctx) {

};
 */

module.exports = BoldCommand;
