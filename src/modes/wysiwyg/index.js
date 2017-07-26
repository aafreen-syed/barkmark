'use strict';

var utils = require('../../utils');
var Surface = require('./surface');
var Chunks = require('./chunks');
var Commands = require('./commands');
var Contexts = require('./contexts');
var Mode = require('../abstract/mode');
var doc = global.document;

function WYSIWYG (editor, options) {
  Mode.apply(this, arguments);
  this.surface = new Surface(editor, options);
  this.shortcuts.attach(this.surface.current());

  // Add commands
  Commands.forEach((function (Command) {
    this.addCommand(new Command(this, editor));
  }).bind(this));
}

utils.inherit(WYSIWYG, Mode);

WYSIWYG.id = WYSIWYG.prototype.name = 'wysiwyg';

WYSIWYG.prototype.show = function () {
  // Register mode contexts

  // Add commands to command bar
  this.getCommands().forEach((function (command) {
    this.editor.addCommandButton(command);
  }).bind(this));

  // Show the editing surface
  var cl = this.surface.current().classList;
  cl.remove('wk-hide');
};

WYSIWYG.prototype.hide = function () {
  // Unregister mode contexts

  // Remove commands from the command bar
  this.getCommands().forEach((function (command) {
    this.editor.removeCommandButton(command);
  }).bind(this));

  // Hide the editing surface
  var cl = this.surface.current().classList;
  cl.add('wk-hide');
};

WYSIWYG.prototype.getSelectionContext = function () {
  var sel = doc.getSelection(),
    surfaceEl = this.surface.current(),
    ctx = {
      raw: sel,
      top: surfaceEl,
      selections: [],
    };

  if(!surfaceEl.contains(sel.anchorNode) || !surfaceEl.contains(sel.focusNode)) {
    // We need to force selection into the current node
    var forced = doc.createRange();
    // Set the selection to the end of the editor node
    if(!surfaceEl.childNodes.length) {
      surfaceEl.append(doc.createTextNode(''));
    }
    forced.setStartAfter(surfaceEl.childNodes[surfaceEl.childNodes.length - 1]);
    forced.collapse(true);
    sel.removeAllRanges();
    sel.addRange(forced);
  }

  for (var s = 0, l = sel.rangeCount; s < l; s++) {
    var range = sel.getRangeAt(s),
      set = {
        range: range,
        commonStack: getStack(range.commonAncestorContainer),
      },
      start = range.startContainer,
      end = range.endContainer,
      startOffset = range.startOffset,
      endOffset = range.endOffset,
      singleNode = range.startContainer === range.endContainer;

    // Split off any extra text before the selection if possible
    if(start.nodeType === Node.TEXT_NODE && startOffset > 0) {
      start = start.splitText(startOffset);
      if(singleNode) {
        end = start;
        endOffset = endOffset - startOffset;
      }
    } else if (start.nodeType === Node.ELEMENT_NODE && start.childNodes.length > startOffset && (!singleNode || startOffset !== endOffset)) {
      start = start.childNodes[startOffset];
    } else if (start.nodeType === Node.ELEMENT_NODE) {
      // We're at the end of our start node, let's insert something here
      // so we have a spot to work with when we need to do something
      var txt = doc.createTextNode('');

      if (singleNode) {
        // If we're inbetween two nodes as a cursor...
        if (startOffset === endOffset && start.childNodes.length > startOffset) {
          // ... insert between the nodes ....
          start.insertBefore(txt, start.childNodes[startOffset]);
        } else {
          // ... otherwise just insert at the end
          start.appendChild(txt);
        }
        endOffset++;
      } else {
        start.appendChild(txt);
      }

      start = txt;
    }

    // Split off any extra text after the selection if possible
    if(end.nodeType === Node.TEXT_NODE && endOffset < end.textContent.length - 1) {
      end.splitText(endOffset);
    } else if (end.nodeType === Node.ELEMENT_NODE) {
      // We want the full selection which should end with the last node in the selection
      end = end.childNodes[endOffset - 1];
    }

    set.start = start;
    set.end = end;
    set.startStack = getStack(start);
    set.endStack = getStack(end);
    set.topLevelNodes = getNodeRange(start, end);

    ctx.selections.push(set);
  }

  return ctx;

  function getStack(start) {
    var stack = [];

    do {
      stack.push(start);
      start = start.parentNode;
    } while(start && start.parentNode && start.parentNode !== start && start.parentNode !== surfaceEl);

    return stack;
  }

  function getNodeRange(start, end) {
    var curr = start,
      results = [];

    while (curr && curr !== end) {
      // Add current node to the results
      results.push(curr);

      // Find the next position for traversing the tree
      var next = curr;
      // ==== Going Up
      while(!next.nextSibling && next !== end) {
        // We don't have a next sibling, we need to go up then over
        next = next.parentNode;
      }

      // ==== Going Laterally
      next = next.nextSibling;

      // ==== Going Down
      while(next.contains(end) && next !== end) {
        // If the next node should only be a "partial" node, go to it's first child
        next = next.childNodes[0];
      }

      // We've found the next node,
      curr = next;
    }
    results.push(end);

    return results;
  }
};

WYSIWYG.Surface  = WYSIWYG.prototype.Surface  = Surface;
WYSIWYG.Chunks   = WYSIWYG.prototype.Chunks   = Chunks;
WYSIWYG.Commands = WYSIWYG.prototype.Commands = Commands;
WYSIWYG.Contexts = WYSIWYG.prototype.Contexts = Contexts;

module.exports = WYSIWYG;
