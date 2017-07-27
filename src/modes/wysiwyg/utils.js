'use strict';

var doc = global.document;

var PHRASING_NODE_NAMES = [
  'ABBR',
  'AREA',
  'AUDIO',
  'B',
  'BDO',
  'BR',
  'BUTTON',
  'CANVAS',
  'CITE',
  'CODE',
  'COMMAND',
  'DATA',
  'DATALIST',
  'DFN',
  'EM',
  'EMBED',
  'I',
  'IFRAME',
  'IMG',
  'INPUT',
  'KBD',
  'KEYGEN',
  'LABEL',
  'MARK',
  'MATH',
  'METER',
  'NOSCRIPT',
  'OBJECT',
  'OUTPUT',
  'PROGRESS',
  'Q',
  'RUBY',
  'SAMP',
  'SCRIPT',
  'SELECT',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'SVG',
  'TEXTAREA',
  'TIME',
  'VAR',
  'VIDEO',
  'WBR'
  // NOTE: There are a few more with restrictions that are handled in the function below
];

exports.isPhrasingContent = function (el) {
  return el.nodeType === Node.TEXT_NODE ||
    PHRASING_NODE_NAMES.indexOf(el.nodeName) >= 0 ||
    (['LINK', 'META'].indexOf(el.nodeName) >= 0 && el.getAttribute('itemProp')) ||
    (['A', 'DEL', 'INS', 'MAP'].indexOf(el.nodeName) >= 0 && childrenArePhrasing(el));

  function childrenArePhrasing(node) {
    for(var c = 0, l = node.childNodes.length; c < l; c++) {
      if(!exports.isPhrasingContent(node.childNodes[c])) {
        return false;
      }
    }
    return true;
  }
};

exports.wrapPhrasingContent = function (nodes, wrapIn, nodeSynonyms) {
  if(typeof wrapIn !== 'string') {
    throw new Error('Must provide node name to wrap phrasing content in');
  }

  if(!nodeSynonyms) {
    nodeSynonyms = [];
  } else if (typeof nodeSynonyms === 'string') {
    nodeSynonyms = [nodeSynonyms];
  }

  if(nodeSynonyms.indexOf(wrapIn.toUpperCase()) < 0) {
    nodeSynonyms.push(wrapIn.toUpperCase());
  }

  if(!nodes || !nodes.length) {
    return nodes;
  }
  nodes = Array.prototype.slice.call(nodes);

  var prev;
  for(var i = 0; i < nodes.length; i++) {
    var node = nodes[i],
      canBeWrapped = exports.isPhrasingContent(node),
      isAlreadyWrapped = canBeWrapped && exports.findPhrasingElement(node, nodeSynonyms),
      isSibling = prev && (prev.nextSibling === node || prev.nextSibling === isAlreadyWrapped);

    if(!canBeWrapped) {
      // We have a block level node, we need to wrap it's contents
      this.wrapPhrasingContent(node.childNodes, wrapIn, nodeSynonyms);
      prev = null;

    } else if (isSibling) {
      // Check to make sure this hasn't already been moved
      if(exports.findPhrasingElement(prev, nodeSynonyms) !== isAlreadyWrapped) {
        // We have a sibling node, and we've already processed the prev
        // node so we can just merge them
        if(isAlreadyWrapped) {
          // Merge children if this node is already wrapped
          while(isAlreadyWrapped.childNodes.length) {
            prev.appendChild(isAlreadyWrapped.childNodes[0]);
          }
          isAlreadyWrapped.parentNode.removeChild(isAlreadyWrapped);
          prev = exports.findPhrasingElement(prev, nodeSynonyms);
        } else {
          // Just put this node under the previous node
          prev.appendChild(node);
        }
      }

      // "delete" this node from the list as processed
      Array.prototype.splice.call(nodes, i, 1);
      i--;
    } else if (!isAlreadyWrapped) {
      // Wrap the contents in the phrasing tag
      var wrapper = doc.createElement(wrapIn);
      node.parentNode.replaceChild(wrapper, node);
      wrapper.appendChild(node);
      nodes[i] = wrapper;
      prev = wrapper;
    } else {
      // Else we're already wrapped and either a wrapped element or a Text node under the wrapped element
      prev = isAlreadyWrapped;
    }

    if(canBeWrapped) {
      // Clean up any child nodes that may have a double wrap applied
      exports.unwrapPhrasingContent(node.childNodes, nodeSynonyms, true);
    }
  }

  return nodes;
};

exports.unwrapPhrasingContent = function (nodes, unwrapFrom, leaveParent) {
  if(!unwrapFrom) {
    throw new Error('Must provide node name(s) to unwrap phrasing content from');
  }

  if (typeof unwrapFrom === 'string') {
    unwrapFrom = [unwrapFrom];
  }

  if(!nodes || !nodes.length) {
    return nodes;
  }
  nodes = Array.prototype.slice.call(nodes);

  nodes.forEach(function (node) {
    // We only have to unwrap elements that match
    var parent = node.parentNode,
      childNodes = Array.prototype.slice.call(node.childNodes);
    if(unwrapFrom.indexOf(node.nodeName) >= 0) {
      childNodes.forEach(function (child) {
        parent.insertBefore(child, node);
      });
      parent.removeChild(node);
    } else if (!leaveParent && node.nodeType === Node.TEXT_NODE && unwrapFrom.indexOf(parent.nodeName) >= 0) {
      // We're unwrapping our parent from a text node
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

      // If our parent has no content, remove it
      if(!parent.childNodes.length) {
        parent.parentNode.removeChild(parent);
      }
    }

    // Apply recursively
    exports.unwrapPhrasingContent(childNodes, unwrapFrom);
  });
};

exports.findPhrasingElement = function (node, matches) {
  if(typeof matches === 'string') {
    matches = [matches];
  }

  while(node && exports.isPhrasingContent(node)) {
    if(matches.indexOf(node.nodeName) >= 0) {
      return node;
    }
    node = node.parentNode;
  }
  return false;
};

exports.findContextElement = function (node, top) {
  while(node && node !== top && node.parentNode !== top) {
    node = node.parentNode;
  }

  return node !== top ? node : null;
};
