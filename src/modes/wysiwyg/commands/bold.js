'use strict';

var utils = require('../../../utils');
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
      var isAlreadyBold = !!findBold(node);

      mixedContent = mixedContent || (typeof removingBold  !== 'undefined' && isAlreadyBold !== removingBold);
      removingBold = removingBold || isAlreadyBold;
    });

    if (mixedContent|| !removingBold) {
      this.makeBold(sel.topLevelNodes);
    } else {
      this.removeBold(sel.topLevelNodes);
    }
  }, this);

  // Normalize Text Nodes
  this.mode.surface.current().normalize();
};

BoldCommand.prototype.makeBold = function (nodes) {
  if(!nodes || !nodes.length) {
    return nodes;
  }
  nodes = Array.prototype.slice.call(nodes);

  var prev;
  for(var i = 0; i < nodes.length; i++) {
    var node = nodes[i],
      canBeWrapped = utils.isPhrasingContent(node),
      isAlreadyBold = canBeWrapped && findBold(node),
      isSibling = prev && (prev.nextSibling === node || prev.nextSibling === isAlreadyBold);

    if(!canBeWrapped) {
      // We have a block level node, we need to wrap it's contents
      this.makeBold(node.childNodes);
      prev = null;

    } else if (isSibling) {
      // Check to make sure this hasn't already been moved
      if(findBold(prev) !== isAlreadyBold) {
        // We have a sibling node, and we've already processed the prev
        // node so we can just merge them
        if(isAlreadyBold) {
          // Merge children if this node is bold
          while(isAlreadyBold.childNodes.length) {
            prev.appendChild(isAlreadyBold.childNodes[0]);
          }
          isAlreadyBold.parentNode.removeChild(isAlreadyBold);
          prev = findBold(prev);
        } else {
          // Just put this node under the previous node
          prev.appendChild(node);
        }
      }

      // "delete" this node from the list as processed
      Array.prototype.splice.call(nodes, i, 1);
      i--;
    } else if (!isAlreadyBold) {
      // Wrap the contents in a <strong> tag
      var wrapper = doc.createElement('strong');
      node.parentNode.replaceChild(wrapper, node);
      wrapper.appendChild(node);
      nodes[i] = wrapper;
      prev = wrapper;
    } else {
      // Else we're already bold and either a bold element or a bold Text node
      prev = isAlreadyBold;
    }

    if(canBeWrapped) {
      // Clean up any child nodes that may have a double bold applied
      this.removeBold(node.childNodes, true);
    }
  }

  return nodes;
};

BoldCommand.prototype.removeBold = function (nodes, leaveParent) {
  if(!nodes || !nodes.length) {
    return nodes;
  }
  nodes = Array.prototype.slice.call(nodes);

  nodes.forEach(function (node) {
    // We only have to unwrap bolding elements
    var parent = node.parentNode,
      childNodes = Array.prototype.slice.call(node.childNodes);
    if(BOLD_NODES.indexOf(node.nodeName) >= 0) {
      childNodes.forEach(function (child) {
        parent.insertBefore(child, node);
      });
      parent.removeChild(node);
    } else if (!leaveParent && node.nodeType === Node.TEXT_NODE && BOLD_NODES.indexOf(parent.nodeName) >= 0) {
      // We're unwrapping our parent bold from a text node
      var idx = Array.prototype.indexOf.call(parent.childNodes, node);

      parent.parentNode.insertBefore(node, parent);

      if(idx > 0) {
        // We have content before we will need to keep ordered
        var before = doc.createElement(parent.nodeName.toLowerCase());
        while (idx > 0) {
          before.appendChild(parent.childNodes[0]);
          idx--;
        }
        parent.parentNode.insertBefore(before, node);
      }

      // If our bold has no content, remove it
      if(!parent.childNodes.length) {
        parent.parentNode.removeChild(parent);
      }
    }

    // Apply recursively
    this.removeBold(childNodes);
  }, this);
};

/*
BoldCommand.prototype.isActive = function (ctx) {

};
 */

function findBold (node) {
  while(node && utils.isPhrasingContent(node)) {
    if(BOLD_NODES.indexOf(node.nodeName) >= 0) {
      return node;
    }
    node = node.parentNode;
  }
  return false;
}

module.exports = BoldCommand;
