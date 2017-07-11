'use strict';

var Events = require('../../events');
var utils = require('../../utils');

var doc = global.document;
var ropen = /^(<[^>]+(?: [^>]*)?>)/;
var rclose = /(<\/[^>]+>)$/;

function WysiwygSurface (editable) {
  this.editable = editable;

  var self = this;
  var _cached = this.read();
  var debouncedChange = utils.debounce(sendChange, 200);

  editable.addEventListener('blur', sendChange);
  editable.addEventListener('cut', sendChange);
  editable.addEventListener('paste', sendChange);
  editable.addEventListener('textinput', debouncedChange);
  editable.addEventListener('input', debouncedChange);
  editable.addEventListener('keypress', debouncedChange);
  editable.addEventListener('keyup', debouncedChange);

  function sendChange () {
    var updated = self.read();
    if(_cached !== updated) {
      _cached = updated;
      self.trigger('change', updated);
    }
  }
}

WysiwygSurface.prototype.focus = function (forceImmediate) {
  if(forceImmediate) {
    this.editable.focus();
  } else {
    setTimeout(this.editable.focus.bind(this.editable), 0);
  }
};

WysiwygSurface.prototype.read = function () {
  return this.editable.innerHTML;
};

WysiwygSurface.prototype.write = function (value) {
  this.editable.innerHTML = value;
};

WysiwygSurface.prototype.current = function () {
  return this.editable;
};

WysiwygSurface.prototype.writeSelection = function (state) {
  var chunks = state.cachedChunks || state.getChunks();
  var start = unescapeText(chunks.before).length;
  var end = start + unescapeText(chunks.selection).length;
  var p = doc.createRange();
  var startRangeSet = false;
  var endRangeSet = false;

  walk(this.editable.firstChild, peek);
  this.editable.focus();
  var selection = doc.getSelection();
  selection.removeAllRanges();
  selection.addRange(p);

  function peek (context, el) {
    var cursor = unescapeText(context.text).length;
    var content = readNode(el, false).length;
    var sum = cursor + content;
    if (!startRangeSet && sum >= start) {
      p.setStart(el, bounded(start - cursor));
      startRangeSet = true;
    }
    if (!endRangeSet && sum >= end) {
      p.setEnd(el, bounded(end - cursor));
      endRangeSet = true;
    }

    function bounded (offset) {
      return Math.max(0, Math.min(content, offset));
    }
  }
};

WysiwygSurface.prototype.readSelection = function (state) {
  var sel = doc.getSelection();
  var distance = walk(this.editable.firstChild, peek);
  var start = distance.start || 0;
  var end = distance.end || 0;

  state.text = distance.text;

  if (end > start) {
    state.start = start;
    state.end = end;
  } else {
    state.start = end;
    state.end = start;
  }

  function peek (context, el) {
    var elText = (el.textContent || el.innerText || '');

    if (el === sel.anchorNode) {
      context.start = context.text.length + escapeNodeText(elText.substring(0, sel.anchorOffset)).length;
    }
    if (el === sel.focusNode) {
      context.end = context.text.length + escapeNodeText(elText.substring(0, sel.focusOffset)).length;
    }
  }
};

function walk (el, peek, ctx, siblings) {
  var context = ctx || { text: '' };

  if (!el) {
    return context;
  }

  var elNode = el.nodeType === 1;
  var textNode = el.nodeType === 3;

  peek(context, el);

  if (textNode) {
    context.text += readNode(el);
  }
  if (elNode) {
    if (el.outerHTML.match(ropen)) { context.text += RegExp.$1; }
    Array.prototype.slice.call(el.childNodes).forEach(walkChildren);
    if (el.outerHTML.match(rclose)) { context.text += RegExp.$1; }
  }
  if (siblings !== false && el.nextSibling) {
    return walk(el.nextSibling, peek, context);
  }
  return context;

  function walkChildren (child) {
    walk(child, peek, context, false);
  }
}

function readNode (el, escape) {
  if(el.nodeType === 3) {
    if(escape === false) {
      return el.textContent || el.innerText || '';
    }

    return escapeNodeText(el);
  }
  return '';
}

function escapeNodeText (el) {
  el = el || '';
  if(el.nodeType === 3) {
    el = el.cloneNode();
  } else {
    el = doc.createTextNode(el);
  }

  // Using browser escaping to clean up any special characters
  var toText = doc.createElement('div');
  toText.appendChild(el);
  return toText.innerHTML || '';
}

function unescapeText (el) {
  if(el.nodeType) {
    return el.textContent || el.innerText || '';
  }

  var toText = doc.createElement('div');
  toText.textContent = el;
  return toText.textContent;
}

Events.extend(WysiwygSurface);

module.exports = WysiwygSurface;
