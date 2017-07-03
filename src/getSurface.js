'use strict';

var doc = global.document;
var fixEOL = require('./fixEOL');
var many = require('./many');
var cast = require('./cast');
var ropen = /^(<[^>]+(?: [^>]*)?>)/;
var rclose = /(<\/[^>]+>)$/;

function surface (textarea, editable, droparea) {
  return {
    textarea: textarea,
    editable: editable,
    droparea: droparea,
    focus: setFocus,
    read: read,
    write: write,
    current: current,
    writeSelection: writeSelection,
    readSelection: readSelection
  };

  function setFocus (mode) {
    current(mode).focus();
  }

  function current (mode) {
    return mode === 'wysiwyg' ? editable : textarea;
  }

  function read (mode) {
    if (mode === 'wysiwyg') {
      return editable.innerHTML;
    }
    return textarea.value;
  }

  function write (mode, value) {
    if (mode === 'wysiwyg') {
      editable.innerHTML = value;
    } else {
      textarea.value = value;
    }
  }

  function writeSelection (state) {
    if (state.mode === 'wysiwyg') {
      writeSelectionEditable(state);
    } else {
      writeSelectionTextarea(state);
    }
  }

  function readSelection (state) {
    if (state.mode === 'wysiwyg') {
      readSelectionEditable(state);
    } else {
      readSelectionTextarea(state);
    }
  }

  function writeSelectionTextarea (state) {
    var range;
    if (textarea.selectionStart !== void 0) {
      textarea.focus();
      textarea.selectionStart = state.start;
      textarea.selectionEnd = state.end;
      textarea.scrollTop = state.scrollTop;
    } else if (doc.selection) {
      if (doc.activeElement && doc.activeElement !== textarea) {
        return;
      }
      textarea.focus();
      range = textarea.createTextRange();
      range.moveStart('character', -textarea.value.length);
      range.moveEnd('character', -textarea.value.length);
      range.moveEnd('character', state.end);
      range.moveStart('character', state.start);
      range.select();
    }
  }

  function readSelectionTextarea (state) {
    if (textarea.selectionStart !== void 0) {
      state.start = textarea.selectionStart;
      state.end = textarea.selectionEnd;
    } else if (doc.selection) {
      ancientlyReadSelectionTextarea(state);
    }
  }

  function ancientlyReadSelectionTextarea (state) {
    if (doc.activeElement && doc.activeElement !== textarea) {
      return;
    }

    state.text = fixEOL(textarea.value);

    var range = doc.selection.createRange();
    var fixedRange = fixEOL(range.text);
    var marker = '\x07';
    var markedRange = marker + fixedRange + marker;

    range.text = markedRange;

    var inputText = fixEOL(textarea.value);

    range.moveStart('character', -markedRange.length);
    range.text = fixedRange;
    state.start = inputText.indexOf(marker);
    state.end = inputText.lastIndexOf(marker) - marker.length;

    var diff = state.text.length - fixEOL(textarea.value).length;
    if (diff) {
      range.moveStart('character', -fixedRange.length);
      fixedRange += many('\n', diff);
      state.end += diff;
      range.text = fixedRange;
    }
    state.select();
  }

  function writeSelectionEditable (state) {
    var chunks = state.cachedChunks || state.getChunks();
    var start = unescapeText(chunks.before).length;
    var end = start + unescapeText(chunks.selection).length;
    var p = doc.createRange();
    var startRangeSet = false;
    var endRangeSet = false;

    walk(editable.firstChild, peek);
    editable.focus();
    DOMSelection.setRange(p);

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
  }

  function readSelectionEditable (state) {
    var sel = DOMSelection.getRange();
    var distance = walk(editable.firstChild, peek);
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
  }

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
      cast(el.childNodes).forEach(walkChildren);
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
}

module.exports = surface;
