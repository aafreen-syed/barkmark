!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.barkmark=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var InputState = require('./InputState');

function InputHistory (surface, mode) {
  var state = this;

  state.inputMode = mode;
  state.surface = surface;
  state.reset();

  listen(surface.current());

  function listen (el) {
    var pasteHandler = selfie(handlePaste);
    el.addEventListener('keypress', preventCtrlYZ);
    el.addEventListener('keydown', selfie(handleCtrlYZ));
    el.addEventListener('keydown', selfie(handleModeChange));
    el.addEventListener('mousedown', setMoving);
    el.onpaste = pasteHandler;
    el.ondrop = pasteHandler;
  }

  function setMoving () {
    state.setMode('moving');
  }

  function selfie (fn) {
    return function handler (e) { return fn.call(null, state, e); };
  }
}

InputHistory.prototype.setInputMode = function (mode) {
  var state = this;
  state.inputMode = mode;
  state.reset();
};

InputHistory.prototype.reset = function () {
  var state = this;
  state.inputState = null;
  state.lastState = null;
  state.history = [];
  state.historyPointer = 0;
  state.historyMode = 'none';
  state.refreshing = null;
  state.refreshState(true);
  state.saveState();
  return state;
};

InputHistory.prototype.setCommandMode = function () {
  var state = this;
  state.historyMode = 'command';
  state.saveState();
  state.refreshing = setTimeout(function () {
    state.refreshState();
  }, 0);
};

InputHistory.prototype.canUndo = function () {
  return this.historyPointer > 1;
};

InputHistory.prototype.canRedo = function () {
  return this.history[this.historyPointer + 1];
};

InputHistory.prototype.undo = function () {
  var state = this;
  if (state.canUndo()) {
    if (state.lastState) {
      state.lastState.restore();
      state.lastState = null;
    } else {
      state.history[state.historyPointer] = new InputState(state.surface, state.inputMode);
      state.history[--state.historyPointer].restore();
    }
  }
  state.historyMode = 'none';
  state.surface.focus(state.inputMode);
  state.refreshState();
};

InputHistory.prototype.redo = function () {
  var state = this;
  if (state.canRedo()) {
    state.history[++state.historyPointer].restore();
  }

  state.historyMode = 'none';
  state.surface.focus(state.inputMode);
  state.refreshState();
};

InputHistory.prototype.setMode = function (value) {
  var state = this;
  if (state.historyMode !== value) {
    state.historyMode = value;
    state.saveState();
  }
  state.refreshing = setTimeout(function () {
    state.refreshState();
  }, 1);
};

InputHistory.prototype.refreshState = function (initialState) {
  var state = this;
  state.inputState = new InputState(state.surface, state.inputMode, initialState);
  state.refreshing = null;
};

InputHistory.prototype.saveState = function () {
  var state = this;
  var current = state.inputState || new InputState(state.surface, state.inputMode);

  if (state.historyMode === 'moving') {
    if (!state.lastState) {
      state.lastState = current;
    }
    return;
  }
  if (state.lastState) {
    if (state.history[state.historyPointer - 1].text !== state.lastState.text) {
      state.history[state.historyPointer++] = state.lastState;
    }
    state.lastState = null;
  }
  state.history[state.historyPointer++] = current;
  state.history[state.historyPointer + 1] = null;
};

function handleCtrlYZ (state, e) {
  var handled = false;
  var keyCode = e.charCode || e.keyCode;
  var keyCodeChar = String.fromCharCode(keyCode);

  if (e.ctrlKey || e.metaKey) {
    switch (keyCodeChar.toLowerCase()) {
      case 'y':
        state.redo();
        handled = true;
        break;

      case 'z':
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        handled = true;
        break;
    }
  }

  if (handled && e.preventDefault) {
    e.preventDefault();
  }
}

function handleModeChange (state, e) {
  if (e.ctrlKey || e.metaKey) {
    return;
  }

  var keyCode = e.keyCode;

  if ((keyCode >= 33 && keyCode <= 40) || (keyCode >= 63232 && keyCode <= 63235)) {
    state.setMode('moving');
  } else if (keyCode === 8 || keyCode === 46 || keyCode === 127) {
    state.setMode('deleting');
  } else if (keyCode === 13) {
    state.setMode('newlines');
  } else if (keyCode === 27) {
    state.setMode('escape');
  } else if ((keyCode < 16 || keyCode > 20) && keyCode !== 91) {
    state.setMode('typing');
  }
}

function handlePaste (state) {
  if (state.inputState && state.inputState.text !== state.surface.read(state.inputMode) && state.refreshing === null) {
    state.historyMode = 'paste';
    state.saveState();
    state.refreshState();
  }
}

function preventCtrlYZ (e) {
  var keyCode = e.charCode || e.keyCode;
  var yz = keyCode === 89 || keyCode === 90;
  var ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && yz) {
    e.preventDefault();
  }
}

module.exports = InputHistory;

},{"./InputState":2}],2:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var isVisibleElement = require('./isVisibleElement');
var fixEOL = require('./fixEOL');
var MarkdownChunks = require('./markdown/MarkdownChunks');
var HtmlChunks = require('./html/HtmlChunks');
var chunks = {
  markdown: MarkdownChunks,
  html: HtmlChunks,
  wysiwyg: HtmlChunks
};

function InputState (surface, mode, initialState) {
  this.mode = mode;
  this.surface = surface;
  this.initialState = initialState || false;
  this.init();
}

InputState.prototype.init = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (!isVisibleElement(el)) {
    return;
  }
  if (!this.initialState && doc.activeElement && doc.activeElement !== el) {
    return;
  }
  self.surface.readSelection(self);
  self.scrollTop = el.scrollTop;
  if (!self.text) {
    self.text = self.surface.read(self.mode);
  }
};

InputState.prototype.select = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (!isVisibleElement(el)) {
    return;
  }
  self.surface.writeSelection(self);
};

InputState.prototype.restore = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (typeof self.text === 'string' && self.text !== self.surface.read()) {
    self.surface.write(self.text);
  }
  self.select();
  el.scrollTop = self.scrollTop;
};

InputState.prototype.getChunks = function () {
  var self = this;
  var chunk = new chunks[self.mode]();
  chunk.before = fixEOL(self.text.substring(0, self.start));
  chunk.startTag = '';
  chunk.selection = fixEOL(self.text.substring(self.start, self.end));
  chunk.endTag = '';
  chunk.after = fixEOL(self.text.substring(self.end));
  chunk.scrollTop = self.scrollTop;
  self.cachedChunks = chunk;
  return chunk;
};

InputState.prototype.setChunks = function (chunk) {
  var self = this;
  chunk.before = chunk.before + chunk.startTag;
  chunk.after = chunk.endTag + chunk.after;
  self.start = chunk.before.length;
  self.end = chunk.before.length + chunk.selection.length;
  self.text = chunk.before + chunk.selection + chunk.after;
  self.scrollTop = chunk.scrollTop;
};

module.exports = InputState;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9JbnB1dFN0YXRlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgaXNWaXNpYmxlRWxlbWVudCA9IHJlcXVpcmUoJy4vaXNWaXNpYmxlRWxlbWVudCcpO1xudmFyIGZpeEVPTCA9IHJlcXVpcmUoJy4vZml4RU9MJyk7XG52YXIgTWFya2Rvd25DaHVua3MgPSByZXF1aXJlKCcuL21hcmtkb3duL01hcmtkb3duQ2h1bmtzJyk7XG52YXIgSHRtbENodW5rcyA9IHJlcXVpcmUoJy4vaHRtbC9IdG1sQ2h1bmtzJyk7XG52YXIgY2h1bmtzID0ge1xuICBtYXJrZG93bjogTWFya2Rvd25DaHVua3MsXG4gIGh0bWw6IEh0bWxDaHVua3MsXG4gIHd5c2l3eWc6IEh0bWxDaHVua3Ncbn07XG5cbmZ1bmN0aW9uIElucHV0U3RhdGUgKHN1cmZhY2UsIG1vZGUsIGluaXRpYWxTdGF0ZSkge1xuICB0aGlzLm1vZGUgPSBtb2RlO1xuICB0aGlzLnN1cmZhY2UgPSBzdXJmYWNlO1xuICB0aGlzLmluaXRpYWxTdGF0ZSA9IGluaXRpYWxTdGF0ZSB8fCBmYWxzZTtcbiAgdGhpcy5pbml0KCk7XG59XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKCFpc1Zpc2libGVFbGVtZW50KGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXRoaXMuaW5pdGlhbFN0YXRlICYmIGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBlbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBzZWxmLnN1cmZhY2UucmVhZFNlbGVjdGlvbihzZWxmKTtcbiAgc2VsZi5zY3JvbGxUb3AgPSBlbC5zY3JvbGxUb3A7XG4gIGlmICghc2VsZi50ZXh0KSB7XG4gICAgc2VsZi50ZXh0ID0gc2VsZi5zdXJmYWNlLnJlYWQoc2VsZi5tb2RlKTtcbiAgfVxufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICghaXNWaXNpYmxlRWxlbWVudChlbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5zdXJmYWNlLndyaXRlU2VsZWN0aW9uKHNlbGYpO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUucmVzdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAodHlwZW9mIHNlbGYudGV4dCA9PT0gJ3N0cmluZycgJiYgc2VsZi50ZXh0ICE9PSBzZWxmLnN1cmZhY2UucmVhZCgpKSB7XG4gICAgc2VsZi5zdXJmYWNlLndyaXRlKHNlbGYudGV4dCk7XG4gIH1cbiAgc2VsZi5zZWxlY3QoKTtcbiAgZWwuc2Nyb2xsVG9wID0gc2VsZi5zY3JvbGxUb3A7XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5nZXRDaHVua3MgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNodW5rID0gbmV3IGNodW5rc1tzZWxmLm1vZGVdKCk7XG4gIGNodW5rLmJlZm9yZSA9IGZpeEVPTChzZWxmLnRleHQuc3Vic3RyaW5nKDAsIHNlbGYuc3RhcnQpKTtcbiAgY2h1bmsuc3RhcnRUYWcgPSAnJztcbiAgY2h1bmsuc2VsZWN0aW9uID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoc2VsZi5zdGFydCwgc2VsZi5lbmQpKTtcbiAgY2h1bmsuZW5kVGFnID0gJyc7XG4gIGNodW5rLmFmdGVyID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoc2VsZi5lbmQpKTtcbiAgY2h1bmsuc2Nyb2xsVG9wID0gc2VsZi5zY3JvbGxUb3A7XG4gIHNlbGYuY2FjaGVkQ2h1bmtzID0gY2h1bms7XG4gIHJldHVybiBjaHVuaztcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLnNldENodW5rcyA9IGZ1bmN0aW9uIChjaHVuaykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGNodW5rLmJlZm9yZSA9IGNodW5rLmJlZm9yZSArIGNodW5rLnN0YXJ0VGFnO1xuICBjaHVuay5hZnRlciA9IGNodW5rLmVuZFRhZyArIGNodW5rLmFmdGVyO1xuICBzZWxmLnN0YXJ0ID0gY2h1bmsuYmVmb3JlLmxlbmd0aDtcbiAgc2VsZi5lbmQgPSBjaHVuay5iZWZvcmUubGVuZ3RoICsgY2h1bmsuc2VsZWN0aW9uLmxlbmd0aDtcbiAgc2VsZi50ZXh0ID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc2VsZWN0aW9uICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc2Nyb2xsVG9wID0gY2h1bmsuc2Nyb2xsVG9wO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dFN0YXRlO1xuIl19
},{"./fixEOL":10,"./html/HtmlChunks":12,"./isVisibleElement":21,"./markdown/MarkdownChunks":24}],3:[function(require,module,exports){
'use strict';

var Manager = require('./manager');

var manager = new Manager();

function barkmark (textarea, options) {
  return manager.get(textarea, options);
}

barkmark.find = function (textarea) {
  return manager.find(textarea);
};

barkmark.strings = require('./strings');

module.exports = barkmark;

},{"./manager":22,"./strings":42}],4:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var commands = {
  markdown: {
    boldOrItalic: require('./markdown/boldOrItalic'),
    linkOrImageOrAttachment: require('./markdown/linkOrImageOrAttachment'),
    blockquote: require('./markdown/blockquote'),
    codeblock: require('./markdown/codeblock'),
    heading: require('./markdown/heading'),
    list: require('./markdown/list'),
    hr: require('./markdown/hr')
  },
  html: {
    boldOrItalic: require('./html/boldOrItalic'),
    linkOrImageOrAttachment: require('./html/linkOrImageOrAttachment'),
    blockquote: require('./html/blockquote'),
    codeblock: require('./html/codeblock'),
    heading: require('./html/heading'),
    list: require('./html/list'),
    hr: require('./html/hr')
  }
};

commands.wysiwyg = commands.html;

function bindCommands (editor, options) {
  bind('bold', 'b', bold);
  bind('italic', 'i', italic);
  bind('quote', 'j', router('blockquote'));
  bind('code', 'e', code);
  bind('ol', 'o', ol);
  bind('ul', 'u', ul);
  bind('heading', 'd', router('heading'));
  editor.showLinkDialog = fabricator(bind('link', 'k', linkOrImageOrAttachment('link')));
  editor.showImageDialog = fabricator(bind('image', 'g', linkOrImageOrAttachment('image')));
  editor.linkOrImageOrAttachment = linkOrImageOrAttachment;

  if (options.attachments) {
    editor.showAttachmentDialog = fabricator(bind('attachment', 'k', true, linkOrImageOrAttachment('attachment')));
  }
  if (options.hr) { bind('hr', 'cmd+n', router('hr')); }

  function fabricator (el) {
    return function open () {
      utils.dispatchClickEvent(el);
    };
  }
  function bold (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'bold');
  }
  function italic (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'italic');
  }
  function code (mode, chunks) {
    commands[mode].codeblock(chunks, { fencing: options.fencing });
  }
  function ul (mode, chunks) {
    commands[mode].list(chunks, false);
  }
  function ol (mode, chunks) {
    commands[mode].list(chunks, true);
  }
  function linkOrImageOrAttachment (type, autoUpload) {
    return function linkOrImageOrAttachmentInvoke (mode, chunks) {
      commands[mode].linkOrImageOrAttachment.call(this, chunks, {
        editor: editor,
        mode: mode,
        type: type,
        prompts: options.prompts,
        upload: options[type + 's'],
        classes: options.classes,
        mergeHtmlAndAttachment: options.mergeHtmlAndAttachment,
        autoUpload: autoUpload
      });
    };
  }
  function bind (id, key, shift, fn) {
    if(arguments.length === 3) {
      fn = shift;
      shift = undefined;
    }

    return editor.addCommandButton(id, key, shift, suppress(fn));
  }
  function router (method) {
    return function routed (mode, chunks) { commands[mode][method].call(this, chunks); };
  }
  function stop (e) {
    e.preventDefault(); e.stopPropagation();
  }
  function suppress (fn) {
    return function suppressor (e, mode, chunks) { stop(e); fn.call(this, mode, chunks); };
  }
}

module.exports = bindCommands;

},{"./html/blockquote":13,"./html/boldOrItalic":14,"./html/codeblock":15,"./html/heading":16,"./html/hr":17,"./html/linkOrImageOrAttachment":18,"./html/list":19,"./markdown/blockquote":25,"./markdown/boldOrItalic":26,"./markdown/codeblock":27,"./markdown/heading":28,"./markdown/hr":29,"./markdown/linkOrImageOrAttachment":30,"./markdown/list":31,"./utils":44}],5:[function(require,module,exports){
'use strict';

var rinput = /^\s*(.*?)(?:\s+"(.+)")?\s*$/;
var rfull = /^(?:https?|ftp):\/\//;

function parseLinkInput (input) {
  return parser.apply(null, input.match(rinput));

  function parser (all, link, title) {
    var href = link.replace(/\?.*$/, queryUnencodedReplacer);
    href = decodeURIComponent(href);
    href = encodeURI(href).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    href = href.replace(/\?.*$/, queryEncodedReplacer);

    return {
      href: formatHref(href), title: formatTitle(title)
    };
  }
}

function queryUnencodedReplacer (query) {
  return query.replace(/\+/g, ' ');
}

function queryEncodedReplacer (query) {
  return query.replace(/\+/g, '%2b');
}

function formatTitle (title) {
  if (!title) {
    return null;
  }

  return title
    .replace(/^\s+|\s+$/g, '')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatHref (url) {
  var href = url.replace(/^\s+|\s+$/g, '');
  if (href.length && href[0] !== '/' && !rfull.test(href)) {
    return 'http://' + href;
  }
  return href;
}

module.exports = parseLinkInput;

},{}],6:[function(require,module,exports){
'use strict';

function trim (remove) {
  var self = this;

  if (remove) {
    beforeReplacer = afterReplacer = '';
  }
  self.selection = self.selection.replace(/^(\s*)/, beforeReplacer).replace(/(\s*)$/, afterReplacer);

  function beforeReplacer (text) {
    self.before += text; return '';
  }
  function afterReplacer (text) {
    self.after = text + self.after; return '';
  }
}

module.exports = trim;

},{}],7:[function(require,module,exports){
'use strict';

var rtrim = /^\s+|\s+$/g;
var rspaces = /\s+/g;

function addClass (el, cls) {
  var current = el.className;
  if (current.indexOf(cls) === -1) {
    el.className = (current + ' ' + cls).replace(rtrim, '');
  }
}

function rmClass (el, cls) {
  el.className = el.className.replace(cls, '').replace(rtrim, '').replace(rspaces, ' ');
}

module.exports = {
  add: addClass,
  rm: rmClass
};

},{}],8:[function(require,module,exports){
(function (global){
'use strict';

var utils = require('./utils');
// var uploads = require('./uploads');
var strings = require('./strings');
var bindCommands = require('./bindCommands');
var InputHistory = require('./InputHistory');
var ShortcutManager = require('./shortcuts');
var getCommandHandler = require('./getCommandHandler');
var TextSurface = require('./modes/markdown/textareaSurface');
var WysiwygSurface = require('./modes/wysiwyg/wysiwygSurface');
var classes = require('./classes');
var renderers = require('./renderers');
var prompt = require('./prompts/prompt');
var closePrompts = require('./prompts/close');
var modeNames = ['markdown', 'wysiwyg'];
var mac = /\bMac OS\b/.test(global.navigator.userAgent);
var doc = document;
var rparagraph = /^<p><\/p>\n?$/i;

function Editor (textarea, options) {
  var self = this;
  this.textarea = textarea;
  var parent = textarea.parentNode;
  var o = this.options = utils.defaultsDeep(options || {}, {
    // Default Option Values
    markdown: true,
    wysiwyg: true,
    hr: false,
    storage: true,
    fencing: true,
    render: {
      modes: {},
      commands: {},
    },
    prompts: {
      link: prompt,
      image: prompt,
      attachment: prompt,
      close: closePrompts,
    },
    classes: {
      wysiwyg: [],
      prompts: {},
      input: {},
    },
  });

  if (!o.markdown && !o.wysiwyg) {
    throw new Error('barkmark expects at least one input mode to be available');
  }

  if (o.storage === true) { o.storage = 'barkmark_input_mode'; }

  var preference = o.storage && JSON.parse(localStorage.getItem(o.storage));
  if (preference) {
    o.defaultMode = preference;
  }

  this.components = {
    textarea: textarea,
    droparea: tag({ c: 'wk-container-drop' }),
    switchboard: tag({ c: 'wk-switchboard' }),
    commands: tag({ c: 'wk-commands' }),
    editable: tag({ c: ['wk-wysiwyg', 'wk-hide'].concat(o.classes.wysiwyg).join(' ') }),
  };

  this.modes = {
    wysiwyg: {
      element: this.components.editable,
      button: tag({ t: 'button', c: 'wk-mode wk-mode-inactive' }),
      surface: new WysiwygSurface(this.components.editable),
      set: wysiwygMode
    },
    markdown: {
      element: textarea,
      button: tag({ t: 'button', c: 'wk-mode wk-mode-active' }),
      surface: new TextSurface(textarea),
      set: markdownMode
    },
  };
  this.modes.wysiwyg.history = new InputHistory(this.modes.wysiwyg.surface, 'wysiwyg');
  this.modes.markdown.history = new InputHistory(this.modes.markdown.surface, 'markdown');
  this.mode = 'markdown';

  this.shortcuts = new ShortcutManager();
  this.shortcuts.attach(this.modes.wysiwyg.element);
  this.shortcuts.attach(this.modes.markdown.element);

  tag({ t: 'span', c: 'wk-drop-text', x: strings.prompts.drop, p: this.components.droparea });
  tag({ t: 'p', c: ['wk-drop-icon'].concat(o.classes.dropicon).join(' '), p: this.components.droparea });

  this.components.editable.contentEditable = true;
  this.modes.markdown.button.setAttribute('disabled', 'disabled');
  modeNames.forEach(addMode);

  if (o.wysiwyg) {
    this.placeholder = tag({ c: 'wk-wysiwyg-placeholder wk-hide', x: textarea.placeholder });
    this.placeholder.addEventListener('click', this.modes.wysiwyg.surface.focus.bind(this.modes.wysiwyg.surface));
  }

  if (o.defaultMode && o[o.defaultMode]) {
    this.modes[o.defaultMode].set();
  } else if (o.markdown) {
    this.modes.markdown.set();
  } else {
    this.modes.wysiwyg.set();
  }

  bindCommands(this, o);
  bindEvents();

  function addMode (id) {
    var button = self.modes[id].button;
    var custom = o.render.modes;
    if (o[id]) {
      self.components.switchboard.appendChild(button);
      (typeof custom === 'function' ? custom : renderers.modes)(button, id);
      button.addEventListener('click', self.modes[id].set);
      button.type = 'button';
      button.tabIndex = -1;

      var title = strings.titles[id];
      if (title) {
        button.setAttribute('title', mac ? macify(title) : title);
      }
    }
  }

  function bindEvents (remove) {
    var ar = remove ? 'rm' : 'add';
    var mov = remove ? 'removeChild' : 'appendChild';
    if (remove) {
      self.shortcuts.clear();
    } else {
      if (o.markdown) { self.shortcuts.add('m', markdownMode); }
      if (o.wysiwyg) { self.shortcuts.add('p', wysiwygMode); }
    }
    classes[ar](parent, 'wk-container');
    if(remove) {
      parent[mov](self.components.commands);
    } else {
      parent.insertBefore(self.components.commands, self.textarea);
    }
    parent[mov](self.components.editable);
    if (self.placeholder) { parent[mov](self.placeholder); }
    parent[mov](self.components.switchboard);
    // TODO
    // if (self.options.images || self.options.attachments) {
      // parent[mov](self.components.droparea);
      // uploads(parent, self.components.droparea, self, o, remove);
    // }
  }

  function markdownMode (e) { self.setMode('markdown', e); }
  function wysiwygMode (e) { self.setMode('wysiwyg', e); }
}

Editor.prototype.getSurface = function () {
  return this.modes[this.mode].surface;
};

Editor.prototype.addCommand = function (key, shift, fn) {
  if(arguments.length === 2) {
    fn = shift;
    shift = undefined;
  }

  this.shortcuts.add(key, shift, getCommandHandler(this, this.modes[this.mode].history, fn));
};

Editor.prototype.addCommandButton = function (id, key, shift, fn) {
  if (arguments.length === 2) {
    fn = key;
    key = undefined;
    shift = undefined;
  } else if (arguments.length === 3) {
    fn = shift;
    shift = undefined;
  }

  var button = tag({ t: 'button', c: 'wk-command', p: this.components.commands });
  var custom = this.options.render.commands;
  var render = typeof custom === 'function' ? custom : renderers.commands;
  var title = strings.titles[id];
  if (title) {
    button.setAttribute('title', mac ? macify(title) : title);
  }
  button.type = 'button';
  button.tabIndex = -1;
  render(button, id);
  button.addEventListener('click', getCommandHandler(this, this.modes[this.mode].history, fn));
  if (key) {
    this.addCommand(key, shift, fn);
  }
  return button;
};

Editor.prototype.runCommand = function (fn) {
  getCommandHandler(this, this.modes[this.mode].history, rearrange)(null);

  function rearrange (e, mode, chunks) {
    return fn.call(this, chunks, mode);
  }
};

Editor.prototype.parseMarkdown = function () {
  return this.options.parseMarkdown.apply(this.options.parseMarkdown, arguments);
};

Editor.prototype.parseHTML = function () {
  return this.options.parseHTML.apply(this.options.parseHTML, arguments);
};

Editor.prototype.destroy = function () {
  if (this.mode !== 'markdown') {
    this.textarea.value = this.getMarkdown();
  }
  classes.rm(this.textarea, 'wk-hide');
  // bindEvents(true); // TODO
};

Editor.prototype.value = function getOrSetValue (input) {
  var markdown = String(input);
  var self = this;

  var sets = arguments.length === 1;
  if (sets) {
    if (this.mode === 'wysiwyg') {
      markdown = asHtml();
    }
    this.getSurface().write(markdown);
    this.modes[this.mode].history.reset();
  }

  return this.getMarkdown();

  function asHtml () {
    return self.options.parseMarkdown(markdown);
  }
};

Editor.prototype.setMode = function (goToMode, e) {
  var self = this;
  var currentMode = this.modes[this.mode] || {};
  var nextMode = this.modes[goToMode];
  var old = currentMode.button;
  var button = nextMode.button;
  var focusing = !!e || doc.activeElement === currentMode.element || doc.activeElement === nextMode.element;

  stop(e);

  if (currentMode === nextMode) {
    return;
  }

  this.textarea.blur(); // avert chrome repaint bugs

  var value = this.getSurface().read();
  if (goToMode === 'markdown') {
    value = parse('parseHTML', value).trim();
  } else if (goToMode === 'wysiwyg') {
    value = parse('parseMarkdown', value).replace(rparagraph, '').trim();
  }
  nextMode.surface.write(value);

  classes.add(currentMode.element, 'wk-hide');
  classes.rm(nextMode.element, 'wk-hide');

  if (goToMode === 'wysiwyg') {
    if (this.placeholder) { classes.rm(this.placeholder, 'wk-hide'); }
  } else {
    if (this.placeholder) { classes.add(this.placeholder, 'wk-hide'); }
  }

  if (focusing) {
    nextMode.surface.focus();
  }

  classes.add(button, 'wk-mode-active');
  classes.rm(old, 'wk-mode-active');
  classes.add(old, 'wk-mode-inactive');
  classes.rm(button, 'wk-mode-inactive');
  button.setAttribute('disabled', 'disabled');
  old.removeAttribute('disabled');
  this.mode = goToMode;

  if (this.options.storage) {
    localStorage.setItem(this.options.storage, JSON.stringify(goToMode));
  }

  // this.history.setInputMode(goToMode);
  fireLater.call(this, 'barkmark-mode-change');

  function parse (method, input) {
    return self.options[method](input);
  }
};

Editor.prototype.getMarkdown = function () {
  if (this.mode === 'wysiwyg') {
    return this.options.parseHTML(this.modes.wysiwyg.element);
  }
  return this.textarea.value;
};

/*
  var editor = {
    addCommand: addCommand,
    addCommandButton: addCommandButton,
    runCommand: runCommand,
    parseMarkdown: o.parseMarkdown,
    parseHTML: o.parseHTML,
    destroy: destroy,
    value: getOrSetValue,
    textarea: textarea,
    editable: o.wysiwyg ? editable : null,
    setMode: persistMode,
    history: {
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo
    },
    mode: 'markdown'
  };
*/

function fireLater (type) {
  var self = this;
  setTimeout(function fire () {
    utils.dispatchCustomEvent(self.textarea, type);
  }, 0);
}

function tag (options) {
  var o = options || {};
  var el = doc.createElement(o.t || 'div');
  el.className = o.c || '';
  el.textContent = o.x || '';
  if (o.p) { o.p.appendChild(el); }
  return el;
}

function stop (e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
}

function macify (text) {
  return text
    .replace(/\bctrl\b/i, '\u2318')
    .replace(/\balt\b/i, '\u2325')
    .replace(/\bshift\b/i, '\u21e7');
}

module.exports = Editor;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9lZGl0b3IuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG4vLyB2YXIgdXBsb2FkcyA9IHJlcXVpcmUoJy4vdXBsb2FkcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcbnZhciBiaW5kQ29tbWFuZHMgPSByZXF1aXJlKCcuL2JpbmRDb21tYW5kcycpO1xudmFyIElucHV0SGlzdG9yeSA9IHJlcXVpcmUoJy4vSW5wdXRIaXN0b3J5Jyk7XG52YXIgU2hvcnRjdXRNYW5hZ2VyID0gcmVxdWlyZSgnLi9zaG9ydGN1dHMnKTtcbnZhciBnZXRDb21tYW5kSGFuZGxlciA9IHJlcXVpcmUoJy4vZ2V0Q29tbWFuZEhhbmRsZXInKTtcbnZhciBUZXh0U3VyZmFjZSA9IHJlcXVpcmUoJy4vbW9kZXMvbWFya2Rvd24vdGV4dGFyZWFTdXJmYWNlJyk7XG52YXIgV3lzaXd5Z1N1cmZhY2UgPSByZXF1aXJlKCcuL21vZGVzL3d5c2l3eWcvd3lzaXd5Z1N1cmZhY2UnKTtcbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi9jbGFzc2VzJyk7XG52YXIgcmVuZGVyZXJzID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMnKTtcbnZhciBwcm9tcHQgPSByZXF1aXJlKCcuL3Byb21wdHMvcHJvbXB0Jyk7XG52YXIgY2xvc2VQcm9tcHRzID0gcmVxdWlyZSgnLi9wcm9tcHRzL2Nsb3NlJyk7XG52YXIgbW9kZU5hbWVzID0gWydtYXJrZG93bicsICd3eXNpd3lnJ107XG52YXIgbWFjID0gL1xcYk1hYyBPU1xcYi8udGVzdChnbG9iYWwubmF2aWdhdG9yLnVzZXJBZ2VudCk7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgcnBhcmFncmFwaCA9IC9ePHA+PFxcL3A+XFxuPyQvaTtcblxuZnVuY3Rpb24gRWRpdG9yICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHRoaXMudGV4dGFyZWEgPSB0ZXh0YXJlYTtcbiAgdmFyIHBhcmVudCA9IHRleHRhcmVhLnBhcmVudE5vZGU7XG4gIHZhciBvID0gdGhpcy5vcHRpb25zID0gdXRpbHMuZGVmYXVsdHNEZWVwKG9wdGlvbnMgfHwge30sIHtcbiAgICAvLyBEZWZhdWx0IE9wdGlvbiBWYWx1ZXNcbiAgICBtYXJrZG93bjogdHJ1ZSxcbiAgICB3eXNpd3lnOiB0cnVlLFxuICAgIGhyOiBmYWxzZSxcbiAgICBzdG9yYWdlOiB0cnVlLFxuICAgIGZlbmNpbmc6IHRydWUsXG4gICAgcmVuZGVyOiB7XG4gICAgICBtb2Rlczoge30sXG4gICAgICBjb21tYW5kczoge30sXG4gICAgfSxcbiAgICBwcm9tcHRzOiB7XG4gICAgICBsaW5rOiBwcm9tcHQsXG4gICAgICBpbWFnZTogcHJvbXB0LFxuICAgICAgYXR0YWNobWVudDogcHJvbXB0LFxuICAgICAgY2xvc2U6IGNsb3NlUHJvbXB0cyxcbiAgICB9LFxuICAgIGNsYXNzZXM6IHtcbiAgICAgIHd5c2l3eWc6IFtdLFxuICAgICAgcHJvbXB0czoge30sXG4gICAgICBpbnB1dDoge30sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFvLm1hcmtkb3duICYmICFvLnd5c2l3eWcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2JhcmttYXJrIGV4cGVjdHMgYXQgbGVhc3Qgb25lIGlucHV0IG1vZGUgdG8gYmUgYXZhaWxhYmxlJyk7XG4gIH1cblxuICBpZiAoby5zdG9yYWdlID09PSB0cnVlKSB7IG8uc3RvcmFnZSA9ICdiYXJrbWFya19pbnB1dF9tb2RlJzsgfVxuXG4gIHZhciBwcmVmZXJlbmNlID0gby5zdG9yYWdlICYmIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oby5zdG9yYWdlKSk7XG4gIGlmIChwcmVmZXJlbmNlKSB7XG4gICAgby5kZWZhdWx0TW9kZSA9IHByZWZlcmVuY2U7XG4gIH1cblxuICB0aGlzLmNvbXBvbmVudHMgPSB7XG4gICAgdGV4dGFyZWE6IHRleHRhcmVhLFxuICAgIGRyb3BhcmVhOiB0YWcoeyBjOiAnd2stY29udGFpbmVyLWRyb3AnIH0pLFxuICAgIHN3aXRjaGJvYXJkOiB0YWcoeyBjOiAnd2stc3dpdGNoYm9hcmQnIH0pLFxuICAgIGNvbW1hbmRzOiB0YWcoeyBjOiAnd2stY29tbWFuZHMnIH0pLFxuICAgIGVkaXRhYmxlOiB0YWcoeyBjOiBbJ3drLXd5c2l3eWcnLCAnd2staGlkZSddLmNvbmNhdChvLmNsYXNzZXMud3lzaXd5Zykuam9pbignICcpIH0pLFxuICB9O1xuXG4gIHRoaXMubW9kZXMgPSB7XG4gICAgd3lzaXd5Zzoge1xuICAgICAgZWxlbWVudDogdGhpcy5jb21wb25lbnRzLmVkaXRhYmxlLFxuICAgICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLW1vZGUgd2stbW9kZS1pbmFjdGl2ZScgfSksXG4gICAgICBzdXJmYWNlOiBuZXcgV3lzaXd5Z1N1cmZhY2UodGhpcy5jb21wb25lbnRzLmVkaXRhYmxlKSxcbiAgICAgIHNldDogd3lzaXd5Z01vZGVcbiAgICB9LFxuICAgIG1hcmtkb3duOiB7XG4gICAgICBlbGVtZW50OiB0ZXh0YXJlYSxcbiAgICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1tb2RlIHdrLW1vZGUtYWN0aXZlJyB9KSxcbiAgICAgIHN1cmZhY2U6IG5ldyBUZXh0U3VyZmFjZSh0ZXh0YXJlYSksXG4gICAgICBzZXQ6IG1hcmtkb3duTW9kZVxuICAgIH0sXG4gIH07XG4gIHRoaXMubW9kZXMud3lzaXd5Zy5oaXN0b3J5ID0gbmV3IElucHV0SGlzdG9yeSh0aGlzLm1vZGVzLnd5c2l3eWcuc3VyZmFjZSwgJ3d5c2l3eWcnKTtcbiAgdGhpcy5tb2Rlcy5tYXJrZG93bi5oaXN0b3J5ID0gbmV3IElucHV0SGlzdG9yeSh0aGlzLm1vZGVzLm1hcmtkb3duLnN1cmZhY2UsICdtYXJrZG93bicpO1xuICB0aGlzLm1vZGUgPSAnbWFya2Rvd24nO1xuXG4gIHRoaXMuc2hvcnRjdXRzID0gbmV3IFNob3J0Y3V0TWFuYWdlcigpO1xuICB0aGlzLnNob3J0Y3V0cy5hdHRhY2godGhpcy5tb2Rlcy53eXNpd3lnLmVsZW1lbnQpO1xuICB0aGlzLnNob3J0Y3V0cy5hdHRhY2godGhpcy5tb2Rlcy5tYXJrZG93bi5lbGVtZW50KTtcblxuICB0YWcoeyB0OiAnc3BhbicsIGM6ICd3ay1kcm9wLXRleHQnLCB4OiBzdHJpbmdzLnByb21wdHMuZHJvcCwgcDogdGhpcy5jb21wb25lbnRzLmRyb3BhcmVhIH0pO1xuICB0YWcoeyB0OiAncCcsIGM6IFsnd2stZHJvcC1pY29uJ10uY29uY2F0KG8uY2xhc3Nlcy5kcm9waWNvbikuam9pbignICcpLCBwOiB0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEgfSk7XG5cbiAgdGhpcy5jb21wb25lbnRzLmVkaXRhYmxlLmNvbnRlbnRFZGl0YWJsZSA9IHRydWU7XG4gIHRoaXMubW9kZXMubWFya2Rvd24uYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgbW9kZU5hbWVzLmZvckVhY2goYWRkTW9kZSk7XG5cbiAgaWYgKG8ud3lzaXd5Zykge1xuICAgIHRoaXMucGxhY2Vob2xkZXIgPSB0YWcoeyBjOiAnd2std3lzaXd5Zy1wbGFjZWhvbGRlciB3ay1oaWRlJywgeDogdGV4dGFyZWEucGxhY2Vob2xkZXIgfSk7XG4gICAgdGhpcy5wbGFjZWhvbGRlci5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHRoaXMubW9kZXMud3lzaXd5Zy5zdXJmYWNlLmZvY3VzLmJpbmQodGhpcy5tb2Rlcy53eXNpd3lnLnN1cmZhY2UpKTtcbiAgfVxuXG4gIGlmIChvLmRlZmF1bHRNb2RlICYmIG9bby5kZWZhdWx0TW9kZV0pIHtcbiAgICB0aGlzLm1vZGVzW28uZGVmYXVsdE1vZGVdLnNldCgpO1xuICB9IGVsc2UgaWYgKG8ubWFya2Rvd24pIHtcbiAgICB0aGlzLm1vZGVzLm1hcmtkb3duLnNldCgpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubW9kZXMud3lzaXd5Zy5zZXQoKTtcbiAgfVxuXG4gIGJpbmRDb21tYW5kcyh0aGlzLCBvKTtcbiAgYmluZEV2ZW50cygpO1xuXG4gIGZ1bmN0aW9uIGFkZE1vZGUgKGlkKSB7XG4gICAgdmFyIGJ1dHRvbiA9IHNlbGYubW9kZXNbaWRdLmJ1dHRvbjtcbiAgICB2YXIgY3VzdG9tID0gby5yZW5kZXIubW9kZXM7XG4gICAgaWYgKG9baWRdKSB7XG4gICAgICBzZWxmLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQuYXBwZW5kQ2hpbGQoYnV0dG9uKTtcbiAgICAgICh0eXBlb2YgY3VzdG9tID09PSAnZnVuY3Rpb24nID8gY3VzdG9tIDogcmVuZGVyZXJzLm1vZGVzKShidXR0b24sIGlkKTtcbiAgICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHNlbGYubW9kZXNbaWRdLnNldCk7XG4gICAgICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICAgICAgYnV0dG9uLnRhYkluZGV4ID0gLTE7XG5cbiAgICAgIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsIG1hYyA/IG1hY2lmeSh0aXRsZSkgOiB0aXRsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZEV2ZW50cyAocmVtb3ZlKSB7XG4gICAgdmFyIGFyID0gcmVtb3ZlID8gJ3JtJyA6ICdhZGQnO1xuICAgIHZhciBtb3YgPSByZW1vdmUgPyAncmVtb3ZlQ2hpbGQnIDogJ2FwcGVuZENoaWxkJztcbiAgICBpZiAocmVtb3ZlKSB7XG4gICAgICBzZWxmLnNob3J0Y3V0cy5jbGVhcigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoby5tYXJrZG93bikgeyBzZWxmLnNob3J0Y3V0cy5hZGQoJ20nLCBtYXJrZG93bk1vZGUpOyB9XG4gICAgICBpZiAoby53eXNpd3lnKSB7IHNlbGYuc2hvcnRjdXRzLmFkZCgncCcsIHd5c2l3eWdNb2RlKTsgfVxuICAgIH1cbiAgICBjbGFzc2VzW2FyXShwYXJlbnQsICd3ay1jb250YWluZXInKTtcbiAgICBpZihyZW1vdmUpIHtcbiAgICAgIHBhcmVudFttb3ZdKHNlbGYuY29tcG9uZW50cy5jb21tYW5kcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmVudC5pbnNlcnRCZWZvcmUoc2VsZi5jb21wb25lbnRzLmNvbW1hbmRzLCBzZWxmLnRleHRhcmVhKTtcbiAgICB9XG4gICAgcGFyZW50W21vdl0oc2VsZi5jb21wb25lbnRzLmVkaXRhYmxlKTtcbiAgICBpZiAoc2VsZi5wbGFjZWhvbGRlcikgeyBwYXJlbnRbbW92XShzZWxmLnBsYWNlaG9sZGVyKTsgfVxuICAgIHBhcmVudFttb3ZdKHNlbGYuY29tcG9uZW50cy5zd2l0Y2hib2FyZCk7XG4gICAgLy8gVE9ET1xuICAgIC8vIGlmIChzZWxmLm9wdGlvbnMuaW1hZ2VzIHx8IHNlbGYub3B0aW9ucy5hdHRhY2htZW50cykge1xuICAgICAgLy8gcGFyZW50W21vdl0oc2VsZi5jb21wb25lbnRzLmRyb3BhcmVhKTtcbiAgICAgIC8vIHVwbG9hZHMocGFyZW50LCBzZWxmLmNvbXBvbmVudHMuZHJvcGFyZWEsIHNlbGYsIG8sIHJlbW92ZSk7XG4gICAgLy8gfVxuICB9XG5cbiAgZnVuY3Rpb24gbWFya2Rvd25Nb2RlIChlKSB7IHNlbGYuc2V0TW9kZSgnbWFya2Rvd24nLCBlKTsgfVxuICBmdW5jdGlvbiB3eXNpd3lnTW9kZSAoZSkgeyBzZWxmLnNldE1vZGUoJ3d5c2l3eWcnLCBlKTsgfVxufVxuXG5FZGl0b3IucHJvdG90eXBlLmdldFN1cmZhY2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm1vZGVzW3RoaXMubW9kZV0uc3VyZmFjZTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuYWRkQ29tbWFuZCA9IGZ1bmN0aW9uIChrZXksIHNoaWZ0LCBmbikge1xuICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZm4gPSBzaGlmdDtcbiAgICBzaGlmdCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHRoaXMuc2hvcnRjdXRzLmFkZChrZXksIHNoaWZ0LCBnZXRDb21tYW5kSGFuZGxlcih0aGlzLCB0aGlzLm1vZGVzW3RoaXMubW9kZV0uaGlzdG9yeSwgZm4pKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuYWRkQ29tbWFuZEJ1dHRvbiA9IGZ1bmN0aW9uIChpZCwga2V5LCBzaGlmdCwgZm4pIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBmbiA9IGtleTtcbiAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGZuID0gc2hpZnQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICB2YXIgYnV0dG9uID0gdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1jb21tYW5kJywgcDogdGhpcy5jb21wb25lbnRzLmNvbW1hbmRzIH0pO1xuICB2YXIgY3VzdG9tID0gdGhpcy5vcHRpb25zLnJlbmRlci5jb21tYW5kcztcbiAgdmFyIHJlbmRlciA9IHR5cGVvZiBjdXN0b20gPT09ICdmdW5jdGlvbicgPyBjdXN0b20gOiByZW5kZXJlcnMuY29tbWFuZHM7XG4gIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgaWYgKHRpdGxlKSB7XG4gICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICB9XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuICByZW5kZXIoYnV0dG9uLCBpZCk7XG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCBmbikpO1xuICBpZiAoa2V5KSB7XG4gICAgdGhpcy5hZGRDb21tYW5kKGtleSwgc2hpZnQsIGZuKTtcbiAgfVxuICByZXR1cm4gYnV0dG9uO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5ydW5Db21tYW5kID0gZnVuY3Rpb24gKGZuKSB7XG4gIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCByZWFycmFuZ2UpKG51bGwpO1xuXG4gIGZ1bmN0aW9uIHJlYXJyYW5nZSAoZSwgbW9kZSwgY2h1bmtzKSB7XG4gICAgcmV0dXJuIGZuLmNhbGwodGhpcywgY2h1bmtzLCBtb2RlKTtcbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5wYXJzZU1hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5vcHRpb25zLnBhcnNlTWFya2Rvd24uYXBwbHkodGhpcy5vcHRpb25zLnBhcnNlTWFya2Rvd24sIGFyZ3VtZW50cyk7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnBhcnNlSFRNTCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9ucy5wYXJzZUhUTUwuYXBwbHkodGhpcy5vcHRpb25zLnBhcnNlSFRNTCwgYXJndW1lbnRzKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMubW9kZSAhPT0gJ21hcmtkb3duJykge1xuICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSB0aGlzLmdldE1hcmtkb3duKCk7XG4gIH1cbiAgY2xhc3Nlcy5ybSh0aGlzLnRleHRhcmVhLCAnd2staGlkZScpO1xuICAvLyBiaW5kRXZlbnRzKHRydWUpOyAvLyBUT0RPXG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnZhbHVlID0gZnVuY3Rpb24gZ2V0T3JTZXRWYWx1ZSAoaW5wdXQpIHtcbiAgdmFyIG1hcmtkb3duID0gU3RyaW5nKGlucHV0KTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHZhciBzZXRzID0gYXJndW1lbnRzLmxlbmd0aCA9PT0gMTtcbiAgaWYgKHNldHMpIHtcbiAgICBpZiAodGhpcy5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIG1hcmtkb3duID0gYXNIdG1sKCk7XG4gICAgfVxuICAgIHRoaXMuZ2V0U3VyZmFjZSgpLndyaXRlKG1hcmtkb3duKTtcbiAgICB0aGlzLm1vZGVzW3RoaXMubW9kZV0uaGlzdG9yeS5yZXNldCgpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXMuZ2V0TWFya2Rvd24oKTtcblxuICBmdW5jdGlvbiBhc0h0bWwgKCkge1xuICAgIHJldHVybiBzZWxmLm9wdGlvbnMucGFyc2VNYXJrZG93bihtYXJrZG93bik7XG4gIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUuc2V0TW9kZSA9IGZ1bmN0aW9uIChnb1RvTW9kZSwgZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBjdXJyZW50TW9kZSA9IHRoaXMubW9kZXNbdGhpcy5tb2RlXSB8fCB7fTtcbiAgdmFyIG5leHRNb2RlID0gdGhpcy5tb2Rlc1tnb1RvTW9kZV07XG4gIHZhciBvbGQgPSBjdXJyZW50TW9kZS5idXR0b247XG4gIHZhciBidXR0b24gPSBuZXh0TW9kZS5idXR0b247XG4gIHZhciBmb2N1c2luZyA9ICEhZSB8fCBkb2MuYWN0aXZlRWxlbWVudCA9PT0gY3VycmVudE1vZGUuZWxlbWVudCB8fCBkb2MuYWN0aXZlRWxlbWVudCA9PT0gbmV4dE1vZGUuZWxlbWVudDtcblxuICBzdG9wKGUpO1xuXG4gIGlmIChjdXJyZW50TW9kZSA9PT0gbmV4dE1vZGUpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLnRleHRhcmVhLmJsdXIoKTsgLy8gYXZlcnQgY2hyb21lIHJlcGFpbnQgYnVnc1xuXG4gIHZhciB2YWx1ZSA9IHRoaXMuZ2V0U3VyZmFjZSgpLnJlYWQoKTtcbiAgaWYgKGdvVG9Nb2RlID09PSAnbWFya2Rvd24nKSB7XG4gICAgdmFsdWUgPSBwYXJzZSgncGFyc2VIVE1MJywgdmFsdWUpLnRyaW0oKTtcbiAgfSBlbHNlIGlmIChnb1RvTW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgdmFsdWUgPSBwYXJzZSgncGFyc2VNYXJrZG93bicsIHZhbHVlKS5yZXBsYWNlKHJwYXJhZ3JhcGgsICcnKS50cmltKCk7XG4gIH1cbiAgbmV4dE1vZGUuc3VyZmFjZS53cml0ZSh2YWx1ZSk7XG5cbiAgY2xhc3Nlcy5hZGQoY3VycmVudE1vZGUuZWxlbWVudCwgJ3drLWhpZGUnKTtcbiAgY2xhc3Nlcy5ybShuZXh0TW9kZS5lbGVtZW50LCAnd2staGlkZScpO1xuXG4gIGlmIChnb1RvTW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgY2xhc3Nlcy5ybSh0aGlzLnBsYWNlaG9sZGVyLCAnd2staGlkZScpOyB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgY2xhc3Nlcy5hZGQodGhpcy5wbGFjZWhvbGRlciwgJ3drLWhpZGUnKTsgfVxuICB9XG5cbiAgaWYgKGZvY3VzaW5nKSB7XG4gICAgbmV4dE1vZGUuc3VyZmFjZS5mb2N1cygpO1xuICB9XG5cbiAgY2xhc3Nlcy5hZGQoYnV0dG9uLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgY2xhc3Nlcy5ybShvbGQsICd3ay1tb2RlLWFjdGl2ZScpO1xuICBjbGFzc2VzLmFkZChvbGQsICd3ay1tb2RlLWluYWN0aXZlJyk7XG4gIGNsYXNzZXMucm0oYnV0dG9uLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICBvbGQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICB0aGlzLm1vZGUgPSBnb1RvTW9kZTtcblxuICBpZiAodGhpcy5vcHRpb25zLnN0b3JhZ2UpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLm9wdGlvbnMuc3RvcmFnZSwgSlNPTi5zdHJpbmdpZnkoZ29Ub01vZGUpKTtcbiAgfVxuXG4gIC8vIHRoaXMuaGlzdG9yeS5zZXRJbnB1dE1vZGUoZ29Ub01vZGUpO1xuICBmaXJlTGF0ZXIuY2FsbCh0aGlzLCAnYmFya21hcmstbW9kZS1jaGFuZ2UnKTtcblxuICBmdW5jdGlvbiBwYXJzZSAobWV0aG9kLCBpbnB1dCkge1xuICAgIHJldHVybiBzZWxmLm9wdGlvbnNbbWV0aG9kXShpbnB1dCk7XG4gIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUuZ2V0TWFya2Rvd24gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgIHJldHVybiB0aGlzLm9wdGlvbnMucGFyc2VIVE1MKHRoaXMubW9kZXMud3lzaXd5Zy5lbGVtZW50KTtcbiAgfVxuICByZXR1cm4gdGhpcy50ZXh0YXJlYS52YWx1ZTtcbn07XG5cbi8qXG4gIHZhciBlZGl0b3IgPSB7XG4gICAgYWRkQ29tbWFuZDogYWRkQ29tbWFuZCxcbiAgICBhZGRDb21tYW5kQnV0dG9uOiBhZGRDb21tYW5kQnV0dG9uLFxuICAgIHJ1bkNvbW1hbmQ6IHJ1bkNvbW1hbmQsXG4gICAgcGFyc2VNYXJrZG93bjogby5wYXJzZU1hcmtkb3duLFxuICAgIHBhcnNlSFRNTDogby5wYXJzZUhUTUwsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICB2YWx1ZTogZ2V0T3JTZXRWYWx1ZSxcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IG8ud3lzaXd5ZyA/IGVkaXRhYmxlIDogbnVsbCxcbiAgICBzZXRNb2RlOiBwZXJzaXN0TW9kZSxcbiAgICBoaXN0b3J5OiB7XG4gICAgICB1bmRvOiBoaXN0b3J5LnVuZG8sXG4gICAgICByZWRvOiBoaXN0b3J5LnJlZG8sXG4gICAgICBjYW5VbmRvOiBoaXN0b3J5LmNhblVuZG8sXG4gICAgICBjYW5SZWRvOiBoaXN0b3J5LmNhblJlZG9cbiAgICB9LFxuICAgIG1vZGU6ICdtYXJrZG93bidcbiAgfTtcbiovXG5cbmZ1bmN0aW9uIGZpcmVMYXRlciAodHlwZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24gZmlyZSAoKSB7XG4gICAgdXRpbHMuZGlzcGF0Y2hDdXN0b21FdmVudChzZWxmLnRleHRhcmVhLCB0eXBlKTtcbiAgfSwgMCk7XG59XG5cbmZ1bmN0aW9uIHRhZyAob3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KG8udCB8fCAnZGl2Jyk7XG4gIGVsLmNsYXNzTmFtZSA9IG8uYyB8fCAnJztcbiAgZWwudGV4dENvbnRlbnQgPSBvLnggfHwgJyc7XG4gIGlmIChvLnApIHsgby5wLmFwcGVuZENoaWxkKGVsKTsgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgaWYgKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpOyB9XG59XG5cbmZ1bmN0aW9uIG1hY2lmeSAodGV4dCkge1xuICByZXR1cm4gdGV4dFxuICAgIC5yZXBsYWNlKC9cXGJjdHJsXFxiL2ksICdcXHUyMzE4JylcbiAgICAucmVwbGFjZSgvXFxiYWx0XFxiL2ksICdcXHUyMzI1JylcbiAgICAucmVwbGFjZSgvXFxic2hpZnRcXGIvaSwgJ1xcdTIxZTcnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3I7XG4iXX0=
},{"./InputHistory":1,"./bindCommands":4,"./classes":7,"./getCommandHandler":11,"./modes/markdown/textareaSurface":34,"./modes/wysiwyg/wysiwygSurface":35,"./prompts/close":37,"./prompts/prompt":38,"./renderers":40,"./shortcuts":41,"./strings":42,"./utils":44}],9:[function(require,module,exports){
'use strict';

function extendRegExp (regex, pre, post) {
  var pattern = regex.toString();
  var flags;

  pattern = pattern.replace(/\/([gim]*)$/, captureFlags);
  pattern = pattern.replace(/(^\/|\/$)/g, '');
  pattern = pre + pattern + post;
  return new RegExp(pattern, flags);

  function captureFlags (all, f) {
    flags = f;
    return '';
  }
}

module.exports = extendRegExp;

},{}],10:[function(require,module,exports){
'use strict';

function fixEOL (text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = fixEOL;

},{}],11:[function(require,module,exports){
'use strict';

var InputState = require('./InputState');

function getCommandHandler (editor, history, fn) {
  return function handleCommand (e) {
    var surface = editor.getSurface();
    surface.focus(true);
    history.setCommandMode();

    var state = new InputState(surface, editor.mode);
    var chunks = state.getChunks();
    var asyncHandler = {
      async: async, immediate: true
    };

    fn.call(asyncHandler, e, editor.mode, chunks);

    if (asyncHandler.immediate) {
      done();
    }

    function async () {
      asyncHandler.immediate = false;
      return done;
    }

    function done () {
      surface.focus();
      state.setChunks(chunks);
      state.restore();
    }
  };
}

module.exports = getCommandHandler;

},{"./InputState":2}],12:[function(require,module,exports){
'use strict';

var trimChunks = require('../chunks/trim');

function HtmlChunks () {
}

HtmlChunks.prototype.trim = trimChunks;

HtmlChunks.prototype.findTags = function () {
};

HtmlChunks.prototype.skip = function () {
};

module.exports = HtmlChunks;

},{"../chunks/trim":6}],13:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function blockquote (chunks) {
  wrapping('blockquote', strings.placeholders.quote, chunks);
}

module.exports = blockquote;

},{"../strings":42,"./wrapping":20}],14:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function boldOrItalic (chunks, type) {
  wrapping(type === 'bold' ? 'strong' : 'em', strings.placeholders[type], chunks);
}

module.exports = boldOrItalic;

},{"../strings":42,"./wrapping":20}],15:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function codeblock (chunks) {
  wrapping('pre><code', strings.placeholders.code, chunks);
}

module.exports = codeblock;

},{"../strings":42,"./wrapping":20}],16:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rleading = /<h([1-6])( [^>]*)?>$/;
var rtrailing = /^<\/h([1-6])>/;

function heading (chunks) {
  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail && lead[1] === trail[1]) {
    swap();
  } else {
    add();
  }

  function swap () {
    var level = parseInt(lead[1], 10);
    var next = level <= 1 ? 4 : level - 1;
    chunks.before = chunks.before.replace(rleading, '<h' + next + '>');
    chunks.after = chunks.after.replace(rtrailing, '</h' + next + '>');
  }

  function add () {
    if (!chunks.selection) {
      chunks.selection = strings.placeholders.heading;
    }
    chunks.before += '<h1>';
    chunks.after = '</h1>' + chunks.after;
  }
}

module.exports = heading;

},{"../strings":42}],17:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.before += '\n<hr>\n';
  chunks.selection = '';
}

module.exports = hr;

},{}],18:[function(require,module,exports){
'use strict';

var utils = require('../utils');
var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rleading = /<a( [^>]*)?>$/;
var rtrailing = /^<\/a>/;
var rimage = /<img( [^>]*)?\/>$/;

function linkOrImageOrAttachment (chunks, options) {
  var type = options.type;
  var image = type === 'image';
  var resume;

  if (type !== 'attachment') {
    chunks.trim();
  }

  if (removal()) {
    return;
  }

  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(options, once(resolved));

  function removal () {
    if (image) {
      if (rimage.test(chunks.selection)) {
        chunks.selection = '';
        return true;
      }
    } else if (rtrailing.exec(chunks.after) && rleading.exec(chunks.before)) {
      chunks.before = chunks.before.replace(rleading, '');
      chunks.after = chunks.after.replace(rtrailing, '');
      return true;
    }
  }

  function resolved (result) {
    var parts;
    var links = result.definitions.map(parseLinkInput).filter(long);
    if (links.length === 0) {
      resume(); return;
    }
    var link = links[0];

    if (type === 'attachment') {
      parts = options.mergeHtmlAndAttachment(chunks.before + chunks.selection + chunks.after, link);
      chunks.before = parts.before;
      chunks.selection = parts.selection;
      chunks.after = parts.after;
      resume();
      utils.dispatchCustomEvent(options.surface.textarea, 'woofmark-mode-change');
      return;
    }

    if (image) {
      imageWrap(link, links.slice(1));
    } else {
      linkWrap(link, links.slice(1));
    }

    if (!chunks.selection) {
      chunks.selection = strings.placeholders[type];
    }
    resume();

    function long (link) {
      return link.href.length > 0;
    }

    function getTitle (link) {
      return link.title ? ' title="' + link.title + '"' : '';
    }

    function imageWrap (link, rest) {
      var after = chunks.after;
      chunks.before += tagopen(link);
      chunks.after = tagclose(link);
      if (rest.length) {
        chunks.after += rest.map(toAnotherImage).join('');
      }
      chunks.after += after;
      function tagopen (link) { return '<img src="' + link.href + '" alt="'; }
      function tagclose (link) { return '"' + getTitle(link) + ' />'; }
      function toAnotherImage (link) { return ' ' + tagopen(link) + tagclose(link); }
    }

    function linkWrap (link, rest) {
      var after = chunks.after;
      var names = options.classes.input.links;
      var classes = names ? ' class="' + names + '"' : '';
      chunks.before += tagopen(link);
      chunks.after = tagclose();
      if (rest.length) {
        chunks.after += rest.map(toAnotherLink).join('');
      }
      chunks.after += after;
      function tagopen (link) { return '<a href="' + link.href + '"' + getTitle(link) + classes + '>'; }
      function tagclose () { return '</a>'; }
      function toAnotherLink (link) { return ' ' + tagopen(link) + tagclose(); }
    }
  }
}

module.exports = linkOrImageOrAttachment;

},{"../chunks/parseLinkInput":5,"../once":36,"../strings":42,"../utils":44}],19:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rleftsingle = /<(ul|ol)( [^>]*)?>\s*<li( [^>]*)?>$/;
var rrightsingle = /^<\/li>\s*<\/(ul|ol)>/;
var rleftitem = /<li( [^>]*)?>$/;
var rrightitem = /^<\/li( [^>]*)?>/;
var ropen = /^<(ul|ol)( [^>]*)?>$/;

function list (chunks, ordered) {
  var tag = ordered ? 'ol' : 'ul';
  var olist = '<' + tag + '>';
  var clist = '</' + tag + '>';

  chunks.trim();

  if (rleftsingle.test(chunks.before) && rrightsingle.test(chunks.after)) {
    if (tag === RegExp.$1) {
      chunks.before = chunks.before.replace(rleftsingle, '');
      chunks.after = chunks.after.replace(rrightsingle, '');
      return;
    }
  }

  var ulStart = chunks.before.lastIndexOf('<ul');
  var olStart = chunks.before.lastIndexOf('<ol');
  var closeTag = chunks.after.indexOf('</ul>');
  if (closeTag === -1) {
    closeTag = chunks.after.indexOf('</ol>');
  }
  if (closeTag === -1) {
    add(); return;
  }
  var openStart = ulStart > olStart ? ulStart : olStart;
  if (openStart === -1) {
    add(); return;
  }
  var openEnd = chunks.before.indexOf('>', openStart);
  if (openEnd === -1) {
    add(); return;
  }

  var openTag = chunks.before.substr(openStart, openEnd - openStart + 1);
  if (ropen.test(openTag)) {
    if (tag !== RegExp.$1) {
      chunks.before = chunks.before.substr(0, openStart) + '<' + tag + chunks.before.substr(openStart + 3);
      chunks.after = chunks.after.substr(0, closeTag) + '</' + tag + chunks.after.substr(closeTag + 4);
    } else {
      if (rleftitem.test(chunks.before) && rrightitem.test(chunks.after)) {
        chunks.before = chunks.before.replace(rleftitem, '');
        chunks.after = chunks.after.replace(rrightitem, '');
      } else {
        add(true);
      }
    }
  }

  function add (list) {
    var open = list ? '' : olist;
    var close = list ? '' : clist;

    chunks.before += open + '<li>';
    chunks.after = '</li>' + close + chunks.after;

    if (!chunks.selection) {
      chunks.selection = strings.placeholders.listitem;
    }
  }
}

module.exports = list;

},{"../strings":42}],20:[function(require,module,exports){
'use strict';

function wrapping (tag, placeholder, chunks) {
  var open = '<' + tag;
  var close = '</' + tag.replace(/</g, '</');
  var rleading = new RegExp(open + '( [^>]*)?>$', 'i');
  var rtrailing = new RegExp('^' + close + '>', 'i');
  var ropen = new RegExp(open + '( [^>]*)?>', 'ig');
  var rclose = new RegExp(close + '( [^>]*)?>', 'ig');

  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail) {
    chunks.before = chunks.before.replace(rleading, '');
    chunks.after = chunks.after.replace(rtrailing, '');
  } else {
    if (!chunks.selection) {
      chunks.selection = placeholder;
    }
    var opened = ropen.test(chunks.selection);
    if (opened) {
      chunks.selection = chunks.selection.replace(ropen, '');
      if (!surrounded(chunks, tag)) {
        chunks.before += open + '>';
      }
    }
    var closed = rclose.test(chunks.selection);
    if (closed) {
      chunks.selection = chunks.selection.replace(rclose, '');
      if (!surrounded(chunks, tag)) {
        chunks.after = close + '>' + chunks.after;
      }
    }
    if (opened || closed) {
      pushover(); return;
    }
    if (surrounded(chunks, tag)) {
      if (rleading.test(chunks.before)) {
        chunks.before = chunks.before.replace(rleading, '');
      } else {
        chunks.before += close + '>';
      }
      if (rtrailing.test(chunks.after)) {
        chunks.after = chunks.after.replace(rtrailing, '');
      } else {
        chunks.after = open + '>' + chunks.after;
      }
    } else if (!closebounded(chunks, tag)) {
      chunks.after = close + '>' + chunks.after;
      chunks.before += open + '>';
    }
    pushover();
  }

  function pushover () {
    chunks.selection.replace(/<(\/)?([^> ]+)( [^>]*)?>/ig, pushoverOtherTags);
  }

  function pushoverOtherTags (all, closing, tag, a, i) {
    var attrs = a || '';
    var open = !closing;
    var rclosed = new RegExp('<\/' + tag.replace(/</g, '</') + '>', 'i');
    var ropened = new RegExp('<' + tag + '( [^>]*)?>', 'i');
    if (open && !rclosed.test(chunks.selection.substr(i))) {
      chunks.selection += '</' + tag + '>';
      chunks.after = chunks.after.replace(/^(<\/[^>]+>)/, '$1<' + tag + attrs + '>');
    }

    if (closing && !ropened.test(chunks.selection.substr(0, i))) {
      chunks.selection = '<' + tag + attrs + '>' + chunks.selection;
      chunks.before = chunks.before.replace(/(<[^>]+(?: [^>]*)?>)$/, '</' + tag + '>$1');
    }
  }
}

function closebounded (chunks, tag) {
  var rcloseleft = new RegExp('</' + tag.replace(/</g, '</') + '>$', 'i');
  var ropenright = new RegExp('^<' + tag + '(?: [^>]*)?>', 'i');
  var bounded = rcloseleft.test(chunks.before) && ropenright.test(chunks.after);
  if (bounded) {
    chunks.before = chunks.before.replace(rcloseleft, '');
    chunks.after = chunks.after.replace(ropenright, '');
  }
  return bounded;
}

function surrounded (chunks, tag) {
  var ropen = new RegExp('<' + tag + '(?: [^>]*)?>', 'ig');
  var rclose = new RegExp('<\/' + tag.replace(/</g, '</') + '>', 'ig');
  var opensBefore = count(chunks.before, ropen);
  var opensAfter = count(chunks.after, ropen);
  var closesBefore = count(chunks.before, rclose);
  var closesAfter = count(chunks.after, rclose);
  var open = opensBefore - closesBefore > 0;
  var close = closesAfter - opensAfter > 0;
  return open && close;

  function count (text, regex) {
    var match = text.match(regex);
    if (match) {
      return match.length;
    }
    return 0;
  }
}

module.exports = wrapping;

},{}],21:[function(require,module,exports){
(function (global){
'use strict';

function isVisibleElement (elem) {
  if (global.getComputedStyle) {
    return global.getComputedStyle(elem, null).getPropertyValue('display') !== 'none';
  } else if (elem.currentStyle) {
    return elem.currentStyle.display !== 'none';
  }
}

module.exports = isVisibleElement;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9pc1Zpc2libGVFbGVtZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaXNWaXNpYmxlRWxlbWVudCAoZWxlbSkge1xuICBpZiAoZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUpIHtcbiAgICByZXR1cm4gZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUoZWxlbSwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZSgnZGlzcGxheScpICE9PSAnbm9uZSc7XG4gIH0gZWxzZSBpZiAoZWxlbS5jdXJyZW50U3R5bGUpIHtcbiAgICByZXR1cm4gZWxlbS5jdXJyZW50U3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXNpYmxlRWxlbWVudDtcbiJdfQ==
},{}],22:[function(require,module,exports){
'use strict';

var cache = [];
var Editor = require('./editor');

function Manager () {
  this.cache = [];
}

Manager.prototype.find = function (textarea) {
  for (var i = 0, l = this.cache.length; i < l; i++) {
    if (this.cache[i] && this.cache[i].textarea === textarea) {
      return this.cache[i];
    }
  }
};

Manager.prototype.get = function (textarea, options) {
  var editor = this.find(textarea);
  if(editor) {
    return editor.editor;
  }

  editor = new Editor(textarea, options);
  cache.push({
    textarea: textarea,
    editor: editor,
    options: options,
  });

  return editor;
};

Manager.prototype.remove = function (textarea) {
  var editor = this.find(textarea);
  if(!editor) {
    return false;
  }

  editor.editor.destroy();
  cache.splice(cache.indexOf(editor), 1);
  return true;
};

Manager.prototype.clear = function () {
  var cached;
  while (cached = this.cache.pop()) {
    cached.editor.destroy();
  }
};

Manager.prototype.each = function (fn) {
  for (var i = 0, l = this.cache.length; i < l; i++) {
    var cached = this.cache[i];
    fn(cached.editor, cached.textarea, cached.options);
  }
};

module.exports = Manager;

},{"./editor":8}],23:[function(require,module,exports){
'use strict';

function many (text, times) {
  return new Array(times + 1).join(text);
}

module.exports = many;

},{}],24:[function(require,module,exports){
'use strict';

var many = require('../many');
var extendRegExp = require('../extendRegExp');
var trimChunks = require('../chunks/trim');

function MarkdownChunks () {
}

MarkdownChunks.prototype.trim = trimChunks;

MarkdownChunks.prototype.findTags = function (startRegex, endRegex) {
  var self = this;
  var regex;

  if (startRegex) {
    regex = extendRegExp(startRegex, '', '$');
    this.before = this.before.replace(regex, startReplacer);
    regex = extendRegExp(startRegex, '^', '');
    this.selection = this.selection.replace(regex, startReplacer);
  }

  if (endRegex) {
    regex = extendRegExp(endRegex, '', '$');
    this.selection = this.selection.replace(regex, endReplacer);
    regex = extendRegExp(endRegex, '^', '');
    this.after = this.after.replace(regex, endReplacer);
  }

  function startReplacer (match) {
    self.startTag = self.startTag + match; return '';
  }

  function endReplacer (match) {
    self.endTag = match + self.endTag; return '';
  }
};

MarkdownChunks.prototype.skip = function (options) {
  var o = options || {};
  var beforeCount = 'before' in o ? o.before : 1;
  var afterCount = 'after' in o ? o.after : 1;

  this.selection = this.selection.replace(/(^\n*)/, '');
  this.startTag = this.startTag + RegExp.$1;
  this.selection = this.selection.replace(/(\n*$)/, '');
  this.endTag = this.endTag + RegExp.$1;
  this.startTag = this.startTag.replace(/(^\n*)/, '');
  this.before = this.before + RegExp.$1;
  this.endTag = this.endTag.replace(/(\n*$)/, '');
  this.after = this.after + RegExp.$1;

  if (this.before) {
    this.before = replace(this.before, ++beforeCount, '$');
  }

  if (this.after) {
    this.after = replace(this.after, ++afterCount, '');
  }

  function replace (text, count, suffix) {
    var regex = o.any ? '\\n*' : many('\\n?', count);
    var replacement = many('\n', count);
    return text.replace(new RegExp(regex + suffix), replacement);
  }
};

module.exports = MarkdownChunks;

},{"../chunks/trim":6,"../extendRegExp":9,"../many":23}],25:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');
var settings = require('./settings');
var rtrailblankline = /(>[ \t]*)$/;
var rleadblankline = /^(>[ \t]*)/;
var rnewlinefencing = /^(\n*)([^\r]+?)(\n*)$/;
var rendtag = /^(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*)/;
var rleadbracket = /^\n((>|\s)*)\n/;
var rtrailbracket = /\n((>|\s)*)\n$/;

function blockquote (chunks) {
  var match = '';
  var leftOver = '';
  var line;

  chunks.selection = chunks.selection.replace(rnewlinefencing, newlinereplacer);
  chunks.before = chunks.before.replace(rtrailblankline, trailblanklinereplacer);
  chunks.selection = chunks.selection.replace(/^(\s|>)+$/, '');
  chunks.selection = chunks.selection || strings.placeholders.quote;

  if (chunks.before) {
    beforeProcessing();
  }

  chunks.startTag = match;
  chunks.before = leftOver;

  if (chunks.after) {
    chunks.after = chunks.after.replace(/^\n?/, '\n');
  }

  chunks.after = chunks.after.replace(rendtag, endtagreplacer);

  if (/^(?![ ]{0,3}>)/m.test(chunks.selection)) {
    wrapping.wrap(chunks, settings.lineLength - 2);
    chunks.selection = chunks.selection.replace(/^/gm, '> ');
    replaceBlanksInTags(true);
    chunks.skip();
  } else {
    chunks.selection = chunks.selection.replace(/^[ ]{0,3}> ?/gm, '');
    wrapping.unwrap(chunks);
    replaceBlanksInTags(false);

    if (!/^(\n|^)[ ]{0,3}>/.test(chunks.selection) && chunks.startTag) {
      chunks.startTag = chunks.startTag.replace(/\n{0,2}$/, '\n\n');
    }

    if (!/(\n|^)[ ]{0,3}>.*$/.test(chunks.selection) && chunks.endTag) {
      chunks.endTag = chunks.endTag.replace(/^\n{0,2}/, '\n\n');
    }
  }

  if (!/\n/.test(chunks.selection)) {
    chunks.selection = chunks.selection.replace(rleadblankline, leadblanklinereplacer);
  }

  function newlinereplacer (all, before, text, after) {
    chunks.before += before;
    chunks.after = after + chunks.after;
    return text;
  }

  function trailblanklinereplacer (all, blank) {
    chunks.selection = blank + chunks.selection; return '';
  }

  function leadblanklinereplacer (all, blanks) {
    chunks.startTag += blanks; return '';
  }

  function beforeProcessing () {
    var lines = chunks.before.replace(/\n$/, '').split('\n');
    var chained = false;
    var good;

    for (var i = 0; i < lines.length; i++) {
      good = false;
      line = lines[i];
      chained = chained && line.length > 0;
      if (/^>/.test(line)) {
        good = true;
        if (!chained && line.length > 1) {
          chained = true;
        }
      } else if (/^[ \t]*$/.test(line)) {
        good = true;
      } else {
        good = chained;
      }
      if (good) {
        match += line + '\n';
      } else {
        leftOver += match + line;
        match = '\n';
      }
    }

    if (!/(^|\n)>/.test(match)) {
      leftOver += match;
      match = '';
    }
  }

  function endtagreplacer (all) {
    chunks.endTag = all; return '';
  }

  function replaceBlanksInTags (bracket) {
    var replacement = bracket ? '> ' : '';

    if (chunks.startTag) {
      chunks.startTag = chunks.startTag.replace(rtrailbracket, replacer);
    }
    if (chunks.endTag) {
      chunks.endTag = chunks.endTag.replace(rleadbracket, replacer);
    }

    function replacer (all, markdown) {
      return '\n' + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + '\n';
    }
  }
}

module.exports = blockquote;

},{"../strings":42,"./settings":32,"./wrapping":33}],26:[function(require,module,exports){
'use strict';

var rleading = /^(\**)/;
var rtrailing = /(\**$)/;
var rtrailingspace = /(\s?)$/;
var strings = require('../strings');

function boldOrItalic (chunks, type) {
  var rnewlines = /\n{2,}/g;
  var starCount = type === 'bold' ? 2 : 1;

  chunks.trim();
  chunks.selection = chunks.selection.replace(rnewlines, '\n');

  var markup;
  var leadStars = rtrailing.exec(chunks.before)[0];
  var trailStars = rleading.exec(chunks.after)[0];
  var stars = '\\*{' + starCount + '}';
  var fence = Math.min(leadStars.length, trailStars.length);
  if (fence >= starCount && (fence !== 2 || starCount !== 1)) {
    chunks.before = chunks.before.replace(new RegExp(stars + '$', ''), '');
    chunks.after = chunks.after.replace(new RegExp('^' + stars, ''), '');
  } else if (!chunks.selection && trailStars) {
    chunks.after = chunks.after.replace(rleading, '');
    chunks.before = chunks.before.replace(rtrailingspace, '') + trailStars + RegExp.$1;
  } else {
    if (!chunks.selection && !trailStars) {
      chunks.selection = strings.placeholders[type];
    }

    markup = starCount === 1 ? '*' : '**';
    chunks.before = chunks.before + markup;
    chunks.after = markup + chunks.after;
  }
}

module.exports = boldOrItalic;

},{"../strings":42}],27:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rtextbefore = /\S[ ]*$/;
var rtextafter = /^[ ]*\S/;
var rnewline = /\n/;
var rbacktick = /`/;
var rfencebefore = /```[a-z]*\n?$/;
var rfencebeforeinside = /^```[a-z]*\n/;
var rfenceafter = /^\n?```/;
var rfenceafterinside = /\n```$/;

function codeblock (chunks, options) {
  var newlined = rnewline.test(chunks.selection);
  var trailing = rtextafter.test(chunks.after);
  var leading = rtextbefore.test(chunks.before);
  var outfenced = rfencebefore.test(chunks.before) && rfenceafter.test(chunks.after);
  if (outfenced || newlined || !(leading || trailing)) {
    block(outfenced);
  } else {
    inline();
  }

  function inline () {
    chunks.trim();
    chunks.findTags(rbacktick, rbacktick);

    if (!chunks.startTag && !chunks.endTag) {
      chunks.startTag = chunks.endTag = '`';
      if (!chunks.selection) {
        chunks.selection = strings.placeholders.code;
      }
    } else if (chunks.endTag && !chunks.startTag) {
      chunks.before += chunks.endTag;
      chunks.endTag = '';
    } else {
      chunks.startTag = chunks.endTag = '';
    }
  }

  function block (outfenced) {
    if (outfenced) {
      chunks.before = chunks.before.replace(rfencebefore, '');
      chunks.after = chunks.after.replace(rfenceafter, '');
      return;
    }

    chunks.before = chunks.before.replace(/[ ]{4}|```[a-z]*\n$/, mergeSelection);
    chunks.skip({
      before: /(\n|^)(\t|[ ]{4,}|```[a-z]*\n).*\n$/.test(chunks.before) ? 0 : 1,
      after: /^\n(\t|[ ]{4,}|\n```)/.test(chunks.after) ? 0 : 1
    });

    if (!chunks.selection) {
      if (options.fencing) {
        chunks.startTag = '```\n';
        chunks.endTag = '\n```';
      } else {
        chunks.startTag = '    ';
      }
      chunks.selection = strings.placeholders.code;
    } else {
      if (rfencebeforeinside.test(chunks.selection) && rfenceafterinside.test(chunks.selection)) {
        chunks.selection = chunks.selection.replace(/(^```[a-z]*\n)|(```$)/g, '');
      } else if (/^[ ]{0,3}\S/m.test(chunks.selection)) {
        if (options.fencing) {
          chunks.before += '```\n';
          chunks.after = '\n```' + chunks.after;
        } else if (newlined) {
          chunks.selection = chunks.selection.replace(/^/gm, '    ');
        } else {
          chunks.before += '    ';
        }
      } else {
        chunks.selection = chunks.selection.replace(/^(?:[ ]{4}|[ ]{0,3}\t|```[a-z]*)/gm, '');
      }
    }

    function mergeSelection (all) {
      chunks.selection = all + chunks.selection; return '';
    }
  }
}

module.exports = codeblock;

},{"../strings":42}],28:[function(require,module,exports){
'use strict';

var many = require('../many');
var strings = require('../strings');

function heading (chunks) {
  var level = 0;

  chunks.selection = chunks.selection
    .replace(/\s+/g, ' ')
    .replace(/(^\s+|\s+$)/g, '');

  if (!chunks.selection) {
    chunks.startTag = '# ';
    chunks.selection = strings.placeholders.heading;
    chunks.endTag = '';
    chunks.skip({ before: 1, after: 1 });
    return;
  }

  chunks.findTags(/#+[ ]*/, /[ ]*#+/);

  if (/#+/.test(chunks.startTag)) {
    level = RegExp.lastMatch.length;
  }

  chunks.startTag = chunks.endTag = '';
  chunks.findTags(null, /\s?(-+|=+)/);

  if (/=+/.test(chunks.endTag)) {
    level = 1;
  }

  if (/-+/.test(chunks.endTag)) {
    level = 2;
  }

  chunks.startTag = chunks.endTag = '';
  chunks.skip({ before: 1, after: 1 });

  var levelToCreate = level < 2 ? 4 : level - 1;
  if (levelToCreate > 0) {
    chunks.startTag = many('#', levelToCreate) + ' ';
  }
}

module.exports = heading;

},{"../many":23,"../strings":42}],29:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.startTag = '----------\n';
  chunks.selection = '';
  chunks.skip({ left: 2, right: 1, any: true });
}

module.exports = hr;

},{}],30:[function(require,module,exports){
'use strict';

var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rdefinitions = /^[ ]{0,3}\[((?:attachment-)?\d+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|$)/gm;
var rattachment = /^attachment-(\d+)$/i;

function extractDefinitions (text, definitions) {
  rdefinitions.lastIndex = 0;
  return text.replace(rdefinitions, replacer);

  function replacer (all, id, link, newlines, title) {
    definitions[id] = all.replace(/\s*$/, '');
    if (newlines) {
      definitions[id] = all.replace(/["(](.+?)[")]$/, '');
      return newlines + title;
    }
    return '';
  }
}

function pushDefinition (options) {
  var chunks = options.chunks;
  var definition = options.definition;
  var attachment = options.attachment;
  var regex = /(\[)((?:\[[^\]]*\]|[^\[\]])*)(\][ ]?(?:\n[ ]*)?\[)((?:attachment-)?\d+)(\])/g;
  var anchor = 0;
  var definitions = {};
  var footnotes = [];

  chunks.before = extractDefinitions(chunks.before, definitions);
  chunks.selection = extractDefinitions(chunks.selection, definitions);
  chunks.after = extractDefinitions(chunks.after, definitions);
  chunks.before = chunks.before.replace(regex, getLink);

  if (definition) {
    if (!attachment) { pushAnchor(definition); }
  } else {
    chunks.selection = chunks.selection.replace(regex, getLink);
  }

  var result = anchor;

  chunks.after = chunks.after.replace(regex, getLink);

  if (chunks.after) {
    chunks.after = chunks.after.replace(/\n*$/, '');
  }
  if (!chunks.after) {
    chunks.selection = chunks.selection.replace(/\n*$/, '');
  }

  anchor = 0;
  Object.keys(definitions).forEach(pushAttachments);

  if (attachment) {
    pushAnchor(definition);
  }
  chunks.after += '\n\n' + footnotes.join('\n');

  return result;

  function pushAttachments (definition) {
    if (rattachment.test(definition)) {
      pushAnchor(definitions[definition]);
    }
  }

  function pushAnchor (definition) {
    anchor++;
    definition = definition.replace(/^[ ]{0,3}\[(attachment-)?(\d+)\]:/, '  [$1' + anchor + ']:');
    footnotes.push(definition);
  }

  function getLink (all, before, inner, afterInner, definition, end) {
    inner = inner.replace(regex, getLink);
    if (definitions[definition]) {
      pushAnchor(definitions[definition]);
      return before + inner + afterInner + anchor + end;
    }
    return all;
  }
}

function linkOrImageOrAttachment (chunks, options) {
  var type = options.type;
  var image = type === 'image';
  var resume;

  chunks.trim();
  chunks.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\[.*?\])?/);

  if (chunks.endTag.length > 1 && chunks.startTag.length > 0) {
    chunks.startTag = chunks.startTag.replace(/!?\[/, '');
    chunks.endTag = '';
    pushDefinition({ chunks: chunks });
    return;
  }

  chunks.selection = chunks.startTag + chunks.selection + chunks.endTag;
  chunks.startTag = chunks.endTag = '';

  if (/\n\n/.test(chunks.selection)) {
    pushDefinition({ chunks: chunks });
    return;
  }
  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(options, once(resolved));

  function resolved (result) {
    var links = result
      .definitions
      .map(parseLinkInput)
      .filter(long);

    links.forEach(renderLink);
    resume();

    function renderLink (link, i) {
      chunks.selection = (' ' + chunks.selection).replace(/([^\\](?:\\\\)*)(?=[[\]])/g, '$1\\').substr(1);

      var key = result.attachment ? '  [attachment-9999]: ' : ' [9999]: ';
      var definition = key + link.href + (link.title ? ' "' + link.title + '"' : '');
      var anchor = pushDefinition({
        chunks: chunks,
        definition: definition,
        attachment: result.attachment
      });

      if (!result.attachment) {
        add();
      }

      function add () {
        chunks.startTag = image ? '![' : '[';
        chunks.endTag = '][' + anchor + ']';

        if (!chunks.selection) {
          chunks.selection = strings.placeholders[type];
        }

        if (i < links.length - 1) { // has multiple links, not the last one
          chunks.before += chunks.startTag + chunks.selection + chunks.endTag + '\n';
        }
      }
    }

    function long (link) {
      return link.href.length > 0;
    }
  }
}

module.exports = linkOrImageOrAttachment;

},{"../chunks/parseLinkInput":5,"../once":36,"../strings":42}],31:[function(require,module,exports){
'use strict';

var many = require('../many');
var strings = require('../strings');
var wrapping = require('./wrapping');
var settings = require('./settings');
var rprevious = /(\n|^)(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*$/;
var rnext = /^\n*(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*/;
var rbullettype = /^\s*([*+-])/;
var rskipper = /[^\n]\n\n[^\n]/;

function pad (text) {
  return ' ' + text + ' ';
}

function list (chunks, ordered) {
  var bullet = '-';
  var num = 1;
  var digital;
  var beforeSkip = 1;
  var afterSkip = 1;

  chunks.findTags(/(\n|^)*[ ]{0,3}([*+-]|\d+[.])\s+/, null);

  if (chunks.before && !/\n$/.test(chunks.before) && !/^\n/.test(chunks.startTag)) {
    chunks.before += chunks.startTag;
    chunks.startTag = '';
  }

  if (chunks.startTag) {
    digital = /\d+[.]/.test(chunks.startTag);
    chunks.startTag = '';
    chunks.selection = chunks.selection.replace(/\n[ ]{4}/g, '\n');
    wrapping.unwrap(chunks);
    chunks.skip();

    if (digital) {
      chunks.after = chunks.after.replace(rnext, getPrefixedItem);
    }
    if (ordered === digital) {
      return;
    }
  }

  chunks.before = chunks.before.replace(rprevious, beforeReplacer);

  if (!chunks.selection) {
    chunks.selection = strings.placeholders.listitem;
  }

  var prefix = nextBullet();
  var spaces = many(' ', prefix.length);

  chunks.after = chunks.after.replace(rnext, afterReplacer);
  chunks.trim(true);
  chunks.skip({ before: beforeSkip, after: afterSkip, any: true });
  chunks.startTag = prefix;
  wrapping.wrap(chunks, settings.lineLength - prefix.length);
  chunks.selection = chunks.selection.replace(/\n/g, '\n' + spaces);

  function beforeReplacer (text) {
    if (rbullettype.test(text)) {
      bullet = RegExp.$1;
    }
    beforeSkip = rskipper.test(text) ? 1 : 0;
    return getPrefixedItem(text);
  }

  function afterReplacer (text) {
    afterSkip = rskipper.test(text) ? 1 : 0;
    return getPrefixedItem(text);
  }

  function nextBullet () {
    if (ordered) {
      return pad((num++) + '.');
    }
    return pad(bullet);
  }

  function getPrefixedItem (text) {
    var rmarkers = /^[ ]{0,3}([*+-]|\d+[.])\s/gm;
    return text.replace(rmarkers, nextBullet);
  }
}

module.exports = list;

},{"../many":23,"../strings":42,"./settings":32,"./wrapping":33}],32:[function(require,module,exports){
'use strict';

module.exports = {
  lineLength: 72
};

},{}],33:[function(require,module,exports){
'use strict';

var prefixes = '(?:\\s{4,}|\\s*>|\\s*-\\s+|\\s*\\d+\\.|=|\\+|-|_|\\*|#|\\s*\\[[^\n]]+\\]:)';
var rleadingprefixes = new RegExp('^' + prefixes, '');
var rtext = new RegExp('([^\\n])\\n(?!(\\n|' + prefixes + '))', 'g');
var rtrailingspaces = /\s+$/;

function wrap (chunks, len) {
  var regex = new RegExp('(.{1,' + len + '})( +|$\\n?)', 'gm');

  unwrap(chunks);
  chunks.selection = chunks.selection
    .replace(regex, replacer)
    .replace(rtrailingspaces, '');

  function replacer (line, marked) {
    return rleadingprefixes.test(line) ? line : marked + '\n';
  }
}

function unwrap (chunks) {
  rtext.lastIndex = 0;
  chunks.selection = chunks.selection.replace(rtext, '$1 $2');
}

module.exports = {
  wrap: wrap,
  unwrap: unwrap
};

},{}],34:[function(require,module,exports){
'use strict';

function TextSurface (textarea) {
  this.textarea = textarea;
}

TextSurface.prototype.focus = function () {
  this.textarea.focus();
};

TextSurface.prototype.read = function () {
  return this.textarea.value;
};

TextSurface.prototype.write = function (value) {
  this.textarea.value = value;
};

TextSurface.prototype.current = function () {
  return this.textarea;
};

TextSurface.prototype.writeSelection = function (state) {
  this.textarea.focus();
  this.textarea.selectionStart = state.start;
  this.textarea.selectionEnd = state.end;
  this.textarea.scrollTop = state.scrollTop;
};

TextSurface.prototype.readSelection = function (state) {
  state.start = this.textarea.selectionStart;
  state.end = this.textarea.selectionEnd;
};

module.exports = TextSurface;

},{}],35:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var ropen = /^(<[^>]+(?: [^>]*)?>)/;
var rclose = /(<\/[^>]+>)$/;

function WysiwygSurface (editable) {
  this.editable = editable;
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

module.exports = WysiwygSurface;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9tb2Rlcy93eXNpd3lnL3d5c2l3eWdTdXJmYWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgcm9wZW4gPSAvXig8W14+XSsoPzogW14+XSopPz4pLztcbnZhciByY2xvc2UgPSAvKDxcXC9bXj5dKz4pJC87XG5cbmZ1bmN0aW9uIFd5c2l3eWdTdXJmYWNlIChlZGl0YWJsZSkge1xuICB0aGlzLmVkaXRhYmxlID0gZWRpdGFibGU7XG59XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5mb2N1cyA9IGZ1bmN0aW9uIChmb3JjZUltbWVkaWF0ZSkge1xuICBpZihmb3JjZUltbWVkaWF0ZSkge1xuICAgIHRoaXMuZWRpdGFibGUuZm9jdXMoKTtcbiAgfSBlbHNlIHtcbiAgICBzZXRUaW1lb3V0KHRoaXMuZWRpdGFibGUuZm9jdXMuYmluZCh0aGlzLmVkaXRhYmxlKSwgMCk7XG4gIH1cbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lZGl0YWJsZS5pbm5lckhUTUw7XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdGhpcy5lZGl0YWJsZS5pbm5lckhUTUwgPSB2YWx1ZTtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lZGl0YWJsZTtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS53cml0ZVNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgY2h1bmtzID0gc3RhdGUuY2FjaGVkQ2h1bmtzIHx8IHN0YXRlLmdldENodW5rcygpO1xuICB2YXIgc3RhcnQgPSB1bmVzY2FwZVRleHQoY2h1bmtzLmJlZm9yZSkubGVuZ3RoO1xuICB2YXIgZW5kID0gc3RhcnQgKyB1bmVzY2FwZVRleHQoY2h1bmtzLnNlbGVjdGlvbikubGVuZ3RoO1xuICB2YXIgcCA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICB2YXIgc3RhcnRSYW5nZVNldCA9IGZhbHNlO1xuICB2YXIgZW5kUmFuZ2VTZXQgPSBmYWxzZTtcblxuICB3YWxrKHRoaXMuZWRpdGFibGUuZmlyc3RDaGlsZCwgcGVlayk7XG4gIHRoaXMuZWRpdGFibGUuZm9jdXMoKTtcbiAgdmFyIHNlbGVjdGlvbiA9IGRvYy5nZXRTZWxlY3Rpb24oKTtcbiAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuICBzZWxlY3Rpb24uYWRkUmFuZ2UocCk7XG5cbiAgZnVuY3Rpb24gcGVlayAoY29udGV4dCwgZWwpIHtcbiAgICB2YXIgY3Vyc29yID0gdW5lc2NhcGVUZXh0KGNvbnRleHQudGV4dCkubGVuZ3RoO1xuICAgIHZhciBjb250ZW50ID0gcmVhZE5vZGUoZWwsIGZhbHNlKS5sZW5ndGg7XG4gICAgdmFyIHN1bSA9IGN1cnNvciArIGNvbnRlbnQ7XG4gICAgaWYgKCFzdGFydFJhbmdlU2V0ICYmIHN1bSA+PSBzdGFydCkge1xuICAgICAgcC5zZXRTdGFydChlbCwgYm91bmRlZChzdGFydCAtIGN1cnNvcikpO1xuICAgICAgc3RhcnRSYW5nZVNldCA9IHRydWU7XG4gICAgfVxuICAgIGlmICghZW5kUmFuZ2VTZXQgJiYgc3VtID49IGVuZCkge1xuICAgICAgcC5zZXRFbmQoZWwsIGJvdW5kZWQoZW5kIC0gY3Vyc29yKSk7XG4gICAgICBlbmRSYW5nZVNldCA9IHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYm91bmRlZCAob2Zmc2V0KSB7XG4gICAgICByZXR1cm4gTWF0aC5tYXgoMCwgTWF0aC5taW4oY29udGVudCwgb2Zmc2V0KSk7XG4gICAgfVxuICB9XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUucmVhZFNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgc2VsID0gZG9jLmdldFNlbGVjdGlvbigpO1xuICB2YXIgZGlzdGFuY2UgPSB3YWxrKHRoaXMuZWRpdGFibGUuZmlyc3RDaGlsZCwgcGVlayk7XG4gIHZhciBzdGFydCA9IGRpc3RhbmNlLnN0YXJ0IHx8IDA7XG4gIHZhciBlbmQgPSBkaXN0YW5jZS5lbmQgfHwgMDtcblxuICBzdGF0ZS50ZXh0ID0gZGlzdGFuY2UudGV4dDtcblxuICBpZiAoZW5kID4gc3RhcnQpIHtcbiAgICBzdGF0ZS5zdGFydCA9IHN0YXJ0O1xuICAgIHN0YXRlLmVuZCA9IGVuZDtcbiAgfSBlbHNlIHtcbiAgICBzdGF0ZS5zdGFydCA9IGVuZDtcbiAgICBzdGF0ZS5lbmQgPSBzdGFydDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgdmFyIGVsVGV4dCA9IChlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJycpO1xuXG4gICAgaWYgKGVsID09PSBzZWwuYW5jaG9yTm9kZSkge1xuICAgICAgY29udGV4dC5zdGFydCA9IGNvbnRleHQudGV4dC5sZW5ndGggKyBlc2NhcGVOb2RlVGV4dChlbFRleHQuc3Vic3RyaW5nKDAsIHNlbC5hbmNob3JPZmZzZXQpKS5sZW5ndGg7XG4gICAgfVxuICAgIGlmIChlbCA9PT0gc2VsLmZvY3VzTm9kZSkge1xuICAgICAgY29udGV4dC5lbmQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgZXNjYXBlTm9kZVRleHQoZWxUZXh0LnN1YnN0cmluZygwLCBzZWwuZm9jdXNPZmZzZXQpKS5sZW5ndGg7XG4gICAgfVxuICB9XG59O1xuXG5mdW5jdGlvbiB3YWxrIChlbCwgcGVlaywgY3R4LCBzaWJsaW5ncykge1xuICB2YXIgY29udGV4dCA9IGN0eCB8fCB7IHRleHQ6ICcnIH07XG5cbiAgaWYgKCFlbCkge1xuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG5cbiAgdmFyIGVsTm9kZSA9IGVsLm5vZGVUeXBlID09PSAxO1xuICB2YXIgdGV4dE5vZGUgPSBlbC5ub2RlVHlwZSA9PT0gMztcblxuICBwZWVrKGNvbnRleHQsIGVsKTtcblxuICBpZiAodGV4dE5vZGUpIHtcbiAgICBjb250ZXh0LnRleHQgKz0gcmVhZE5vZGUoZWwpO1xuICB9XG4gIGlmIChlbE5vZGUpIHtcbiAgICBpZiAoZWwub3V0ZXJIVE1MLm1hdGNoKHJvcGVuKSkgeyBjb250ZXh0LnRleHQgKz0gUmVnRXhwLiQxOyB9XG4gICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZWwuY2hpbGROb2RlcykuZm9yRWFjaCh3YWxrQ2hpbGRyZW4pO1xuICAgIGlmIChlbC5vdXRlckhUTUwubWF0Y2gocmNsb3NlKSkgeyBjb250ZXh0LnRleHQgKz0gUmVnRXhwLiQxOyB9XG4gIH1cbiAgaWYgKHNpYmxpbmdzICE9PSBmYWxzZSAmJiBlbC5uZXh0U2libGluZykge1xuICAgIHJldHVybiB3YWxrKGVsLm5leHRTaWJsaW5nLCBwZWVrLCBjb250ZXh0KTtcbiAgfVxuICByZXR1cm4gY29udGV4dDtcblxuICBmdW5jdGlvbiB3YWxrQ2hpbGRyZW4gKGNoaWxkKSB7XG4gICAgd2FsayhjaGlsZCwgcGVlaywgY29udGV4dCwgZmFsc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWROb2RlIChlbCwgZXNjYXBlKSB7XG4gIGlmKGVsLm5vZGVUeXBlID09PSAzKSB7XG4gICAgaWYoZXNjYXBlID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIGVsLnRleHRDb250ZW50IHx8IGVsLmlubmVyVGV4dCB8fCAnJztcbiAgICB9XG5cbiAgICByZXR1cm4gZXNjYXBlTm9kZVRleHQoZWwpO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gZXNjYXBlTm9kZVRleHQgKGVsKSB7XG4gIGVsID0gZWwgfHwgJyc7XG4gIGlmKGVsLm5vZGVUeXBlID09PSAzKSB7XG4gICAgZWwgPSBlbC5jbG9uZU5vZGUoKTtcbiAgfSBlbHNlIHtcbiAgICBlbCA9IGRvYy5jcmVhdGVUZXh0Tm9kZShlbCk7XG4gIH1cblxuICAvLyBVc2luZyBicm93c2VyIGVzY2FwaW5nIHRvIGNsZWFuIHVwIGFueSBzcGVjaWFsIGNoYXJhY3RlcnNcbiAgdmFyIHRvVGV4dCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9UZXh0LmFwcGVuZENoaWxkKGVsKTtcbiAgcmV0dXJuIHRvVGV4dC5pbm5lckhUTUwgfHwgJyc7XG59XG5cbmZ1bmN0aW9uIHVuZXNjYXBlVGV4dCAoZWwpIHtcbiAgaWYoZWwubm9kZVR5cGUpIHtcbiAgICByZXR1cm4gZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnO1xuICB9XG5cbiAgdmFyIHRvVGV4dCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9UZXh0LnRleHRDb250ZW50ID0gZWw7XG4gIHJldHVybiB0b1RleHQudGV4dENvbnRlbnQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gV3lzaXd5Z1N1cmZhY2U7XG4iXX0=
},{}],36:[function(require,module,exports){
'use strict';

function once (fn) {
  var disposed;
  return function disposable () {
    if (disposed) {
      return;
    }
    disposed = true;
    return fn.apply(this, arguments);
  };
}

module.exports = once;

},{}],37:[function(require,module,exports){
'use strict';

var doc = document;

function homebrewQSA (className) {
  var results = [];
  var all = doc.getElementsByTagName('*');
  var i;
  for (i in all) {
    if (wrap(all[i].className).indexOf(wrap(className)) !== -1) {
      results.push(all[i]);
    }
  }
  return results;
}

function wrap (text) {
  return ' ' + text + ' ';
}

function closePrompts () {
  if (doc.body.querySelectorAll) {
    remove(doc.body.querySelectorAll('.wk-prompt'));
  } else {
    remove(homebrewQSA('wk-prompt'));
  }
}

function remove (prompts) {
  var len = prompts.length;
  var i;
  for (i = 0; i < len; i++) {
    prompts[i].parentElement.removeChild(prompts[i]);
  }
}

module.exports = closePrompts;

},{}],38:[function(require,module,exports){
'use strict';

// var bureaucracy = require('bureaucracy');
var render = require('./render');
var classes = require('../classes');
var strings = require('../strings');
var uploads = require('../uploads');
var ENTER_KEY = 13;
var ESCAPE_KEY = 27;
var dragClass = 'wk-dragging';
var dragClassSpecific = 'wk-prompt-upload-dragging';
var root = document.documentElement;

function classify (group, classes) {
  Object.keys(group).forEach(customize);
  function customize (key) {
    if (classes[key]) {
      group[key].className += ' ' + classes[key];
    }
  }
}

function prompt (options, done) {
  var text = strings.prompts[options.type];
  var dom = render({
    id: 'wk-prompt-' + options.type,
    title: text.title,
    description: text.description,
    placeholder: text.placeholder
  });
  var domup;

  dom.cancel.addEventListener('click', remove);
  dom.close.addEventListener('click', remove);
  dom.ok.addEventListener('click', ok);
  dom.input.addEventListener('keypress', enter);
  dom.dialog.addEventListener('keydown', esc);
  classify(dom, options.classes.prompts);

  var upload = options.upload;
  if (typeof upload === 'string') {
    upload = { url: upload };
  }

  var bureaucrat = null;
  if (upload) {
    bureaucrat = arrangeUploads();
    if (options.autoUpload) {
      bureaucrat.submit(options.autoUpload);
    }
  }

  setTimeout(focusDialog, 0);

  function focusDialog () {
    dom.input.focus();
  }

  function enter (e) {
    var key = e.which || e.keyCode;
    if (key === ENTER_KEY) {
      ok();
      e.preventDefault();
    }
  }

  function esc (e) {
    var key = e.which || e.keyCode;
    if (key === ESCAPE_KEY) {
      remove();
      e.preventDefault();
    }
  }

  function ok () {
    remove();
    done({ definitions: [dom.input.value] });
  }

  function remove () {
    if (upload) { bindUploadEvents(true); }
    if (dom.dialog.parentElement) { dom.dialog.parentElement.removeChild(dom.dialog); }
    options.surface.focus(options.mode);
  }

  function bindUploadEvents (remove) {
    var op = remove ? 'remove' : 'add';
    root[op + 'EventListener']('dragenter', dragging);
    root[op + 'EventListener']('dragend', dragstop);
    root[op + 'EventListener']('mouseout', dragstop);
  }

  function dragging () {
    classes.add(domup.area, dragClass);
    classes.add(domup.area, dragClassSpecific);
  }
  function dragstop () {
    classes.rm(domup.area, dragClass);
    classes.rm(domup.area, dragClassSpecific);
    uploads.stop(options.surface.droparea);
  }

  function arrangeUploads () {
    domup = render.uploads(dom, strings.prompts.types + (upload.restriction || options.type + 's'));
    bindUploadEvents();
    domup.area.addEventListener('dragover', handleDragOver, false);
    domup.area.addEventListener('drop', handleFileSelect, false);
    classify(domup, options.classes.prompts);
/*
    var bureaucrat = bureaucracy.setup(domup.fileinput, {
      method: upload.method,
      formData: upload.formData,
      fieldKey: upload.fieldKey,
      endpoint: upload.url,
      validate: 'image'
    });

    bureaucrat.on('started', function () {
      classes.rm(domup.failed, 'wk-prompt-error-show');
      classes.rm(domup.warning, 'wk-prompt-error-show');
    });
    bureaucrat.on('valid', function () {
      classes.add(domup.area, 'wk-prompt-uploading');
    });
    bureaucrat.on('invalid', function () {
      classes.add(domup.warning, 'wk-prompt-error-show');
    });
    bureaucrat.on('error', function () {
      classes.add(domup.failed, 'wk-prompt-error-show');
    });
    bureaucrat.on('success', receivedImages);
    bureaucrat.on('ended', function () {
      classes.rm(domup.area, 'wk-prompt-uploading');
    });

    return bureaucrat;

    function receivedImages (results) {
      var body = results[0];
      dom.input.value = body.href + ' "' + body.title + '"';
      remove();
      done({
        definitions: results.map(toDefinition),
        attachment: options.type === 'attachment'
      });
      function toDefinition (result) {
        return result.href + ' "' + result.title + '"';
      }
    } */
  }

  function handleDragOver (e) {
    stop(e);
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleFileSelect (e) {
    dragstop();
    stop(e);
    bureaucrat.submit(e.dataTransfer.files);
  }

  function stop (e) {
    e.stopPropagation();
    e.preventDefault();
  }
}

module.exports = prompt;

},{"../classes":7,"../strings":42,"../uploads":43,"./render":39}],39:[function(require,module,exports){
(function (global){
'use strict';

var classes = require('../classes');
var strings = require('../strings');
var ac = 'appendChild';
var doc = global.document;

function e (type, cls, text) {
  var el = doc.createElement(type);
  el.className = cls;
  if (text) {
    el.textContent = text;
  }
  return el;
}

function render (options) {
  var dom = {
    dialog: e('article', 'wk-prompt ' + options.id),
    close: e('a', 'wk-prompt-close'),
    header: e('header', 'wk-prompt-header'),
    h1: e('h1', 'wk-prompt-title', options.title),
    section: e('section', 'wk-prompt-body'),
    desc: e('p', 'wk-prompt-description', options.description),
    inputContainer: e('div', 'wk-prompt-input-container'),
    input: e('input', 'wk-prompt-input'),
    cancel: e('button', 'wk-prompt-cancel', 'Cancel'),
    ok: e('button', 'wk-prompt-ok', 'Ok'),
    footer: e('footer', 'wk-prompt-buttons')
  };
  dom.ok.type = 'button';
  dom.header[ac](dom.h1);
  dom.section[ac](dom.desc);
  dom.section[ac](dom.inputContainer);
  dom.inputContainer[ac](dom.input);
  dom.input.placeholder = options.placeholder;
  dom.cancel.type = 'button';
  dom.footer[ac](dom.cancel);
  dom.footer[ac](dom.ok);
  dom.dialog[ac](dom.close);
  dom.dialog[ac](dom.header);
  dom.dialog[ac](dom.section);
  dom.dialog[ac](dom.footer);
  doc.body[ac](dom.dialog);
  return dom;
}

function uploads (dom, warning) {
  var fup = 'wk-prompt-fileupload';
  var domup = {
    area: e('section', 'wk-prompt-upload-area'),
    warning: e('p', 'wk-prompt-error wk-warning', warning),
    failed: e('p', 'wk-prompt-error wk-failed', strings.prompts.uploadfailed),
    upload: e('label', 'wk-prompt-upload'),
    uploading: e('span', 'wk-prompt-progress', strings.prompts.uploading),
    drop: e('span', 'wk-prompt-drop', strings.prompts.drop),
    dropicon: e('p', 'wk-drop-icon wk-prompt-drop-icon'),
    browse: e('span', 'wk-prompt-browse', strings.prompts.browse),
    dragdrop: e('p', 'wk-prompt-dragdrop', strings.prompts.drophint),
    fileinput: e('input', fup)
  };
  domup.area[ac](domup.drop);
  domup.area[ac](domup.uploading);
  domup.area[ac](domup.dropicon);
  domup.upload[ac](domup.browse);
  domup.upload[ac](domup.fileinput);
  domup.fileinput.id = fup;
  domup.fileinput.type = 'file';
  domup.fileinput.multiple = 'multiple';
  dom.dialog.className += ' wk-prompt-uploads';
  dom.inputContainer.className += ' wk-prompt-input-container-uploads';
  dom.input.className += ' wk-prompt-input-uploads';
  dom.section.insertBefore(domup.warning, dom.inputContainer);
  dom.section.insertBefore(domup.failed, dom.inputContainer);
  dom.section[ac](domup.upload);
  dom.section[ac](domup.dragdrop);
  dom.section[ac](domup.area);
  dom.desc.textContent = dom.desc.textContent + strings.prompts.upload;
  domup.fileinput.addEventListener('focus', focusedFileInput);
  domup.fileinput.addEventListener('blur', blurredFileInput);

  function focusedFileInput () {
    classes.add(domup.upload, 'wk-focused');
  }
  function blurredFileInput () {
    classes.rm(domup.upload, 'wk-focused');
  }
  return domup;
}

render.uploads = uploads;
module.exports = render;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wcm9tcHRzL3JlbmRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi4vY2xhc3NlcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgYWMgPSAnYXBwZW5kQ2hpbGQnO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gZSAodHlwZSwgY2xzLCB0ZXh0KSB7XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KHR5cGUpO1xuICBlbC5jbGFzc05hbWUgPSBjbHM7XG4gIGlmICh0ZXh0KSB7XG4gICAgZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyIChvcHRpb25zKSB7XG4gIHZhciBkb20gPSB7XG4gICAgZGlhbG9nOiBlKCdhcnRpY2xlJywgJ3drLXByb21wdCAnICsgb3B0aW9ucy5pZCksXG4gICAgY2xvc2U6IGUoJ2EnLCAnd2stcHJvbXB0LWNsb3NlJyksXG4gICAgaGVhZGVyOiBlKCdoZWFkZXInLCAnd2stcHJvbXB0LWhlYWRlcicpLFxuICAgIGgxOiBlKCdoMScsICd3ay1wcm9tcHQtdGl0bGUnLCBvcHRpb25zLnRpdGxlKSxcbiAgICBzZWN0aW9uOiBlKCdzZWN0aW9uJywgJ3drLXByb21wdC1ib2R5JyksXG4gICAgZGVzYzogZSgncCcsICd3ay1wcm9tcHQtZGVzY3JpcHRpb24nLCBvcHRpb25zLmRlc2NyaXB0aW9uKSxcbiAgICBpbnB1dENvbnRhaW5lcjogZSgnZGl2JywgJ3drLXByb21wdC1pbnB1dC1jb250YWluZXInKSxcbiAgICBpbnB1dDogZSgnaW5wdXQnLCAnd2stcHJvbXB0LWlucHV0JyksXG4gICAgY2FuY2VsOiBlKCdidXR0b24nLCAnd2stcHJvbXB0LWNhbmNlbCcsICdDYW5jZWwnKSxcbiAgICBvazogZSgnYnV0dG9uJywgJ3drLXByb21wdC1vaycsICdPaycpLFxuICAgIGZvb3RlcjogZSgnZm9vdGVyJywgJ3drLXByb21wdC1idXR0b25zJylcbiAgfTtcbiAgZG9tLm9rLnR5cGUgPSAnYnV0dG9uJztcbiAgZG9tLmhlYWRlclthY10oZG9tLmgxKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbS5kZXNjKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbS5pbnB1dENvbnRhaW5lcik7XG4gIGRvbS5pbnB1dENvbnRhaW5lclthY10oZG9tLmlucHV0KTtcbiAgZG9tLmlucHV0LnBsYWNlaG9sZGVyID0gb3B0aW9ucy5wbGFjZWhvbGRlcjtcbiAgZG9tLmNhbmNlbC50eXBlID0gJ2J1dHRvbic7XG4gIGRvbS5mb290ZXJbYWNdKGRvbS5jYW5jZWwpO1xuICBkb20uZm9vdGVyW2FjXShkb20ub2spO1xuICBkb20uZGlhbG9nW2FjXShkb20uY2xvc2UpO1xuICBkb20uZGlhbG9nW2FjXShkb20uaGVhZGVyKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLnNlY3Rpb24pO1xuICBkb20uZGlhbG9nW2FjXShkb20uZm9vdGVyKTtcbiAgZG9jLmJvZHlbYWNdKGRvbS5kaWFsb2cpO1xuICByZXR1cm4gZG9tO1xufVxuXG5mdW5jdGlvbiB1cGxvYWRzIChkb20sIHdhcm5pbmcpIHtcbiAgdmFyIGZ1cCA9ICd3ay1wcm9tcHQtZmlsZXVwbG9hZCc7XG4gIHZhciBkb211cCA9IHtcbiAgICBhcmVhOiBlKCdzZWN0aW9uJywgJ3drLXByb21wdC11cGxvYWQtYXJlYScpLFxuICAgIHdhcm5pbmc6IGUoJ3AnLCAnd2stcHJvbXB0LWVycm9yIHdrLXdhcm5pbmcnLCB3YXJuaW5nKSxcbiAgICBmYWlsZWQ6IGUoJ3AnLCAnd2stcHJvbXB0LWVycm9yIHdrLWZhaWxlZCcsIHN0cmluZ3MucHJvbXB0cy51cGxvYWRmYWlsZWQpLFxuICAgIHVwbG9hZDogZSgnbGFiZWwnLCAnd2stcHJvbXB0LXVwbG9hZCcpLFxuICAgIHVwbG9hZGluZzogZSgnc3BhbicsICd3ay1wcm9tcHQtcHJvZ3Jlc3MnLCBzdHJpbmdzLnByb21wdHMudXBsb2FkaW5nKSxcbiAgICBkcm9wOiBlKCdzcGFuJywgJ3drLXByb21wdC1kcm9wJywgc3RyaW5ncy5wcm9tcHRzLmRyb3ApLFxuICAgIGRyb3BpY29uOiBlKCdwJywgJ3drLWRyb3AtaWNvbiB3ay1wcm9tcHQtZHJvcC1pY29uJyksXG4gICAgYnJvd3NlOiBlKCdzcGFuJywgJ3drLXByb21wdC1icm93c2UnLCBzdHJpbmdzLnByb21wdHMuYnJvd3NlKSxcbiAgICBkcmFnZHJvcDogZSgncCcsICd3ay1wcm9tcHQtZHJhZ2Ryb3AnLCBzdHJpbmdzLnByb21wdHMuZHJvcGhpbnQpLFxuICAgIGZpbGVpbnB1dDogZSgnaW5wdXQnLCBmdXApXG4gIH07XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLmRyb3ApO1xuICBkb211cC5hcmVhW2FjXShkb211cC51cGxvYWRpbmcpO1xuICBkb211cC5hcmVhW2FjXShkb211cC5kcm9waWNvbik7XG4gIGRvbXVwLnVwbG9hZFthY10oZG9tdXAuYnJvd3NlKTtcbiAgZG9tdXAudXBsb2FkW2FjXShkb211cC5maWxlaW5wdXQpO1xuICBkb211cC5maWxlaW5wdXQuaWQgPSBmdXA7XG4gIGRvbXVwLmZpbGVpbnB1dC50eXBlID0gJ2ZpbGUnO1xuICBkb211cC5maWxlaW5wdXQubXVsdGlwbGUgPSAnbXVsdGlwbGUnO1xuICBkb20uZGlhbG9nLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC11cGxvYWRzJztcbiAgZG9tLmlucHV0Q29udGFpbmVyLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC1pbnB1dC1jb250YWluZXItdXBsb2Fkcyc7XG4gIGRvbS5pbnB1dC5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtaW5wdXQtdXBsb2Fkcyc7XG4gIGRvbS5zZWN0aW9uLmluc2VydEJlZm9yZShkb211cC53YXJuaW5nLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvbi5pbnNlcnRCZWZvcmUoZG9tdXAuZmFpbGVkLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAudXBsb2FkKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmRyYWdkcm9wKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmFyZWEpO1xuICBkb20uZGVzYy50ZXh0Q29udGVudCA9IGRvbS5kZXNjLnRleHRDb250ZW50ICsgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZDtcbiAgZG9tdXAuZmlsZWlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgZm9jdXNlZEZpbGVJbnB1dCk7XG4gIGRvbXVwLmZpbGVpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgYmx1cnJlZEZpbGVJbnB1dCk7XG5cbiAgZnVuY3Rpb24gZm9jdXNlZEZpbGVJbnB1dCAoKSB7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAudXBsb2FkLCAnd2stZm9jdXNlZCcpO1xuICB9XG4gIGZ1bmN0aW9uIGJsdXJyZWRGaWxlSW5wdXQgKCkge1xuICAgIGNsYXNzZXMucm0oZG9tdXAudXBsb2FkLCAnd2stZm9jdXNlZCcpO1xuICB9XG4gIHJldHVybiBkb211cDtcbn1cblxucmVuZGVyLnVwbG9hZHMgPSB1cGxvYWRzO1xubW9kdWxlLmV4cG9ydHMgPSByZW5kZXI7XG4iXX0=
},{"../classes":7,"../strings":42}],40:[function(require,module,exports){
'use strict';

var strings = require('./strings');

function commands (el, id) {
  el.textContent = strings.buttons[id] || id;
}

function modes (el, id) {
  el.textContent = strings.modes[id] || id;
}

module.exports = {
  modes: modes,
  commands: commands
};

},{"./strings":42}],41:[function(require,module,exports){
'use strict';

function ShortcutManager(element) {
  this.boundHandler = this.handleEvent.bind(this);
  this.handlers = {};
  if(element) {
    this.attach(element);
  }
}

ShortcutManager.prototype.attach = function (el) {
  el.addEventListener('keydown', this.boundHandler, false);
};

ShortcutManager.prototype.detach = function (el) {
  el.removeEventListener('keydown', this.boundHandler, false);
};

ShortcutManager.prototype.add = function (key, shift, fn) {
  if(arguments.length === 2) {
    fn = shift;
    shift = false;
  }

  if(!this.handlers[key]) { this.handlers[key] = []; }
  this.handlers[key].push({
    shift: !!shift,
    fn: fn,
  });

  return this;
};

ShortcutManager.prototype.remove = function (key, shift, fn) {
  if(arguments.length === 2) {
    fn = shift;
    shift = undefined;
  }

  if(this.handlers[key] && this.handlers[key].length) {
    var h = 0,
      l = this.handlers[key].length;
    for(; h < l; h++) {
      var handler = this.handlers[key][h];
      if(handler.fn === fn && (typeof shift === 'undefined' || handler.shift === shift)) {
        // Match, don't need to process anymore
        break;
      }
    }

    if(h < l) {
      // We found a match, splice it out
      this.hanlders.splice(h, 1);
    }
  }

  return this;
};

ShortcutManager.prototype.clear = function () {
  this.handlers = {};
};

ShortcutManager.prototype.handleEvent = function (event) {
  if(event.ctrlKey || event.metaKey) {
    var ch = event.key;

    if(ch && this.handlers[ch]) {
      for(var h = 0, l = this.handlers[ch].length; h < l; h++) {
        var handler = this.handlers[ch][h];

        if(event.shiftKey === handler.shift) {
          // Handle event
          handler.fn(event);
          event.preventDefault();
          event.stopPropagation();
        }
      } // End for loop
    } // End handler array check
  }// End CTRL/CMD check
};

module.exports = ShortcutManager;

},{}],42:[function(require,module,exports){
'use strict';

module.exports = {
  placeholders: {
    bold: 'strong text',
    italic: 'emphasized text',
    quote: 'quoted text',
    code: 'code goes here',
    listitem: 'list item',
    heading: 'Heading Text',
    link: 'link text',
    image: 'image description',
    attachment: 'attachment description'
  },
  titles: {
    bold: 'Strong <strong> Ctrl+B',
    italic: 'Emphasis <em> Ctrl+I',
    quote: 'Blockquote <blockquote> Ctrl+J',
    code: 'Code Sample <pre><code> Ctrl+E',
    ol: 'Numbered List <ol> Ctrl+O',
    ul: 'Bulleted List <ul> Ctrl+U',
    heading: 'Heading <h1>, <h2>, ... Ctrl+D',
    link: 'Hyperlink <a> Ctrl+K',
    image: 'Image <img> Ctrl+G',
    attachment: 'Attachment Ctrl+Shift+K',
    markdown: 'Markdown Mode Ctrl+M',
    html: 'HTML Mode Ctrl+H',
    wysiwyg: 'Preview Mode Ctrl+P'
  },
  buttons: {
    bold: 'B',
    italic: 'I',
    quote: '\u201c',
    code: '</>',
    ol: '1.',
    ul: '\u29BF',
    heading: 'Tt',
    link: 'Link',
    image: 'Image',
    attachment: 'Attachment',
    hr: '\u21b5'
  },
  prompts: {
    link: {
      title: 'Insert Link',
      description: 'Type or paste the url to your link',
      placeholder: 'http://example.com/ "title"'
    },
    image: {
      title: 'Insert Image',
      description: 'Enter the url to your image',
      placeholder: 'http://example.com/public/image.png "title"'
    },
    attachment: {
      title: 'Attach File',
      description: 'Enter the url to your attachment',
      placeholder: 'http://example.com/public/report.pdf "title"'
    },
    types: 'You can only upload ',
    browse: 'Browse...',
    drophint: 'You can also drag files from your computer and drop them here!',
    drop: 'Drop your file here to begin upload...',
    upload: ', or upload a file',
    uploading: 'Uploading your file...',
    uploadfailed: 'The upload failed! That\'s all we know.'
  },
  modes: {
    wysiwyg: 'wysiwyg',
    markdown: 'm\u2193',
  },
};

},{}],43:[function(require,module,exports){
'use strict';

var classes = require('./classes');
var dragClass = 'wk-dragging';
var dragClassSpecific = 'wk-container-dragging';
var root = document.documentElement;

function uploads (container, droparea, editor, options, remove) {
  var op = remove ? 'remove' : 'add';
  root[op + 'EventListener']('dragenter', dragging);
  root[op + 'EventListener']('dragend', dragstop);
  root[op + 'EventListener']('mouseout', dragstop);
  root[op + 'EventListener']('dragover', handleDragOver, false);
  root[op + 'EventListener']('drop', handleFileSelect, false);

  function dragging () {
    classes.add(droparea, dragClass);
    classes.add(droparea, dragClassSpecific);
  }
  function dragstop () {
    dragstopper(droparea);
  }
  function handleDragOver (e) {
    stop(e);
    dragging();
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleFileSelect (e) {
    dragstop();
    stop(e);
    editor.runCommand(function runner (chunks, mode) {
      var files = Array.prototype.slice.call(e.dataTransfer.files);
      var type = inferType(files);
      editor.linkOrImageOrAttachment(type, files).call(this, mode, chunks);
    });
  }
  function inferType (files) {
    if (options.images && !options.attachments) {
      return 'image';
    }
    if (!options.images && options.attachments) {
      return 'attachment';
    }
    if (files.every(matches(options.images.validate || never))) {
      return 'image';
    }
    return 'attachment';
  }
}

function matches (fn) {
  return function matcher (file) { return fn(file); };
}
function never () {
  return false;
}
function stop (e) {
  e.stopPropagation();
  e.preventDefault();
}
function dragstopper (droparea) {
  classes.rm(droparea, dragClass);
  classes.rm(droparea, dragClassSpecific);
}

uploads.stop = dragstopper;
module.exports = uploads;

},{"./classes":7}],44:[function(require,module,exports){
'use strict';

// Object.assign polyfill
// Ignore Polyfill code for linting (overriding globals here is expected)
/* jshint ignore:start */
if (typeof Object.assign != 'function') {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
  Object.assign = function(target, varArgs) { // .length of function is 2
    if (target === null || target === undefined) { // TypeError if undefined or null
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);

    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];

      if (nextSource !== null && nextSource !== undefined) { // Skip over if undefined or null
        for (var nextKey in nextSource) {
          // Avoid bugs when hasOwnProperty is shadowed
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

// Custom Event Constructor Polyfill
(function () {
  if ( typeof window.CustomEvent === "function" ) { return false; }

  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();

// Mouse Event Constructor Polyfill
(function (window) {
  try {
    new MouseEvent('test');
    return false; // No need to polyfill
  } catch (e) {
    // Need to polyfill - fall through
  }

  // Polyfills DOM4 MouseEvent

  var MouseEvent = function (eventType, params) {
    params = params || { bubbles: false, cancelable: false };
    var mouseEvent = document.createEvent('MouseEvent');
    mouseEvent.initMouseEvent(eventType, params.bubbles, params.cancelable, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

    return mouseEvent;
  };

  MouseEvent.prototype = Event.prototype;

  window.MouseEvent = MouseEvent;
})(window);
/* jshint ignore:end */

var exists = exports.exists = function (obj) {
  return obj !== undefined && obj !== null;
};

exports.clone = function (obj) {
  return Object.assign({}, obj);
};

exports.extend = Object.assign;

exports.defaultsDeep = function (target) {
  if (!exists(target)) { // TypeError if undefined or null
    throw new TypeError('Cannot convert undefined or null to object');
  }

  var to = exports.clone(target);

  for (var index = 1; index < arguments.length; index++) {
    var nextSource = arguments[index];

    if (nextSource !== null) { // Skip over if undefined or null
      for (var nextKey in nextSource) {
        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
          if(Object.prototype.hasOwnProperty(to, nextKey)) {
            if(exists(to[nextKey]) && exists(nextSource[nextKey]) && typeof to[nextKey] === 'object' && typeof nextSource[nextKey] === 'object') {
              to[nextKey] = exports.defaultsDeep(to[nextKey], nextSource[nextKey]);
            }
            // Else: Don't override existing values
          } else if (typeof nextSource[nextKey] === 'object' && nextSource[nextKey] !== null) {
            to[nextKey] = exports.clone(nextSource[nextKey]);
          } else {
            to[nextKey] = nextSource[nextKey];
          }
        } // end source if check
      } // end for
    }
  }

  return to;
};

exports.dispatchCustomEvent = function (element, event, params) {
  var ev = new CustomEvent(event, params);
  element.dispatchEvent(ev);
};

exports.dispatchClickEvent = function (element) {
  var ev = new MouseEvent('click');
  element.dispatchEvent(ev);
};

},{}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsInNyY1xcSW5wdXRIaXN0b3J5LmpzIiwic3JjXFxJbnB1dFN0YXRlLmpzIiwic3JjXFxiYXJrbWFyay5qcyIsInNyY1xcYmluZENvbW1hbmRzLmpzIiwic3JjXFxjaHVua3NcXHBhcnNlTGlua0lucHV0LmpzIiwic3JjXFxjaHVua3NcXHRyaW0uanMiLCJzcmNcXGNsYXNzZXMuanMiLCJzcmNcXGVkaXRvci5qcyIsInNyY1xcZXh0ZW5kUmVnRXhwLmpzIiwic3JjXFxmaXhFT0wuanMiLCJzcmNcXGdldENvbW1hbmRIYW5kbGVyLmpzIiwic3JjXFxodG1sXFxIdG1sQ2h1bmtzLmpzIiwic3JjXFxodG1sXFxibG9ja3F1b3RlLmpzIiwic3JjXFxodG1sXFxib2xkT3JJdGFsaWMuanMiLCJzcmNcXGh0bWxcXGNvZGVibG9jay5qcyIsInNyY1xcaHRtbFxcaGVhZGluZy5qcyIsInNyY1xcaHRtbFxcaHIuanMiLCJzcmNcXGh0bWxcXGxpbmtPckltYWdlT3JBdHRhY2htZW50LmpzIiwic3JjXFxodG1sXFxsaXN0LmpzIiwic3JjXFxodG1sXFx3cmFwcGluZy5qcyIsInNyY1xcaXNWaXNpYmxlRWxlbWVudC5qcyIsInNyY1xcbWFuYWdlci5qcyIsInNyY1xcbWFueS5qcyIsInNyY1xcbWFya2Rvd25cXE1hcmtkb3duQ2h1bmtzLmpzIiwic3JjXFxtYXJrZG93blxcYmxvY2txdW90ZS5qcyIsInNyY1xcbWFya2Rvd25cXGJvbGRPckl0YWxpYy5qcyIsInNyY1xcbWFya2Rvd25cXGNvZGVibG9jay5qcyIsInNyY1xcbWFya2Rvd25cXGhlYWRpbmcuanMiLCJzcmNcXG1hcmtkb3duXFxoci5qcyIsInNyY1xcbWFya2Rvd25cXGxpbmtPckltYWdlT3JBdHRhY2htZW50LmpzIiwic3JjXFxtYXJrZG93blxcbGlzdC5qcyIsInNyY1xcbWFya2Rvd25cXHNldHRpbmdzLmpzIiwic3JjXFxtYXJrZG93blxcd3JhcHBpbmcuanMiLCJzcmNcXG1vZGVzXFxtYXJrZG93blxcdGV4dGFyZWFTdXJmYWNlLmpzIiwic3JjXFxtb2Rlc1xcd3lzaXd5Z1xcd3lzaXd5Z1N1cmZhY2UuanMiLCJzcmNcXG9uY2UuanMiLCJzcmNcXHByb21wdHNcXGNsb3NlLmpzIiwic3JjXFxwcm9tcHRzXFxwcm9tcHQuanMiLCJzcmNcXHByb21wdHNcXHJlbmRlci5qcyIsInNyY1xccmVuZGVyZXJzLmpzIiwic3JjXFxzaG9ydGN1dHMuanMiLCJzcmNcXHN0cmluZ3MuanMiLCJzcmNcXHVwbG9hZHMuanMiLCJzcmNcXHV0aWxzLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdldBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDektBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSW5wdXRTdGF0ZSA9IHJlcXVpcmUoJy4vSW5wdXRTdGF0ZScpO1xuXG5mdW5jdGlvbiBJbnB1dEhpc3RvcnkgKHN1cmZhY2UsIG1vZGUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcblxuICBzdGF0ZS5pbnB1dE1vZGUgPSBtb2RlO1xuICBzdGF0ZS5zdXJmYWNlID0gc3VyZmFjZTtcbiAgc3RhdGUucmVzZXQoKTtcblxuICBsaXN0ZW4oc3VyZmFjZS5jdXJyZW50KCkpO1xuXG4gIGZ1bmN0aW9uIGxpc3RlbiAoZWwpIHtcbiAgICB2YXIgcGFzdGVIYW5kbGVyID0gc2VsZmllKGhhbmRsZVBhc3RlKTtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIHByZXZlbnRDdHJsWVopO1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBzZWxmaWUoaGFuZGxlQ3RybFlaKSk7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHNlbGZpZShoYW5kbGVNb2RlQ2hhbmdlKSk7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgc2V0TW92aW5nKTtcbiAgICBlbC5vbnBhc3RlID0gcGFzdGVIYW5kbGVyO1xuICAgIGVsLm9uZHJvcCA9IHBhc3RlSGFuZGxlcjtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldE1vdmluZyAoKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnbW92aW5nJyk7XG4gIH1cblxuICBmdW5jdGlvbiBzZWxmaWUgKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZXIgKGUpIHsgcmV0dXJuIGZuLmNhbGwobnVsbCwgc3RhdGUsIGUpOyB9O1xuICB9XG59XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2V0SW5wdXRNb2RlID0gZnVuY3Rpb24gKG1vZGUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgc3RhdGUuaW5wdXRNb2RlID0gbW9kZTtcbiAgc3RhdGUucmVzZXQoKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUucmVzZXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmlucHV0U3RhdGUgPSBudWxsO1xuICBzdGF0ZS5sYXN0U3RhdGUgPSBudWxsO1xuICBzdGF0ZS5oaXN0b3J5ID0gW107XG4gIHN0YXRlLmhpc3RvcnlQb2ludGVyID0gMDtcbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnbm9uZSc7XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBudWxsO1xuICBzdGF0ZS5yZWZyZXNoU3RhdGUodHJ1ZSk7XG4gIHN0YXRlLnNhdmVTdGF0ZSgpO1xuICByZXR1cm4gc3RhdGU7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNldENvbW1hbmRNb2RlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdjb21tYW5kJztcbiAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbiAgfSwgMCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLmNhblVuZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmhpc3RvcnlQb2ludGVyID4gMTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuY2FuUmVkbyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuaGlzdG9yeVt0aGlzLmhpc3RvcnlQb2ludGVyICsgMV07XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnVuZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIGlmIChzdGF0ZS5jYW5VbmRvKCkpIHtcbiAgICBpZiAoc3RhdGUubGFzdFN0YXRlKSB7XG4gICAgICBzdGF0ZS5sYXN0U3RhdGUucmVzdG9yZSgpO1xuICAgICAgc3RhdGUubGFzdFN0YXRlID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlcl0gPSBuZXcgSW5wdXRTdGF0ZShzdGF0ZS5zdXJmYWNlLCBzdGF0ZS5pbnB1dE1vZGUpO1xuICAgICAgc3RhdGUuaGlzdG9yeVstLXN0YXRlLmhpc3RvcnlQb2ludGVyXS5yZXN0b3JlKCk7XG4gICAgfVxuICB9XG4gIHN0YXRlLmhpc3RvcnlNb2RlID0gJ25vbmUnO1xuICBzdGF0ZS5zdXJmYWNlLmZvY3VzKHN0YXRlLmlucHV0TW9kZSk7XG4gIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5yZWRvID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBpZiAoc3RhdGUuY2FuUmVkbygpKSB7XG4gICAgc3RhdGUuaGlzdG9yeVsrK3N0YXRlLmhpc3RvcnlQb2ludGVyXS5yZXN0b3JlKCk7XG4gIH1cblxuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdub25lJztcbiAgc3RhdGUuc3VyZmFjZS5mb2N1cyhzdGF0ZS5pbnB1dE1vZGUpO1xuICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2V0TW9kZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBpZiAoc3RhdGUuaGlzdG9yeU1vZGUgIT09IHZhbHVlKSB7XG4gICAgc3RhdGUuaGlzdG9yeU1vZGUgPSB2YWx1ZTtcbiAgICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgfVxuICBzdGF0ZS5yZWZyZXNoaW5nID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG4gIH0sIDEpO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5yZWZyZXNoU3RhdGUgPSBmdW5jdGlvbiAoaW5pdGlhbFN0YXRlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmlucHV0U3RhdGUgPSBuZXcgSW5wdXRTdGF0ZShzdGF0ZS5zdXJmYWNlLCBzdGF0ZS5pbnB1dE1vZGUsIGluaXRpYWxTdGF0ZSk7XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBudWxsO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5zYXZlU3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHZhciBjdXJyZW50ID0gc3RhdGUuaW5wdXRTdGF0ZSB8fCBuZXcgSW5wdXRTdGF0ZShzdGF0ZS5zdXJmYWNlLCBzdGF0ZS5pbnB1dE1vZGUpO1xuXG4gIGlmIChzdGF0ZS5oaXN0b3J5TW9kZSA9PT0gJ21vdmluZycpIHtcbiAgICBpZiAoIXN0YXRlLmxhc3RTdGF0ZSkge1xuICAgICAgc3RhdGUubGFzdFN0YXRlID0gY3VycmVudDtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChzdGF0ZS5sYXN0U3RhdGUpIHtcbiAgICBpZiAoc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlciAtIDFdLnRleHQgIT09IHN0YXRlLmxhc3RTdGF0ZS50ZXh0KSB7XG4gICAgICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyKytdID0gc3RhdGUubGFzdFN0YXRlO1xuICAgIH1cbiAgICBzdGF0ZS5sYXN0U3RhdGUgPSBudWxsO1xuICB9XG4gIHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXIrK10gPSBjdXJyZW50O1xuICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyICsgMV0gPSBudWxsO1xufTtcblxuZnVuY3Rpb24gaGFuZGxlQ3RybFlaIChzdGF0ZSwgZSkge1xuICB2YXIgaGFuZGxlZCA9IGZhbHNlO1xuICB2YXIga2V5Q29kZSA9IGUuY2hhckNvZGUgfHwgZS5rZXlDb2RlO1xuICB2YXIga2V5Q29kZUNoYXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGtleUNvZGUpO1xuXG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSB7XG4gICAgc3dpdGNoIChrZXlDb2RlQ2hhci50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICBjYXNlICd5JzpcbiAgICAgICAgc3RhdGUucmVkbygpO1xuICAgICAgICBoYW5kbGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG5cbiAgICAgIGNhc2UgJ3onOlxuICAgICAgICBpZiAoZS5zaGlmdEtleSkge1xuICAgICAgICAgIHN0YXRlLnJlZG8oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBzdGF0ZS51bmRvKCk7XG4gICAgICAgIH1cbiAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGlmIChoYW5kbGVkICYmIGUucHJldmVudERlZmF1bHQpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlTW9kZUNoYW5nZSAoc3RhdGUsIGUpIHtcbiAgaWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIga2V5Q29kZSA9IGUua2V5Q29kZTtcblxuICBpZiAoKGtleUNvZGUgPj0gMzMgJiYga2V5Q29kZSA8PSA0MCkgfHwgKGtleUNvZGUgPj0gNjMyMzIgJiYga2V5Q29kZSA8PSA2MzIzNSkpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCdtb3ZpbmcnKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSA4IHx8IGtleUNvZGUgPT09IDQ2IHx8IGtleUNvZGUgPT09IDEyNykge1xuICAgIHN0YXRlLnNldE1vZGUoJ2RlbGV0aW5nJyk7XG4gIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMTMpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCduZXdsaW5lcycpO1xuICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDI3KSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnZXNjYXBlJyk7XG4gIH0gZWxzZSBpZiAoKGtleUNvZGUgPCAxNiB8fCBrZXlDb2RlID4gMjApICYmIGtleUNvZGUgIT09IDkxKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgndHlwaW5nJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlUGFzdGUgKHN0YXRlKSB7XG4gIGlmIChzdGF0ZS5pbnB1dFN0YXRlICYmIHN0YXRlLmlucHV0U3RhdGUudGV4dCAhPT0gc3RhdGUuc3VyZmFjZS5yZWFkKHN0YXRlLmlucHV0TW9kZSkgJiYgc3RhdGUucmVmcmVzaGluZyA9PT0gbnVsbCkge1xuICAgIHN0YXRlLmhpc3RvcnlNb2RlID0gJ3Bhc3RlJztcbiAgICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcmV2ZW50Q3RybFlaIChlKSB7XG4gIHZhciBrZXlDb2RlID0gZS5jaGFyQ29kZSB8fCBlLmtleUNvZGU7XG4gIHZhciB5eiA9IGtleUNvZGUgPT09IDg5IHx8IGtleUNvZGUgPT09IDkwO1xuICB2YXIgY3RybCA9IGUuY3RybEtleSB8fCBlLm1ldGFLZXk7XG4gIGlmIChjdHJsICYmIHl6KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXRIaXN0b3J5O1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGlzVmlzaWJsZUVsZW1lbnQgPSByZXF1aXJlKCcuL2lzVmlzaWJsZUVsZW1lbnQnKTtcbnZhciBmaXhFT0wgPSByZXF1aXJlKCcuL2ZpeEVPTCcpO1xudmFyIE1hcmtkb3duQ2h1bmtzID0gcmVxdWlyZSgnLi9tYXJrZG93bi9NYXJrZG93bkNodW5rcycpO1xudmFyIEh0bWxDaHVua3MgPSByZXF1aXJlKCcuL2h0bWwvSHRtbENodW5rcycpO1xudmFyIGNodW5rcyA9IHtcbiAgbWFya2Rvd246IE1hcmtkb3duQ2h1bmtzLFxuICBodG1sOiBIdG1sQ2h1bmtzLFxuICB3eXNpd3lnOiBIdG1sQ2h1bmtzXG59O1xuXG5mdW5jdGlvbiBJbnB1dFN0YXRlIChzdXJmYWNlLCBtb2RlLCBpbml0aWFsU3RhdGUpIHtcbiAgdGhpcy5tb2RlID0gbW9kZTtcbiAgdGhpcy5zdXJmYWNlID0gc3VyZmFjZTtcbiAgdGhpcy5pbml0aWFsU3RhdGUgPSBpbml0aWFsU3RhdGUgfHwgZmFsc2U7XG4gIHRoaXMuaW5pdCgpO1xufVxuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5pbml0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICghaXNWaXNpYmxlRWxlbWVudChlbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCF0aGlzLmluaXRpYWxTdGF0ZSAmJiBkb2MuYWN0aXZlRWxlbWVudCAmJiBkb2MuYWN0aXZlRWxlbWVudCAhPT0gZWwpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5zdXJmYWNlLnJlYWRTZWxlY3Rpb24oc2VsZik7XG4gIHNlbGYuc2Nyb2xsVG9wID0gZWwuc2Nyb2xsVG9wO1xuICBpZiAoIXNlbGYudGV4dCkge1xuICAgIHNlbGYudGV4dCA9IHNlbGYuc3VyZmFjZS5yZWFkKHNlbGYubW9kZSk7XG4gIH1cbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLnNlbGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAoIWlzVmlzaWJsZUVsZW1lbnQoZWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNlbGYuc3VyZmFjZS53cml0ZVNlbGVjdGlvbihzZWxmKTtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLnJlc3RvcmUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKHR5cGVvZiBzZWxmLnRleHQgPT09ICdzdHJpbmcnICYmIHNlbGYudGV4dCAhPT0gc2VsZi5zdXJmYWNlLnJlYWQoKSkge1xuICAgIHNlbGYuc3VyZmFjZS53cml0ZShzZWxmLnRleHQpO1xuICB9XG4gIHNlbGYuc2VsZWN0KCk7XG4gIGVsLnNjcm9sbFRvcCA9IHNlbGYuc2Nyb2xsVG9wO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuZ2V0Q2h1bmtzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBjaHVuayA9IG5ldyBjaHVua3Nbc2VsZi5tb2RlXSgpO1xuICBjaHVuay5iZWZvcmUgPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZygwLCBzZWxmLnN0YXJ0KSk7XG4gIGNodW5rLnN0YXJ0VGFnID0gJyc7XG4gIGNodW5rLnNlbGVjdGlvbiA9IGZpeEVPTChzZWxmLnRleHQuc3Vic3RyaW5nKHNlbGYuc3RhcnQsIHNlbGYuZW5kKSk7XG4gIGNodW5rLmVuZFRhZyA9ICcnO1xuICBjaHVuay5hZnRlciA9IGZpeEVPTChzZWxmLnRleHQuc3Vic3RyaW5nKHNlbGYuZW5kKSk7XG4gIGNodW5rLnNjcm9sbFRvcCA9IHNlbGYuc2Nyb2xsVG9wO1xuICBzZWxmLmNhY2hlZENodW5rcyA9IGNodW5rO1xuICByZXR1cm4gY2h1bms7XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5zZXRDaHVua3MgPSBmdW5jdGlvbiAoY2h1bmspIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBjaHVuay5iZWZvcmUgPSBjaHVuay5iZWZvcmUgKyBjaHVuay5zdGFydFRhZztcbiAgY2h1bmsuYWZ0ZXIgPSBjaHVuay5lbmRUYWcgKyBjaHVuay5hZnRlcjtcbiAgc2VsZi5zdGFydCA9IGNodW5rLmJlZm9yZS5sZW5ndGg7XG4gIHNlbGYuZW5kID0gY2h1bmsuYmVmb3JlLmxlbmd0aCArIGNodW5rLnNlbGVjdGlvbi5sZW5ndGg7XG4gIHNlbGYudGV4dCA9IGNodW5rLmJlZm9yZSArIGNodW5rLnNlbGVjdGlvbiArIGNodW5rLmFmdGVyO1xuICBzZWxmLnNjcm9sbFRvcCA9IGNodW5rLnNjcm9sbFRvcDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW5wdXRTdGF0ZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5SmJuQjFkRk4wWVhSbExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJrYjJNZ1BTQm5iRzlpWVd3dVpHOWpkVzFsYm5RN1hHNTJZWElnYVhOV2FYTnBZbXhsUld4bGJXVnVkQ0E5SUhKbGNYVnBjbVVvSnk0dmFYTldhWE5wWW14bFJXeGxiV1Z1ZENjcE8xeHVkbUZ5SUdacGVFVlBUQ0E5SUhKbGNYVnBjbVVvSnk0dlptbDRSVTlNSnlrN1hHNTJZWElnVFdGeWEyUnZkMjVEYUhWdWEzTWdQU0J5WlhGMWFYSmxLQ2N1TDIxaGNtdGtiM2R1TDAxaGNtdGtiM2R1UTJoMWJtdHpKeWs3WEc1MllYSWdTSFJ0YkVOb2RXNXJjeUE5SUhKbGNYVnBjbVVvSnk0dmFIUnRiQzlJZEcxc1EyaDFibXR6SnlrN1hHNTJZWElnWTJoMWJtdHpJRDBnZTF4dUlDQnRZWEpyWkc5M2Jqb2dUV0Z5YTJSdmQyNURhSFZ1YTNNc1hHNGdJR2gwYld3NklFaDBiV3hEYUhWdWEzTXNYRzRnSUhkNWMybDNlV2M2SUVoMGJXeERhSFZ1YTNOY2JuMDdYRzVjYm1aMWJtTjBhVzl1SUVsdWNIVjBVM1JoZEdVZ0tITjFjbVpoWTJVc0lHMXZaR1VzSUdsdWFYUnBZV3hUZEdGMFpTa2dlMXh1SUNCMGFHbHpMbTF2WkdVZ1BTQnRiMlJsTzF4dUlDQjBhR2x6TG5OMWNtWmhZMlVnUFNCemRYSm1ZV05sTzF4dUlDQjBhR2x6TG1sdWFYUnBZV3hUZEdGMFpTQTlJR2x1YVhScFlXeFRkR0YwWlNCOGZDQm1ZV3h6WlR0Y2JpQWdkR2hwY3k1cGJtbDBLQ2s3WEc1OVhHNWNia2x1Y0hWMFUzUmhkR1V1Y0hKdmRHOTBlWEJsTG1sdWFYUWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJSFpoY2lCelpXeG1JRDBnZEdocGN6dGNiaUFnZG1GeUlHVnNJRDBnYzJWc1ppNXpkWEptWVdObExtTjFjbkpsYm5Rb2MyVnNaaTV0YjJSbEtUdGNiaUFnYVdZZ0tDRnBjMVpwYzJsaWJHVkZiR1Z0Wlc1MEtHVnNLU2tnZTF4dUlDQWdJSEpsZEhWeWJqdGNiaUFnZlZ4dUlDQnBaaUFvSVhSb2FYTXVhVzVwZEdsaGJGTjBZWFJsSUNZbUlHUnZZeTVoWTNScGRtVkZiR1Z0Wlc1MElDWW1JR1J2WXk1aFkzUnBkbVZGYkdWdFpXNTBJQ0U5UFNCbGJDa2dlMXh1SUNBZ0lISmxkSFZ5Ymp0Y2JpQWdmVnh1SUNCelpXeG1Mbk4xY21aaFkyVXVjbVZoWkZObGJHVmpkR2x2YmloelpXeG1LVHRjYmlBZ2MyVnNaaTV6WTNKdmJHeFViM0FnUFNCbGJDNXpZM0p2Ykd4VWIzQTdYRzRnSUdsbUlDZ2hjMlZzWmk1MFpYaDBLU0I3WEc0Z0lDQWdjMlZzWmk1MFpYaDBJRDBnYzJWc1ppNXpkWEptWVdObExuSmxZV1FvYzJWc1ppNXRiMlJsS1R0Y2JpQWdmVnh1ZlR0Y2JseHVTVzV3ZFhSVGRHRjBaUzV3Y205MGIzUjVjR1V1YzJWc1pXTjBJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0IyWVhJZ2MyVnNaaUE5SUhSb2FYTTdYRzRnSUhaaGNpQmxiQ0E5SUhObGJHWXVjM1Z5Wm1GalpTNWpkWEp5Wlc1MEtITmxiR1l1Ylc5a1pTazdYRzRnSUdsbUlDZ2hhWE5XYVhOcFlteGxSV3hsYldWdWRDaGxiQ2twSUh0Y2JpQWdJQ0J5WlhSMWNtNDdYRzRnSUgxY2JpQWdjMlZzWmk1emRYSm1ZV05sTG5keWFYUmxVMlZzWldOMGFXOXVLSE5sYkdZcE8xeHVmVHRjYmx4dVNXNXdkWFJUZEdGMFpTNXdjbTkwYjNSNWNHVXVjbVZ6ZEc5eVpTQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdkbUZ5SUhObGJHWWdQU0IwYUdsek8xeHVJQ0IyWVhJZ1pXd2dQU0J6Wld4bUxuTjFjbVpoWTJVdVkzVnljbVZ1ZENoelpXeG1MbTF2WkdVcE8xeHVJQ0JwWmlBb2RIbHdaVzltSUhObGJHWXVkR1Y0ZENBOVBUMGdKM04wY21sdVp5Y2dKaVlnYzJWc1ppNTBaWGgwSUNFOVBTQnpaV3htTG5OMWNtWmhZMlV1Y21WaFpDZ3BLU0I3WEc0Z0lDQWdjMlZzWmk1emRYSm1ZV05sTG5keWFYUmxLSE5sYkdZdWRHVjRkQ2s3WEc0Z0lIMWNiaUFnYzJWc1ppNXpaV3hsWTNRb0tUdGNiaUFnWld3dWMyTnliMnhzVkc5d0lEMGdjMlZzWmk1elkzSnZiR3hVYjNBN1hHNTlPMXh1WEc1SmJuQjFkRk4wWVhSbExuQnliM1J2ZEhsd1pTNW5aWFJEYUhWdWEzTWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJSFpoY2lCelpXeG1JRDBnZEdocGN6dGNiaUFnZG1GeUlHTm9kVzVySUQwZ2JtVjNJR05vZFc1cmMxdHpaV3htTG0xdlpHVmRLQ2s3WEc0Z0lHTm9kVzVyTG1KbFptOXlaU0E5SUdacGVFVlBUQ2h6Wld4bUxuUmxlSFF1YzNWaWMzUnlhVzVuS0RBc0lITmxiR1l1YzNSaGNuUXBLVHRjYmlBZ1kyaDFibXN1YzNSaGNuUlVZV2NnUFNBbkp6dGNiaUFnWTJoMWJtc3VjMlZzWldOMGFXOXVJRDBnWm1sNFJVOU1LSE5sYkdZdWRHVjRkQzV6ZFdKemRISnBibWNvYzJWc1ppNXpkR0Z5ZEN3Z2MyVnNaaTVsYm1RcEtUdGNiaUFnWTJoMWJtc3VaVzVrVkdGbklEMGdKeWM3WEc0Z0lHTm9kVzVyTG1GbWRHVnlJRDBnWm1sNFJVOU1LSE5sYkdZdWRHVjRkQzV6ZFdKemRISnBibWNvYzJWc1ppNWxibVFwS1R0Y2JpQWdZMmgxYm1zdWMyTnliMnhzVkc5d0lEMGdjMlZzWmk1elkzSnZiR3hVYjNBN1hHNGdJSE5sYkdZdVkyRmphR1ZrUTJoMWJtdHpJRDBnWTJoMWJtczdYRzRnSUhKbGRIVnliaUJqYUhWdWF6dGNibjA3WEc1Y2JrbHVjSFYwVTNSaGRHVXVjSEp2ZEc5MGVYQmxMbk5sZEVOb2RXNXJjeUE5SUdaMWJtTjBhVzl1SUNoamFIVnVheWtnZTF4dUlDQjJZWElnYzJWc1ppQTlJSFJvYVhNN1hHNGdJR05vZFc1ckxtSmxabTl5WlNBOUlHTm9kVzVyTG1KbFptOXlaU0FySUdOb2RXNXJMbk4wWVhKMFZHRm5PMXh1SUNCamFIVnVheTVoWm5SbGNpQTlJR05vZFc1ckxtVnVaRlJoWnlBcklHTm9kVzVyTG1GbWRHVnlPMXh1SUNCelpXeG1Mbk4wWVhKMElEMGdZMmgxYm1zdVltVm1iM0psTG14bGJtZDBhRHRjYmlBZ2MyVnNaaTVsYm1RZ1BTQmphSFZ1YXk1aVpXWnZjbVV1YkdWdVozUm9JQ3NnWTJoMWJtc3VjMlZzWldOMGFXOXVMbXhsYm1kMGFEdGNiaUFnYzJWc1ppNTBaWGgwSUQwZ1kyaDFibXN1WW1WbWIzSmxJQ3NnWTJoMWJtc3VjMlZzWldOMGFXOXVJQ3NnWTJoMWJtc3VZV1owWlhJN1hHNGdJSE5sYkdZdWMyTnliMnhzVkc5d0lEMGdZMmgxYm1zdWMyTnliMnhzVkc5d08xeHVmVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCSmJuQjFkRk4wWVhSbE8xeHVJbDE5IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgTWFuYWdlciA9IHJlcXVpcmUoJy4vbWFuYWdlcicpO1xuXG52YXIgbWFuYWdlciA9IG5ldyBNYW5hZ2VyKCk7XG5cbmZ1bmN0aW9uIGJhcmttYXJrICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICByZXR1cm4gbWFuYWdlci5nZXQodGV4dGFyZWEsIG9wdGlvbnMpO1xufVxuXG5iYXJrbWFyay5maW5kID0gZnVuY3Rpb24gKHRleHRhcmVhKSB7XG4gIHJldHVybiBtYW5hZ2VyLmZpbmQodGV4dGFyZWEpO1xufTtcblxuYmFya21hcmsuc3RyaW5ncyA9IHJlcXVpcmUoJy4vc3RyaW5ncycpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGJhcmttYXJrO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG52YXIgY29tbWFuZHMgPSB7XG4gIG1hcmtkb3duOiB7XG4gICAgYm9sZE9ySXRhbGljOiByZXF1aXJlKCcuL21hcmtkb3duL2JvbGRPckl0YWxpYycpLFxuICAgIGxpbmtPckltYWdlT3JBdHRhY2htZW50OiByZXF1aXJlKCcuL21hcmtkb3duL2xpbmtPckltYWdlT3JBdHRhY2htZW50JyksXG4gICAgYmxvY2txdW90ZTogcmVxdWlyZSgnLi9tYXJrZG93bi9ibG9ja3F1b3RlJyksXG4gICAgY29kZWJsb2NrOiByZXF1aXJlKCcuL21hcmtkb3duL2NvZGVibG9jaycpLFxuICAgIGhlYWRpbmc6IHJlcXVpcmUoJy4vbWFya2Rvd24vaGVhZGluZycpLFxuICAgIGxpc3Q6IHJlcXVpcmUoJy4vbWFya2Rvd24vbGlzdCcpLFxuICAgIGhyOiByZXF1aXJlKCcuL21hcmtkb3duL2hyJylcbiAgfSxcbiAgaHRtbDoge1xuICAgIGJvbGRPckl0YWxpYzogcmVxdWlyZSgnLi9odG1sL2JvbGRPckl0YWxpYycpLFxuICAgIGxpbmtPckltYWdlT3JBdHRhY2htZW50OiByZXF1aXJlKCcuL2h0bWwvbGlua09ySW1hZ2VPckF0dGFjaG1lbnQnKSxcbiAgICBibG9ja3F1b3RlOiByZXF1aXJlKCcuL2h0bWwvYmxvY2txdW90ZScpLFxuICAgIGNvZGVibG9jazogcmVxdWlyZSgnLi9odG1sL2NvZGVibG9jaycpLFxuICAgIGhlYWRpbmc6IHJlcXVpcmUoJy4vaHRtbC9oZWFkaW5nJyksXG4gICAgbGlzdDogcmVxdWlyZSgnLi9odG1sL2xpc3QnKSxcbiAgICBocjogcmVxdWlyZSgnLi9odG1sL2hyJylcbiAgfVxufTtcblxuY29tbWFuZHMud3lzaXd5ZyA9IGNvbW1hbmRzLmh0bWw7XG5cbmZ1bmN0aW9uIGJpbmRDb21tYW5kcyAoZWRpdG9yLCBvcHRpb25zKSB7XG4gIGJpbmQoJ2JvbGQnLCAnYicsIGJvbGQpO1xuICBiaW5kKCdpdGFsaWMnLCAnaScsIGl0YWxpYyk7XG4gIGJpbmQoJ3F1b3RlJywgJ2onLCByb3V0ZXIoJ2Jsb2NrcXVvdGUnKSk7XG4gIGJpbmQoJ2NvZGUnLCAnZScsIGNvZGUpO1xuICBiaW5kKCdvbCcsICdvJywgb2wpO1xuICBiaW5kKCd1bCcsICd1JywgdWwpO1xuICBiaW5kKCdoZWFkaW5nJywgJ2QnLCByb3V0ZXIoJ2hlYWRpbmcnKSk7XG4gIGVkaXRvci5zaG93TGlua0RpYWxvZyA9IGZhYnJpY2F0b3IoYmluZCgnbGluaycsICdrJywgbGlua09ySW1hZ2VPckF0dGFjaG1lbnQoJ2xpbmsnKSkpO1xuICBlZGl0b3Iuc2hvd0ltYWdlRGlhbG9nID0gZmFicmljYXRvcihiaW5kKCdpbWFnZScsICdnJywgbGlua09ySW1hZ2VPckF0dGFjaG1lbnQoJ2ltYWdlJykpKTtcbiAgZWRpdG9yLmxpbmtPckltYWdlT3JBdHRhY2htZW50ID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG5cbiAgaWYgKG9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICBlZGl0b3Iuc2hvd0F0dGFjaG1lbnREaWFsb2cgPSBmYWJyaWNhdG9yKGJpbmQoJ2F0dGFjaG1lbnQnLCAnaycsIHRydWUsIGxpbmtPckltYWdlT3JBdHRhY2htZW50KCdhdHRhY2htZW50JykpKTtcbiAgfVxuICBpZiAob3B0aW9ucy5ocikgeyBiaW5kKCdocicsICdjbWQrbicsIHJvdXRlcignaHInKSk7IH1cblxuICBmdW5jdGlvbiBmYWJyaWNhdG9yIChlbCkge1xuICAgIHJldHVybiBmdW5jdGlvbiBvcGVuICgpIHtcbiAgICAgIHV0aWxzLmRpc3BhdGNoQ2xpY2tFdmVudChlbCk7XG4gICAgfTtcbiAgfVxuICBmdW5jdGlvbiBib2xkIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5ib2xkT3JJdGFsaWMoY2h1bmtzLCAnYm9sZCcpO1xuICB9XG4gIGZ1bmN0aW9uIGl0YWxpYyAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0uYm9sZE9ySXRhbGljKGNodW5rcywgJ2l0YWxpYycpO1xuICB9XG4gIGZ1bmN0aW9uIGNvZGUgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmNvZGVibG9jayhjaHVua3MsIHsgZmVuY2luZzogb3B0aW9ucy5mZW5jaW5nIH0pO1xuICB9XG4gIGZ1bmN0aW9uIHVsIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5saXN0KGNodW5rcywgZmFsc2UpO1xuICB9XG4gIGZ1bmN0aW9uIG9sIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5saXN0KGNodW5rcywgdHJ1ZSk7XG4gIH1cbiAgZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQgKHR5cGUsIGF1dG9VcGxvYWQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnRJbnZva2UgKG1vZGUsIGNodW5rcykge1xuICAgICAgY29tbWFuZHNbbW9kZV0ubGlua09ySW1hZ2VPckF0dGFjaG1lbnQuY2FsbCh0aGlzLCBjaHVua3MsIHtcbiAgICAgICAgZWRpdG9yOiBlZGl0b3IsXG4gICAgICAgIG1vZGU6IG1vZGUsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIHByb21wdHM6IG9wdGlvbnMucHJvbXB0cyxcbiAgICAgICAgdXBsb2FkOiBvcHRpb25zW3R5cGUgKyAncyddLFxuICAgICAgICBjbGFzc2VzOiBvcHRpb25zLmNsYXNzZXMsXG4gICAgICAgIG1lcmdlSHRtbEFuZEF0dGFjaG1lbnQ6IG9wdGlvbnMubWVyZ2VIdG1sQW5kQXR0YWNobWVudCxcbiAgICAgICAgYXV0b1VwbG9hZDogYXV0b1VwbG9hZFxuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuICBmdW5jdGlvbiBiaW5kIChpZCwga2V5LCBzaGlmdCwgZm4pIHtcbiAgICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICBmbiA9IHNoaWZ0O1xuICAgICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVkaXRvci5hZGRDb21tYW5kQnV0dG9uKGlkLCBrZXksIHNoaWZ0LCBzdXBwcmVzcyhmbikpO1xuICB9XG4gIGZ1bmN0aW9uIHJvdXRlciAobWV0aG9kKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHJvdXRlZCAobW9kZSwgY2h1bmtzKSB7IGNvbW1hbmRzW21vZGVdW21ldGhvZF0uY2FsbCh0aGlzLCBjaHVua3MpOyB9O1xuICB9XG4gIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7IGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cbiAgZnVuY3Rpb24gc3VwcHJlc3MgKGZuKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIHN1cHByZXNzb3IgKGUsIG1vZGUsIGNodW5rcykgeyBzdG9wKGUpOyBmbi5jYWxsKHRoaXMsIG1vZGUsIGNodW5rcyk7IH07XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBiaW5kQ29tbWFuZHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciByaW5wdXQgPSAvXlxccyooLio/KSg/OlxccytcIiguKylcIik/XFxzKiQvO1xudmFyIHJmdWxsID0gL14oPzpodHRwcz98ZnRwKTpcXC9cXC8vO1xuXG5mdW5jdGlvbiBwYXJzZUxpbmtJbnB1dCAoaW5wdXQpIHtcbiAgcmV0dXJuIHBhcnNlci5hcHBseShudWxsLCBpbnB1dC5tYXRjaChyaW5wdXQpKTtcblxuICBmdW5jdGlvbiBwYXJzZXIgKGFsbCwgbGluaywgdGl0bGUpIHtcbiAgICB2YXIgaHJlZiA9IGxpbmsucmVwbGFjZSgvXFw/LiokLywgcXVlcnlVbmVuY29kZWRSZXBsYWNlcik7XG4gICAgaHJlZiA9IGRlY29kZVVSSUNvbXBvbmVudChocmVmKTtcbiAgICBocmVmID0gZW5jb2RlVVJJKGhyZWYpLnJlcGxhY2UoLycvZywgJyUyNycpLnJlcGxhY2UoL1xcKC9nLCAnJTI4JykucmVwbGFjZSgvXFwpL2csICclMjknKTtcbiAgICBocmVmID0gaHJlZi5yZXBsYWNlKC9cXD8uKiQvLCBxdWVyeUVuY29kZWRSZXBsYWNlcik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaHJlZjogZm9ybWF0SHJlZihocmVmKSwgdGl0bGU6IGZvcm1hdFRpdGxlKHRpdGxlKVxuICAgIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gcXVlcnlVbmVuY29kZWRSZXBsYWNlciAocXVlcnkpIHtcbiAgcmV0dXJuIHF1ZXJ5LnJlcGxhY2UoL1xcKy9nLCAnICcpO1xufVxuXG5mdW5jdGlvbiBxdWVyeUVuY29kZWRSZXBsYWNlciAocXVlcnkpIHtcbiAgcmV0dXJuIHF1ZXJ5LnJlcGxhY2UoL1xcKy9nLCAnJTJiJyk7XG59XG5cbmZ1bmN0aW9uIGZvcm1hdFRpdGxlICh0aXRsZSkge1xuICBpZiAoIXRpdGxlKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICByZXR1cm4gdGl0bGVcbiAgICAucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG4gICAgLnJlcGxhY2UoL1wiL2csICcmcXVvdDsnKVxuICAgIC5yZXBsYWNlKC88L2csICcmbHQ7JylcbiAgICAucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRIcmVmICh1cmwpIHtcbiAgdmFyIGhyZWYgPSB1cmwucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpO1xuICBpZiAoaHJlZi5sZW5ndGggJiYgaHJlZlswXSAhPT0gJy8nICYmICFyZnVsbC50ZXN0KGhyZWYpKSB7XG4gICAgcmV0dXJuICdodHRwOi8vJyArIGhyZWY7XG4gIH1cbiAgcmV0dXJuIGhyZWY7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2VMaW5rSW5wdXQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRyaW0gKHJlbW92ZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKHJlbW92ZSkge1xuICAgIGJlZm9yZVJlcGxhY2VyID0gYWZ0ZXJSZXBsYWNlciA9ICcnO1xuICB9XG4gIHNlbGYuc2VsZWN0aW9uID0gc2VsZi5zZWxlY3Rpb24ucmVwbGFjZSgvXihcXHMqKS8sIGJlZm9yZVJlcGxhY2VyKS5yZXBsYWNlKC8oXFxzKikkLywgYWZ0ZXJSZXBsYWNlcik7XG5cbiAgZnVuY3Rpb24gYmVmb3JlUmVwbGFjZXIgKHRleHQpIHtcbiAgICBzZWxmLmJlZm9yZSArPSB0ZXh0OyByZXR1cm4gJyc7XG4gIH1cbiAgZnVuY3Rpb24gYWZ0ZXJSZXBsYWNlciAodGV4dCkge1xuICAgIHNlbGYuYWZ0ZXIgPSB0ZXh0ICsgc2VsZi5hZnRlcjsgcmV0dXJuICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdHJpbTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJ0cmltID0gL15cXHMrfFxccyskL2c7XG52YXIgcnNwYWNlcyA9IC9cXHMrL2c7XG5cbmZ1bmN0aW9uIGFkZENsYXNzIChlbCwgY2xzKSB7XG4gIHZhciBjdXJyZW50ID0gZWwuY2xhc3NOYW1lO1xuICBpZiAoY3VycmVudC5pbmRleE9mKGNscykgPT09IC0xKSB7XG4gICAgZWwuY2xhc3NOYW1lID0gKGN1cnJlbnQgKyAnICcgKyBjbHMpLnJlcGxhY2UocnRyaW0sICcnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBybUNsYXNzIChlbCwgY2xzKSB7XG4gIGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZS5yZXBsYWNlKGNscywgJycpLnJlcGxhY2UocnRyaW0sICcnKS5yZXBsYWNlKHJzcGFjZXMsICcgJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBhZGQ6IGFkZENsYXNzLFxuICBybTogcm1DbGFzc1xufTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuLy8gdmFyIHVwbG9hZHMgPSByZXF1aXJlKCcuL3VwbG9hZHMnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi9zdHJpbmdzJyk7XG52YXIgYmluZENvbW1hbmRzID0gcmVxdWlyZSgnLi9iaW5kQ29tbWFuZHMnKTtcbnZhciBJbnB1dEhpc3RvcnkgPSByZXF1aXJlKCcuL0lucHV0SGlzdG9yeScpO1xudmFyIFNob3J0Y3V0TWFuYWdlciA9IHJlcXVpcmUoJy4vc2hvcnRjdXRzJyk7XG52YXIgZ2V0Q29tbWFuZEhhbmRsZXIgPSByZXF1aXJlKCcuL2dldENvbW1hbmRIYW5kbGVyJyk7XG52YXIgVGV4dFN1cmZhY2UgPSByZXF1aXJlKCcuL21vZGVzL21hcmtkb3duL3RleHRhcmVhU3VyZmFjZScpO1xudmFyIFd5c2l3eWdTdXJmYWNlID0gcmVxdWlyZSgnLi9tb2Rlcy93eXNpd3lnL3d5c2l3eWdTdXJmYWNlJyk7XG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4vY2xhc3NlcycpO1xudmFyIHJlbmRlcmVycyA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzJyk7XG52YXIgcHJvbXB0ID0gcmVxdWlyZSgnLi9wcm9tcHRzL3Byb21wdCcpO1xudmFyIGNsb3NlUHJvbXB0cyA9IHJlcXVpcmUoJy4vcHJvbXB0cy9jbG9zZScpO1xudmFyIG1vZGVOYW1lcyA9IFsnbWFya2Rvd24nLCAnd3lzaXd5ZyddO1xudmFyIG1hYyA9IC9cXGJNYWMgT1NcXGIvLnRlc3QoZ2xvYmFsLm5hdmlnYXRvci51c2VyQWdlbnQpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIHJwYXJhZ3JhcGggPSAvXjxwPjxcXC9wPlxcbj8kL2k7XG5cbmZ1bmN0aW9uIEVkaXRvciAodGV4dGFyZWEsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLnRleHRhcmVhID0gdGV4dGFyZWE7XG4gIHZhciBwYXJlbnQgPSB0ZXh0YXJlYS5wYXJlbnROb2RlO1xuICB2YXIgbyA9IHRoaXMub3B0aW9ucyA9IHV0aWxzLmRlZmF1bHRzRGVlcChvcHRpb25zIHx8IHt9LCB7XG4gICAgLy8gRGVmYXVsdCBPcHRpb24gVmFsdWVzXG4gICAgbWFya2Rvd246IHRydWUsXG4gICAgd3lzaXd5ZzogdHJ1ZSxcbiAgICBocjogZmFsc2UsXG4gICAgc3RvcmFnZTogdHJ1ZSxcbiAgICBmZW5jaW5nOiB0cnVlLFxuICAgIHJlbmRlcjoge1xuICAgICAgbW9kZXM6IHt9LFxuICAgICAgY29tbWFuZHM6IHt9LFxuICAgIH0sXG4gICAgcHJvbXB0czoge1xuICAgICAgbGluazogcHJvbXB0LFxuICAgICAgaW1hZ2U6IHByb21wdCxcbiAgICAgIGF0dGFjaG1lbnQ6IHByb21wdCxcbiAgICAgIGNsb3NlOiBjbG9zZVByb21wdHMsXG4gICAgfSxcbiAgICBjbGFzc2VzOiB7XG4gICAgICB3eXNpd3lnOiBbXSxcbiAgICAgIHByb21wdHM6IHt9LFxuICAgICAgaW5wdXQ6IHt9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghby5tYXJrZG93biAmJiAhby53eXNpd3lnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXJrbWFyayBleHBlY3RzIGF0IGxlYXN0IG9uZSBpbnB1dCBtb2RlIHRvIGJlIGF2YWlsYWJsZScpO1xuICB9XG5cbiAgaWYgKG8uc3RvcmFnZSA9PT0gdHJ1ZSkgeyBvLnN0b3JhZ2UgPSAnYmFya21hcmtfaW5wdXRfbW9kZSc7IH1cblxuICB2YXIgcHJlZmVyZW5jZSA9IG8uc3RvcmFnZSAmJiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKG8uc3RvcmFnZSkpO1xuICBpZiAocHJlZmVyZW5jZSkge1xuICAgIG8uZGVmYXVsdE1vZGUgPSBwcmVmZXJlbmNlO1xuICB9XG5cbiAgdGhpcy5jb21wb25lbnRzID0ge1xuICAgIHRleHRhcmVhOiB0ZXh0YXJlYSxcbiAgICBkcm9wYXJlYTogdGFnKHsgYzogJ3drLWNvbnRhaW5lci1kcm9wJyB9KSxcbiAgICBzd2l0Y2hib2FyZDogdGFnKHsgYzogJ3drLXN3aXRjaGJvYXJkJyB9KSxcbiAgICBjb21tYW5kczogdGFnKHsgYzogJ3drLWNvbW1hbmRzJyB9KSxcbiAgICBlZGl0YWJsZTogdGFnKHsgYzogWyd3ay13eXNpd3lnJywgJ3drLWhpZGUnXS5jb25jYXQoby5jbGFzc2VzLnd5c2l3eWcpLmpvaW4oJyAnKSB9KSxcbiAgfTtcblxuICB0aGlzLm1vZGVzID0ge1xuICAgIHd5c2l3eWc6IHtcbiAgICAgIGVsZW1lbnQ6IHRoaXMuY29tcG9uZW50cy5lZGl0YWJsZSxcbiAgICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1tb2RlIHdrLW1vZGUtaW5hY3RpdmUnIH0pLFxuICAgICAgc3VyZmFjZTogbmV3IFd5c2l3eWdTdXJmYWNlKHRoaXMuY29tcG9uZW50cy5lZGl0YWJsZSksXG4gICAgICBzZXQ6IHd5c2l3eWdNb2RlXG4gICAgfSxcbiAgICBtYXJrZG93bjoge1xuICAgICAgZWxlbWVudDogdGV4dGFyZWEsXG4gICAgICBidXR0b246IHRhZyh7IHQ6ICdidXR0b24nLCBjOiAnd2stbW9kZSB3ay1tb2RlLWFjdGl2ZScgfSksXG4gICAgICBzdXJmYWNlOiBuZXcgVGV4dFN1cmZhY2UodGV4dGFyZWEpLFxuICAgICAgc2V0OiBtYXJrZG93bk1vZGVcbiAgICB9LFxuICB9O1xuICB0aGlzLm1vZGVzLnd5c2l3eWcuaGlzdG9yeSA9IG5ldyBJbnB1dEhpc3RvcnkodGhpcy5tb2Rlcy53eXNpd3lnLnN1cmZhY2UsICd3eXNpd3lnJyk7XG4gIHRoaXMubW9kZXMubWFya2Rvd24uaGlzdG9yeSA9IG5ldyBJbnB1dEhpc3RvcnkodGhpcy5tb2Rlcy5tYXJrZG93bi5zdXJmYWNlLCAnbWFya2Rvd24nKTtcbiAgdGhpcy5tb2RlID0gJ21hcmtkb3duJztcblxuICB0aGlzLnNob3J0Y3V0cyA9IG5ldyBTaG9ydGN1dE1hbmFnZXIoKTtcbiAgdGhpcy5zaG9ydGN1dHMuYXR0YWNoKHRoaXMubW9kZXMud3lzaXd5Zy5lbGVtZW50KTtcbiAgdGhpcy5zaG9ydGN1dHMuYXR0YWNoKHRoaXMubW9kZXMubWFya2Rvd24uZWxlbWVudCk7XG5cbiAgdGFnKHsgdDogJ3NwYW4nLCBjOiAnd2stZHJvcC10ZXh0JywgeDogc3RyaW5ncy5wcm9tcHRzLmRyb3AsIHA6IHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSB9KTtcbiAgdGFnKHsgdDogJ3AnLCBjOiBbJ3drLWRyb3AtaWNvbiddLmNvbmNhdChvLmNsYXNzZXMuZHJvcGljb24pLmpvaW4oJyAnKSwgcDogdGhpcy5jb21wb25lbnRzLmRyb3BhcmVhIH0pO1xuXG4gIHRoaXMuY29tcG9uZW50cy5lZGl0YWJsZS5jb250ZW50RWRpdGFibGUgPSB0cnVlO1xuICB0aGlzLm1vZGVzLm1hcmtkb3duLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyk7XG4gIG1vZGVOYW1lcy5mb3JFYWNoKGFkZE1vZGUpO1xuXG4gIGlmIChvLnd5c2l3eWcpIHtcbiAgICB0aGlzLnBsYWNlaG9sZGVyID0gdGFnKHsgYzogJ3drLXd5c2l3eWctcGxhY2Vob2xkZXIgd2staGlkZScsIHg6IHRleHRhcmVhLnBsYWNlaG9sZGVyIH0pO1xuICAgIHRoaXMucGxhY2Vob2xkZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLm1vZGVzLnd5c2l3eWcuc3VyZmFjZS5mb2N1cy5iaW5kKHRoaXMubW9kZXMud3lzaXd5Zy5zdXJmYWNlKSk7XG4gIH1cblxuICBpZiAoby5kZWZhdWx0TW9kZSAmJiBvW28uZGVmYXVsdE1vZGVdKSB7XG4gICAgdGhpcy5tb2Rlc1tvLmRlZmF1bHRNb2RlXS5zZXQoKTtcbiAgfSBlbHNlIGlmIChvLm1hcmtkb3duKSB7XG4gICAgdGhpcy5tb2Rlcy5tYXJrZG93bi5zZXQoKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLm1vZGVzLnd5c2l3eWcuc2V0KCk7XG4gIH1cblxuICBiaW5kQ29tbWFuZHModGhpcywgbyk7XG4gIGJpbmRFdmVudHMoKTtcblxuICBmdW5jdGlvbiBhZGRNb2RlIChpZCkge1xuICAgIHZhciBidXR0b24gPSBzZWxmLm1vZGVzW2lkXS5idXR0b247XG4gICAgdmFyIGN1c3RvbSA9IG8ucmVuZGVyLm1vZGVzO1xuICAgIGlmIChvW2lkXSkge1xuICAgICAgc2VsZi5jb21wb25lbnRzLnN3aXRjaGJvYXJkLmFwcGVuZENoaWxkKGJ1dHRvbik7XG4gICAgICAodHlwZW9mIGN1c3RvbSA9PT0gJ2Z1bmN0aW9uJyA/IGN1c3RvbSA6IHJlbmRlcmVycy5tb2RlcykoYnV0dG9uLCBpZCk7XG4gICAgICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBzZWxmLm1vZGVzW2lkXS5zZXQpO1xuICAgICAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuXG4gICAgICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tpZF07XG4gICAgICBpZiAodGl0bGUpIHtcbiAgICAgICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmRFdmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBhciA9IHJlbW92ZSA/ICdybScgOiAnYWRkJztcbiAgICB2YXIgbW92ID0gcmVtb3ZlID8gJ3JlbW92ZUNoaWxkJyA6ICdhcHBlbmRDaGlsZCc7XG4gICAgaWYgKHJlbW92ZSkge1xuICAgICAgc2VsZi5zaG9ydGN1dHMuY2xlYXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG8ubWFya2Rvd24pIHsgc2VsZi5zaG9ydGN1dHMuYWRkKCdtJywgbWFya2Rvd25Nb2RlKTsgfVxuICAgICAgaWYgKG8ud3lzaXd5ZykgeyBzZWxmLnNob3J0Y3V0cy5hZGQoJ3AnLCB3eXNpd3lnTW9kZSk7IH1cbiAgICB9XG4gICAgY2xhc3Nlc1thcl0ocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG4gICAgaWYocmVtb3ZlKSB7XG4gICAgICBwYXJlbnRbbW92XShzZWxmLmNvbXBvbmVudHMuY29tbWFuZHMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnQuaW5zZXJ0QmVmb3JlKHNlbGYuY29tcG9uZW50cy5jb21tYW5kcywgc2VsZi50ZXh0YXJlYSk7XG4gICAgfVxuICAgIHBhcmVudFttb3ZdKHNlbGYuY29tcG9uZW50cy5lZGl0YWJsZSk7XG4gICAgaWYgKHNlbGYucGxhY2Vob2xkZXIpIHsgcGFyZW50W21vdl0oc2VsZi5wbGFjZWhvbGRlcik7IH1cbiAgICBwYXJlbnRbbW92XShzZWxmLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQpO1xuICAgIC8vIFRPRE9cbiAgICAvLyBpZiAoc2VsZi5vcHRpb25zLmltYWdlcyB8fCBzZWxmLm9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIC8vIHBhcmVudFttb3ZdKHNlbGYuY29tcG9uZW50cy5kcm9wYXJlYSk7XG4gICAgICAvLyB1cGxvYWRzKHBhcmVudCwgc2VsZi5jb21wb25lbnRzLmRyb3BhcmVhLCBzZWxmLCBvLCByZW1vdmUpO1xuICAgIC8vIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG1hcmtkb3duTW9kZSAoZSkgeyBzZWxmLnNldE1vZGUoJ21hcmtkb3duJywgZSk7IH1cbiAgZnVuY3Rpb24gd3lzaXd5Z01vZGUgKGUpIHsgc2VsZi5zZXRNb2RlKCd3eXNpd3lnJywgZSk7IH1cbn1cblxuRWRpdG9yLnByb3RvdHlwZS5nZXRTdXJmYWNlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5tb2Rlc1t0aGlzLm1vZGVdLnN1cmZhY2U7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLmFkZENvbW1hbmQgPSBmdW5jdGlvbiAoa2V5LCBzaGlmdCwgZm4pIHtcbiAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGZuID0gc2hpZnQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICB0aGlzLnNob3J0Y3V0cy5hZGQoa2V5LCBzaGlmdCwgZ2V0Q29tbWFuZEhhbmRsZXIodGhpcywgdGhpcy5tb2Rlc1t0aGlzLm1vZGVdLmhpc3RvcnksIGZuKSk7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLmFkZENvbW1hbmRCdXR0b24gPSBmdW5jdGlvbiAoaWQsIGtleSwgc2hpZnQsIGZuKSB7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZm4gPSBrZXk7XG4gICAga2V5ID0gdW5kZWZpbmVkO1xuICAgIHNoaWZ0ID0gdW5kZWZpbmVkO1xuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICBmbiA9IHNoaWZ0O1xuICAgIHNoaWZ0ID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgdmFyIGJ1dHRvbiA9IHRhZyh7IHQ6ICdidXR0b24nLCBjOiAnd2stY29tbWFuZCcsIHA6IHRoaXMuY29tcG9uZW50cy5jb21tYW5kcyB9KTtcbiAgdmFyIGN1c3RvbSA9IHRoaXMub3B0aW9ucy5yZW5kZXIuY29tbWFuZHM7XG4gIHZhciByZW5kZXIgPSB0eXBlb2YgY3VzdG9tID09PSAnZnVuY3Rpb24nID8gY3VzdG9tIDogcmVuZGVyZXJzLmNvbW1hbmRzO1xuICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tpZF07XG4gIGlmICh0aXRsZSkge1xuICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgbWFjID8gbWFjaWZ5KHRpdGxlKSA6IHRpdGxlKTtcbiAgfVxuICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICBidXR0b24udGFiSW5kZXggPSAtMTtcbiAgcmVuZGVyKGJ1dHRvbiwgaWQpO1xuICBidXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBnZXRDb21tYW5kSGFuZGxlcih0aGlzLCB0aGlzLm1vZGVzW3RoaXMubW9kZV0uaGlzdG9yeSwgZm4pKTtcbiAgaWYgKGtleSkge1xuICAgIHRoaXMuYWRkQ29tbWFuZChrZXksIHNoaWZ0LCBmbik7XG4gIH1cbiAgcmV0dXJuIGJ1dHRvbjtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUucnVuQ29tbWFuZCA9IGZ1bmN0aW9uIChmbikge1xuICBnZXRDb21tYW5kSGFuZGxlcih0aGlzLCB0aGlzLm1vZGVzW3RoaXMubW9kZV0uaGlzdG9yeSwgcmVhcnJhbmdlKShudWxsKTtcblxuICBmdW5jdGlvbiByZWFycmFuZ2UgKGUsIG1vZGUsIGNodW5rcykge1xuICAgIHJldHVybiBmbi5jYWxsKHRoaXMsIGNodW5rcywgbW9kZSk7XG4gIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUucGFyc2VNYXJrZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9ucy5wYXJzZU1hcmtkb3duLmFwcGx5KHRoaXMub3B0aW9ucy5wYXJzZU1hcmtkb3duLCBhcmd1bWVudHMpO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5wYXJzZUhUTUwgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm9wdGlvbnMucGFyc2VIVE1MLmFwcGx5KHRoaXMub3B0aW9ucy5wYXJzZUhUTUwsIGFyZ3VtZW50cyk7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLm1vZGUgIT09ICdtYXJrZG93bicpIHtcbiAgICB0aGlzLnRleHRhcmVhLnZhbHVlID0gdGhpcy5nZXRNYXJrZG93bigpO1xuICB9XG4gIGNsYXNzZXMucm0odGhpcy50ZXh0YXJlYSwgJ3drLWhpZGUnKTtcbiAgLy8gYmluZEV2ZW50cyh0cnVlKTsgLy8gVE9ET1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS52YWx1ZSA9IGZ1bmN0aW9uIGdldE9yU2V0VmFsdWUgKGlucHV0KSB7XG4gIHZhciBtYXJrZG93biA9IFN0cmluZyhpbnB1dCk7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICB2YXIgc2V0cyA9IGFyZ3VtZW50cy5sZW5ndGggPT09IDE7XG4gIGlmIChzZXRzKSB7XG4gICAgaWYgKHRoaXMubW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgICBtYXJrZG93biA9IGFzSHRtbCgpO1xuICAgIH1cbiAgICB0aGlzLmdldFN1cmZhY2UoKS53cml0ZShtYXJrZG93bik7XG4gICAgdGhpcy5tb2Rlc1t0aGlzLm1vZGVdLmhpc3RvcnkucmVzZXQoKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzLmdldE1hcmtkb3duKCk7XG5cbiAgZnVuY3Rpb24gYXNIdG1sICgpIHtcbiAgICByZXR1cm4gc2VsZi5vcHRpb25zLnBhcnNlTWFya2Rvd24obWFya2Rvd24pO1xuICB9XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnNldE1vZGUgPSBmdW5jdGlvbiAoZ29Ub01vZGUsIGUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY3VycmVudE1vZGUgPSB0aGlzLm1vZGVzW3RoaXMubW9kZV0gfHwge307XG4gIHZhciBuZXh0TW9kZSA9IHRoaXMubW9kZXNbZ29Ub01vZGVdO1xuICB2YXIgb2xkID0gY3VycmVudE1vZGUuYnV0dG9uO1xuICB2YXIgYnV0dG9uID0gbmV4dE1vZGUuYnV0dG9uO1xuICB2YXIgZm9jdXNpbmcgPSAhIWUgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IGN1cnJlbnRNb2RlLmVsZW1lbnQgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IG5leHRNb2RlLmVsZW1lbnQ7XG5cbiAgc3RvcChlKTtcblxuICBpZiAoY3VycmVudE1vZGUgPT09IG5leHRNb2RlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy50ZXh0YXJlYS5ibHVyKCk7IC8vIGF2ZXJ0IGNocm9tZSByZXBhaW50IGJ1Z3NcblxuICB2YXIgdmFsdWUgPSB0aGlzLmdldFN1cmZhY2UoKS5yZWFkKCk7XG4gIGlmIChnb1RvTW9kZSA9PT0gJ21hcmtkb3duJykge1xuICAgIHZhbHVlID0gcGFyc2UoJ3BhcnNlSFRNTCcsIHZhbHVlKS50cmltKCk7XG4gIH0gZWxzZSBpZiAoZ29Ub01vZGUgPT09ICd3eXNpd3lnJykge1xuICAgIHZhbHVlID0gcGFyc2UoJ3BhcnNlTWFya2Rvd24nLCB2YWx1ZSkucmVwbGFjZShycGFyYWdyYXBoLCAnJykudHJpbSgpO1xuICB9XG4gIG5leHRNb2RlLnN1cmZhY2Uud3JpdGUodmFsdWUpO1xuXG4gIGNsYXNzZXMuYWRkKGN1cnJlbnRNb2RlLmVsZW1lbnQsICd3ay1oaWRlJyk7XG4gIGNsYXNzZXMucm0obmV4dE1vZGUuZWxlbWVudCwgJ3drLWhpZGUnKTtcblxuICBpZiAoZ29Ub01vZGUgPT09ICd3eXNpd3lnJykge1xuICAgIGlmICh0aGlzLnBsYWNlaG9sZGVyKSB7IGNsYXNzZXMucm0odGhpcy5wbGFjZWhvbGRlciwgJ3drLWhpZGUnKTsgfVxuICB9IGVsc2Uge1xuICAgIGlmICh0aGlzLnBsYWNlaG9sZGVyKSB7IGNsYXNzZXMuYWRkKHRoaXMucGxhY2Vob2xkZXIsICd3ay1oaWRlJyk7IH1cbiAgfVxuXG4gIGlmIChmb2N1c2luZykge1xuICAgIG5leHRNb2RlLnN1cmZhY2UuZm9jdXMoKTtcbiAgfVxuXG4gIGNsYXNzZXMuYWRkKGJ1dHRvbiwgJ3drLW1vZGUtYWN0aXZlJyk7XG4gIGNsYXNzZXMucm0ob2xkLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgY2xhc3Nlcy5hZGQob2xkLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICBjbGFzc2VzLnJtKGJ1dHRvbiwgJ3drLW1vZGUtaW5hY3RpdmUnKTtcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgb2xkLnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcbiAgdGhpcy5tb2RlID0gZ29Ub01vZGU7XG5cbiAgaWYgKHRoaXMub3B0aW9ucy5zdG9yYWdlKSB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0odGhpcy5vcHRpb25zLnN0b3JhZ2UsIEpTT04uc3RyaW5naWZ5KGdvVG9Nb2RlKSk7XG4gIH1cblxuICAvLyB0aGlzLmhpc3Rvcnkuc2V0SW5wdXRNb2RlKGdvVG9Nb2RlKTtcbiAgZmlyZUxhdGVyLmNhbGwodGhpcywgJ2JhcmttYXJrLW1vZGUtY2hhbmdlJyk7XG5cbiAgZnVuY3Rpb24gcGFyc2UgKG1ldGhvZCwgaW5wdXQpIHtcbiAgICByZXR1cm4gc2VsZi5vcHRpb25zW21ldGhvZF0oaW5wdXQpO1xuICB9XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLmdldE1hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICByZXR1cm4gdGhpcy5vcHRpb25zLnBhcnNlSFRNTCh0aGlzLm1vZGVzLnd5c2l3eWcuZWxlbWVudCk7XG4gIH1cbiAgcmV0dXJuIHRoaXMudGV4dGFyZWEudmFsdWU7XG59O1xuXG4vKlxuICB2YXIgZWRpdG9yID0ge1xuICAgIGFkZENvbW1hbmQ6IGFkZENvbW1hbmQsXG4gICAgYWRkQ29tbWFuZEJ1dHRvbjogYWRkQ29tbWFuZEJ1dHRvbixcbiAgICBydW5Db21tYW5kOiBydW5Db21tYW5kLFxuICAgIHBhcnNlTWFya2Rvd246IG8ucGFyc2VNYXJrZG93bixcbiAgICBwYXJzZUhUTUw6IG8ucGFyc2VIVE1MLFxuICAgIGRlc3Ryb3k6IGRlc3Ryb3ksXG4gICAgdmFsdWU6IGdldE9yU2V0VmFsdWUsXG4gICAgdGV4dGFyZWE6IHRleHRhcmVhLFxuICAgIGVkaXRhYmxlOiBvLnd5c2l3eWcgPyBlZGl0YWJsZSA6IG51bGwsXG4gICAgc2V0TW9kZTogcGVyc2lzdE1vZGUsXG4gICAgaGlzdG9yeToge1xuICAgICAgdW5kbzogaGlzdG9yeS51bmRvLFxuICAgICAgcmVkbzogaGlzdG9yeS5yZWRvLFxuICAgICAgY2FuVW5kbzogaGlzdG9yeS5jYW5VbmRvLFxuICAgICAgY2FuUmVkbzogaGlzdG9yeS5jYW5SZWRvXG4gICAgfSxcbiAgICBtb2RlOiAnbWFya2Rvd24nXG4gIH07XG4qL1xuXG5mdW5jdGlvbiBmaXJlTGF0ZXIgKHR5cGUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZXRUaW1lb3V0KGZ1bmN0aW9uIGZpcmUgKCkge1xuICAgIHV0aWxzLmRpc3BhdGNoQ3VzdG9tRXZlbnQoc2VsZi50ZXh0YXJlYSwgdHlwZSk7XG4gIH0sIDApO1xufVxuXG5mdW5jdGlvbiB0YWcgKG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgZWwgPSBkb2MuY3JlYXRlRWxlbWVudChvLnQgfHwgJ2RpdicpO1xuICBlbC5jbGFzc05hbWUgPSBvLmMgfHwgJyc7XG4gIGVsLnRleHRDb250ZW50ID0gby54IHx8ICcnO1xuICBpZiAoby5wKSB7IG8ucC5hcHBlbmRDaGlsZChlbCk7IH1cbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiBzdG9wIChlKSB7XG4gIGlmIChlKSB7IGUucHJldmVudERlZmF1bHQoKTsgZS5zdG9wUHJvcGFnYXRpb24oKTsgfVxufVxuXG5mdW5jdGlvbiBtYWNpZnkgKHRleHQpIHtcbiAgcmV0dXJuIHRleHRcbiAgICAucmVwbGFjZSgvXFxiY3RybFxcYi9pLCAnXFx1MjMxOCcpXG4gICAgLnJlcGxhY2UoL1xcYmFsdFxcYi9pLCAnXFx1MjMyNScpXG4gICAgLnJlcGxhY2UoL1xcYnNoaWZ0XFxiL2ksICdcXHUyMWU3Jyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gRWRpdG9yO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTlsWkdsMGIzSXVhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJanRCUVVGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnZFhScGJITWdQU0J5WlhGMWFYSmxLQ2N1TDNWMGFXeHpKeWs3WEc0dkx5QjJZWElnZFhCc2IyRmtjeUE5SUhKbGNYVnBjbVVvSnk0dmRYQnNiMkZrY3ljcE8xeHVkbUZ5SUhOMGNtbHVaM01nUFNCeVpYRjFhWEpsS0NjdUwzTjBjbWx1WjNNbktUdGNiblpoY2lCaWFXNWtRMjl0YldGdVpITWdQU0J5WlhGMWFYSmxLQ2N1TDJKcGJtUkRiMjF0WVc1a2N5Y3BPMXh1ZG1GeUlFbHVjSFYwU0dsemRHOXllU0E5SUhKbGNYVnBjbVVvSnk0dlNXNXdkWFJJYVhOMGIzSjVKeWs3WEc1MllYSWdVMmh2Y25SamRYUk5ZVzVoWjJWeUlEMGdjbVZ4ZFdseVpTZ25MaTl6YUc5eWRHTjFkSE1uS1R0Y2JuWmhjaUJuWlhSRGIyMXRZVzVrU0dGdVpHeGxjaUE5SUhKbGNYVnBjbVVvSnk0dloyVjBRMjl0YldGdVpFaGhibVJzWlhJbktUdGNiblpoY2lCVVpYaDBVM1Z5Wm1GalpTQTlJSEpsY1hWcGNtVW9KeTR2Ylc5a1pYTXZiV0Z5YTJSdmQyNHZkR1Y0ZEdGeVpXRlRkWEptWVdObEp5azdYRzUyWVhJZ1YzbHphWGQ1WjFOMWNtWmhZMlVnUFNCeVpYRjFhWEpsS0NjdUwyMXZaR1Z6TDNkNWMybDNlV2N2ZDNsemFYZDVaMU4xY21aaFkyVW5LVHRjYm5aaGNpQmpiR0Z6YzJWeklEMGdjbVZ4ZFdseVpTZ25MaTlqYkdGemMyVnpKeWs3WEc1MllYSWdjbVZ1WkdWeVpYSnpJRDBnY21WeGRXbHlaU2duTGk5eVpXNWtaWEpsY25NbktUdGNiblpoY2lCd2NtOXRjSFFnUFNCeVpYRjFhWEpsS0NjdUwzQnliMjF3ZEhNdmNISnZiWEIwSnlrN1hHNTJZWElnWTJ4dmMyVlFjbTl0Y0hSeklEMGdjbVZ4ZFdseVpTZ25MaTl3Y205dGNIUnpMMk5zYjNObEp5azdYRzUyWVhJZ2JXOWtaVTVoYldWeklEMGdXeWR0WVhKclpHOTNiaWNzSUNkM2VYTnBkM2xuSjEwN1hHNTJZWElnYldGaklEMGdMMXhjWWsxaFl5QlBVMXhjWWk4dWRHVnpkQ2huYkc5aVlXd3VibUYyYVdkaGRHOXlMblZ6WlhKQloyVnVkQ2s3WEc1MllYSWdaRzlqSUQwZ1pHOWpkVzFsYm5RN1hHNTJZWElnY25CaGNtRm5jbUZ3YUNBOUlDOWVQSEErUEZ4Y0wzQStYRnh1UHlRdmFUdGNibHh1Wm5WdVkzUnBiMjRnUldScGRHOXlJQ2gwWlhoMFlYSmxZU3dnYjNCMGFXOXVjeWtnZTF4dUlDQjJZWElnYzJWc1ppQTlJSFJvYVhNN1hHNGdJSFJvYVhNdWRHVjRkR0Z5WldFZ1BTQjBaWGgwWVhKbFlUdGNiaUFnZG1GeUlIQmhjbVZ1ZENBOUlIUmxlSFJoY21WaExuQmhjbVZ1ZEU1dlpHVTdYRzRnSUhaaGNpQnZJRDBnZEdocGN5NXZjSFJwYjI1eklEMGdkWFJwYkhNdVpHVm1ZWFZzZEhORVpXVndLRzl3ZEdsdmJuTWdmSHdnZTMwc0lIdGNiaUFnSUNBdkx5QkVaV1poZFd4MElFOXdkR2x2YmlCV1lXeDFaWE5jYmlBZ0lDQnRZWEpyWkc5M2Jqb2dkSEoxWlN4Y2JpQWdJQ0IzZVhOcGQzbG5PaUIwY25WbExGeHVJQ0FnSUdoeU9pQm1ZV3h6WlN4Y2JpQWdJQ0J6ZEc5eVlXZGxPaUIwY25WbExGeHVJQ0FnSUdabGJtTnBibWM2SUhSeWRXVXNYRzRnSUNBZ2NtVnVaR1Z5T2lCN1hHNGdJQ0FnSUNCdGIyUmxjem9nZTMwc1hHNGdJQ0FnSUNCamIyMXRZVzVrY3pvZ2UzMHNYRzRnSUNBZ2ZTeGNiaUFnSUNCd2NtOXRjSFJ6T2lCN1hHNGdJQ0FnSUNCc2FXNXJPaUJ3Y205dGNIUXNYRzRnSUNBZ0lDQnBiV0ZuWlRvZ2NISnZiWEIwTEZ4dUlDQWdJQ0FnWVhSMFlXTm9iV1Z1ZERvZ2NISnZiWEIwTEZ4dUlDQWdJQ0FnWTJ4dmMyVTZJR05zYjNObFVISnZiWEIwY3l4Y2JpQWdJQ0I5TEZ4dUlDQWdJR05zWVhOelpYTTZJSHRjYmlBZ0lDQWdJSGQ1YzJsM2VXYzZJRnRkTEZ4dUlDQWdJQ0FnY0hKdmJYQjBjem9nZTMwc1hHNGdJQ0FnSUNCcGJuQjFkRG9nZTMwc1hHNGdJQ0FnZlN4Y2JpQWdmU2s3WEc1Y2JpQWdhV1lnS0NGdkxtMWhjbXRrYjNkdUlDWW1JQ0Z2TG5kNWMybDNlV2NwSUh0Y2JpQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KMkpoY210dFlYSnJJR1Y0Y0dWamRITWdZWFFnYkdWaGMzUWdiMjVsSUdsdWNIVjBJRzF2WkdVZ2RHOGdZbVVnWVhaaGFXeGhZbXhsSnlrN1hHNGdJSDFjYmx4dUlDQnBaaUFvYnk1emRHOXlZV2RsSUQwOVBTQjBjblZsS1NCN0lHOHVjM1J2Y21GblpTQTlJQ2RpWVhKcmJXRnlhMTlwYm5CMWRGOXRiMlJsSnpzZ2ZWeHVYRzRnSUhaaGNpQndjbVZtWlhKbGJtTmxJRDBnYnk1emRHOXlZV2RsSUNZbUlFcFRUMDR1Y0dGeWMyVW9iRzlqWVd4VGRHOXlZV2RsTG1kbGRFbDBaVzBvYnk1emRHOXlZV2RsS1NrN1hHNGdJR2xtSUNod2NtVm1aWEpsYm1ObEtTQjdYRzRnSUNBZ2J5NWtaV1poZFd4MFRXOWtaU0E5SUhCeVpXWmxjbVZ1WTJVN1hHNGdJSDFjYmx4dUlDQjBhR2x6TG1OdmJYQnZibVZ1ZEhNZ1BTQjdYRzRnSUNBZ2RHVjRkR0Z5WldFNklIUmxlSFJoY21WaExGeHVJQ0FnSUdSeWIzQmhjbVZoT2lCMFlXY29leUJqT2lBbmQyc3RZMjl1ZEdGcGJtVnlMV1J5YjNBbklIMHBMRnh1SUNBZ0lITjNhWFJqYUdKdllYSmtPaUIwWVdjb2V5QmpPaUFuZDJzdGMzZHBkR05vWW05aGNtUW5JSDBwTEZ4dUlDQWdJR052YlcxaGJtUnpPaUIwWVdjb2V5QmpPaUFuZDJzdFkyOXRiV0Z1WkhNbklIMHBMRnh1SUNBZ0lHVmthWFJoWW14bE9pQjBZV2NvZXlCak9pQmJKM2RyTFhkNWMybDNlV2NuTENBbmQyc3RhR2xrWlNkZExtTnZibU5oZENodkxtTnNZWE56WlhNdWQzbHphWGQ1WnlrdWFtOXBiaWduSUNjcElIMHBMRnh1SUNCOU8xeHVYRzRnSUhSb2FYTXViVzlrWlhNZ1BTQjdYRzRnSUNBZ2QzbHphWGQ1WnpvZ2UxeHVJQ0FnSUNBZ1pXeGxiV1Z1ZERvZ2RHaHBjeTVqYjIxd2IyNWxiblJ6TG1Wa2FYUmhZbXhsTEZ4dUlDQWdJQ0FnWW5WMGRHOXVPaUIwWVdjb2V5QjBPaUFuWW5WMGRHOXVKeXdnWXpvZ0ozZHJMVzF2WkdVZ2Qyc3RiVzlrWlMxcGJtRmpkR2wyWlNjZ2ZTa3NYRzRnSUNBZ0lDQnpkWEptWVdObE9pQnVaWGNnVjNsemFYZDVaMU4xY21aaFkyVW9kR2hwY3k1amIyMXdiMjVsYm5SekxtVmthWFJoWW14bEtTeGNiaUFnSUNBZ0lITmxkRG9nZDNsemFYZDVaMDF2WkdWY2JpQWdJQ0I5TEZ4dUlDQWdJRzFoY210a2IzZHVPaUI3WEc0Z0lDQWdJQ0JsYkdWdFpXNTBPaUIwWlhoMFlYSmxZU3hjYmlBZ0lDQWdJR0oxZEhSdmJqb2dkR0ZuS0hzZ2REb2dKMkoxZEhSdmJpY3NJR002SUNkM2F5MXRiMlJsSUhkckxXMXZaR1V0WVdOMGFYWmxKeUI5S1N4Y2JpQWdJQ0FnSUhOMWNtWmhZMlU2SUc1bGR5QlVaWGgwVTNWeVptRmpaU2gwWlhoMFlYSmxZU2tzWEc0Z0lDQWdJQ0J6WlhRNklHMWhjbXRrYjNkdVRXOWtaVnh1SUNBZ0lIMHNYRzRnSUgwN1hHNGdJSFJvYVhNdWJXOWtaWE11ZDNsemFYZDVaeTVvYVhOMGIzSjVJRDBnYm1WM0lFbHVjSFYwU0dsemRHOXllU2gwYUdsekxtMXZaR1Z6TG5kNWMybDNlV2N1YzNWeVptRmpaU3dnSjNkNWMybDNlV2NuS1R0Y2JpQWdkR2hwY3k1dGIyUmxjeTV0WVhKclpHOTNiaTVvYVhOMGIzSjVJRDBnYm1WM0lFbHVjSFYwU0dsemRHOXllU2gwYUdsekxtMXZaR1Z6TG0xaGNtdGtiM2R1TG5OMWNtWmhZMlVzSUNkdFlYSnJaRzkzYmljcE8xeHVJQ0IwYUdsekxtMXZaR1VnUFNBbmJXRnlhMlJ2ZDI0bk8xeHVYRzRnSUhSb2FYTXVjMmh2Y25SamRYUnpJRDBnYm1WM0lGTm9iM0owWTNWMFRXRnVZV2RsY2lncE8xeHVJQ0IwYUdsekxuTm9iM0owWTNWMGN5NWhkSFJoWTJnb2RHaHBjeTV0YjJSbGN5NTNlWE5wZDNsbkxtVnNaVzFsYm5RcE8xeHVJQ0IwYUdsekxuTm9iM0owWTNWMGN5NWhkSFJoWTJnb2RHaHBjeTV0YjJSbGN5NXRZWEpyWkc5M2JpNWxiR1Z0Wlc1MEtUdGNibHh1SUNCMFlXY29leUIwT2lBbmMzQmhiaWNzSUdNNklDZDNheTFrY205d0xYUmxlSFFuTENCNE9pQnpkSEpwYm1kekxuQnliMjF3ZEhNdVpISnZjQ3dnY0RvZ2RHaHBjeTVqYjIxd2IyNWxiblJ6TG1SeWIzQmhjbVZoSUgwcE8xeHVJQ0IwWVdjb2V5QjBPaUFuY0Njc0lHTTZJRnNuZDJzdFpISnZjQzFwWTI5dUoxMHVZMjl1WTJGMEtHOHVZMnhoYzNObGN5NWtjbTl3YVdOdmJpa3VhbTlwYmlnbklDY3BMQ0J3T2lCMGFHbHpMbU52YlhCdmJtVnVkSE11WkhKdmNHRnlaV0VnZlNrN1hHNWNiaUFnZEdocGN5NWpiMjF3YjI1bGJuUnpMbVZrYVhSaFlteGxMbU52Ym5SbGJuUkZaR2wwWVdKc1pTQTlJSFJ5ZFdVN1hHNGdJSFJvYVhNdWJXOWtaWE11YldGeWEyUnZkMjR1WW5WMGRHOXVMbk5sZEVGMGRISnBZblYwWlNnblpHbHpZV0pzWldRbkxDQW5aR2x6WVdKc1pXUW5LVHRjYmlBZ2JXOWtaVTVoYldWekxtWnZja1ZoWTJnb1lXUmtUVzlrWlNrN1hHNWNiaUFnYVdZZ0tHOHVkM2x6YVhkNVp5a2dlMXh1SUNBZ0lIUm9hWE11Y0d4aFkyVm9iMnhrWlhJZ1BTQjBZV2NvZXlCak9pQW5kMnN0ZDNsemFYZDVaeTF3YkdGalpXaHZiR1JsY2lCM2F5MW9hV1JsSnl3Z2VEb2dkR1Y0ZEdGeVpXRXVjR3hoWTJWb2IyeGtaWElnZlNrN1hHNGdJQ0FnZEdocGN5NXdiR0ZqWldodmJHUmxjaTVoWkdSRmRtVnVkRXhwYzNSbGJtVnlLQ2RqYkdsamF5Y3NJSFJvYVhNdWJXOWtaWE11ZDNsemFYZDVaeTV6ZFhKbVlXTmxMbVp2WTNWekxtSnBibVFvZEdocGN5NXRiMlJsY3k1M2VYTnBkM2xuTG5OMWNtWmhZMlVwS1R0Y2JpQWdmVnh1WEc0Z0lHbG1JQ2h2TG1SbFptRjFiSFJOYjJSbElDWW1JRzliYnk1a1pXWmhkV3gwVFc5a1pWMHBJSHRjYmlBZ0lDQjBhR2x6TG0xdlpHVnpXMjh1WkdWbVlYVnNkRTF2WkdWZExuTmxkQ2dwTzF4dUlDQjlJR1ZzYzJVZ2FXWWdLRzh1YldGeWEyUnZkMjRwSUh0Y2JpQWdJQ0IwYUdsekxtMXZaR1Z6TG0xaGNtdGtiM2R1TG5ObGRDZ3BPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSFJvYVhNdWJXOWtaWE11ZDNsemFYZDVaeTV6WlhRb0tUdGNiaUFnZlZ4dVhHNGdJR0pwYm1SRGIyMXRZVzVrY3loMGFHbHpMQ0J2S1R0Y2JpQWdZbWx1WkVWMlpXNTBjeWdwTzF4dVhHNGdJR1oxYm1OMGFXOXVJR0ZrWkUxdlpHVWdLR2xrS1NCN1hHNGdJQ0FnZG1GeUlHSjFkSFJ2YmlBOUlITmxiR1l1Ylc5a1pYTmJhV1JkTG1KMWRIUnZianRjYmlBZ0lDQjJZWElnWTNWemRHOXRJRDBnYnk1eVpXNWtaWEl1Ylc5a1pYTTdYRzRnSUNBZ2FXWWdLRzliYVdSZEtTQjdYRzRnSUNBZ0lDQnpaV3htTG1OdmJYQnZibVZ1ZEhNdWMzZHBkR05vWW05aGNtUXVZWEJ3Wlc1a1EyaHBiR1FvWW5WMGRHOXVLVHRjYmlBZ0lDQWdJQ2gwZVhCbGIyWWdZM1Z6ZEc5dElEMDlQU0FuWm5WdVkzUnBiMjRuSUQ4Z1kzVnpkRzl0SURvZ2NtVnVaR1Z5WlhKekxtMXZaR1Z6S1NoaWRYUjBiMjRzSUdsa0tUdGNiaUFnSUNBZ0lHSjFkSFJ2Ymk1aFpHUkZkbVZ1ZEV4cGMzUmxibVZ5S0NkamJHbGpheWNzSUhObGJHWXViVzlrWlhOYmFXUmRMbk5sZENrN1hHNGdJQ0FnSUNCaWRYUjBiMjR1ZEhsd1pTQTlJQ2RpZFhSMGIyNG5PMXh1SUNBZ0lDQWdZblYwZEc5dUxuUmhZa2x1WkdWNElEMGdMVEU3WEc1Y2JpQWdJQ0FnSUhaaGNpQjBhWFJzWlNBOUlITjBjbWx1WjNNdWRHbDBiR1Z6VzJsa1hUdGNiaUFnSUNBZ0lHbG1JQ2gwYVhSc1pTa2dlMXh1SUNBZ0lDQWdJQ0JpZFhSMGIyNHVjMlYwUVhSMGNtbGlkWFJsS0NkMGFYUnNaU2NzSUcxaFl5QS9JRzFoWTJsbWVTaDBhWFJzWlNrZ09pQjBhWFJzWlNrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1ltbHVaRVYyWlc1MGN5QW9jbVZ0YjNabEtTQjdYRzRnSUNBZ2RtRnlJR0Z5SUQwZ2NtVnRiM1psSUQ4Z0ozSnRKeUE2SUNkaFpHUW5PMXh1SUNBZ0lIWmhjaUJ0YjNZZ1BTQnlaVzF2ZG1VZ1B5QW5jbVZ0YjNabFEyaHBiR1FuSURvZ0oyRndjR1Z1WkVOb2FXeGtKenRjYmlBZ0lDQnBaaUFvY21WdGIzWmxLU0I3WEc0Z0lDQWdJQ0J6Wld4bUxuTm9iM0owWTNWMGN5NWpiR1ZoY2lncE8xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0JwWmlBb2J5NXRZWEpyWkc5M2Jpa2dleUJ6Wld4bUxuTm9iM0owWTNWMGN5NWhaR1FvSjIwbkxDQnRZWEpyWkc5M2JrMXZaR1VwT3lCOVhHNGdJQ0FnSUNCcFppQW9ieTUzZVhOcGQzbG5LU0I3SUhObGJHWXVjMmh2Y25SamRYUnpMbUZrWkNnbmNDY3NJSGQ1YzJsM2VXZE5iMlJsS1RzZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0JqYkdGemMyVnpXMkZ5WFNod1lYSmxiblFzSUNkM2F5MWpiMjUwWVdsdVpYSW5LVHRjYmlBZ0lDQnBaaWh5WlcxdmRtVXBJSHRjYmlBZ0lDQWdJSEJoY21WdWRGdHRiM1pkS0hObGJHWXVZMjl0Y0c5dVpXNTBjeTVqYjIxdFlXNWtjeWs3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lIQmhjbVZ1ZEM1cGJuTmxjblJDWldadmNtVW9jMlZzWmk1amIyMXdiMjVsYm5SekxtTnZiVzFoYm1SekxDQnpaV3htTG5SbGVIUmhjbVZoS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdjR0Z5Wlc1MFcyMXZkbDBvYzJWc1ppNWpiMjF3YjI1bGJuUnpMbVZrYVhSaFlteGxLVHRjYmlBZ0lDQnBaaUFvYzJWc1ppNXdiR0ZqWldodmJHUmxjaWtnZXlCd1lYSmxiblJiYlc5MlhTaHpaV3htTG5Cc1lXTmxhRzlzWkdWeUtUc2dmVnh1SUNBZ0lIQmhjbVZ1ZEZ0dGIzWmRLSE5sYkdZdVkyOXRjRzl1Wlc1MGN5NXpkMmwwWTJoaWIyRnlaQ2s3WEc0Z0lDQWdMeThnVkU5RVQxeHVJQ0FnSUM4dklHbG1JQ2h6Wld4bUxtOXdkR2x2Ym5NdWFXMWhaMlZ6SUh4OElITmxiR1l1YjNCMGFXOXVjeTVoZEhSaFkyaHRaVzUwY3lrZ2UxeHVJQ0FnSUNBZ0x5OGdjR0Z5Wlc1MFcyMXZkbDBvYzJWc1ppNWpiMjF3YjI1bGJuUnpMbVJ5YjNCaGNtVmhLVHRjYmlBZ0lDQWdJQzh2SUhWd2JHOWhaSE1vY0dGeVpXNTBMQ0J6Wld4bUxtTnZiWEJ2Ym1WdWRITXVaSEp2Y0dGeVpXRXNJSE5sYkdZc0lHOHNJSEpsYlc5MlpTazdYRzRnSUNBZ0x5OGdmVnh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnYldGeWEyUnZkMjVOYjJSbElDaGxLU0I3SUhObGJHWXVjMlYwVFc5a1pTZ25iV0Z5YTJSdmQyNG5MQ0JsS1RzZ2ZWeHVJQ0JtZFc1amRHbHZiaUIzZVhOcGQzbG5UVzlrWlNBb1pTa2dleUJ6Wld4bUxuTmxkRTF2WkdVb0ozZDVjMmwzZVdjbkxDQmxLVHNnZlZ4dWZWeHVYRzVGWkdsMGIzSXVjSEp2ZEc5MGVYQmxMbWRsZEZOMWNtWmhZMlVnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhKbGRIVnliaUIwYUdsekxtMXZaR1Z6VzNSb2FYTXViVzlrWlYwdWMzVnlabUZqWlR0Y2JuMDdYRzVjYmtWa2FYUnZjaTV3Y205MGIzUjVjR1V1WVdSa1EyOXRiV0Z1WkNBOUlHWjFibU4wYVc5dUlDaHJaWGtzSUhOb2FXWjBMQ0JtYmlrZ2UxeHVJQ0JwWmloaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvSUQwOVBTQXlLU0I3WEc0Z0lDQWdabTRnUFNCemFHbG1kRHRjYmlBZ0lDQnphR2xtZENBOUlIVnVaR1ZtYVc1bFpEdGNiaUFnZlZ4dVhHNGdJSFJvYVhNdWMyaHZjblJqZFhSekxtRmtaQ2hyWlhrc0lITm9hV1owTENCblpYUkRiMjF0WVc1a1NHRnVaR3hsY2loMGFHbHpMQ0IwYUdsekxtMXZaR1Z6VzNSb2FYTXViVzlrWlYwdWFHbHpkRzl5ZVN3Z1ptNHBLVHRjYm4wN1hHNWNia1ZrYVhSdmNpNXdjbTkwYjNSNWNHVXVZV1JrUTI5dGJXRnVaRUoxZEhSdmJpQTlJR1oxYm1OMGFXOXVJQ2hwWkN3Z2EyVjVMQ0J6YUdsbWRDd2dabTRwSUh0Y2JpQWdhV1lnS0dGeVozVnRaVzUwY3k1c1pXNW5kR2dnUFQwOUlESXBJSHRjYmlBZ0lDQm1iaUE5SUd0bGVUdGNiaUFnSUNCclpYa2dQU0IxYm1SbFptbHVaV1E3WEc0Z0lDQWdjMmhwWm5RZ1BTQjFibVJsWm1sdVpXUTdYRzRnSUgwZ1pXeHpaU0JwWmlBb1lYSm5kVzFsYm5SekxteGxibWQwYUNBOVBUMGdNeWtnZTF4dUlDQWdJR1p1SUQwZ2MyaHBablE3WEc0Z0lDQWdjMmhwWm5RZ1BTQjFibVJsWm1sdVpXUTdYRzRnSUgxY2JseHVJQ0IyWVhJZ1luVjBkRzl1SUQwZ2RHRm5LSHNnZERvZ0oySjFkSFJ2Ymljc0lHTTZJQ2QzYXkxamIyMXRZVzVrSnl3Z2NEb2dkR2hwY3k1amIyMXdiMjVsYm5SekxtTnZiVzFoYm1SeklIMHBPMXh1SUNCMllYSWdZM1Z6ZEc5dElEMGdkR2hwY3k1dmNIUnBiMjV6TG5KbGJtUmxjaTVqYjIxdFlXNWtjenRjYmlBZ2RtRnlJSEpsYm1SbGNpQTlJSFI1Y0dWdlppQmpkWE4wYjIwZ1BUMDlJQ2RtZFc1amRHbHZiaWNnUHlCamRYTjBiMjBnT2lCeVpXNWtaWEpsY25NdVkyOXRiV0Z1WkhNN1hHNGdJSFpoY2lCMGFYUnNaU0E5SUhOMGNtbHVaM011ZEdsMGJHVnpXMmxrWFR0Y2JpQWdhV1lnS0hScGRHeGxLU0I3WEc0Z0lDQWdZblYwZEc5dUxuTmxkRUYwZEhKcFluVjBaU2duZEdsMGJHVW5MQ0J0WVdNZ1B5QnRZV05wWm5rb2RHbDBiR1VwSURvZ2RHbDBiR1VwTzF4dUlDQjlYRzRnSUdKMWRIUnZiaTUwZVhCbElEMGdKMkoxZEhSdmJpYzdYRzRnSUdKMWRIUnZiaTUwWVdKSmJtUmxlQ0E5SUMweE8xeHVJQ0J5Wlc1a1pYSW9ZblYwZEc5dUxDQnBaQ2s3WEc0Z0lHSjFkSFJ2Ymk1aFpHUkZkbVZ1ZEV4cGMzUmxibVZ5S0NkamJHbGpheWNzSUdkbGRFTnZiVzFoYm1SSVlXNWtiR1Z5S0hSb2FYTXNJSFJvYVhNdWJXOWtaWE5iZEdocGN5NXRiMlJsWFM1b2FYTjBiM0o1TENCbWJpa3BPMXh1SUNCcFppQW9hMlY1S1NCN1hHNGdJQ0FnZEdocGN5NWhaR1JEYjIxdFlXNWtLR3RsZVN3Z2MyaHBablFzSUdadUtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z1luVjBkRzl1TzF4dWZUdGNibHh1UldScGRHOXlMbkJ5YjNSdmRIbHdaUzV5ZFc1RGIyMXRZVzVrSUQwZ1puVnVZM1JwYjI0Z0tHWnVLU0I3WEc0Z0lHZGxkRU52YlcxaGJtUklZVzVrYkdWeUtIUm9hWE1zSUhSb2FYTXViVzlrWlhOYmRHaHBjeTV0YjJSbFhTNW9hWE4wYjNKNUxDQnlaV0Z5Y21GdVoyVXBLRzUxYkd3cE8xeHVYRzRnSUdaMWJtTjBhVzl1SUhKbFlYSnlZVzVuWlNBb1pTd2diVzlrWlN3Z1kyaDFibXR6S1NCN1hHNGdJQ0FnY21WMGRYSnVJR1p1TG1OaGJHd29kR2hwY3l3Z1kyaDFibXR6TENCdGIyUmxLVHRjYmlBZ2ZWeHVmVHRjYmx4dVJXUnBkRzl5TG5CeWIzUnZkSGx3WlM1d1lYSnpaVTFoY210a2IzZHVJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1dmNIUnBiMjV6TG5CaGNuTmxUV0Z5YTJSdmQyNHVZWEJ3Ykhrb2RHaHBjeTV2Y0hScGIyNXpMbkJoY25ObFRXRnlhMlJ2ZDI0c0lHRnlaM1Z0Wlc1MGN5azdYRzU5TzF4dVhHNUZaR2wwYjNJdWNISnZkRzkwZVhCbExuQmhjbk5sU0ZSTlRDQTlJR1oxYm1OMGFXOXVJQ2dwSUh0Y2JpQWdjbVYwZFhKdUlIUm9hWE11YjNCMGFXOXVjeTV3WVhKelpVaFVUVXd1WVhCd2JIa29kR2hwY3k1dmNIUnBiMjV6TG5CaGNuTmxTRlJOVEN3Z1lYSm5kVzFsYm5SektUdGNibjA3WEc1Y2JrVmthWFJ2Y2k1d2NtOTBiM1I1Y0dVdVpHVnpkSEp2ZVNBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2FXWWdLSFJvYVhNdWJXOWtaU0FoUFQwZ0oyMWhjbXRrYjNkdUp5a2dlMXh1SUNBZ0lIUm9hWE11ZEdWNGRHRnlaV0V1ZG1Gc2RXVWdQU0IwYUdsekxtZGxkRTFoY210a2IzZHVLQ2s3WEc0Z0lIMWNiaUFnWTJ4aGMzTmxjeTV5YlNoMGFHbHpMblJsZUhSaGNtVmhMQ0FuZDJzdGFHbGtaU2NwTzF4dUlDQXZMeUJpYVc1a1JYWmxiblJ6S0hSeWRXVXBPeUF2THlCVVQwUlBYRzU5TzF4dVhHNUZaR2wwYjNJdWNISnZkRzkwZVhCbExuWmhiSFZsSUQwZ1puVnVZM1JwYjI0Z1oyVjBUM0pUWlhSV1lXeDFaU0FvYVc1d2RYUXBJSHRjYmlBZ2RtRnlJRzFoY210a2IzZHVJRDBnVTNSeWFXNW5LR2x1Y0hWMEtUdGNiaUFnZG1GeUlITmxiR1lnUFNCMGFHbHpPMXh1WEc0Z0lIWmhjaUJ6WlhSeklEMGdZWEpuZFcxbGJuUnpMbXhsYm1kMGFDQTlQVDBnTVR0Y2JpQWdhV1lnS0hObGRITXBJSHRjYmlBZ0lDQnBaaUFvZEdocGN5NXRiMlJsSUQwOVBTQW5kM2x6YVhkNVp5Y3BJSHRjYmlBZ0lDQWdJRzFoY210a2IzZHVJRDBnWVhOSWRHMXNLQ2s3WEc0Z0lDQWdmVnh1SUNBZ0lIUm9hWE11WjJWMFUzVnlabUZqWlNncExuZHlhWFJsS0cxaGNtdGtiM2R1S1R0Y2JpQWdJQ0IwYUdsekxtMXZaR1Z6VzNSb2FYTXViVzlrWlYwdWFHbHpkRzl5ZVM1eVpYTmxkQ2dwTzF4dUlDQjlYRzVjYmlBZ2NtVjBkWEp1SUhSb2FYTXVaMlYwVFdGeWEyUnZkMjRvS1R0Y2JseHVJQ0JtZFc1amRHbHZiaUJoYzBoMGJXd2dLQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQnpaV3htTG05d2RHbHZibk11Y0dGeWMyVk5ZWEpyWkc5M2JpaHRZWEpyWkc5M2JpazdYRzRnSUgxY2JuMDdYRzVjYmtWa2FYUnZjaTV3Y205MGIzUjVjR1V1YzJWMFRXOWtaU0E5SUdaMWJtTjBhVzl1SUNobmIxUnZUVzlrWlN3Z1pTa2dlMXh1SUNCMllYSWdjMlZzWmlBOUlIUm9hWE03WEc0Z0lIWmhjaUJqZFhKeVpXNTBUVzlrWlNBOUlIUm9hWE11Ylc5a1pYTmJkR2hwY3k1dGIyUmxYU0I4ZkNCN2ZUdGNiaUFnZG1GeUlHNWxlSFJOYjJSbElEMGdkR2hwY3k1dGIyUmxjMXRuYjFSdlRXOWtaVjA3WEc0Z0lIWmhjaUJ2YkdRZ1BTQmpkWEp5Wlc1MFRXOWtaUzVpZFhSMGIyNDdYRzRnSUhaaGNpQmlkWFIwYjI0Z1BTQnVaWGgwVFc5a1pTNWlkWFIwYjI0N1hHNGdJSFpoY2lCbWIyTjFjMmx1WnlBOUlDRWhaU0I4ZkNCa2IyTXVZV04wYVhabFJXeGxiV1Z1ZENBOVBUMGdZM1Z5Y21WdWRFMXZaR1V1Wld4bGJXVnVkQ0I4ZkNCa2IyTXVZV04wYVhabFJXeGxiV1Z1ZENBOVBUMGdibVY0ZEUxdlpHVXVaV3hsYldWdWREdGNibHh1SUNCemRHOXdLR1VwTzF4dVhHNGdJR2xtSUNoamRYSnlaVzUwVFc5a1pTQTlQVDBnYm1WNGRFMXZaR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNDdYRzRnSUgxY2JseHVJQ0IwYUdsekxuUmxlSFJoY21WaExtSnNkWElvS1RzZ0x5OGdZWFpsY25RZ1kyaHliMjFsSUhKbGNHRnBiblFnWW5WbmMxeHVYRzRnSUhaaGNpQjJZV3gxWlNBOUlIUm9hWE11WjJWMFUzVnlabUZqWlNncExuSmxZV1FvS1R0Y2JpQWdhV1lnS0dkdlZHOU5iMlJsSUQwOVBTQW5iV0Z5YTJSdmQyNG5LU0I3WEc0Z0lDQWdkbUZzZFdVZ1BTQndZWEp6WlNnbmNHRnljMlZJVkUxTUp5d2dkbUZzZFdVcExuUnlhVzBvS1R0Y2JpQWdmU0JsYkhObElHbG1JQ2huYjFSdlRXOWtaU0E5UFQwZ0ozZDVjMmwzZVdjbktTQjdYRzRnSUNBZ2RtRnNkV1VnUFNCd1lYSnpaU2duY0dGeWMyVk5ZWEpyWkc5M2JpY3NJSFpoYkhWbEtTNXlaWEJzWVdObEtISndZWEpoWjNKaGNHZ3NJQ2NuS1M1MGNtbHRLQ2s3WEc0Z0lIMWNiaUFnYm1WNGRFMXZaR1V1YzNWeVptRmpaUzUzY21sMFpTaDJZV3gxWlNrN1hHNWNiaUFnWTJ4aGMzTmxjeTVoWkdRb1kzVnljbVZ1ZEUxdlpHVXVaV3hsYldWdWRDd2dKM2RyTFdocFpHVW5LVHRjYmlBZ1kyeGhjM05sY3k1eWJTaHVaWGgwVFc5a1pTNWxiR1Z0Wlc1MExDQW5kMnN0YUdsa1pTY3BPMXh1WEc0Z0lHbG1JQ2huYjFSdlRXOWtaU0E5UFQwZ0ozZDVjMmwzZVdjbktTQjdYRzRnSUNBZ2FXWWdLSFJvYVhNdWNHeGhZMlZvYjJ4a1pYSXBJSHNnWTJ4aGMzTmxjeTV5YlNoMGFHbHpMbkJzWVdObGFHOXNaR1Z5TENBbmQyc3RhR2xrWlNjcE95QjlYRzRnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdhV1lnS0hSb2FYTXVjR3hoWTJWb2IyeGtaWElwSUhzZ1kyeGhjM05sY3k1aFpHUW9kR2hwY3k1d2JHRmpaV2h2YkdSbGNpd2dKM2RyTFdocFpHVW5LVHNnZlZ4dUlDQjlYRzVjYmlBZ2FXWWdLR1p2WTNWemFXNW5LU0I3WEc0Z0lDQWdibVY0ZEUxdlpHVXVjM1Z5Wm1GalpTNW1iMk4xY3lncE8xeHVJQ0I5WEc1Y2JpQWdZMnhoYzNObGN5NWhaR1FvWW5WMGRHOXVMQ0FuZDJzdGJXOWtaUzFoWTNScGRtVW5LVHRjYmlBZ1kyeGhjM05sY3k1eWJTaHZiR1FzSUNkM2F5MXRiMlJsTFdGamRHbDJaU2NwTzF4dUlDQmpiR0Z6YzJWekxtRmtaQ2h2YkdRc0lDZDNheTF0YjJSbExXbHVZV04wYVhabEp5azdYRzRnSUdOc1lYTnpaWE11Y20wb1luVjBkRzl1TENBbmQyc3RiVzlrWlMxcGJtRmpkR2wyWlNjcE8xeHVJQ0JpZFhSMGIyNHVjMlYwUVhSMGNtbGlkWFJsS0Nka2FYTmhZbXhsWkNjc0lDZGthWE5oWW14bFpDY3BPMXh1SUNCdmJHUXVjbVZ0YjNabFFYUjBjbWxpZFhSbEtDZGthWE5oWW14bFpDY3BPMXh1SUNCMGFHbHpMbTF2WkdVZ1BTQm5iMVJ2VFc5a1pUdGNibHh1SUNCcFppQW9kR2hwY3k1dmNIUnBiMjV6TG5OMGIzSmhaMlVwSUh0Y2JpQWdJQ0JzYjJOaGJGTjBiM0poWjJVdWMyVjBTWFJsYlNoMGFHbHpMbTl3ZEdsdmJuTXVjM1J2Y21GblpTd2dTbE5QVGk1emRISnBibWRwWm5rb1oyOVViMDF2WkdVcEtUdGNiaUFnZlZ4dVhHNGdJQzh2SUhSb2FYTXVhR2x6ZEc5eWVTNXpaWFJKYm5CMWRFMXZaR1VvWjI5VWIwMXZaR1VwTzF4dUlDQm1hWEpsVEdGMFpYSXVZMkZzYkNoMGFHbHpMQ0FuWW1GeWEyMWhjbXN0Ylc5a1pTMWphR0Z1WjJVbktUdGNibHh1SUNCbWRXNWpkR2x2YmlCd1lYSnpaU0FvYldWMGFHOWtMQ0JwYm5CMWRDa2dlMXh1SUNBZ0lISmxkSFZ5YmlCelpXeG1MbTl3ZEdsdmJuTmJiV1YwYUc5a1hTaHBibkIxZENrN1hHNGdJSDFjYm4wN1hHNWNia1ZrYVhSdmNpNXdjbTkwYjNSNWNHVXVaMlYwVFdGeWEyUnZkMjRnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUdsbUlDaDBhR2x6TG0xdlpHVWdQVDA5SUNkM2VYTnBkM2xuSnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUIwYUdsekxtOXdkR2x2Ym5NdWNHRnljMlZJVkUxTUtIUm9hWE11Ylc5a1pYTXVkM2x6YVhkNVp5NWxiR1Z0Wlc1MEtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2RHaHBjeTUwWlhoMFlYSmxZUzUyWVd4MVpUdGNibjA3WEc1Y2JpOHFYRzRnSUhaaGNpQmxaR2wwYjNJZ1BTQjdYRzRnSUNBZ1lXUmtRMjl0YldGdVpEb2dZV1JrUTI5dGJXRnVaQ3hjYmlBZ0lDQmhaR1JEYjIxdFlXNWtRblYwZEc5dU9pQmhaR1JEYjIxdFlXNWtRblYwZEc5dUxGeHVJQ0FnSUhKMWJrTnZiVzFoYm1RNklISjFia052YlcxaGJtUXNYRzRnSUNBZ2NHRnljMlZOWVhKclpHOTNiam9nYnk1d1lYSnpaVTFoY210a2IzZHVMRnh1SUNBZ0lIQmhjbk5sU0ZSTlREb2dieTV3WVhKelpVaFVUVXdzWEc0Z0lDQWdaR1Z6ZEhKdmVUb2daR1Z6ZEhKdmVTeGNiaUFnSUNCMllXeDFaVG9nWjJWMFQzSlRaWFJXWVd4MVpTeGNiaUFnSUNCMFpYaDBZWEpsWVRvZ2RHVjRkR0Z5WldFc1hHNGdJQ0FnWldScGRHRmliR1U2SUc4dWQzbHphWGQ1WnlBL0lHVmthWFJoWW14bElEb2diblZzYkN4Y2JpQWdJQ0J6WlhSTmIyUmxPaUJ3WlhKemFYTjBUVzlrWlN4Y2JpQWdJQ0JvYVhOMGIzSjVPaUI3WEc0Z0lDQWdJQ0IxYm1Sdk9pQm9hWE4wYjNKNUxuVnVaRzhzWEc0Z0lDQWdJQ0J5WldSdk9pQm9hWE4wYjNKNUxuSmxaRzhzWEc0Z0lDQWdJQ0JqWVc1VmJtUnZPaUJvYVhOMGIzSjVMbU5oYmxWdVpHOHNYRzRnSUNBZ0lDQmpZVzVTWldSdk9pQm9hWE4wYjNKNUxtTmhibEpsWkc5Y2JpQWdJQ0I5TEZ4dUlDQWdJRzF2WkdVNklDZHRZWEpyWkc5M2JpZGNiaUFnZlR0Y2Jpb3ZYRzVjYm1aMWJtTjBhVzl1SUdacGNtVk1ZWFJsY2lBb2RIbHdaU2tnZTF4dUlDQjJZWElnYzJWc1ppQTlJSFJvYVhNN1hHNGdJSE5sZEZScGJXVnZkWFFvWm5WdVkzUnBiMjRnWm1seVpTQW9LU0I3WEc0Z0lDQWdkWFJwYkhNdVpHbHpjR0YwWTJoRGRYTjBiMjFGZG1WdWRDaHpaV3htTG5SbGVIUmhjbVZoTENCMGVYQmxLVHRjYmlBZ2ZTd2dNQ2s3WEc1OVhHNWNibVoxYm1OMGFXOXVJSFJoWnlBb2IzQjBhVzl1Y3lrZ2UxeHVJQ0IyWVhJZ2J5QTlJRzl3ZEdsdmJuTWdmSHdnZTMwN1hHNGdJSFpoY2lCbGJDQTlJR1J2WXk1amNtVmhkR1ZGYkdWdFpXNTBLRzh1ZENCOGZDQW5aR2wySnlrN1hHNGdJR1ZzTG1Oc1lYTnpUbUZ0WlNBOUlHOHVZeUI4ZkNBbkp6dGNiaUFnWld3dWRHVjRkRU52Ym5SbGJuUWdQU0J2TG5nZ2ZId2dKeWM3WEc0Z0lHbG1JQ2h2TG5BcElIc2dieTV3TG1Gd2NHVnVaRU5vYVd4a0tHVnNLVHNnZlZ4dUlDQnlaWFIxY200Z1pXdzdYRzU5WEc1Y2JtWjFibU4wYVc5dUlITjBiM0FnS0dVcElIdGNiaUFnYVdZZ0tHVXBJSHNnWlM1d2NtVjJaVzUwUkdWbVlYVnNkQ2dwT3lCbExuTjBiM0JRY205d1lXZGhkR2x2YmlncE95QjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlHMWhZMmxtZVNBb2RHVjRkQ2tnZTF4dUlDQnlaWFIxY200Z2RHVjRkRnh1SUNBZ0lDNXlaWEJzWVdObEtDOWNYR0pqZEhKc1hGeGlMMmtzSUNkY1hIVXlNekU0SnlsY2JpQWdJQ0F1Y21Wd2JHRmpaU2d2WEZ4aVlXeDBYRnhpTDJrc0lDZGNYSFV5TXpJMUp5bGNiaUFnSUNBdWNtVndiR0ZqWlNndlhGeGljMmhwWm5SY1hHSXZhU3dnSjF4Y2RUSXhaVGNuS1R0Y2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JGWkdsMGIzSTdYRzRpWFgwPSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZXh0ZW5kUmVnRXhwIChyZWdleCwgcHJlLCBwb3N0KSB7XG4gIHZhciBwYXR0ZXJuID0gcmVnZXgudG9TdHJpbmcoKTtcbiAgdmFyIGZsYWdzO1xuXG4gIHBhdHRlcm4gPSBwYXR0ZXJuLnJlcGxhY2UoL1xcLyhbZ2ltXSopJC8sIGNhcHR1cmVGbGFncyk7XG4gIHBhdHRlcm4gPSBwYXR0ZXJuLnJlcGxhY2UoLyheXFwvfFxcLyQpL2csICcnKTtcbiAgcGF0dGVybiA9IHByZSArIHBhdHRlcm4gKyBwb3N0O1xuICByZXR1cm4gbmV3IFJlZ0V4cChwYXR0ZXJuLCBmbGFncyk7XG5cbiAgZnVuY3Rpb24gY2FwdHVyZUZsYWdzIChhbGwsIGYpIHtcbiAgICBmbGFncyA9IGY7XG4gICAgcmV0dXJuICcnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZXh0ZW5kUmVnRXhwO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBmaXhFT0wgKHRleHQpIHtcbiAgcmV0dXJuIHRleHQucmVwbGFjZSgvXFxyXFxuL2csICdcXG4nKS5yZXBsYWNlKC9cXHIvZywgJ1xcbicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZpeEVPTDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIElucHV0U3RhdGUgPSByZXF1aXJlKCcuL0lucHV0U3RhdGUnKTtcblxuZnVuY3Rpb24gZ2V0Q29tbWFuZEhhbmRsZXIgKGVkaXRvciwgaGlzdG9yeSwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGhhbmRsZUNvbW1hbmQgKGUpIHtcbiAgICB2YXIgc3VyZmFjZSA9IGVkaXRvci5nZXRTdXJmYWNlKCk7XG4gICAgc3VyZmFjZS5mb2N1cyh0cnVlKTtcbiAgICBoaXN0b3J5LnNldENvbW1hbmRNb2RlKCk7XG5cbiAgICB2YXIgc3RhdGUgPSBuZXcgSW5wdXRTdGF0ZShzdXJmYWNlLCBlZGl0b3IubW9kZSk7XG4gICAgdmFyIGNodW5rcyA9IHN0YXRlLmdldENodW5rcygpO1xuICAgIHZhciBhc3luY0hhbmRsZXIgPSB7XG4gICAgICBhc3luYzogYXN5bmMsIGltbWVkaWF0ZTogdHJ1ZVxuICAgIH07XG5cbiAgICBmbi5jYWxsKGFzeW5jSGFuZGxlciwgZSwgZWRpdG9yLm1vZGUsIGNodW5rcyk7XG5cbiAgICBpZiAoYXN5bmNIYW5kbGVyLmltbWVkaWF0ZSkge1xuICAgICAgZG9uZSgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGFzeW5jICgpIHtcbiAgICAgIGFzeW5jSGFuZGxlci5pbW1lZGlhdGUgPSBmYWxzZTtcbiAgICAgIHJldHVybiBkb25lO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGRvbmUgKCkge1xuICAgICAgc3VyZmFjZS5mb2N1cygpO1xuICAgICAgc3RhdGUuc2V0Q2h1bmtzKGNodW5rcyk7XG4gICAgICBzdGF0ZS5yZXN0b3JlKCk7XG4gICAgfVxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldENvbW1hbmRIYW5kbGVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdHJpbUNodW5rcyA9IHJlcXVpcmUoJy4uL2NodW5rcy90cmltJyk7XG5cbmZ1bmN0aW9uIEh0bWxDaHVua3MgKCkge1xufVxuXG5IdG1sQ2h1bmtzLnByb3RvdHlwZS50cmltID0gdHJpbUNodW5rcztcblxuSHRtbENodW5rcy5wcm90b3R5cGUuZmluZFRhZ3MgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5IdG1sQ2h1bmtzLnByb3RvdHlwZS5za2lwID0gZnVuY3Rpb24gKCkge1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBIdG1sQ2h1bmtzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcblxuZnVuY3Rpb24gYmxvY2txdW90ZSAoY2h1bmtzKSB7XG4gIHdyYXBwaW5nKCdibG9ja3F1b3RlJywgc3RyaW5ncy5wbGFjZWhvbGRlcnMucXVvdGUsIGNodW5rcyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmxvY2txdW90ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgd3JhcHBpbmcgPSByZXF1aXJlKCcuL3dyYXBwaW5nJyk7XG5cbmZ1bmN0aW9uIGJvbGRPckl0YWxpYyAoY2h1bmtzLCB0eXBlKSB7XG4gIHdyYXBwaW5nKHR5cGUgPT09ICdib2xkJyA/ICdzdHJvbmcnIDogJ2VtJywgc3RyaW5ncy5wbGFjZWhvbGRlcnNbdHlwZV0sIGNodW5rcyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYm9sZE9ySXRhbGljO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcblxuZnVuY3Rpb24gY29kZWJsb2NrIChjaHVua3MpIHtcbiAgd3JhcHBpbmcoJ3ByZT48Y29kZScsIHN0cmluZ3MucGxhY2Vob2xkZXJzLmNvZGUsIGNodW5rcyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY29kZWJsb2NrO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBybGVhZGluZyA9IC88aChbMS02XSkoIFtePl0qKT8+JC87XG52YXIgcnRyYWlsaW5nID0gL148XFwvaChbMS02XSk+LztcblxuZnVuY3Rpb24gaGVhZGluZyAoY2h1bmtzKSB7XG4gIGNodW5rcy50cmltKCk7XG5cbiAgdmFyIHRyYWlsID0gcnRyYWlsaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKTtcbiAgdmFyIGxlYWQgPSBybGVhZGluZy5leGVjKGNodW5rcy5iZWZvcmUpO1xuICBpZiAobGVhZCAmJiB0cmFpbCAmJiBsZWFkWzFdID09PSB0cmFpbFsxXSkge1xuICAgIHN3YXAoKTtcbiAgfSBlbHNlIHtcbiAgICBhZGQoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN3YXAgKCkge1xuICAgIHZhciBsZXZlbCA9IHBhcnNlSW50KGxlYWRbMV0sIDEwKTtcbiAgICB2YXIgbmV4dCA9IGxldmVsIDw9IDEgPyA0IDogbGV2ZWwgLSAxO1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlYWRpbmcsICc8aCcgKyBuZXh0ICsgJz4nKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShydHJhaWxpbmcsICc8L2gnICsgbmV4dCArICc+Jyk7XG4gIH1cblxuICBmdW5jdGlvbiBhZGQgKCkge1xuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmhlYWRpbmc7XG4gICAgfVxuICAgIGNodW5rcy5iZWZvcmUgKz0gJzxoMT4nO1xuICAgIGNodW5rcy5hZnRlciA9ICc8L2gxPicgKyBjaHVua3MuYWZ0ZXI7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoZWFkaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBociAoY2h1bmtzKSB7XG4gIGNodW5rcy5iZWZvcmUgKz0gJ1xcbjxocj5cXG4nO1xuICBjaHVua3Muc2VsZWN0aW9uID0gJyc7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaHI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XG52YXIgb25jZSA9IHJlcXVpcmUoJy4uL29uY2UnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHBhcnNlTGlua0lucHV0ID0gcmVxdWlyZSgnLi4vY2h1bmtzL3BhcnNlTGlua0lucHV0Jyk7XG52YXIgcmxlYWRpbmcgPSAvPGEoIFtePl0qKT8+JC87XG52YXIgcnRyYWlsaW5nID0gL148XFwvYT4vO1xudmFyIHJpbWFnZSA9IC88aW1nKCBbXj5dKik/XFwvPiQvO1xuXG5mdW5jdGlvbiBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCAoY2h1bmtzLCBvcHRpb25zKSB7XG4gIHZhciB0eXBlID0gb3B0aW9ucy50eXBlO1xuICB2YXIgaW1hZ2UgPSB0eXBlID09PSAnaW1hZ2UnO1xuICB2YXIgcmVzdW1lO1xuXG4gIGlmICh0eXBlICE9PSAnYXR0YWNobWVudCcpIHtcbiAgICBjaHVua3MudHJpbSgpO1xuICB9XG5cbiAgaWYgKHJlbW92YWwoKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHJlc3VtZSA9IHRoaXMuYXN5bmMoKTtcblxuICBvcHRpb25zLnByb21wdHMuY2xvc2UoKTtcbiAgKG9wdGlvbnMucHJvbXB0c1t0eXBlXSB8fCBvcHRpb25zLnByb21wdHMubGluaykob3B0aW9ucywgb25jZShyZXNvbHZlZCkpO1xuXG4gIGZ1bmN0aW9uIHJlbW92YWwgKCkge1xuICAgIGlmIChpbWFnZSkge1xuICAgICAgaWYgKHJpbWFnZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSAnJztcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChydHJhaWxpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpICYmIHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSkpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlYWRpbmcsICcnKTtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZWQgKHJlc3VsdCkge1xuICAgIHZhciBwYXJ0cztcbiAgICB2YXIgbGlua3MgPSByZXN1bHQuZGVmaW5pdGlvbnMubWFwKHBhcnNlTGlua0lucHV0KS5maWx0ZXIobG9uZyk7XG4gICAgaWYgKGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmVzdW1lKCk7IHJldHVybjtcbiAgICB9XG4gICAgdmFyIGxpbmsgPSBsaW5rc1swXTtcblxuICAgIGlmICh0eXBlID09PSAnYXR0YWNobWVudCcpIHtcbiAgICAgIHBhcnRzID0gb3B0aW9ucy5tZXJnZUh0bWxBbmRBdHRhY2htZW50KGNodW5rcy5iZWZvcmUgKyBjaHVua3Muc2VsZWN0aW9uICsgY2h1bmtzLmFmdGVyLCBsaW5rKTtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBwYXJ0cy5iZWZvcmU7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gcGFydHMuc2VsZWN0aW9uO1xuICAgICAgY2h1bmtzLmFmdGVyID0gcGFydHMuYWZ0ZXI7XG4gICAgICByZXN1bWUoKTtcbiAgICAgIHV0aWxzLmRpc3BhdGNoQ3VzdG9tRXZlbnQob3B0aW9ucy5zdXJmYWNlLnRleHRhcmVhLCAnd29vZm1hcmstbW9kZS1jaGFuZ2UnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaW1hZ2UpIHtcbiAgICAgIGltYWdlV3JhcChsaW5rLCBsaW5rcy5zbGljZSgxKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxpbmtXcmFwKGxpbmssIGxpbmtzLnNsaWNlKDEpKTtcbiAgICB9XG5cbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICB9XG4gICAgcmVzdW1lKCk7XG5cbiAgICBmdW5jdGlvbiBsb25nIChsaW5rKSB7XG4gICAgICByZXR1cm4gbGluay5ocmVmLmxlbmd0aCA+IDA7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZ2V0VGl0bGUgKGxpbmspIHtcbiAgICAgIHJldHVybiBsaW5rLnRpdGxlID8gJyB0aXRsZT1cIicgKyBsaW5rLnRpdGxlICsgJ1wiJyA6ICcnO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGltYWdlV3JhcCAobGluaywgcmVzdCkge1xuICAgICAgdmFyIGFmdGVyID0gY2h1bmtzLmFmdGVyO1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSB0YWdvcGVuKGxpbmspO1xuICAgICAgY2h1bmtzLmFmdGVyID0gdGFnY2xvc2UobGluayk7XG4gICAgICBpZiAocmVzdC5sZW5ndGgpIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyICs9IHJlc3QubWFwKHRvQW5vdGhlckltYWdlKS5qb2luKCcnKTtcbiAgICAgIH1cbiAgICAgIGNodW5rcy5hZnRlciArPSBhZnRlcjtcbiAgICAgIGZ1bmN0aW9uIHRhZ29wZW4gKGxpbmspIHsgcmV0dXJuICc8aW1nIHNyYz1cIicgKyBsaW5rLmhyZWYgKyAnXCIgYWx0PVwiJzsgfVxuICAgICAgZnVuY3Rpb24gdGFnY2xvc2UgKGxpbmspIHsgcmV0dXJuICdcIicgKyBnZXRUaXRsZShsaW5rKSArICcgLz4nOyB9XG4gICAgICBmdW5jdGlvbiB0b0Fub3RoZXJJbWFnZSAobGluaykgeyByZXR1cm4gJyAnICsgdGFnb3BlbihsaW5rKSArIHRhZ2Nsb3NlKGxpbmspOyB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbGlua1dyYXAgKGxpbmssIHJlc3QpIHtcbiAgICAgIHZhciBhZnRlciA9IGNodW5rcy5hZnRlcjtcbiAgICAgIHZhciBuYW1lcyA9IG9wdGlvbnMuY2xhc3Nlcy5pbnB1dC5saW5rcztcbiAgICAgIHZhciBjbGFzc2VzID0gbmFtZXMgPyAnIGNsYXNzPVwiJyArIG5hbWVzICsgJ1wiJyA6ICcnO1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSB0YWdvcGVuKGxpbmspO1xuICAgICAgY2h1bmtzLmFmdGVyID0gdGFnY2xvc2UoKTtcbiAgICAgIGlmIChyZXN0Lmxlbmd0aCkge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgKz0gcmVzdC5tYXAodG9Bbm90aGVyTGluaykuam9pbignJyk7XG4gICAgICB9XG4gICAgICBjaHVua3MuYWZ0ZXIgKz0gYWZ0ZXI7XG4gICAgICBmdW5jdGlvbiB0YWdvcGVuIChsaW5rKSB7IHJldHVybiAnPGEgaHJlZj1cIicgKyBsaW5rLmhyZWYgKyAnXCInICsgZ2V0VGl0bGUobGluaykgKyBjbGFzc2VzICsgJz4nOyB9XG4gICAgICBmdW5jdGlvbiB0YWdjbG9zZSAoKSB7IHJldHVybiAnPC9hPic7IH1cbiAgICAgIGZ1bmN0aW9uIHRvQW5vdGhlckxpbmsgKGxpbmspIHsgcmV0dXJuICcgJyArIHRhZ29wZW4obGluaykgKyB0YWdjbG9zZSgpOyB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHJsZWZ0c2luZ2xlID0gLzwodWx8b2wpKCBbXj5dKik/Plxccyo8bGkoIFtePl0qKT8+JC87XG52YXIgcnJpZ2h0c2luZ2xlID0gL148XFwvbGk+XFxzKjxcXC8odWx8b2wpPi87XG52YXIgcmxlZnRpdGVtID0gLzxsaSggW14+XSopPz4kLztcbnZhciBycmlnaHRpdGVtID0gL148XFwvbGkoIFtePl0qKT8+LztcbnZhciByb3BlbiA9IC9ePCh1bHxvbCkoIFtePl0qKT8+JC87XG5cbmZ1bmN0aW9uIGxpc3QgKGNodW5rcywgb3JkZXJlZCkge1xuICB2YXIgdGFnID0gb3JkZXJlZCA/ICdvbCcgOiAndWwnO1xuICB2YXIgb2xpc3QgPSAnPCcgKyB0YWcgKyAnPic7XG4gIHZhciBjbGlzdCA9ICc8LycgKyB0YWcgKyAnPic7XG5cbiAgY2h1bmtzLnRyaW0oKTtcblxuICBpZiAocmxlZnRzaW5nbGUudGVzdChjaHVua3MuYmVmb3JlKSAmJiBycmlnaHRzaW5nbGUudGVzdChjaHVua3MuYWZ0ZXIpKSB7XG4gICAgaWYgKHRhZyA9PT0gUmVnRXhwLiQxKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWZ0c2luZ2xlLCAnJyk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShycmlnaHRzaW5nbGUsICcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICB2YXIgdWxTdGFydCA9IGNodW5rcy5iZWZvcmUubGFzdEluZGV4T2YoJzx1bCcpO1xuICB2YXIgb2xTdGFydCA9IGNodW5rcy5iZWZvcmUubGFzdEluZGV4T2YoJzxvbCcpO1xuICB2YXIgY2xvc2VUYWcgPSBjaHVua3MuYWZ0ZXIuaW5kZXhPZignPC91bD4nKTtcbiAgaWYgKGNsb3NlVGFnID09PSAtMSkge1xuICAgIGNsb3NlVGFnID0gY2h1bmtzLmFmdGVyLmluZGV4T2YoJzwvb2w+Jyk7XG4gIH1cbiAgaWYgKGNsb3NlVGFnID09PSAtMSkge1xuICAgIGFkZCgpOyByZXR1cm47XG4gIH1cbiAgdmFyIG9wZW5TdGFydCA9IHVsU3RhcnQgPiBvbFN0YXJ0ID8gdWxTdGFydCA6IG9sU3RhcnQ7XG4gIGlmIChvcGVuU3RhcnQgPT09IC0xKSB7XG4gICAgYWRkKCk7IHJldHVybjtcbiAgfVxuICB2YXIgb3BlbkVuZCA9IGNodW5rcy5iZWZvcmUuaW5kZXhPZignPicsIG9wZW5TdGFydCk7XG4gIGlmIChvcGVuRW5kID09PSAtMSkge1xuICAgIGFkZCgpOyByZXR1cm47XG4gIH1cblxuICB2YXIgb3BlblRhZyA9IGNodW5rcy5iZWZvcmUuc3Vic3RyKG9wZW5TdGFydCwgb3BlbkVuZCAtIG9wZW5TdGFydCArIDEpO1xuICBpZiAocm9wZW4udGVzdChvcGVuVGFnKSkge1xuICAgIGlmICh0YWcgIT09IFJlZ0V4cC4kMSkge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUuc3Vic3RyKDAsIG9wZW5TdGFydCkgKyAnPCcgKyB0YWcgKyBjaHVua3MuYmVmb3JlLnN1YnN0cihvcGVuU3RhcnQgKyAzKTtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5zdWJzdHIoMCwgY2xvc2VUYWcpICsgJzwvJyArIHRhZyArIGNodW5rcy5hZnRlci5zdWJzdHIoY2xvc2VUYWcgKyA0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJsZWZ0aXRlbS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJyaWdodGl0ZW0udGVzdChjaHVua3MuYWZ0ZXIpKSB7XG4gICAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlZnRpdGVtLCAnJyk7XG4gICAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJyaWdodGl0ZW0sICcnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkZCh0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhZGQgKGxpc3QpIHtcbiAgICB2YXIgb3BlbiA9IGxpc3QgPyAnJyA6IG9saXN0O1xuICAgIHZhciBjbG9zZSA9IGxpc3QgPyAnJyA6IGNsaXN0O1xuXG4gICAgY2h1bmtzLmJlZm9yZSArPSBvcGVuICsgJzxsaT4nO1xuICAgIGNodW5rcy5hZnRlciA9ICc8L2xpPicgKyBjbG9zZSArIGNodW5rcy5hZnRlcjtcblxuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmxpc3RpdGVtO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3Q7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHdyYXBwaW5nICh0YWcsIHBsYWNlaG9sZGVyLCBjaHVua3MpIHtcbiAgdmFyIG9wZW4gPSAnPCcgKyB0YWc7XG4gIHZhciBjbG9zZSA9ICc8LycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKTtcbiAgdmFyIHJsZWFkaW5nID0gbmV3IFJlZ0V4cChvcGVuICsgJyggW14+XSopPz4kJywgJ2knKTtcbiAgdmFyIHJ0cmFpbGluZyA9IG5ldyBSZWdFeHAoJ14nICsgY2xvc2UgKyAnPicsICdpJyk7XG4gIHZhciByb3BlbiA9IG5ldyBSZWdFeHAob3BlbiArICcoIFtePl0qKT8+JywgJ2lnJyk7XG4gIHZhciByY2xvc2UgPSBuZXcgUmVnRXhwKGNsb3NlICsgJyggW14+XSopPz4nLCAnaWcnKTtcblxuICBjaHVua3MudHJpbSgpO1xuXG4gIHZhciB0cmFpbCA9IHJ0cmFpbGluZy5leGVjKGNodW5rcy5hZnRlcik7XG4gIHZhciBsZWFkID0gcmxlYWRpbmcuZXhlYyhjaHVua3MuYmVmb3JlKTtcbiAgaWYgKGxlYWQgJiYgdHJhaWwpIHtcbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gcGxhY2Vob2xkZXI7XG4gICAgfVxuICAgIHZhciBvcGVuZWQgPSByb3Blbi50ZXN0KGNodW5rcy5zZWxlY3Rpb24pO1xuICAgIGlmIChvcGVuZWQpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm9wZW4sICcnKTtcbiAgICAgIGlmICghc3Vycm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSArPSBvcGVuICsgJz4nO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgY2xvc2VkID0gcmNsb3NlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbik7XG4gICAgaWYgKGNsb3NlZCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShyY2xvc2UsICcnKTtcbiAgICAgIGlmICghc3Vycm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gY2xvc2UgKyAnPicgKyBjaHVua3MuYWZ0ZXI7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcGVuZWQgfHwgY2xvc2VkKSB7XG4gICAgICBwdXNob3ZlcigpOyByZXR1cm47XG4gICAgfVxuICAgIGlmIChzdXJyb3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgaWYgKHJsZWFkaW5nLnRlc3QoY2h1bmtzLmJlZm9yZSkpIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSArPSBjbG9zZSArICc+JztcbiAgICAgIH1cbiAgICAgIGlmIChydHJhaWxpbmcudGVzdChjaHVua3MuYWZ0ZXIpKSB7XG4gICAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gb3BlbiArICc+JyArIGNodW5rcy5hZnRlcjtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFjbG9zZWJvdW5kZWQoY2h1bmtzLCB0YWcpKSB7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjbG9zZSArICc+JyArIGNodW5rcy5hZnRlcjtcbiAgICAgIGNodW5rcy5iZWZvcmUgKz0gb3BlbiArICc+JztcbiAgICB9XG4gICAgcHVzaG92ZXIoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hvdmVyICgpIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoLzwoXFwvKT8oW14+IF0rKSggW14+XSopPz4vaWcsIHB1c2hvdmVyT3RoZXJUYWdzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hvdmVyT3RoZXJUYWdzIChhbGwsIGNsb3NpbmcsIHRhZywgYSwgaSkge1xuICAgIHZhciBhdHRycyA9IGEgfHwgJyc7XG4gICAgdmFyIG9wZW4gPSAhY2xvc2luZztcbiAgICB2YXIgcmNsb3NlZCA9IG5ldyBSZWdFeHAoJzxcXC8nICsgdGFnLnJlcGxhY2UoLzwvZywgJzwvJykgKyAnPicsICdpJyk7XG4gICAgdmFyIHJvcGVuZWQgPSBuZXcgUmVnRXhwKCc8JyArIHRhZyArICcoIFtePl0qKT8+JywgJ2knKTtcbiAgICBpZiAob3BlbiAmJiAhcmNsb3NlZC50ZXN0KGNodW5rcy5zZWxlY3Rpb24uc3Vic3RyKGkpKSkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiArPSAnPC8nICsgdGFnICsgJz4nO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL14oPFxcL1tePl0rPikvLCAnJDE8JyArIHRhZyArIGF0dHJzICsgJz4nKTtcbiAgICB9XG5cbiAgICBpZiAoY2xvc2luZyAmJiAhcm9wZW5lZC50ZXN0KGNodW5rcy5zZWxlY3Rpb24uc3Vic3RyKDAsIGkpKSkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICc8JyArIHRhZyArIGF0dHJzICsgJz4nICsgY2h1bmtzLnNlbGVjdGlvbjtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UoLyg8W14+XSsoPzogW14+XSopPz4pJC8sICc8LycgKyB0YWcgKyAnPiQxJyk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNsb3NlYm91bmRlZCAoY2h1bmtzLCB0YWcpIHtcbiAgdmFyIHJjbG9zZWxlZnQgPSBuZXcgUmVnRXhwKCc8LycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKSArICc+JCcsICdpJyk7XG4gIHZhciByb3BlbnJpZ2h0ID0gbmV3IFJlZ0V4cCgnXjwnICsgdGFnICsgJyg/OiBbXj5dKik/PicsICdpJyk7XG4gIHZhciBib3VuZGVkID0gcmNsb3NlbGVmdC50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJvcGVucmlnaHQudGVzdChjaHVua3MuYWZ0ZXIpO1xuICBpZiAoYm91bmRlZCkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmNsb3NlbGVmdCwgJycpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJvcGVucmlnaHQsICcnKTtcbiAgfVxuICByZXR1cm4gYm91bmRlZDtcbn1cblxuZnVuY3Rpb24gc3Vycm91bmRlZCAoY2h1bmtzLCB0YWcpIHtcbiAgdmFyIHJvcGVuID0gbmV3IFJlZ0V4cCgnPCcgKyB0YWcgKyAnKD86IFtePl0qKT8+JywgJ2lnJyk7XG4gIHZhciByY2xvc2UgPSBuZXcgUmVnRXhwKCc8XFwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpICsgJz4nLCAnaWcnKTtcbiAgdmFyIG9wZW5zQmVmb3JlID0gY291bnQoY2h1bmtzLmJlZm9yZSwgcm9wZW4pO1xuICB2YXIgb3BlbnNBZnRlciA9IGNvdW50KGNodW5rcy5hZnRlciwgcm9wZW4pO1xuICB2YXIgY2xvc2VzQmVmb3JlID0gY291bnQoY2h1bmtzLmJlZm9yZSwgcmNsb3NlKTtcbiAgdmFyIGNsb3Nlc0FmdGVyID0gY291bnQoY2h1bmtzLmFmdGVyLCByY2xvc2UpO1xuICB2YXIgb3BlbiA9IG9wZW5zQmVmb3JlIC0gY2xvc2VzQmVmb3JlID4gMDtcbiAgdmFyIGNsb3NlID0gY2xvc2VzQWZ0ZXIgLSBvcGVuc0FmdGVyID4gMDtcbiAgcmV0dXJuIG9wZW4gJiYgY2xvc2U7XG5cbiAgZnVuY3Rpb24gY291bnQgKHRleHQsIHJlZ2V4KSB7XG4gICAgdmFyIG1hdGNoID0gdGV4dC5tYXRjaChyZWdleCk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4gbWF0Y2gubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdyYXBwaW5nO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBpc1Zpc2libGVFbGVtZW50IChlbGVtKSB7XG4gIGlmIChnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZSkge1xuICAgIHJldHVybiBnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKCdkaXNwbGF5JykgIT09ICdub25lJztcbiAgfSBlbHNlIGlmIChlbGVtLmN1cnJlbnRTdHlsZSkge1xuICAgIHJldHVybiBlbGVtLmN1cnJlbnRTdHlsZS5kaXNwbGF5ICE9PSAnbm9uZSc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1Zpc2libGVFbGVtZW50O1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTlwYzFacGMybGliR1ZGYkdWdFpXNTBMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1Wm5WdVkzUnBiMjRnYVhOV2FYTnBZbXhsUld4bGJXVnVkQ0FvWld4bGJTa2dlMXh1SUNCcFppQW9aMnh2WW1Gc0xtZGxkRU52YlhCMWRHVmtVM1I1YkdVcElIdGNiaUFnSUNCeVpYUjFjbTRnWjJ4dlltRnNMbWRsZEVOdmJYQjFkR1ZrVTNSNWJHVW9aV3hsYlN3Z2JuVnNiQ2t1WjJWMFVISnZjR1Z5ZEhsV1lXeDFaU2duWkdsemNHeGhlU2NwSUNFOVBTQW5ibTl1WlNjN1hHNGdJSDBnWld4elpTQnBaaUFvWld4bGJTNWpkWEp5Wlc1MFUzUjViR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaV3hsYlM1amRYSnlaVzUwVTNSNWJHVXVaR2x6Y0d4aGVTQWhQVDBnSjI1dmJtVW5PMXh1SUNCOVhHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnYVhOV2FYTnBZbXhsUld4bGJXVnVkRHRjYmlKZGZRPT0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjYWNoZSA9IFtdO1xudmFyIEVkaXRvciA9IHJlcXVpcmUoJy4vZWRpdG9yJyk7XG5cbmZ1bmN0aW9uIE1hbmFnZXIgKCkge1xuICB0aGlzLmNhY2hlID0gW107XG59XG5cbk1hbmFnZXIucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAodGV4dGFyZWEpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNhY2hlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh0aGlzLmNhY2hlW2ldICYmIHRoaXMuY2FjaGVbaV0udGV4dGFyZWEgPT09IHRleHRhcmVhKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWNoZVtpXTtcbiAgICB9XG4gIH1cbn07XG5cbk1hbmFnZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB2YXIgZWRpdG9yID0gdGhpcy5maW5kKHRleHRhcmVhKTtcbiAgaWYoZWRpdG9yKSB7XG4gICAgcmV0dXJuIGVkaXRvci5lZGl0b3I7XG4gIH1cblxuICBlZGl0b3IgPSBuZXcgRWRpdG9yKHRleHRhcmVhLCBvcHRpb25zKTtcbiAgY2FjaGUucHVzaCh7XG4gICAgdGV4dGFyZWE6IHRleHRhcmVhLFxuICAgIGVkaXRvcjogZWRpdG9yLFxuICAgIG9wdGlvbnM6IG9wdGlvbnMsXG4gIH0pO1xuXG4gIHJldHVybiBlZGl0b3I7XG59O1xuXG5NYW5hZ2VyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAodGV4dGFyZWEpIHtcbiAgdmFyIGVkaXRvciA9IHRoaXMuZmluZCh0ZXh0YXJlYSk7XG4gIGlmKCFlZGl0b3IpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBlZGl0b3IuZWRpdG9yLmRlc3Ryb3koKTtcbiAgY2FjaGUuc3BsaWNlKGNhY2hlLmluZGV4T2YoZWRpdG9yKSwgMSk7XG4gIHJldHVybiB0cnVlO1xufTtcblxuTWFuYWdlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBjYWNoZWQ7XG4gIHdoaWxlIChjYWNoZWQgPSB0aGlzLmNhY2hlLnBvcCgpKSB7XG4gICAgY2FjaGVkLmVkaXRvci5kZXN0cm95KCk7XG4gIH1cbn07XG5cbk1hbmFnZXIucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbiAoZm4pIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNhY2hlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBjYWNoZWQgPSB0aGlzLmNhY2hlW2ldO1xuICAgIGZuKGNhY2hlZC5lZGl0b3IsIGNhY2hlZC50ZXh0YXJlYSwgY2FjaGVkLm9wdGlvbnMpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hbmFnZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG1hbnkgKHRleHQsIHRpbWVzKSB7XG4gIHJldHVybiBuZXcgQXJyYXkodGltZXMgKyAxKS5qb2luKHRleHQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1hbnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIGV4dGVuZFJlZ0V4cCA9IHJlcXVpcmUoJy4uL2V4dGVuZFJlZ0V4cCcpO1xudmFyIHRyaW1DaHVua3MgPSByZXF1aXJlKCcuLi9jaHVua3MvdHJpbScpO1xuXG5mdW5jdGlvbiBNYXJrZG93bkNodW5rcyAoKSB7XG59XG5cbk1hcmtkb3duQ2h1bmtzLnByb3RvdHlwZS50cmltID0gdHJpbUNodW5rcztcblxuTWFya2Rvd25DaHVua3MucHJvdG90eXBlLmZpbmRUYWdzID0gZnVuY3Rpb24gKHN0YXJ0UmVnZXgsIGVuZFJlZ2V4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHJlZ2V4O1xuXG4gIGlmIChzdGFydFJlZ2V4KSB7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoc3RhcnRSZWdleCwgJycsICckJyk7XG4gICAgdGhpcy5iZWZvcmUgPSB0aGlzLmJlZm9yZS5yZXBsYWNlKHJlZ2V4LCBzdGFydFJlcGxhY2VyKTtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChzdGFydFJlZ2V4LCAnXicsICcnKTtcbiAgICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UocmVnZXgsIHN0YXJ0UmVwbGFjZXIpO1xuICB9XG5cbiAgaWYgKGVuZFJlZ2V4KSB7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoZW5kUmVnZXgsICcnLCAnJCcpO1xuICAgIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZShyZWdleCwgZW5kUmVwbGFjZXIpO1xuICAgIHJlZ2V4ID0gZXh0ZW5kUmVnRXhwKGVuZFJlZ2V4LCAnXicsICcnKTtcbiAgICB0aGlzLmFmdGVyID0gdGhpcy5hZnRlci5yZXBsYWNlKHJlZ2V4LCBlbmRSZXBsYWNlcik7XG4gIH1cblxuICBmdW5jdGlvbiBzdGFydFJlcGxhY2VyIChtYXRjaCkge1xuICAgIHNlbGYuc3RhcnRUYWcgPSBzZWxmLnN0YXJ0VGFnICsgbWF0Y2g7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuZFJlcGxhY2VyIChtYXRjaCkge1xuICAgIHNlbGYuZW5kVGFnID0gbWF0Y2ggKyBzZWxmLmVuZFRhZzsgcmV0dXJuICcnO1xuICB9XG59O1xuXG5NYXJrZG93bkNodW5rcy5wcm90b3R5cGUuc2tpcCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGJlZm9yZUNvdW50ID0gJ2JlZm9yZScgaW4gbyA/IG8uYmVmb3JlIDogMTtcbiAgdmFyIGFmdGVyQ291bnQgPSAnYWZ0ZXInIGluIG8gPyBvLmFmdGVyIDogMTtcblxuICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UoLyheXFxuKikvLCAnJyk7XG4gIHRoaXMuc3RhcnRUYWcgPSB0aGlzLnN0YXJ0VGFnICsgUmVnRXhwLiQxO1xuICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UoLyhcXG4qJCkvLCAnJyk7XG4gIHRoaXMuZW5kVGFnID0gdGhpcy5lbmRUYWcgKyBSZWdFeHAuJDE7XG4gIHRoaXMuc3RhcnRUYWcgPSB0aGlzLnN0YXJ0VGFnLnJlcGxhY2UoLyheXFxuKikvLCAnJyk7XG4gIHRoaXMuYmVmb3JlID0gdGhpcy5iZWZvcmUgKyBSZWdFeHAuJDE7XG4gIHRoaXMuZW5kVGFnID0gdGhpcy5lbmRUYWcucmVwbGFjZSgvKFxcbiokKS8sICcnKTtcbiAgdGhpcy5hZnRlciA9IHRoaXMuYWZ0ZXIgKyBSZWdFeHAuJDE7XG5cbiAgaWYgKHRoaXMuYmVmb3JlKSB7XG4gICAgdGhpcy5iZWZvcmUgPSByZXBsYWNlKHRoaXMuYmVmb3JlLCArK2JlZm9yZUNvdW50LCAnJCcpO1xuICB9XG5cbiAgaWYgKHRoaXMuYWZ0ZXIpIHtcbiAgICB0aGlzLmFmdGVyID0gcmVwbGFjZSh0aGlzLmFmdGVyLCArK2FmdGVyQ291bnQsICcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2UgKHRleHQsIGNvdW50LCBzdWZmaXgpIHtcbiAgICB2YXIgcmVnZXggPSBvLmFueSA/ICdcXFxcbionIDogbWFueSgnXFxcXG4/JywgY291bnQpO1xuICAgIHZhciByZXBsYWNlbWVudCA9IG1hbnkoJ1xcbicsIGNvdW50KTtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKG5ldyBSZWdFeHAocmVnZXggKyBzdWZmaXgpLCByZXBsYWNlbWVudCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWFya2Rvd25DaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xudmFyIHNldHRpbmdzID0gcmVxdWlyZSgnLi9zZXR0aW5ncycpO1xudmFyIHJ0cmFpbGJsYW5rbGluZSA9IC8oPlsgXFx0XSopJC87XG52YXIgcmxlYWRibGFua2xpbmUgPSAvXig+WyBcXHRdKikvO1xudmFyIHJuZXdsaW5lZmVuY2luZyA9IC9eKFxcbiopKFteXFxyXSs/KShcXG4qKSQvO1xudmFyIHJlbmR0YWcgPSAvXigoKFxcbnxeKShcXG5bIFxcdF0qKSo+KC4rXFxuKSouKikrKFxcblsgXFx0XSopKikvO1xudmFyIHJsZWFkYnJhY2tldCA9IC9eXFxuKCg+fFxccykqKVxcbi87XG52YXIgcnRyYWlsYnJhY2tldCA9IC9cXG4oKD58XFxzKSopXFxuJC87XG5cbmZ1bmN0aW9uIGJsb2NrcXVvdGUgKGNodW5rcykge1xuICB2YXIgbWF0Y2ggPSAnJztcbiAgdmFyIGxlZnRPdmVyID0gJyc7XG4gIHZhciBsaW5lO1xuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm5ld2xpbmVmZW5jaW5nLCBuZXdsaW5lcmVwbGFjZXIpO1xuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJ0cmFpbGJsYW5rbGluZSwgdHJhaWxibGFua2xpbmVyZXBsYWNlcik7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL14oXFxzfD4pKyQvLCAnJyk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uIHx8IHN0cmluZ3MucGxhY2Vob2xkZXJzLnF1b3RlO1xuXG4gIGlmIChjaHVua3MuYmVmb3JlKSB7XG4gICAgYmVmb3JlUHJvY2Vzc2luZygpO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gbWF0Y2g7XG4gIGNodW5rcy5iZWZvcmUgPSBsZWZ0T3ZlcjtcblxuICBpZiAoY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL15cXG4/LywgJ1xcbicpO1xuICB9XG5cbiAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmVuZHRhZywgZW5kdGFncmVwbGFjZXIpO1xuXG4gIGlmICgvXig/IVsgXXswLDN9PikvbS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgd3JhcHBpbmcud3JhcChjaHVua3MsIHNldHRpbmdzLmxpbmVMZW5ndGggLSAyKTtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eL2dtLCAnPiAnKTtcbiAgICByZXBsYWNlQmxhbmtzSW5UYWdzKHRydWUpO1xuICAgIGNodW5rcy5za2lwKCk7XG4gIH0gZWxzZSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXlsgXXswLDN9PiA/L2dtLCAnJyk7XG4gICAgd3JhcHBpbmcudW53cmFwKGNodW5rcyk7XG4gICAgcmVwbGFjZUJsYW5rc0luVGFncyhmYWxzZSk7XG5cbiAgICBpZiAoIS9eKFxcbnxeKVsgXXswLDN9Pi8udGVzdChjaHVua3Muc2VsZWN0aW9uKSAmJiBjaHVua3Muc3RhcnRUYWcpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5zdGFydFRhZy5yZXBsYWNlKC9cXG57MCwyfSQvLCAnXFxuXFxuJyk7XG4gICAgfVxuXG4gICAgaWYgKCEvKFxcbnxeKVsgXXswLDN9Pi4qJC8udGVzdChjaHVua3Muc2VsZWN0aW9uKSAmJiBjaHVua3MuZW5kVGFnKSB7XG4gICAgICBjaHVua3MuZW5kVGFnID0gY2h1bmtzLmVuZFRhZy5yZXBsYWNlKC9eXFxuezAsMn0vLCAnXFxuXFxuJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCEvXFxuLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybGVhZGJsYW5rbGluZSwgbGVhZGJsYW5rbGluZXJlcGxhY2VyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld2xpbmVyZXBsYWNlciAoYWxsLCBiZWZvcmUsIHRleHQsIGFmdGVyKSB7XG4gICAgY2h1bmtzLmJlZm9yZSArPSBiZWZvcmU7XG4gICAgY2h1bmtzLmFmdGVyID0gYWZ0ZXIgKyBjaHVua3MuYWZ0ZXI7XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFpbGJsYW5rbGluZXJlcGxhY2VyIChhbGwsIGJsYW5rKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGJsYW5rICsgY2h1bmtzLnNlbGVjdGlvbjsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gbGVhZGJsYW5rbGluZXJlcGxhY2VyIChhbGwsIGJsYW5rcykge1xuICAgIGNodW5rcy5zdGFydFRhZyArPSBibGFua3M7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGJlZm9yZVByb2Nlc3NpbmcgKCkge1xuICAgIHZhciBsaW5lcyA9IGNodW5rcy5iZWZvcmUucmVwbGFjZSgvXFxuJC8sICcnKS5zcGxpdCgnXFxuJyk7XG4gICAgdmFyIGNoYWluZWQgPSBmYWxzZTtcbiAgICB2YXIgZ29vZDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGdvb2QgPSBmYWxzZTtcbiAgICAgIGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIGNoYWluZWQgPSBjaGFpbmVkICYmIGxpbmUubGVuZ3RoID4gMDtcbiAgICAgIGlmICgvXj4vLnRlc3QobGluZSkpIHtcbiAgICAgICAgZ29vZCA9IHRydWU7XG4gICAgICAgIGlmICghY2hhaW5lZCAmJiBsaW5lLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjaGFpbmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICgvXlsgXFx0XSokLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgIGdvb2QgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZ29vZCA9IGNoYWluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZ29vZCkge1xuICAgICAgICBtYXRjaCArPSBsaW5lICsgJ1xcbic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZWZ0T3ZlciArPSBtYXRjaCArIGxpbmU7XG4gICAgICAgIG1hdGNoID0gJ1xcbic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCEvKF58XFxuKT4vLnRlc3QobWF0Y2gpKSB7XG4gICAgICBsZWZ0T3ZlciArPSBtYXRjaDtcbiAgICAgIG1hdGNoID0gJyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW5kdGFncmVwbGFjZXIgKGFsbCkge1xuICAgIGNodW5rcy5lbmRUYWcgPSBhbGw7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2VCbGFua3NJblRhZ3MgKGJyYWNrZXQpIHtcbiAgICB2YXIgcmVwbGFjZW1lbnQgPSBicmFja2V0ID8gJz4gJyA6ICcnO1xuXG4gICAgaWYgKGNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UocnRyYWlsYnJhY2tldCwgcmVwbGFjZXIpO1xuICAgIH1cbiAgICBpZiAoY2h1bmtzLmVuZFRhZykge1xuICAgICAgY2h1bmtzLmVuZFRhZyA9IGNodW5rcy5lbmRUYWcucmVwbGFjZShybGVhZGJyYWNrZXQsIHJlcGxhY2VyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXBsYWNlciAoYWxsLCBtYXJrZG93bikge1xuICAgICAgcmV0dXJuICdcXG4nICsgbWFya2Rvd24ucmVwbGFjZSgvXlsgXXswLDN9Pj9bIFxcdF0qJC9nbSwgcmVwbGFjZW1lbnQpICsgJ1xcbic7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmxvY2txdW90ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJsZWFkaW5nID0gL14oXFwqKikvO1xudmFyIHJ0cmFpbGluZyA9IC8oXFwqKiQpLztcbnZhciBydHJhaWxpbmdzcGFjZSA9IC8oXFxzPykkLztcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xuXG5mdW5jdGlvbiBib2xkT3JJdGFsaWMgKGNodW5rcywgdHlwZSkge1xuICB2YXIgcm5ld2xpbmVzID0gL1xcbnsyLH0vZztcbiAgdmFyIHN0YXJDb3VudCA9IHR5cGUgPT09ICdib2xkJyA/IDIgOiAxO1xuXG4gIGNodW5rcy50cmltKCk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm5ld2xpbmVzLCAnXFxuJyk7XG5cbiAgdmFyIG1hcmt1cDtcbiAgdmFyIGxlYWRTdGFycyA9IHJ0cmFpbGluZy5leGVjKGNodW5rcy5iZWZvcmUpWzBdO1xuICB2YXIgdHJhaWxTdGFycyA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKVswXTtcbiAgdmFyIHN0YXJzID0gJ1xcXFwqeycgKyBzdGFyQ291bnQgKyAnfSc7XG4gIHZhciBmZW5jZSA9IE1hdGgubWluKGxlYWRTdGFycy5sZW5ndGgsIHRyYWlsU3RhcnMubGVuZ3RoKTtcbiAgaWYgKGZlbmNlID49IHN0YXJDb3VudCAmJiAoZmVuY2UgIT09IDIgfHwgc3RhckNvdW50ICE9PSAxKSkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UobmV3IFJlZ0V4cChzdGFycyArICckJywgJycpLCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnXicgKyBzdGFycywgJycpLCAnJyk7XG4gIH0gZWxzZSBpZiAoIWNodW5rcy5zZWxlY3Rpb24gJiYgdHJhaWxTdGFycykge1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShydHJhaWxpbmdzcGFjZSwgJycpICsgdHJhaWxTdGFycyArIFJlZ0V4cC4kMTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24gJiYgIXRyYWlsU3RhcnMpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICB9XG5cbiAgICBtYXJrdXAgPSBzdGFyQ291bnQgPT09IDEgPyAnKicgOiAnKionO1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlICsgbWFya3VwO1xuICAgIGNodW5rcy5hZnRlciA9IG1hcmt1cCArIGNodW5rcy5hZnRlcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJvbGRPckl0YWxpYztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcnRleHRiZWZvcmUgPSAvXFxTWyBdKiQvO1xudmFyIHJ0ZXh0YWZ0ZXIgPSAvXlsgXSpcXFMvO1xudmFyIHJuZXdsaW5lID0gL1xcbi87XG52YXIgcmJhY2t0aWNrID0gL2AvO1xudmFyIHJmZW5jZWJlZm9yZSA9IC9gYGBbYS16XSpcXG4/JC87XG52YXIgcmZlbmNlYmVmb3JlaW5zaWRlID0gL15gYGBbYS16XSpcXG4vO1xudmFyIHJmZW5jZWFmdGVyID0gL15cXG4/YGBgLztcbnZhciByZmVuY2VhZnRlcmluc2lkZSA9IC9cXG5gYGAkLztcblxuZnVuY3Rpb24gY29kZWJsb2NrIChjaHVua3MsIG9wdGlvbnMpIHtcbiAgdmFyIG5ld2xpbmVkID0gcm5ld2xpbmUudGVzdChjaHVua3Muc2VsZWN0aW9uKTtcbiAgdmFyIHRyYWlsaW5nID0gcnRleHRhZnRlci50ZXN0KGNodW5rcy5hZnRlcik7XG4gIHZhciBsZWFkaW5nID0gcnRleHRiZWZvcmUudGVzdChjaHVua3MuYmVmb3JlKTtcbiAgdmFyIG91dGZlbmNlZCA9IHJmZW5jZWJlZm9yZS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJmZW5jZWFmdGVyLnRlc3QoY2h1bmtzLmFmdGVyKTtcbiAgaWYgKG91dGZlbmNlZCB8fCBuZXdsaW5lZCB8fCAhKGxlYWRpbmcgfHwgdHJhaWxpbmcpKSB7XG4gICAgYmxvY2sob3V0ZmVuY2VkKTtcbiAgfSBlbHNlIHtcbiAgICBpbmxpbmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlubGluZSAoKSB7XG4gICAgY2h1bmtzLnRyaW0oKTtcbiAgICBjaHVua3MuZmluZFRhZ3MocmJhY2t0aWNrLCByYmFja3RpY2spO1xuXG4gICAgaWYgKCFjaHVua3Muc3RhcnRUYWcgJiYgIWNodW5rcy5lbmRUYWcpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnYCc7XG4gICAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmNvZGU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaHVua3MuZW5kVGFnICYmICFjaHVua3Muc3RhcnRUYWcpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLmVuZFRhZztcbiAgICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJsb2NrIChvdXRmZW5jZWQpIHtcbiAgICBpZiAob3V0ZmVuY2VkKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJmZW5jZWJlZm9yZSwgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmZlbmNlYWZ0ZXIsICcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKC9bIF17NH18YGBgW2Etel0qXFxuJC8sIG1lcmdlU2VsZWN0aW9uKTtcbiAgICBjaHVua3Muc2tpcCh7XG4gICAgICBiZWZvcmU6IC8oXFxufF4pKFxcdHxbIF17NCx9fGBgYFthLXpdKlxcbikuKlxcbiQvLnRlc3QoY2h1bmtzLmJlZm9yZSkgPyAwIDogMSxcbiAgICAgIGFmdGVyOiAvXlxcbihcXHR8WyBdezQsfXxcXG5gYGApLy50ZXN0KGNodW5rcy5hZnRlcikgPyAwIDogMVxuICAgIH0pO1xuXG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBpZiAob3B0aW9ucy5mZW5jaW5nKSB7XG4gICAgICAgIGNodW5rcy5zdGFydFRhZyA9ICdgYGBcXG4nO1xuICAgICAgICBjaHVua3MuZW5kVGFnID0gJ1xcbmBgYCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3Muc3RhcnRUYWcgPSAnICAgICc7XG4gICAgICB9XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJmZW5jZWJlZm9yZWluc2lkZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIHJmZW5jZWFmdGVyaW5zaWRlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvKF5gYGBbYS16XSpcXG4pfChgYGAkKS9nLCAnJyk7XG4gICAgICB9IGVsc2UgaWYgKC9eWyBdezAsM31cXFMvbS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmZlbmNpbmcpIHtcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9ICdgYGBcXG4nO1xuICAgICAgICAgIGNodW5rcy5hZnRlciA9ICdcXG5gYGAnICsgY2h1bmtzLmFmdGVyO1xuICAgICAgICB9IGVsc2UgaWYgKG5ld2xpbmVkKSB7XG4gICAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXi9nbSwgJyAgICAnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9ICcgICAgJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXig/OlsgXXs0fXxbIF17MCwzfVxcdHxgYGBbYS16XSopL2dtLCAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWVyZ2VTZWxlY3Rpb24gKGFsbCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGFsbCArIGNodW5rcy5zZWxlY3Rpb247IHJldHVybiAnJztcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGhlYWRpbmcgKGNodW5rcykge1xuICB2YXIgbGV2ZWwgPSAwO1xuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uXG4gICAgLnJlcGxhY2UoL1xccysvZywgJyAnKVxuICAgIC5yZXBsYWNlKC8oXlxccyt8XFxzKyQpL2csICcnKTtcblxuICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSAnIyAnO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5oZWFkaW5nO1xuICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICBjaHVua3Muc2tpcCh7IGJlZm9yZTogMSwgYWZ0ZXI6IDEgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY2h1bmtzLmZpbmRUYWdzKC8jK1sgXSovLCAvWyBdKiMrLyk7XG5cbiAgaWYgKC8jKy8udGVzdChjaHVua3Muc3RhcnRUYWcpKSB7XG4gICAgbGV2ZWwgPSBSZWdFeHAubGFzdE1hdGNoLmxlbmd0aDtcbiAgfVxuXG4gIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnJztcbiAgY2h1bmtzLmZpbmRUYWdzKG51bGwsIC9cXHM/KC0rfD0rKS8pO1xuXG4gIGlmICgvPSsvLnRlc3QoY2h1bmtzLmVuZFRhZykpIHtcbiAgICBsZXZlbCA9IDE7XG4gIH1cblxuICBpZiAoLy0rLy50ZXN0KGNodW5rcy5lbmRUYWcpKSB7XG4gICAgbGV2ZWwgPSAyO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICBjaHVua3Muc2tpcCh7IGJlZm9yZTogMSwgYWZ0ZXI6IDEgfSk7XG5cbiAgdmFyIGxldmVsVG9DcmVhdGUgPSBsZXZlbCA8IDIgPyA0IDogbGV2ZWwgLSAxO1xuICBpZiAobGV2ZWxUb0NyZWF0ZSA+IDApIHtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSBtYW55KCcjJywgbGV2ZWxUb0NyZWF0ZSkgKyAnICc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoZWFkaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBociAoY2h1bmtzKSB7XG4gIGNodW5rcy5zdGFydFRhZyA9ICctLS0tLS0tLS0tXFxuJztcbiAgY2h1bmtzLnNlbGVjdGlvbiA9ICcnO1xuICBjaHVua3Muc2tpcCh7IGxlZnQ6IDIsIHJpZ2h0OiAxLCBhbnk6IHRydWUgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaHI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBvbmNlID0gcmVxdWlyZSgnLi4vb25jZScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcGFyc2VMaW5rSW5wdXQgPSByZXF1aXJlKCcuLi9jaHVua3MvcGFyc2VMaW5rSW5wdXQnKTtcbnZhciByZGVmaW5pdGlvbnMgPSAvXlsgXXswLDN9XFxbKCg/OmF0dGFjaG1lbnQtKT9cXGQrKVxcXTpbIFxcdF0qXFxuP1sgXFx0XSo8PyhcXFMrPyk+P1sgXFx0XSpcXG4/WyBcXHRdKig/OihcXG4qKVtcIihdKC4rPylbXCIpXVsgXFx0XSopPyg/Olxcbit8JCkvZ207XG52YXIgcmF0dGFjaG1lbnQgPSAvXmF0dGFjaG1lbnQtKFxcZCspJC9pO1xuXG5mdW5jdGlvbiBleHRyYWN0RGVmaW5pdGlvbnMgKHRleHQsIGRlZmluaXRpb25zKSB7XG4gIHJkZWZpbml0aW9ucy5sYXN0SW5kZXggPSAwO1xuICByZXR1cm4gdGV4dC5yZXBsYWNlKHJkZWZpbml0aW9ucywgcmVwbGFjZXIpO1xuXG4gIGZ1bmN0aW9uIHJlcGxhY2VyIChhbGwsIGlkLCBsaW5rLCBuZXdsaW5lcywgdGl0bGUpIHtcbiAgICBkZWZpbml0aW9uc1tpZF0gPSBhbGwucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgaWYgKG5ld2xpbmVzKSB7XG4gICAgICBkZWZpbml0aW9uc1tpZF0gPSBhbGwucmVwbGFjZSgvW1wiKF0oLis/KVtcIildJC8sICcnKTtcbiAgICAgIHJldHVybiBuZXdsaW5lcyArIHRpdGxlO1xuICAgIH1cbiAgICByZXR1cm4gJyc7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVzaERlZmluaXRpb24gKG9wdGlvbnMpIHtcbiAgdmFyIGNodW5rcyA9IG9wdGlvbnMuY2h1bmtzO1xuICB2YXIgZGVmaW5pdGlvbiA9IG9wdGlvbnMuZGVmaW5pdGlvbjtcbiAgdmFyIGF0dGFjaG1lbnQgPSBvcHRpb25zLmF0dGFjaG1lbnQ7XG4gIHZhciByZWdleCA9IC8oXFxbKSgoPzpcXFtbXlxcXV0qXFxdfFteXFxbXFxdXSkqKShcXF1bIF0/KD86XFxuWyBdKik/XFxbKSgoPzphdHRhY2htZW50LSk/XFxkKykoXFxdKS9nO1xuICB2YXIgYW5jaG9yID0gMDtcbiAgdmFyIGRlZmluaXRpb25zID0ge307XG4gIHZhciBmb290bm90ZXMgPSBbXTtcblxuICBjaHVua3MuYmVmb3JlID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5iZWZvcmUsIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGV4dHJhY3REZWZpbml0aW9ucyhjaHVua3Muc2VsZWN0aW9uLCBkZWZpbml0aW9ucyk7XG4gIGNodW5rcy5hZnRlciA9IGV4dHJhY3REZWZpbml0aW9ucyhjaHVua3MuYWZ0ZXIsIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG5cbiAgaWYgKGRlZmluaXRpb24pIHtcbiAgICBpZiAoIWF0dGFjaG1lbnQpIHsgcHVzaEFuY2hvcihkZWZpbml0aW9uKTsgfVxuICB9IGVsc2Uge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UocmVnZXgsIGdldExpbmspO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IGFuY2hvcjtcblxuICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG5cbiAgaWYgKGNodW5rcy5hZnRlcikge1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKC9cXG4qJC8sICcnKTtcbiAgfVxuICBpZiAoIWNodW5rcy5hZnRlcikge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcbiokLywgJycpO1xuICB9XG5cbiAgYW5jaG9yID0gMDtcbiAgT2JqZWN0LmtleXMoZGVmaW5pdGlvbnMpLmZvckVhY2gocHVzaEF0dGFjaG1lbnRzKTtcblxuICBpZiAoYXR0YWNobWVudCkge1xuICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbik7XG4gIH1cbiAgY2h1bmtzLmFmdGVyICs9ICdcXG5cXG4nICsgZm9vdG5vdGVzLmpvaW4oJ1xcbicpO1xuXG4gIHJldHVybiByZXN1bHQ7XG5cbiAgZnVuY3Rpb24gcHVzaEF0dGFjaG1lbnRzIChkZWZpbml0aW9uKSB7XG4gICAgaWYgKHJhdHRhY2htZW50LnRlc3QoZGVmaW5pdGlvbikpIHtcbiAgICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hBbmNob3IgKGRlZmluaXRpb24pIHtcbiAgICBhbmNob3IrKztcbiAgICBkZWZpbml0aW9uID0gZGVmaW5pdGlvbi5yZXBsYWNlKC9eWyBdezAsM31cXFsoYXR0YWNobWVudC0pPyhcXGQrKVxcXTovLCAnICBbJDEnICsgYW5jaG9yICsgJ106Jyk7XG4gICAgZm9vdG5vdGVzLnB1c2goZGVmaW5pdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMaW5rIChhbGwsIGJlZm9yZSwgaW5uZXIsIGFmdGVySW5uZXIsIGRlZmluaXRpb24sIGVuZCkge1xuICAgIGlubmVyID0gaW5uZXIucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG4gICAgaWYgKGRlZmluaXRpb25zW2RlZmluaXRpb25dKSB7XG4gICAgICBwdXNoQW5jaG9yKGRlZmluaXRpb25zW2RlZmluaXRpb25dKTtcbiAgICAgIHJldHVybiBiZWZvcmUgKyBpbm5lciArIGFmdGVySW5uZXIgKyBhbmNob3IgKyBlbmQ7XG4gICAgfVxuICAgIHJldHVybiBhbGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQgKGNodW5rcywgb3B0aW9ucykge1xuICB2YXIgdHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgdmFyIGltYWdlID0gdHlwZSA9PT0gJ2ltYWdlJztcbiAgdmFyIHJlc3VtZTtcblxuICBjaHVua3MudHJpbSgpO1xuICBjaHVua3MuZmluZFRhZ3MoL1xccyohP1xcWy8sIC9cXF1bIF0/KD86XFxuWyBdKik/KFxcWy4qP1xcXSk/Lyk7XG5cbiAgaWYgKGNodW5rcy5lbmRUYWcubGVuZ3RoID4gMSAmJiBjaHVua3Muc3RhcnRUYWcubGVuZ3RoID4gMCkge1xuICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5zdGFydFRhZy5yZXBsYWNlKC8hP1xcWy8sICcnKTtcbiAgICBjaHVua3MuZW5kVGFnID0gJyc7XG4gICAgcHVzaERlZmluaXRpb24oeyBjaHVua3M6IGNodW5rcyB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnN0YXJ0VGFnICsgY2h1bmtzLnNlbGVjdGlvbiArIGNodW5rcy5lbmRUYWc7XG4gIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnJztcblxuICBpZiAoL1xcblxcbi8udGVzdChjaHVua3Muc2VsZWN0aW9uKSkge1xuICAgIHB1c2hEZWZpbml0aW9uKHsgY2h1bmtzOiBjaHVua3MgfSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJlc3VtZSA9IHRoaXMuYXN5bmMoKTtcblxuICBvcHRpb25zLnByb21wdHMuY2xvc2UoKTtcbiAgKG9wdGlvbnMucHJvbXB0c1t0eXBlXSB8fCBvcHRpb25zLnByb21wdHMubGluaykob3B0aW9ucywgb25jZShyZXNvbHZlZCkpO1xuXG4gIGZ1bmN0aW9uIHJlc29sdmVkIChyZXN1bHQpIHtcbiAgICB2YXIgbGlua3MgPSByZXN1bHRcbiAgICAgIC5kZWZpbml0aW9uc1xuICAgICAgLm1hcChwYXJzZUxpbmtJbnB1dClcbiAgICAgIC5maWx0ZXIobG9uZyk7XG5cbiAgICBsaW5rcy5mb3JFYWNoKHJlbmRlckxpbmspO1xuICAgIHJlc3VtZSgpO1xuXG4gICAgZnVuY3Rpb24gcmVuZGVyTGluayAobGluaywgaSkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICgnICcgKyBjaHVua3Muc2VsZWN0aW9uKS5yZXBsYWNlKC8oW15cXFxcXSg/OlxcXFxcXFxcKSopKD89W1tcXF1dKS9nLCAnJDFcXFxcJykuc3Vic3RyKDEpO1xuXG4gICAgICB2YXIga2V5ID0gcmVzdWx0LmF0dGFjaG1lbnQgPyAnICBbYXR0YWNobWVudC05OTk5XTogJyA6ICcgWzk5OTldOiAnO1xuICAgICAgdmFyIGRlZmluaXRpb24gPSBrZXkgKyBsaW5rLmhyZWYgKyAobGluay50aXRsZSA/ICcgXCInICsgbGluay50aXRsZSArICdcIicgOiAnJyk7XG4gICAgICB2YXIgYW5jaG9yID0gcHVzaERlZmluaXRpb24oe1xuICAgICAgICBjaHVua3M6IGNodW5rcyxcbiAgICAgICAgZGVmaW5pdGlvbjogZGVmaW5pdGlvbixcbiAgICAgICAgYXR0YWNobWVudDogcmVzdWx0LmF0dGFjaG1lbnRcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3VsdC5hdHRhY2htZW50KSB7XG4gICAgICAgIGFkZCgpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBhZGQgKCkge1xuICAgICAgICBjaHVua3Muc3RhcnRUYWcgPSBpbWFnZSA/ICchWycgOiAnWyc7XG4gICAgICAgIGNodW5rcy5lbmRUYWcgPSAnXVsnICsgYW5jaG9yICsgJ10nO1xuXG4gICAgICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpIDwgbGlua3MubGVuZ3RoIC0gMSkgeyAvLyBoYXMgbXVsdGlwbGUgbGlua3MsIG5vdCB0aGUgbGFzdCBvbmVcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9IGNodW5rcy5zdGFydFRhZyArIGNodW5rcy5zZWxlY3Rpb24gKyBjaHVua3MuZW5kVGFnICsgJ1xcbic7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb25nIChsaW5rKSB7XG4gICAgICByZXR1cm4gbGluay5ocmVmLmxlbmd0aCA+IDA7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgd3JhcHBpbmcgPSByZXF1aXJlKCcuL3dyYXBwaW5nJyk7XG52YXIgc2V0dGluZ3MgPSByZXF1aXJlKCcuL3NldHRpbmdzJyk7XG52YXIgcnByZXZpb3VzID0gLyhcXG58XikoKFsgXXswLDN9KFsqKy1dfFxcZCtbLl0pWyBcXHRdKy4qKShcXG4uK3xcXG57Mix9KFsqKy1dLip8XFxkK1suXSlbIFxcdF0rLip8XFxuezIsfVsgXFx0XStcXFMuKikqKVxcbiokLztcbnZhciBybmV4dCA9IC9eXFxuKigoWyBdezAsM30oWyorLV18XFxkK1suXSlbIFxcdF0rLiopKFxcbi4rfFxcbnsyLH0oWyorLV0uKnxcXGQrWy5dKVsgXFx0XSsuKnxcXG57Mix9WyBcXHRdK1xcUy4qKSopXFxuKi87XG52YXIgcmJ1bGxldHR5cGUgPSAvXlxccyooWyorLV0pLztcbnZhciByc2tpcHBlciA9IC9bXlxcbl1cXG5cXG5bXlxcbl0vO1xuXG5mdW5jdGlvbiBwYWQgKHRleHQpIHtcbiAgcmV0dXJuICcgJyArIHRleHQgKyAnICc7XG59XG5cbmZ1bmN0aW9uIGxpc3QgKGNodW5rcywgb3JkZXJlZCkge1xuICB2YXIgYnVsbGV0ID0gJy0nO1xuICB2YXIgbnVtID0gMTtcbiAgdmFyIGRpZ2l0YWw7XG4gIHZhciBiZWZvcmVTa2lwID0gMTtcbiAgdmFyIGFmdGVyU2tpcCA9IDE7XG5cbiAgY2h1bmtzLmZpbmRUYWdzKC8oXFxufF4pKlsgXXswLDN9KFsqKy1dfFxcZCtbLl0pXFxzKy8sIG51bGwpO1xuXG4gIGlmIChjaHVua3MuYmVmb3JlICYmICEvXFxuJC8udGVzdChjaHVua3MuYmVmb3JlKSAmJiAhL15cXG4vLnRlc3QoY2h1bmtzLnN0YXJ0VGFnKSkge1xuICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLnN0YXJ0VGFnO1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcnO1xuICB9XG5cbiAgaWYgKGNodW5rcy5zdGFydFRhZykge1xuICAgIGRpZ2l0YWwgPSAvXFxkK1suXS8udGVzdChjaHVua3Muc3RhcnRUYWcpO1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcnO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcblsgXXs0fS9nLCAnXFxuJyk7XG4gICAgd3JhcHBpbmcudW53cmFwKGNodW5rcyk7XG4gICAgY2h1bmtzLnNraXAoKTtcblxuICAgIGlmIChkaWdpdGFsKSB7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShybmV4dCwgZ2V0UHJlZml4ZWRJdGVtKTtcbiAgICB9XG4gICAgaWYgKG9yZGVyZWQgPT09IGRpZ2l0YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJwcmV2aW91cywgYmVmb3JlUmVwbGFjZXIpO1xuXG4gIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5saXN0aXRlbTtcbiAgfVxuXG4gIHZhciBwcmVmaXggPSBuZXh0QnVsbGV0KCk7XG4gIHZhciBzcGFjZXMgPSBtYW55KCcgJywgcHJlZml4Lmxlbmd0aCk7XG5cbiAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2Uocm5leHQsIGFmdGVyUmVwbGFjZXIpO1xuICBjaHVua3MudHJpbSh0cnVlKTtcbiAgY2h1bmtzLnNraXAoeyBiZWZvcmU6IGJlZm9yZVNraXAsIGFmdGVyOiBhZnRlclNraXAsIGFueTogdHJ1ZSB9KTtcbiAgY2h1bmtzLnN0YXJ0VGFnID0gcHJlZml4O1xuICB3cmFwcGluZy53cmFwKGNodW5rcywgc2V0dGluZ3MubGluZUxlbmd0aCAtIHByZWZpeC5sZW5ndGgpO1xuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9cXG4vZywgJ1xcbicgKyBzcGFjZXMpO1xuXG4gIGZ1bmN0aW9uIGJlZm9yZVJlcGxhY2VyICh0ZXh0KSB7XG4gICAgaWYgKHJidWxsZXR0eXBlLnRlc3QodGV4dCkpIHtcbiAgICAgIGJ1bGxldCA9IFJlZ0V4cC4kMTtcbiAgICB9XG4gICAgYmVmb3JlU2tpcCA9IHJza2lwcGVyLnRlc3QodGV4dCkgPyAxIDogMDtcbiAgICByZXR1cm4gZ2V0UHJlZml4ZWRJdGVtKHRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gYWZ0ZXJSZXBsYWNlciAodGV4dCkge1xuICAgIGFmdGVyU2tpcCA9IHJza2lwcGVyLnRlc3QodGV4dCkgPyAxIDogMDtcbiAgICByZXR1cm4gZ2V0UHJlZml4ZWRJdGVtKHRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gbmV4dEJ1bGxldCAoKSB7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIHJldHVybiBwYWQoKG51bSsrKSArICcuJyk7XG4gICAgfVxuICAgIHJldHVybiBwYWQoYnVsbGV0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFByZWZpeGVkSXRlbSAodGV4dCkge1xuICAgIHZhciBybWFya2VycyA9IC9eWyBdezAsM30oWyorLV18XFxkK1suXSlcXHMvZ207XG4gICAgcmV0dXJuIHRleHQucmVwbGFjZShybWFya2VycywgbmV4dEJ1bGxldCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbGluZUxlbmd0aDogNzJcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBwcmVmaXhlcyA9ICcoPzpcXFxcc3s0LH18XFxcXHMqPnxcXFxccyotXFxcXHMrfFxcXFxzKlxcXFxkK1xcXFwufD18XFxcXCt8LXxffFxcXFwqfCN8XFxcXHMqXFxcXFtbXlxcbl1dK1xcXFxdOiknO1xudmFyIHJsZWFkaW5ncHJlZml4ZXMgPSBuZXcgUmVnRXhwKCdeJyArIHByZWZpeGVzLCAnJyk7XG52YXIgcnRleHQgPSBuZXcgUmVnRXhwKCcoW15cXFxcbl0pXFxcXG4oPyEoXFxcXG58JyArIHByZWZpeGVzICsgJykpJywgJ2cnKTtcbnZhciBydHJhaWxpbmdzcGFjZXMgPSAvXFxzKyQvO1xuXG5mdW5jdGlvbiB3cmFwIChjaHVua3MsIGxlbikge1xuICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCcoLnsxLCcgKyBsZW4gKyAnfSkoICt8JFxcXFxuPyknLCAnZ20nKTtcblxuICB1bndyYXAoY2h1bmtzKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb25cbiAgICAucmVwbGFjZShyZWdleCwgcmVwbGFjZXIpXG4gICAgLnJlcGxhY2UocnRyYWlsaW5nc3BhY2VzLCAnJyk7XG5cbiAgZnVuY3Rpb24gcmVwbGFjZXIgKGxpbmUsIG1hcmtlZCkge1xuICAgIHJldHVybiBybGVhZGluZ3ByZWZpeGVzLnRlc3QobGluZSkgPyBsaW5lIDogbWFya2VkICsgJ1xcbic7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW53cmFwIChjaHVua3MpIHtcbiAgcnRleHQubGFzdEluZGV4ID0gMDtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShydGV4dCwgJyQxICQyJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB3cmFwOiB3cmFwLFxuICB1bndyYXA6IHVud3JhcFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gVGV4dFN1cmZhY2UgKHRleHRhcmVhKSB7XG4gIHRoaXMudGV4dGFyZWEgPSB0ZXh0YXJlYTtcbn1cblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLmZvY3VzID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMudGV4dGFyZWEudmFsdWU7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IHZhbHVlO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnRleHRhcmVhO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLndyaXRlU2VsZWN0aW9uID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHRoaXMudGV4dGFyZWEuZm9jdXMoKTtcbiAgdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9IHN0YXRlLnN0YXJ0O1xuICB0aGlzLnRleHRhcmVhLnNlbGVjdGlvbkVuZCA9IHN0YXRlLmVuZDtcbiAgdGhpcy50ZXh0YXJlYS5zY3JvbGxUb3AgPSBzdGF0ZS5zY3JvbGxUb3A7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUucmVhZFNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICBzdGF0ZS5zdGFydCA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQ7XG4gIHN0YXRlLmVuZCA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uRW5kO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0U3VyZmFjZTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciByb3BlbiA9IC9eKDxbXj5dKyg/OiBbXj5dKik/PikvO1xudmFyIHJjbG9zZSA9IC8oPFxcL1tePl0rPikkLztcblxuZnVuY3Rpb24gV3lzaXd5Z1N1cmZhY2UgKGVkaXRhYmxlKSB7XG4gIHRoaXMuZWRpdGFibGUgPSBlZGl0YWJsZTtcbn1cblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLmZvY3VzID0gZnVuY3Rpb24gKGZvcmNlSW1tZWRpYXRlKSB7XG4gIGlmKGZvcmNlSW1tZWRpYXRlKSB7XG4gICAgdGhpcy5lZGl0YWJsZS5mb2N1cygpO1xuICB9IGVsc2Uge1xuICAgIHNldFRpbWVvdXQodGhpcy5lZGl0YWJsZS5mb2N1cy5iaW5kKHRoaXMuZWRpdGFibGUpLCAwKTtcbiAgfVxufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVkaXRhYmxlLmlubmVySFRNTDtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB0aGlzLmVkaXRhYmxlLmlubmVySFRNTCA9IHZhbHVlO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVkaXRhYmxlO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLndyaXRlU2VsZWN0aW9uID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciBjaHVua3MgPSBzdGF0ZS5jYWNoZWRDaHVua3MgfHwgc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gIHZhciBzdGFydCA9IHVuZXNjYXBlVGV4dChjaHVua3MuYmVmb3JlKS5sZW5ndGg7XG4gIHZhciBlbmQgPSBzdGFydCArIHVuZXNjYXBlVGV4dChjaHVua3Muc2VsZWN0aW9uKS5sZW5ndGg7XG4gIHZhciBwID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciBzdGFydFJhbmdlU2V0ID0gZmFsc2U7XG4gIHZhciBlbmRSYW5nZVNldCA9IGZhbHNlO1xuXG4gIHdhbGsodGhpcy5lZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgdGhpcy5lZGl0YWJsZS5mb2N1cygpO1xuICB2YXIgc2VsZWN0aW9uID0gZG9jLmdldFNlbGVjdGlvbigpO1xuICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHNlbGVjdGlvbi5hZGRSYW5nZShwKTtcblxuICBmdW5jdGlvbiBwZWVrIChjb250ZXh0LCBlbCkge1xuICAgIHZhciBjdXJzb3IgPSB1bmVzY2FwZVRleHQoY29udGV4dC50ZXh0KS5sZW5ndGg7XG4gICAgdmFyIGNvbnRlbnQgPSByZWFkTm9kZShlbCwgZmFsc2UpLmxlbmd0aDtcbiAgICB2YXIgc3VtID0gY3Vyc29yICsgY29udGVudDtcbiAgICBpZiAoIXN0YXJ0UmFuZ2VTZXQgJiYgc3VtID49IHN0YXJ0KSB7XG4gICAgICBwLnNldFN0YXJ0KGVsLCBib3VuZGVkKHN0YXJ0IC0gY3Vyc29yKSk7XG4gICAgICBzdGFydFJhbmdlU2V0ID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCFlbmRSYW5nZVNldCAmJiBzdW0gPj0gZW5kKSB7XG4gICAgICBwLnNldEVuZChlbCwgYm91bmRlZChlbmQgLSBjdXJzb3IpKTtcbiAgICAgIGVuZFJhbmdlU2V0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBib3VuZGVkIChvZmZzZXQpIHtcbiAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbihjb250ZW50LCBvZmZzZXQpKTtcbiAgICB9XG4gIH1cbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5yZWFkU2VsZWN0aW9uID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciBzZWwgPSBkb2MuZ2V0U2VsZWN0aW9uKCk7XG4gIHZhciBkaXN0YW5jZSA9IHdhbGsodGhpcy5lZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgdmFyIHN0YXJ0ID0gZGlzdGFuY2Uuc3RhcnQgfHwgMDtcbiAgdmFyIGVuZCA9IGRpc3RhbmNlLmVuZCB8fCAwO1xuXG4gIHN0YXRlLnRleHQgPSBkaXN0YW5jZS50ZXh0O1xuXG4gIGlmIChlbmQgPiBzdGFydCkge1xuICAgIHN0YXRlLnN0YXJ0ID0gc3RhcnQ7XG4gICAgc3RhdGUuZW5kID0gZW5kO1xuICB9IGVsc2Uge1xuICAgIHN0YXRlLnN0YXJ0ID0gZW5kO1xuICAgIHN0YXRlLmVuZCA9IHN0YXJ0O1xuICB9XG5cbiAgZnVuY3Rpb24gcGVlayAoY29udGV4dCwgZWwpIHtcbiAgICB2YXIgZWxUZXh0ID0gKGVsLnRleHRDb250ZW50IHx8IGVsLmlubmVyVGV4dCB8fCAnJyk7XG5cbiAgICBpZiAoZWwgPT09IHNlbC5hbmNob3JOb2RlKSB7XG4gICAgICBjb250ZXh0LnN0YXJ0ID0gY29udGV4dC50ZXh0Lmxlbmd0aCArIGVzY2FwZU5vZGVUZXh0KGVsVGV4dC5zdWJzdHJpbmcoMCwgc2VsLmFuY2hvck9mZnNldCkpLmxlbmd0aDtcbiAgICB9XG4gICAgaWYgKGVsID09PSBzZWwuZm9jdXNOb2RlKSB7XG4gICAgICBjb250ZXh0LmVuZCA9IGNvbnRleHQudGV4dC5sZW5ndGggKyBlc2NhcGVOb2RlVGV4dChlbFRleHQuc3Vic3RyaW5nKDAsIHNlbC5mb2N1c09mZnNldCkpLmxlbmd0aDtcbiAgICB9XG4gIH1cbn07XG5cbmZ1bmN0aW9uIHdhbGsgKGVsLCBwZWVrLCBjdHgsIHNpYmxpbmdzKSB7XG4gIHZhciBjb250ZXh0ID0gY3R4IHx8IHsgdGV4dDogJycgfTtcblxuICBpZiAoIWVsKSB7XG4gICAgcmV0dXJuIGNvbnRleHQ7XG4gIH1cblxuICB2YXIgZWxOb2RlID0gZWwubm9kZVR5cGUgPT09IDE7XG4gIHZhciB0ZXh0Tm9kZSA9IGVsLm5vZGVUeXBlID09PSAzO1xuXG4gIHBlZWsoY29udGV4dCwgZWwpO1xuXG4gIGlmICh0ZXh0Tm9kZSkge1xuICAgIGNvbnRleHQudGV4dCArPSByZWFkTm9kZShlbCk7XG4gIH1cbiAgaWYgKGVsTm9kZSkge1xuICAgIGlmIChlbC5vdXRlckhUTUwubWF0Y2gocm9wZW4pKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChlbC5jaGlsZE5vZGVzKS5mb3JFYWNoKHdhbGtDaGlsZHJlbik7XG4gICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyY2xvc2UpKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgfVxuICBpZiAoc2libGluZ3MgIT09IGZhbHNlICYmIGVsLm5leHRTaWJsaW5nKSB7XG4gICAgcmV0dXJuIHdhbGsoZWwubmV4dFNpYmxpbmcsIHBlZWssIGNvbnRleHQpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xuXG4gIGZ1bmN0aW9uIHdhbGtDaGlsZHJlbiAoY2hpbGQpIHtcbiAgICB3YWxrKGNoaWxkLCBwZWVrLCBjb250ZXh0LCBmYWxzZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZE5vZGUgKGVsLCBlc2NhcGUpIHtcbiAgaWYoZWwubm9kZVR5cGUgPT09IDMpIHtcbiAgICBpZihlc2NhcGUgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnO1xuICAgIH1cblxuICAgIHJldHVybiBlc2NhcGVOb2RlVGV4dChlbCk7XG4gIH1cbiAgcmV0dXJuICcnO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVOb2RlVGV4dCAoZWwpIHtcbiAgZWwgPSBlbCB8fCAnJztcbiAgaWYoZWwubm9kZVR5cGUgPT09IDMpIHtcbiAgICBlbCA9IGVsLmNsb25lTm9kZSgpO1xuICB9IGVsc2Uge1xuICAgIGVsID0gZG9jLmNyZWF0ZVRleHROb2RlKGVsKTtcbiAgfVxuXG4gIC8vIFVzaW5nIGJyb3dzZXIgZXNjYXBpbmcgdG8gY2xlYW4gdXAgYW55IHNwZWNpYWwgY2hhcmFjdGVyc1xuICB2YXIgdG9UZXh0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b1RleHQuYXBwZW5kQ2hpbGQoZWwpO1xuICByZXR1cm4gdG9UZXh0LmlubmVySFRNTCB8fCAnJztcbn1cblxuZnVuY3Rpb24gdW5lc2NhcGVUZXh0IChlbCkge1xuICBpZihlbC5ub2RlVHlwZSkge1xuICAgIHJldHVybiBlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJyc7XG4gIH1cblxuICB2YXIgdG9UZXh0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b1RleHQudGV4dENvbnRlbnQgPSBlbDtcbiAgcmV0dXJuIHRvVGV4dC50ZXh0Q29udGVudDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBXeXNpd3lnU3VyZmFjZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5dGIyUmxjeTkzZVhOcGQzbG5MM2Q1YzJsM2VXZFRkWEptWVdObExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCa2IyTWdQU0JuYkc5aVlXd3VaRzlqZFcxbGJuUTdYRzUyWVhJZ2NtOXdaVzRnUFNBdlhpZzhXMTQrWFNzb1B6b2dXMTQrWFNvcFB6NHBMenRjYm5aaGNpQnlZMnh2YzJVZ1BTQXZLRHhjWEM5YlhqNWRLejRwSkM4N1hHNWNibVoxYm1OMGFXOXVJRmQ1YzJsM2VXZFRkWEptWVdObElDaGxaR2wwWVdKc1pTa2dlMXh1SUNCMGFHbHpMbVZrYVhSaFlteGxJRDBnWldScGRHRmliR1U3WEc1OVhHNWNibGQ1YzJsM2VXZFRkWEptWVdObExuQnliM1J2ZEhsd1pTNW1iMk4xY3lBOUlHWjFibU4wYVc5dUlDaG1iM0pqWlVsdGJXVmthV0YwWlNrZ2UxeHVJQ0JwWmlobWIzSmpaVWx0YldWa2FXRjBaU2tnZTF4dUlDQWdJSFJvYVhNdVpXUnBkR0ZpYkdVdVptOWpkWE1vS1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCelpYUlVhVzFsYjNWMEtIUm9hWE11WldScGRHRmliR1V1Wm05amRYTXVZbWx1WkNoMGFHbHpMbVZrYVhSaFlteGxLU3dnTUNrN1hHNGdJSDFjYm4wN1hHNWNibGQ1YzJsM2VXZFRkWEptWVdObExuQnliM1J2ZEhsd1pTNXlaV0ZrSUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNCeVpYUjFjbTRnZEdocGN5NWxaR2wwWVdKc1pTNXBibTVsY2toVVRVdzdYRzU5TzF4dVhHNVhlWE5wZDNsblUzVnlabUZqWlM1d2NtOTBiM1I1Y0dVdWQzSnBkR1VnUFNCbWRXNWpkR2x2YmlBb2RtRnNkV1VwSUh0Y2JpQWdkR2hwY3k1bFpHbDBZV0pzWlM1cGJtNWxja2hVVFV3Z1BTQjJZV3gxWlR0Y2JuMDdYRzVjYmxkNWMybDNlV2RUZFhKbVlXTmxMbkJ5YjNSdmRIbHdaUzVqZFhKeVpXNTBJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1bFpHbDBZV0pzWlR0Y2JuMDdYRzVjYmxkNWMybDNlV2RUZFhKbVlXTmxMbkJ5YjNSdmRIbHdaUzUzY21sMFpWTmxiR1ZqZEdsdmJpQTlJR1oxYm1OMGFXOXVJQ2h6ZEdGMFpTa2dlMXh1SUNCMllYSWdZMmgxYm10eklEMGdjM1JoZEdVdVkyRmphR1ZrUTJoMWJtdHpJSHg4SUhOMFlYUmxMbWRsZEVOb2RXNXJjeWdwTzF4dUlDQjJZWElnYzNSaGNuUWdQU0IxYm1WelkyRndaVlJsZUhRb1kyaDFibXR6TG1KbFptOXlaU2t1YkdWdVozUm9PMXh1SUNCMllYSWdaVzVrSUQwZ2MzUmhjblFnS3lCMWJtVnpZMkZ3WlZSbGVIUW9ZMmgxYm10ekxuTmxiR1ZqZEdsdmJpa3ViR1Z1WjNSb08xeHVJQ0IyWVhJZ2NDQTlJR1J2WXk1amNtVmhkR1ZTWVc1blpTZ3BPMXh1SUNCMllYSWdjM1JoY25SU1lXNW5aVk5sZENBOUlHWmhiSE5sTzF4dUlDQjJZWElnWlc1a1VtRnVaMlZUWlhRZ1BTQm1ZV3h6WlR0Y2JseHVJQ0IzWVd4cktIUm9hWE11WldScGRHRmliR1V1Wm1seWMzUkRhR2xzWkN3Z2NHVmxheWs3WEc0Z0lIUm9hWE11WldScGRHRmliR1V1Wm05amRYTW9LVHRjYmlBZ2RtRnlJSE5sYkdWamRHbHZiaUE5SUdSdll5NW5aWFJUWld4bFkzUnBiMjRvS1R0Y2JpQWdjMlZzWldOMGFXOXVMbkpsYlc5MlpVRnNiRkpoYm1kbGN5Z3BPMXh1SUNCelpXeGxZM1JwYjI0dVlXUmtVbUZ1WjJVb2NDazdYRzVjYmlBZ1puVnVZM1JwYjI0Z2NHVmxheUFvWTI5dWRHVjRkQ3dnWld3cElIdGNiaUFnSUNCMllYSWdZM1Z5YzI5eUlEMGdkVzVsYzJOaGNHVlVaWGgwS0dOdmJuUmxlSFF1ZEdWNGRDa3ViR1Z1WjNSb08xeHVJQ0FnSUhaaGNpQmpiMjUwWlc1MElEMGdjbVZoWkU1dlpHVW9aV3dzSUdaaGJITmxLUzVzWlc1bmRHZzdYRzRnSUNBZ2RtRnlJSE4xYlNBOUlHTjFjbk52Y2lBcklHTnZiblJsYm5RN1hHNGdJQ0FnYVdZZ0tDRnpkR0Z5ZEZKaGJtZGxVMlYwSUNZbUlITjFiU0ErUFNCemRHRnlkQ2tnZTF4dUlDQWdJQ0FnY0M1elpYUlRkR0Z5ZENobGJDd2dZbTkxYm1SbFpDaHpkR0Z5ZENBdElHTjFjbk52Y2lrcE8xeHVJQ0FnSUNBZ2MzUmhjblJTWVc1blpWTmxkQ0E5SUhSeWRXVTdYRzRnSUNBZ2ZWeHVJQ0FnSUdsbUlDZ2haVzVrVW1GdVoyVlRaWFFnSmlZZ2MzVnRJRDQ5SUdWdVpDa2dlMXh1SUNBZ0lDQWdjQzV6WlhSRmJtUW9aV3dzSUdKdmRXNWtaV1FvWlc1a0lDMGdZM1Z5YzI5eUtTazdYRzRnSUNBZ0lDQmxibVJTWVc1blpWTmxkQ0E5SUhSeWRXVTdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ1puVnVZM1JwYjI0Z1ltOTFibVJsWkNBb2IyWm1jMlYwS1NCN1hHNGdJQ0FnSUNCeVpYUjFjbTRnVFdGMGFDNXRZWGdvTUN3Z1RXRjBhQzV0YVc0b1kyOXVkR1Z1ZEN3Z2IyWm1jMlYwS1NrN1hHNGdJQ0FnZlZ4dUlDQjlYRzU5TzF4dVhHNVhlWE5wZDNsblUzVnlabUZqWlM1d2NtOTBiM1I1Y0dVdWNtVmhaRk5sYkdWamRHbHZiaUE5SUdaMWJtTjBhVzl1SUNoemRHRjBaU2tnZTF4dUlDQjJZWElnYzJWc0lEMGdaRzlqTG1kbGRGTmxiR1ZqZEdsdmJpZ3BPMXh1SUNCMllYSWdaR2x6ZEdGdVkyVWdQU0IzWVd4cktIUm9hWE11WldScGRHRmliR1V1Wm1seWMzUkRhR2xzWkN3Z2NHVmxheWs3WEc0Z0lIWmhjaUJ6ZEdGeWRDQTlJR1JwYzNSaGJtTmxMbk4wWVhKMElIeDhJREE3WEc0Z0lIWmhjaUJsYm1RZ1BTQmthWE4wWVc1alpTNWxibVFnZkh3Z01EdGNibHh1SUNCemRHRjBaUzUwWlhoMElEMGdaR2x6ZEdGdVkyVXVkR1Y0ZER0Y2JseHVJQ0JwWmlBb1pXNWtJRDRnYzNSaGNuUXBJSHRjYmlBZ0lDQnpkR0YwWlM1emRHRnlkQ0E5SUhOMFlYSjBPMXh1SUNBZ0lITjBZWFJsTG1WdVpDQTlJR1Z1WkR0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCemRHRjBaUzV6ZEdGeWRDQTlJR1Z1WkR0Y2JpQWdJQ0J6ZEdGMFpTNWxibVFnUFNCemRHRnlkRHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUhCbFpXc2dLR052Ym5SbGVIUXNJR1ZzS1NCN1hHNGdJQ0FnZG1GeUlHVnNWR1Y0ZENBOUlDaGxiQzUwWlhoMFEyOXVkR1Z1ZENCOGZDQmxiQzVwYm01bGNsUmxlSFFnZkh3Z0p5Y3BPMXh1WEc0Z0lDQWdhV1lnS0dWc0lEMDlQU0J6Wld3dVlXNWphRzl5VG05a1pTa2dlMXh1SUNBZ0lDQWdZMjl1ZEdWNGRDNXpkR0Z5ZENBOUlHTnZiblJsZUhRdWRHVjRkQzVzWlc1bmRHZ2dLeUJsYzJOaGNHVk9iMlJsVkdWNGRDaGxiRlJsZUhRdWMzVmljM1J5YVc1bktEQXNJSE5sYkM1aGJtTm9iM0pQWm1aelpYUXBLUzVzWlc1bmRHZzdYRzRnSUNBZ2ZWeHVJQ0FnSUdsbUlDaGxiQ0E5UFQwZ2MyVnNMbVp2WTNWelRtOWtaU2tnZTF4dUlDQWdJQ0FnWTI5dWRHVjRkQzVsYm1RZ1BTQmpiMjUwWlhoMExuUmxlSFF1YkdWdVozUm9JQ3NnWlhOallYQmxUbTlrWlZSbGVIUW9aV3hVWlhoMExuTjFZbk4wY21sdVp5Z3dMQ0J6Wld3dVptOWpkWE5QWm1aelpYUXBLUzVzWlc1bmRHZzdYRzRnSUNBZ2ZWeHVJQ0I5WEc1OU8xeHVYRzVtZFc1amRHbHZiaUIzWVd4cklDaGxiQ3dnY0dWbGF5d2dZM1I0TENCemFXSnNhVzVuY3lrZ2UxeHVJQ0IyWVhJZ1kyOXVkR1Y0ZENBOUlHTjBlQ0I4ZkNCN0lIUmxlSFE2SUNjbklIMDdYRzVjYmlBZ2FXWWdLQ0ZsYkNrZ2UxeHVJQ0FnSUhKbGRIVnliaUJqYjI1MFpYaDBPMXh1SUNCOVhHNWNiaUFnZG1GeUlHVnNUbTlrWlNBOUlHVnNMbTV2WkdWVWVYQmxJRDA5UFNBeE8xeHVJQ0IyWVhJZ2RHVjRkRTV2WkdVZ1BTQmxiQzV1YjJSbFZIbHdaU0E5UFQwZ016dGNibHh1SUNCd1pXVnJLR052Ym5SbGVIUXNJR1ZzS1R0Y2JseHVJQ0JwWmlBb2RHVjRkRTV2WkdVcElIdGNiaUFnSUNCamIyNTBaWGgwTG5SbGVIUWdLejBnY21WaFpFNXZaR1VvWld3cE8xeHVJQ0I5WEc0Z0lHbG1JQ2hsYkU1dlpHVXBJSHRjYmlBZ0lDQnBaaUFvWld3dWIzVjBaWEpJVkUxTUxtMWhkR05vS0hKdmNHVnVLU2tnZXlCamIyNTBaWGgwTG5SbGVIUWdLejBnVW1WblJYaHdMaVF4T3lCOVhHNGdJQ0FnUVhKeVlYa3VjSEp2ZEc5MGVYQmxMbk5zYVdObExtTmhiR3dvWld3dVkyaHBiR1JPYjJSbGN5a3VabTl5UldGamFDaDNZV3hyUTJocGJHUnlaVzRwTzF4dUlDQWdJR2xtSUNobGJDNXZkWFJsY2toVVRVd3ViV0YwWTJnb2NtTnNiM05sS1NrZ2V5QmpiMjUwWlhoMExuUmxlSFFnS3owZ1VtVm5SWGh3TGlReE95QjlYRzRnSUgxY2JpQWdhV1lnS0hOcFlteHBibWR6SUNFOVBTQm1ZV3h6WlNBbUppQmxiQzV1WlhoMFUybGliR2x1WnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUIzWVd4cktHVnNMbTVsZUhSVGFXSnNhVzVuTENCd1pXVnJMQ0JqYjI1MFpYaDBLVHRjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdZMjl1ZEdWNGREdGNibHh1SUNCbWRXNWpkR2x2YmlCM1lXeHJRMmhwYkdSeVpXNGdLR05vYVd4a0tTQjdYRzRnSUNBZ2QyRnNheWhqYUdsc1pDd2djR1ZsYXl3Z1kyOXVkR1Y0ZEN3Z1ptRnNjMlVwTzF4dUlDQjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlISmxZV1JPYjJSbElDaGxiQ3dnWlhOallYQmxLU0I3WEc0Z0lHbG1LR1ZzTG01dlpHVlVlWEJsSUQwOVBTQXpLU0I3WEc0Z0lDQWdhV1lvWlhOallYQmxJRDA5UFNCbVlXeHpaU2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJR1ZzTG5SbGVIUkRiMjUwWlc1MElIeDhJR1ZzTG1sdWJtVnlWR1Y0ZENCOGZDQW5KenRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnlaWFIxY200Z1pYTmpZWEJsVG05a1pWUmxlSFFvWld3cE8xeHVJQ0I5WEc0Z0lISmxkSFZ5YmlBbkp6dGNibjFjYmx4dVpuVnVZM1JwYjI0Z1pYTmpZWEJsVG05a1pWUmxlSFFnS0dWc0tTQjdYRzRnSUdWc0lEMGdaV3dnZkh3Z0p5YzdYRzRnSUdsbUtHVnNMbTV2WkdWVWVYQmxJRDA5UFNBektTQjdYRzRnSUNBZ1pXd2dQU0JsYkM1amJHOXVaVTV2WkdVb0tUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQmxiQ0E5SUdSdll5NWpjbVZoZEdWVVpYaDBUbTlrWlNobGJDazdYRzRnSUgxY2JseHVJQ0F2THlCVmMybHVaeUJpY205M2MyVnlJR1Z6WTJGd2FXNW5JSFJ2SUdOc1pXRnVJSFZ3SUdGdWVTQnpjR1ZqYVdGc0lHTm9ZWEpoWTNSbGNuTmNiaUFnZG1GeUlIUnZWR1Y0ZENBOUlHUnZZeTVqY21WaGRHVkZiR1Z0Wlc1MEtDZGthWFluS1R0Y2JpQWdkRzlVWlhoMExtRndjR1Z1WkVOb2FXeGtLR1ZzS1R0Y2JpQWdjbVYwZFhKdUlIUnZWR1Y0ZEM1cGJtNWxja2hVVFV3Z2ZId2dKeWM3WEc1OVhHNWNibVoxYm1OMGFXOXVJSFZ1WlhOallYQmxWR1Y0ZENBb1pXd3BJSHRjYmlBZ2FXWW9aV3d1Ym05a1pWUjVjR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaV3d1ZEdWNGRFTnZiblJsYm5RZ2ZId2daV3d1YVc1dVpYSlVaWGgwSUh4OElDY25PMXh1SUNCOVhHNWNiaUFnZG1GeUlIUnZWR1Y0ZENBOUlHUnZZeTVqY21WaGRHVkZiR1Z0Wlc1MEtDZGthWFluS1R0Y2JpQWdkRzlVWlhoMExuUmxlSFJEYjI1MFpXNTBJRDBnWld3N1hHNGdJSEpsZEhWeWJpQjBiMVJsZUhRdWRHVjRkRU52Ym5SbGJuUTdYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1YzbHphWGQ1WjFOMWNtWmhZMlU3WEc0aVhYMD0iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG9uY2UgKGZuKSB7XG4gIHZhciBkaXNwb3NlZDtcbiAgcmV0dXJuIGZ1bmN0aW9uIGRpc3Bvc2FibGUgKCkge1xuICAgIGlmIChkaXNwb3NlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkaXNwb3NlZCA9IHRydWU7XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gb25jZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGRvY3VtZW50O1xuXG5mdW5jdGlvbiBob21lYnJld1FTQSAoY2xhc3NOYW1lKSB7XG4gIHZhciByZXN1bHRzID0gW107XG4gIHZhciBhbGwgPSBkb2MuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJyonKTtcbiAgdmFyIGk7XG4gIGZvciAoaSBpbiBhbGwpIHtcbiAgICBpZiAod3JhcChhbGxbaV0uY2xhc3NOYW1lKS5pbmRleE9mKHdyYXAoY2xhc3NOYW1lKSkgIT09IC0xKSB7XG4gICAgICByZXN1bHRzLnB1c2goYWxsW2ldKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIHdyYXAgKHRleHQpIHtcbiAgcmV0dXJuICcgJyArIHRleHQgKyAnICc7XG59XG5cbmZ1bmN0aW9uIGNsb3NlUHJvbXB0cyAoKSB7XG4gIGlmIChkb2MuYm9keS5xdWVyeVNlbGVjdG9yQWxsKSB7XG4gICAgcmVtb3ZlKGRvYy5ib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoJy53ay1wcm9tcHQnKSk7XG4gIH0gZWxzZSB7XG4gICAgcmVtb3ZlKGhvbWVicmV3UVNBKCd3ay1wcm9tcHQnKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlIChwcm9tcHRzKSB7XG4gIHZhciBsZW4gPSBwcm9tcHRzLmxlbmd0aDtcbiAgdmFyIGk7XG4gIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgIHByb21wdHNbaV0ucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChwcm9tcHRzW2ldKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNsb3NlUHJvbXB0cztcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gdmFyIGJ1cmVhdWNyYWN5ID0gcmVxdWlyZSgnYnVyZWF1Y3JhY3knKTtcbnZhciByZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcicpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuLi9jbGFzc2VzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB1cGxvYWRzID0gcmVxdWlyZSgnLi4vdXBsb2FkcycpO1xudmFyIEVOVEVSX0tFWSA9IDEzO1xudmFyIEVTQ0FQRV9LRVkgPSAyNztcbnZhciBkcmFnQ2xhc3MgPSAnd2stZHJhZ2dpbmcnO1xudmFyIGRyYWdDbGFzc1NwZWNpZmljID0gJ3drLXByb21wdC11cGxvYWQtZHJhZ2dpbmcnO1xudmFyIHJvb3QgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbmZ1bmN0aW9uIGNsYXNzaWZ5IChncm91cCwgY2xhc3Nlcykge1xuICBPYmplY3Qua2V5cyhncm91cCkuZm9yRWFjaChjdXN0b21pemUpO1xuICBmdW5jdGlvbiBjdXN0b21pemUgKGtleSkge1xuICAgIGlmIChjbGFzc2VzW2tleV0pIHtcbiAgICAgIGdyb3VwW2tleV0uY2xhc3NOYW1lICs9ICcgJyArIGNsYXNzZXNba2V5XTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvbXB0IChvcHRpb25zLCBkb25lKSB7XG4gIHZhciB0ZXh0ID0gc3RyaW5ncy5wcm9tcHRzW29wdGlvbnMudHlwZV07XG4gIHZhciBkb20gPSByZW5kZXIoe1xuICAgIGlkOiAnd2stcHJvbXB0LScgKyBvcHRpb25zLnR5cGUsXG4gICAgdGl0bGU6IHRleHQudGl0bGUsXG4gICAgZGVzY3JpcHRpb246IHRleHQuZGVzY3JpcHRpb24sXG4gICAgcGxhY2Vob2xkZXI6IHRleHQucGxhY2Vob2xkZXJcbiAgfSk7XG4gIHZhciBkb211cDtcblxuICBkb20uY2FuY2VsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcmVtb3ZlKTtcbiAgZG9tLmNsb3NlLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgcmVtb3ZlKTtcbiAgZG9tLm9rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb2spO1xuICBkb20uaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBlbnRlcik7XG4gIGRvbS5kaWFsb2cuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIGVzYyk7XG4gIGNsYXNzaWZ5KGRvbSwgb3B0aW9ucy5jbGFzc2VzLnByb21wdHMpO1xuXG4gIHZhciB1cGxvYWQgPSBvcHRpb25zLnVwbG9hZDtcbiAgaWYgKHR5cGVvZiB1cGxvYWQgPT09ICdzdHJpbmcnKSB7XG4gICAgdXBsb2FkID0geyB1cmw6IHVwbG9hZCB9O1xuICB9XG5cbiAgdmFyIGJ1cmVhdWNyYXQgPSBudWxsO1xuICBpZiAodXBsb2FkKSB7XG4gICAgYnVyZWF1Y3JhdCA9IGFycmFuZ2VVcGxvYWRzKCk7XG4gICAgaWYgKG9wdGlvbnMuYXV0b1VwbG9hZCkge1xuICAgICAgYnVyZWF1Y3JhdC5zdWJtaXQob3B0aW9ucy5hdXRvVXBsb2FkKTtcbiAgICB9XG4gIH1cblxuICBzZXRUaW1lb3V0KGZvY3VzRGlhbG9nLCAwKTtcblxuICBmdW5jdGlvbiBmb2N1c0RpYWxvZyAoKSB7XG4gICAgZG9tLmlucHV0LmZvY3VzKCk7XG4gIH1cblxuICBmdW5jdGlvbiBlbnRlciAoZSkge1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBpZiAoa2V5ID09PSBFTlRFUl9LRVkpIHtcbiAgICAgIG9rKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZXNjIChlKSB7XG4gICAgdmFyIGtleSA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmIChrZXkgPT09IEVTQ0FQRV9LRVkpIHtcbiAgICAgIHJlbW92ZSgpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9rICgpIHtcbiAgICByZW1vdmUoKTtcbiAgICBkb25lKHsgZGVmaW5pdGlvbnM6IFtkb20uaW5wdXQudmFsdWVdIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlICgpIHtcbiAgICBpZiAodXBsb2FkKSB7IGJpbmRVcGxvYWRFdmVudHModHJ1ZSk7IH1cbiAgICBpZiAoZG9tLmRpYWxvZy5wYXJlbnRFbGVtZW50KSB7IGRvbS5kaWFsb2cucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChkb20uZGlhbG9nKTsgfVxuICAgIG9wdGlvbnMuc3VyZmFjZS5mb2N1cyhvcHRpb25zLm1vZGUpO1xuICB9XG5cbiAgZnVuY3Rpb24gYmluZFVwbG9hZEV2ZW50cyAocmVtb3ZlKSB7XG4gICAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgICByb290W29wICsgJ0V2ZW50TGlzdGVuZXInXSgnZHJhZ2VudGVyJywgZHJhZ2dpbmcpO1xuICAgIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdkcmFnZW5kJywgZHJhZ3N0b3ApO1xuICAgIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdtb3VzZW91dCcsIGRyYWdzdG9wKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRyYWdnaW5nICgpIHtcbiAgICBjbGFzc2VzLmFkZChkb211cC5hcmVhLCBkcmFnQ2xhc3MpO1xuICAgIGNsYXNzZXMuYWRkKGRvbXVwLmFyZWEsIGRyYWdDbGFzc1NwZWNpZmljKTtcbiAgfVxuICBmdW5jdGlvbiBkcmFnc3RvcCAoKSB7XG4gICAgY2xhc3Nlcy5ybShkb211cC5hcmVhLCBkcmFnQ2xhc3MpO1xuICAgIGNsYXNzZXMucm0oZG9tdXAuYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xuICAgIHVwbG9hZHMuc3RvcChvcHRpb25zLnN1cmZhY2UuZHJvcGFyZWEpO1xuICB9XG5cbiAgZnVuY3Rpb24gYXJyYW5nZVVwbG9hZHMgKCkge1xuICAgIGRvbXVwID0gcmVuZGVyLnVwbG9hZHMoZG9tLCBzdHJpbmdzLnByb21wdHMudHlwZXMgKyAodXBsb2FkLnJlc3RyaWN0aW9uIHx8IG9wdGlvbnMudHlwZSArICdzJykpO1xuICAgIGJpbmRVcGxvYWRFdmVudHMoKTtcbiAgICBkb211cC5hcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgaGFuZGxlRHJhZ092ZXIsIGZhbHNlKTtcbiAgICBkb211cC5hcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBoYW5kbGVGaWxlU2VsZWN0LCBmYWxzZSk7XG4gICAgY2xhc3NpZnkoZG9tdXAsIG9wdGlvbnMuY2xhc3Nlcy5wcm9tcHRzKTtcbi8qXG4gICAgdmFyIGJ1cmVhdWNyYXQgPSBidXJlYXVjcmFjeS5zZXR1cChkb211cC5maWxlaW5wdXQsIHtcbiAgICAgIG1ldGhvZDogdXBsb2FkLm1ldGhvZCxcbiAgICAgIGZvcm1EYXRhOiB1cGxvYWQuZm9ybURhdGEsXG4gICAgICBmaWVsZEtleTogdXBsb2FkLmZpZWxkS2V5LFxuICAgICAgZW5kcG9pbnQ6IHVwbG9hZC51cmwsXG4gICAgICB2YWxpZGF0ZTogJ2ltYWdlJ1xuICAgIH0pO1xuXG4gICAgYnVyZWF1Y3JhdC5vbignc3RhcnRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNsYXNzZXMucm0oZG9tdXAuZmFpbGVkLCAnd2stcHJvbXB0LWVycm9yLXNob3cnKTtcbiAgICAgIGNsYXNzZXMucm0oZG9tdXAud2FybmluZywgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgfSk7XG4gICAgYnVyZWF1Y3JhdC5vbigndmFsaWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBjbGFzc2VzLmFkZChkb211cC5hcmVhLCAnd2stcHJvbXB0LXVwbG9hZGluZycpO1xuICAgIH0pO1xuICAgIGJ1cmVhdWNyYXQub24oJ2ludmFsaWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBjbGFzc2VzLmFkZChkb211cC53YXJuaW5nLCAnd2stcHJvbXB0LWVycm9yLXNob3cnKTtcbiAgICB9KTtcbiAgICBidXJlYXVjcmF0Lm9uKCdlcnJvcicsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNsYXNzZXMuYWRkKGRvbXVwLmZhaWxlZCwgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgfSk7XG4gICAgYnVyZWF1Y3JhdC5vbignc3VjY2VzcycsIHJlY2VpdmVkSW1hZ2VzKTtcbiAgICBidXJlYXVjcmF0Lm9uKCdlbmRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNsYXNzZXMucm0oZG9tdXAuYXJlYSwgJ3drLXByb21wdC11cGxvYWRpbmcnKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBidXJlYXVjcmF0O1xuXG4gICAgZnVuY3Rpb24gcmVjZWl2ZWRJbWFnZXMgKHJlc3VsdHMpIHtcbiAgICAgIHZhciBib2R5ID0gcmVzdWx0c1swXTtcbiAgICAgIGRvbS5pbnB1dC52YWx1ZSA9IGJvZHkuaHJlZiArICcgXCInICsgYm9keS50aXRsZSArICdcIic7XG4gICAgICByZW1vdmUoKTtcbiAgICAgIGRvbmUoe1xuICAgICAgICBkZWZpbml0aW9uczogcmVzdWx0cy5tYXAodG9EZWZpbml0aW9uKSxcbiAgICAgICAgYXR0YWNobWVudDogb3B0aW9ucy50eXBlID09PSAnYXR0YWNobWVudCdcbiAgICAgIH0pO1xuICAgICAgZnVuY3Rpb24gdG9EZWZpbml0aW9uIChyZXN1bHQpIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdC5ocmVmICsgJyBcIicgKyByZXN1bHQudGl0bGUgKyAnXCInO1xuICAgICAgfVxuICAgIH0gKi9cbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZURyYWdPdmVyIChlKSB7XG4gICAgc3RvcChlKTtcbiAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlRmlsZVNlbGVjdCAoZSkge1xuICAgIGRyYWdzdG9wKCk7XG4gICAgc3RvcChlKTtcbiAgICBidXJlYXVjcmF0LnN1Ym1pdChlLmRhdGFUcmFuc2Zlci5maWxlcyk7XG4gIH1cblxuICBmdW5jdGlvbiBzdG9wIChlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBwcm9tcHQ7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi4vY2xhc3NlcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgYWMgPSAnYXBwZW5kQ2hpbGQnO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gZSAodHlwZSwgY2xzLCB0ZXh0KSB7XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KHR5cGUpO1xuICBlbC5jbGFzc05hbWUgPSBjbHM7XG4gIGlmICh0ZXh0KSB7XG4gICAgZWwudGV4dENvbnRlbnQgPSB0ZXh0O1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyIChvcHRpb25zKSB7XG4gIHZhciBkb20gPSB7XG4gICAgZGlhbG9nOiBlKCdhcnRpY2xlJywgJ3drLXByb21wdCAnICsgb3B0aW9ucy5pZCksXG4gICAgY2xvc2U6IGUoJ2EnLCAnd2stcHJvbXB0LWNsb3NlJyksXG4gICAgaGVhZGVyOiBlKCdoZWFkZXInLCAnd2stcHJvbXB0LWhlYWRlcicpLFxuICAgIGgxOiBlKCdoMScsICd3ay1wcm9tcHQtdGl0bGUnLCBvcHRpb25zLnRpdGxlKSxcbiAgICBzZWN0aW9uOiBlKCdzZWN0aW9uJywgJ3drLXByb21wdC1ib2R5JyksXG4gICAgZGVzYzogZSgncCcsICd3ay1wcm9tcHQtZGVzY3JpcHRpb24nLCBvcHRpb25zLmRlc2NyaXB0aW9uKSxcbiAgICBpbnB1dENvbnRhaW5lcjogZSgnZGl2JywgJ3drLXByb21wdC1pbnB1dC1jb250YWluZXInKSxcbiAgICBpbnB1dDogZSgnaW5wdXQnLCAnd2stcHJvbXB0LWlucHV0JyksXG4gICAgY2FuY2VsOiBlKCdidXR0b24nLCAnd2stcHJvbXB0LWNhbmNlbCcsICdDYW5jZWwnKSxcbiAgICBvazogZSgnYnV0dG9uJywgJ3drLXByb21wdC1vaycsICdPaycpLFxuICAgIGZvb3RlcjogZSgnZm9vdGVyJywgJ3drLXByb21wdC1idXR0b25zJylcbiAgfTtcbiAgZG9tLm9rLnR5cGUgPSAnYnV0dG9uJztcbiAgZG9tLmhlYWRlclthY10oZG9tLmgxKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbS5kZXNjKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbS5pbnB1dENvbnRhaW5lcik7XG4gIGRvbS5pbnB1dENvbnRhaW5lclthY10oZG9tLmlucHV0KTtcbiAgZG9tLmlucHV0LnBsYWNlaG9sZGVyID0gb3B0aW9ucy5wbGFjZWhvbGRlcjtcbiAgZG9tLmNhbmNlbC50eXBlID0gJ2J1dHRvbic7XG4gIGRvbS5mb290ZXJbYWNdKGRvbS5jYW5jZWwpO1xuICBkb20uZm9vdGVyW2FjXShkb20ub2spO1xuICBkb20uZGlhbG9nW2FjXShkb20uY2xvc2UpO1xuICBkb20uZGlhbG9nW2FjXShkb20uaGVhZGVyKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLnNlY3Rpb24pO1xuICBkb20uZGlhbG9nW2FjXShkb20uZm9vdGVyKTtcbiAgZG9jLmJvZHlbYWNdKGRvbS5kaWFsb2cpO1xuICByZXR1cm4gZG9tO1xufVxuXG5mdW5jdGlvbiB1cGxvYWRzIChkb20sIHdhcm5pbmcpIHtcbiAgdmFyIGZ1cCA9ICd3ay1wcm9tcHQtZmlsZXVwbG9hZCc7XG4gIHZhciBkb211cCA9IHtcbiAgICBhcmVhOiBlKCdzZWN0aW9uJywgJ3drLXByb21wdC11cGxvYWQtYXJlYScpLFxuICAgIHdhcm5pbmc6IGUoJ3AnLCAnd2stcHJvbXB0LWVycm9yIHdrLXdhcm5pbmcnLCB3YXJuaW5nKSxcbiAgICBmYWlsZWQ6IGUoJ3AnLCAnd2stcHJvbXB0LWVycm9yIHdrLWZhaWxlZCcsIHN0cmluZ3MucHJvbXB0cy51cGxvYWRmYWlsZWQpLFxuICAgIHVwbG9hZDogZSgnbGFiZWwnLCAnd2stcHJvbXB0LXVwbG9hZCcpLFxuICAgIHVwbG9hZGluZzogZSgnc3BhbicsICd3ay1wcm9tcHQtcHJvZ3Jlc3MnLCBzdHJpbmdzLnByb21wdHMudXBsb2FkaW5nKSxcbiAgICBkcm9wOiBlKCdzcGFuJywgJ3drLXByb21wdC1kcm9wJywgc3RyaW5ncy5wcm9tcHRzLmRyb3ApLFxuICAgIGRyb3BpY29uOiBlKCdwJywgJ3drLWRyb3AtaWNvbiB3ay1wcm9tcHQtZHJvcC1pY29uJyksXG4gICAgYnJvd3NlOiBlKCdzcGFuJywgJ3drLXByb21wdC1icm93c2UnLCBzdHJpbmdzLnByb21wdHMuYnJvd3NlKSxcbiAgICBkcmFnZHJvcDogZSgncCcsICd3ay1wcm9tcHQtZHJhZ2Ryb3AnLCBzdHJpbmdzLnByb21wdHMuZHJvcGhpbnQpLFxuICAgIGZpbGVpbnB1dDogZSgnaW5wdXQnLCBmdXApXG4gIH07XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLmRyb3ApO1xuICBkb211cC5hcmVhW2FjXShkb211cC51cGxvYWRpbmcpO1xuICBkb211cC5hcmVhW2FjXShkb211cC5kcm9waWNvbik7XG4gIGRvbXVwLnVwbG9hZFthY10oZG9tdXAuYnJvd3NlKTtcbiAgZG9tdXAudXBsb2FkW2FjXShkb211cC5maWxlaW5wdXQpO1xuICBkb211cC5maWxlaW5wdXQuaWQgPSBmdXA7XG4gIGRvbXVwLmZpbGVpbnB1dC50eXBlID0gJ2ZpbGUnO1xuICBkb211cC5maWxlaW5wdXQubXVsdGlwbGUgPSAnbXVsdGlwbGUnO1xuICBkb20uZGlhbG9nLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC11cGxvYWRzJztcbiAgZG9tLmlucHV0Q29udGFpbmVyLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC1pbnB1dC1jb250YWluZXItdXBsb2Fkcyc7XG4gIGRvbS5pbnB1dC5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtaW5wdXQtdXBsb2Fkcyc7XG4gIGRvbS5zZWN0aW9uLmluc2VydEJlZm9yZShkb211cC53YXJuaW5nLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvbi5pbnNlcnRCZWZvcmUoZG9tdXAuZmFpbGVkLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAudXBsb2FkKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmRyYWdkcm9wKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmFyZWEpO1xuICBkb20uZGVzYy50ZXh0Q29udGVudCA9IGRvbS5kZXNjLnRleHRDb250ZW50ICsgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZDtcbiAgZG9tdXAuZmlsZWlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgZm9jdXNlZEZpbGVJbnB1dCk7XG4gIGRvbXVwLmZpbGVpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgYmx1cnJlZEZpbGVJbnB1dCk7XG5cbiAgZnVuY3Rpb24gZm9jdXNlZEZpbGVJbnB1dCAoKSB7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAudXBsb2FkLCAnd2stZm9jdXNlZCcpO1xuICB9XG4gIGZ1bmN0aW9uIGJsdXJyZWRGaWxlSW5wdXQgKCkge1xuICAgIGNsYXNzZXMucm0oZG9tdXAudXBsb2FkLCAnd2stZm9jdXNlZCcpO1xuICB9XG4gIHJldHVybiBkb211cDtcbn1cblxucmVuZGVyLnVwbG9hZHMgPSB1cGxvYWRzO1xubW9kdWxlLmV4cG9ydHMgPSByZW5kZXI7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXdjbTl0Y0hSekwzSmxibVJsY2k1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJqYkdGemMyVnpJRDBnY21WeGRXbHlaU2duTGk0dlkyeGhjM05sY3ljcE8xeHVkbUZ5SUhOMGNtbHVaM01nUFNCeVpYRjFhWEpsS0NjdUxpOXpkSEpwYm1kekp5azdYRzUyWVhJZ1lXTWdQU0FuWVhCd1pXNWtRMmhwYkdRbk8xeHVkbUZ5SUdSdll5QTlJR2RzYjJKaGJDNWtiMk4xYldWdWREdGNibHh1Wm5WdVkzUnBiMjRnWlNBb2RIbHdaU3dnWTJ4ekxDQjBaWGgwS1NCN1hHNGdJSFpoY2lCbGJDQTlJR1J2WXk1amNtVmhkR1ZGYkdWdFpXNTBLSFI1Y0dVcE8xeHVJQ0JsYkM1amJHRnpjMDVoYldVZ1BTQmpiSE03WEc0Z0lHbG1JQ2gwWlhoMEtTQjdYRzRnSUNBZ1pXd3VkR1Y0ZEVOdmJuUmxiblFnUFNCMFpYaDBPMXh1SUNCOVhHNGdJSEpsZEhWeWJpQmxiRHRjYm4xY2JseHVablZ1WTNScGIyNGdjbVZ1WkdWeUlDaHZjSFJwYjI1ektTQjdYRzRnSUhaaGNpQmtiMjBnUFNCN1hHNGdJQ0FnWkdsaGJHOW5PaUJsS0NkaGNuUnBZMnhsSnl3Z0ozZHJMWEJ5YjIxd2RDQW5JQ3NnYjNCMGFXOXVjeTVwWkNrc1hHNGdJQ0FnWTJ4dmMyVTZJR1VvSjJFbkxDQW5kMnN0Y0hKdmJYQjBMV05zYjNObEp5a3NYRzRnSUNBZ2FHVmhaR1Z5T2lCbEtDZG9aV0ZrWlhJbkxDQW5kMnN0Y0hKdmJYQjBMV2hsWVdSbGNpY3BMRnh1SUNBZ0lHZ3hPaUJsS0Nkb01TY3NJQ2QzYXkxd2NtOXRjSFF0ZEdsMGJHVW5MQ0J2Y0hScGIyNXpMblJwZEd4bEtTeGNiaUFnSUNCelpXTjBhVzl1T2lCbEtDZHpaV04wYVc5dUp5d2dKM2RyTFhCeWIyMXdkQzFpYjJSNUp5a3NYRzRnSUNBZ1pHVnpZem9nWlNnbmNDY3NJQ2QzYXkxd2NtOXRjSFF0WkdWelkzSnBjSFJwYjI0bkxDQnZjSFJwYjI1ekxtUmxjMk55YVhCMGFXOXVLU3hjYmlBZ0lDQnBibkIxZEVOdmJuUmhhVzVsY2pvZ1pTZ25aR2wySnl3Z0ozZHJMWEJ5YjIxd2RDMXBibkIxZEMxamIyNTBZV2x1WlhJbktTeGNiaUFnSUNCcGJuQjFkRG9nWlNnbmFXNXdkWFFuTENBbmQyc3RjSEp2YlhCMExXbHVjSFYwSnlrc1hHNGdJQ0FnWTJGdVkyVnNPaUJsS0NkaWRYUjBiMjRuTENBbmQyc3RjSEp2YlhCMExXTmhibU5sYkNjc0lDZERZVzVqWld3bktTeGNiaUFnSUNCdmF6b2daU2duWW5WMGRHOXVKeXdnSjNkckxYQnliMjF3ZEMxdmF5Y3NJQ2RQYXljcExGeHVJQ0FnSUdadmIzUmxjam9nWlNnblptOXZkR1Z5Snl3Z0ozZHJMWEJ5YjIxd2RDMWlkWFIwYjI1ekp5bGNiaUFnZlR0Y2JpQWdaRzl0TG05ckxuUjVjR1VnUFNBblluVjBkRzl1Snp0Y2JpQWdaRzl0TG1obFlXUmxjbHRoWTEwb1pHOXRMbWd4S1R0Y2JpQWdaRzl0TG5ObFkzUnBiMjViWVdOZEtHUnZiUzVrWlhOaktUdGNiaUFnWkc5dExuTmxZM1JwYjI1YllXTmRLR1J2YlM1cGJuQjFkRU52Ym5SaGFXNWxjaWs3WEc0Z0lHUnZiUzVwYm5CMWRFTnZiblJoYVc1bGNsdGhZMTBvWkc5dExtbHVjSFYwS1R0Y2JpQWdaRzl0TG1sdWNIVjBMbkJzWVdObGFHOXNaR1Z5SUQwZ2IzQjBhVzl1Y3k1d2JHRmpaV2h2YkdSbGNqdGNiaUFnWkc5dExtTmhibU5sYkM1MGVYQmxJRDBnSjJKMWRIUnZiaWM3WEc0Z0lHUnZiUzVtYjI5MFpYSmJZV05kS0dSdmJTNWpZVzVqWld3cE8xeHVJQ0JrYjIwdVptOXZkR1Z5VzJGalhTaGtiMjB1YjJzcE8xeHVJQ0JrYjIwdVpHbGhiRzluVzJGalhTaGtiMjB1WTJ4dmMyVXBPMXh1SUNCa2IyMHVaR2xoYkc5blcyRmpYU2hrYjIwdWFHVmhaR1Z5S1R0Y2JpQWdaRzl0TG1ScFlXeHZaMXRoWTEwb1pHOXRMbk5sWTNScGIyNHBPMXh1SUNCa2IyMHVaR2xoYkc5blcyRmpYU2hrYjIwdVptOXZkR1Z5S1R0Y2JpQWdaRzlqTG1KdlpIbGJZV05kS0dSdmJTNWthV0ZzYjJjcE8xeHVJQ0J5WlhSMWNtNGdaRzl0TzF4dWZWeHVYRzVtZFc1amRHbHZiaUIxY0d4dllXUnpJQ2hrYjIwc0lIZGhjbTVwYm1jcElIdGNiaUFnZG1GeUlHWjFjQ0E5SUNkM2F5MXdjbTl0Y0hRdFptbHNaWFZ3Ykc5aFpDYzdYRzRnSUhaaGNpQmtiMjExY0NBOUlIdGNiaUFnSUNCaGNtVmhPaUJsS0NkelpXTjBhVzl1Snl3Z0ozZHJMWEJ5YjIxd2RDMTFjR3h2WVdRdFlYSmxZU2NwTEZ4dUlDQWdJSGRoY201cGJtYzZJR1VvSjNBbkxDQW5kMnN0Y0hKdmJYQjBMV1Z5Y205eUlIZHJMWGRoY201cGJtY25MQ0IzWVhKdWFXNW5LU3hjYmlBZ0lDQm1ZV2xzWldRNklHVW9KM0FuTENBbmQyc3RjSEp2YlhCMExXVnljbTl5SUhkckxXWmhhV3hsWkNjc0lITjBjbWx1WjNNdWNISnZiWEIwY3k1MWNHeHZZV1JtWVdsc1pXUXBMRnh1SUNBZ0lIVndiRzloWkRvZ1pTZ25iR0ZpWld3bkxDQW5kMnN0Y0hKdmJYQjBMWFZ3Ykc5aFpDY3BMRnh1SUNBZ0lIVndiRzloWkdsdVp6b2daU2duYzNCaGJpY3NJQ2QzYXkxd2NtOXRjSFF0Y0hKdlozSmxjM01uTENCemRISnBibWR6TG5CeWIyMXdkSE11ZFhCc2IyRmthVzVuS1N4Y2JpQWdJQ0JrY205d09pQmxLQ2R6Y0dGdUp5d2dKM2RyTFhCeWIyMXdkQzFrY205d0p5d2djM1J5YVc1bmN5NXdjbTl0Y0hSekxtUnliM0FwTEZ4dUlDQWdJR1J5YjNCcFkyOXVPaUJsS0Nkd0p5d2dKM2RyTFdSeWIzQXRhV052YmlCM2F5MXdjbTl0Y0hRdFpISnZjQzFwWTI5dUp5a3NYRzRnSUNBZ1luSnZkM05sT2lCbEtDZHpjR0Z1Snl3Z0ozZHJMWEJ5YjIxd2RDMWljbTkzYzJVbkxDQnpkSEpwYm1kekxuQnliMjF3ZEhNdVluSnZkM05sS1N4Y2JpQWdJQ0JrY21GblpISnZjRG9nWlNnbmNDY3NJQ2QzYXkxd2NtOXRjSFF0WkhKaFoyUnliM0FuTENCemRISnBibWR6TG5CeWIyMXdkSE11WkhKdmNHaHBiblFwTEZ4dUlDQWdJR1pwYkdWcGJuQjFkRG9nWlNnbmFXNXdkWFFuTENCbWRYQXBYRzRnSUgwN1hHNGdJR1J2YlhWd0xtRnlaV0ZiWVdOZEtHUnZiWFZ3TG1SeWIzQXBPMXh1SUNCa2IyMTFjQzVoY21WaFcyRmpYU2hrYjIxMWNDNTFjR3h2WVdScGJtY3BPMXh1SUNCa2IyMTFjQzVoY21WaFcyRmpYU2hrYjIxMWNDNWtjbTl3YVdOdmJpazdYRzRnSUdSdmJYVndMblZ3Ykc5aFpGdGhZMTBvWkc5dGRYQXVZbkp2ZDNObEtUdGNiaUFnWkc5dGRYQXVkWEJzYjJGa1cyRmpYU2hrYjIxMWNDNW1hV3hsYVc1d2RYUXBPMXh1SUNCa2IyMTFjQzVtYVd4bGFXNXdkWFF1YVdRZ1BTQm1kWEE3WEc0Z0lHUnZiWFZ3TG1acGJHVnBibkIxZEM1MGVYQmxJRDBnSjJacGJHVW5PMXh1SUNCa2IyMTFjQzVtYVd4bGFXNXdkWFF1YlhWc2RHbHdiR1VnUFNBbmJYVnNkR2x3YkdVbk8xeHVJQ0JrYjIwdVpHbGhiRzluTG1Oc1lYTnpUbUZ0WlNBclBTQW5JSGRyTFhCeWIyMXdkQzExY0d4dllXUnpKenRjYmlBZ1pHOXRMbWx1Y0hWMFEyOXVkR0ZwYm1WeUxtTnNZWE56VG1GdFpTQXJQU0FuSUhkckxYQnliMjF3ZEMxcGJuQjFkQzFqYjI1MFlXbHVaWEl0ZFhCc2IyRmtjeWM3WEc0Z0lHUnZiUzVwYm5CMWRDNWpiR0Z6YzA1aGJXVWdLejBnSnlCM2F5MXdjbTl0Y0hRdGFXNXdkWFF0ZFhCc2IyRmtjeWM3WEc0Z0lHUnZiUzV6WldOMGFXOXVMbWx1YzJWeWRFSmxabTl5WlNoa2IyMTFjQzUzWVhKdWFXNW5MQ0JrYjIwdWFXNXdkWFJEYjI1MFlXbHVaWElwTzF4dUlDQmtiMjB1YzJWamRHbHZiaTVwYm5ObGNuUkNaV1p2Y21Vb1pHOXRkWEF1Wm1GcGJHVmtMQ0JrYjIwdWFXNXdkWFJEYjI1MFlXbHVaWElwTzF4dUlDQmtiMjB1YzJWamRHbHZibHRoWTEwb1pHOXRkWEF1ZFhCc2IyRmtLVHRjYmlBZ1pHOXRMbk5sWTNScGIyNWJZV05kS0dSdmJYVndMbVJ5WVdka2NtOXdLVHRjYmlBZ1pHOXRMbk5sWTNScGIyNWJZV05kS0dSdmJYVndMbUZ5WldFcE8xeHVJQ0JrYjIwdVpHVnpZeTUwWlhoMFEyOXVkR1Z1ZENBOUlHUnZiUzVrWlhOakxuUmxlSFJEYjI1MFpXNTBJQ3NnYzNSeWFXNW5jeTV3Y205dGNIUnpMblZ3Ykc5aFpEdGNiaUFnWkc5dGRYQXVabWxzWldsdWNIVjBMbUZrWkVWMlpXNTBUR2x6ZEdWdVpYSW9KMlp2WTNWekp5d2dabTlqZFhObFpFWnBiR1ZKYm5CMWRDazdYRzRnSUdSdmJYVndMbVpwYkdWcGJuQjFkQzVoWkdSRmRtVnVkRXhwYzNSbGJtVnlLQ2RpYkhWeUp5d2dZbXgxY25KbFpFWnBiR1ZKYm5CMWRDazdYRzVjYmlBZ1puVnVZM1JwYjI0Z1ptOWpkWE5sWkVacGJHVkpibkIxZENBb0tTQjdYRzRnSUNBZ1kyeGhjM05sY3k1aFpHUW9aRzl0ZFhBdWRYQnNiMkZrTENBbmQyc3RabTlqZFhObFpDY3BPMXh1SUNCOVhHNGdJR1oxYm1OMGFXOXVJR0pzZFhKeVpXUkdhV3hsU1c1d2RYUWdLQ2tnZTF4dUlDQWdJR05zWVhOelpYTXVjbTBvWkc5dGRYQXVkWEJzYjJGa0xDQW5kMnN0Wm05amRYTmxaQ2NwTzF4dUlDQjlYRzRnSUhKbGRIVnliaUJrYjIxMWNEdGNibjFjYmx4dWNtVnVaR1Z5TG5Wd2JHOWhaSE1nUFNCMWNHeHZZV1J6TzF4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCeVpXNWtaWEk3WEc0aVhYMD0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGNvbW1hbmRzIChlbCwgaWQpIHtcbiAgZWwudGV4dENvbnRlbnQgPSBzdHJpbmdzLmJ1dHRvbnNbaWRdIHx8IGlkO1xufVxuXG5mdW5jdGlvbiBtb2RlcyAoZWwsIGlkKSB7XG4gIGVsLnRleHRDb250ZW50ID0gc3RyaW5ncy5tb2Rlc1tpZF0gfHwgaWQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBtb2RlczogbW9kZXMsXG4gIGNvbW1hbmRzOiBjb21tYW5kc1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gU2hvcnRjdXRNYW5hZ2VyKGVsZW1lbnQpIHtcbiAgdGhpcy5ib3VuZEhhbmRsZXIgPSB0aGlzLmhhbmRsZUV2ZW50LmJpbmQodGhpcyk7XG4gIHRoaXMuaGFuZGxlcnMgPSB7fTtcbiAgaWYoZWxlbWVudCkge1xuICAgIHRoaXMuYXR0YWNoKGVsZW1lbnQpO1xuICB9XG59XG5cblNob3J0Y3V0TWFuYWdlci5wcm90b3R5cGUuYXR0YWNoID0gZnVuY3Rpb24gKGVsKSB7XG4gIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmJvdW5kSGFuZGxlciwgZmFsc2UpO1xufTtcblxuU2hvcnRjdXRNYW5hZ2VyLnByb3RvdHlwZS5kZXRhY2ggPSBmdW5jdGlvbiAoZWwpIHtcbiAgZWwucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuYm91bmRIYW5kbGVyLCBmYWxzZSk7XG59O1xuXG5TaG9ydGN1dE1hbmFnZXIucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChrZXksIHNoaWZ0LCBmbikge1xuICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZm4gPSBzaGlmdDtcbiAgICBzaGlmdCA9IGZhbHNlO1xuICB9XG5cbiAgaWYoIXRoaXMuaGFuZGxlcnNba2V5XSkgeyB0aGlzLmhhbmRsZXJzW2tleV0gPSBbXTsgfVxuICB0aGlzLmhhbmRsZXJzW2tleV0ucHVzaCh7XG4gICAgc2hpZnQ6ICEhc2hpZnQsXG4gICAgZm46IGZuLFxuICB9KTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cblNob3J0Y3V0TWFuYWdlci5wcm90b3R5cGUucmVtb3ZlID0gZnVuY3Rpb24gKGtleSwgc2hpZnQsIGZuKSB7XG4gIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBmbiA9IHNoaWZ0O1xuICAgIHNoaWZ0ID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgaWYodGhpcy5oYW5kbGVyc1trZXldICYmIHRoaXMuaGFuZGxlcnNba2V5XS5sZW5ndGgpIHtcbiAgICB2YXIgaCA9IDAsXG4gICAgICBsID0gdGhpcy5oYW5kbGVyc1trZXldLmxlbmd0aDtcbiAgICBmb3IoOyBoIDwgbDsgaCsrKSB7XG4gICAgICB2YXIgaGFuZGxlciA9IHRoaXMuaGFuZGxlcnNba2V5XVtoXTtcbiAgICAgIGlmKGhhbmRsZXIuZm4gPT09IGZuICYmICh0eXBlb2Ygc2hpZnQgPT09ICd1bmRlZmluZWQnIHx8IGhhbmRsZXIuc2hpZnQgPT09IHNoaWZ0KSkge1xuICAgICAgICAvLyBNYXRjaCwgZG9uJ3QgbmVlZCB0byBwcm9jZXNzIGFueW1vcmVcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoaCA8IGwpIHtcbiAgICAgIC8vIFdlIGZvdW5kIGEgbWF0Y2gsIHNwbGljZSBpdCBvdXRcbiAgICAgIHRoaXMuaGFubGRlcnMuc3BsaWNlKGgsIDEpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuU2hvcnRjdXRNYW5hZ2VyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5oYW5kbGVycyA9IHt9O1xufTtcblxuU2hvcnRjdXRNYW5hZ2VyLnByb3RvdHlwZS5oYW5kbGVFdmVudCA9IGZ1bmN0aW9uIChldmVudCkge1xuICBpZihldmVudC5jdHJsS2V5IHx8IGV2ZW50Lm1ldGFLZXkpIHtcbiAgICB2YXIgY2ggPSBldmVudC5rZXk7XG5cbiAgICBpZihjaCAmJiB0aGlzLmhhbmRsZXJzW2NoXSkge1xuICAgICAgZm9yKHZhciBoID0gMCwgbCA9IHRoaXMuaGFuZGxlcnNbY2hdLmxlbmd0aDsgaCA8IGw7IGgrKykge1xuICAgICAgICB2YXIgaGFuZGxlciA9IHRoaXMuaGFuZGxlcnNbY2hdW2hdO1xuXG4gICAgICAgIGlmKGV2ZW50LnNoaWZ0S2V5ID09PSBoYW5kbGVyLnNoaWZ0KSB7XG4gICAgICAgICAgLy8gSGFuZGxlIGV2ZW50XG4gICAgICAgICAgaGFuZGxlci5mbihldmVudCk7XG4gICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgfVxuICAgICAgfSAvLyBFbmQgZm9yIGxvb3BcbiAgICB9IC8vIEVuZCBoYW5kbGVyIGFycmF5IGNoZWNrXG4gIH0vLyBFbmQgQ1RSTC9DTUQgY2hlY2tcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU2hvcnRjdXRNYW5hZ2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgcGxhY2Vob2xkZXJzOiB7XG4gICAgYm9sZDogJ3N0cm9uZyB0ZXh0JyxcbiAgICBpdGFsaWM6ICdlbXBoYXNpemVkIHRleHQnLFxuICAgIHF1b3RlOiAncXVvdGVkIHRleHQnLFxuICAgIGNvZGU6ICdjb2RlIGdvZXMgaGVyZScsXG4gICAgbGlzdGl0ZW06ICdsaXN0IGl0ZW0nLFxuICAgIGhlYWRpbmc6ICdIZWFkaW5nIFRleHQnLFxuICAgIGxpbms6ICdsaW5rIHRleHQnLFxuICAgIGltYWdlOiAnaW1hZ2UgZGVzY3JpcHRpb24nLFxuICAgIGF0dGFjaG1lbnQ6ICdhdHRhY2htZW50IGRlc2NyaXB0aW9uJ1xuICB9LFxuICB0aXRsZXM6IHtcbiAgICBib2xkOiAnU3Ryb25nIDxzdHJvbmc+IEN0cmwrQicsXG4gICAgaXRhbGljOiAnRW1waGFzaXMgPGVtPiBDdHJsK0knLFxuICAgIHF1b3RlOiAnQmxvY2txdW90ZSA8YmxvY2txdW90ZT4gQ3RybCtKJyxcbiAgICBjb2RlOiAnQ29kZSBTYW1wbGUgPHByZT48Y29kZT4gQ3RybCtFJyxcbiAgICBvbDogJ051bWJlcmVkIExpc3QgPG9sPiBDdHJsK08nLFxuICAgIHVsOiAnQnVsbGV0ZWQgTGlzdCA8dWw+IEN0cmwrVScsXG4gICAgaGVhZGluZzogJ0hlYWRpbmcgPGgxPiwgPGgyPiwgLi4uIEN0cmwrRCcsXG4gICAgbGluazogJ0h5cGVybGluayA8YT4gQ3RybCtLJyxcbiAgICBpbWFnZTogJ0ltYWdlIDxpbWc+IEN0cmwrRycsXG4gICAgYXR0YWNobWVudDogJ0F0dGFjaG1lbnQgQ3RybCtTaGlmdCtLJyxcbiAgICBtYXJrZG93bjogJ01hcmtkb3duIE1vZGUgQ3RybCtNJyxcbiAgICBodG1sOiAnSFRNTCBNb2RlIEN0cmwrSCcsXG4gICAgd3lzaXd5ZzogJ1ByZXZpZXcgTW9kZSBDdHJsK1AnXG4gIH0sXG4gIGJ1dHRvbnM6IHtcbiAgICBib2xkOiAnQicsXG4gICAgaXRhbGljOiAnSScsXG4gICAgcXVvdGU6ICdcXHUyMDFjJyxcbiAgICBjb2RlOiAnPC8+JyxcbiAgICBvbDogJzEuJyxcbiAgICB1bDogJ1xcdTI5QkYnLFxuICAgIGhlYWRpbmc6ICdUdCcsXG4gICAgbGluazogJ0xpbmsnLFxuICAgIGltYWdlOiAnSW1hZ2UnLFxuICAgIGF0dGFjaG1lbnQ6ICdBdHRhY2htZW50JyxcbiAgICBocjogJ1xcdTIxYjUnXG4gIH0sXG4gIHByb21wdHM6IHtcbiAgICBsaW5rOiB7XG4gICAgICB0aXRsZTogJ0luc2VydCBMaW5rJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHlwZSBvciBwYXN0ZSB0aGUgdXJsIHRvIHlvdXIgbGluaycsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS8gXCJ0aXRsZVwiJ1xuICAgIH0sXG4gICAgaW1hZ2U6IHtcbiAgICAgIHRpdGxlOiAnSW5zZXJ0IEltYWdlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW50ZXIgdGhlIHVybCB0byB5b3VyIGltYWdlJyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnaHR0cDovL2V4YW1wbGUuY29tL3B1YmxpYy9pbWFnZS5wbmcgXCJ0aXRsZVwiJ1xuICAgIH0sXG4gICAgYXR0YWNobWVudDoge1xuICAgICAgdGl0bGU6ICdBdHRhY2ggRmlsZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VudGVyIHRoZSB1cmwgdG8geW91ciBhdHRhY2htZW50JyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnaHR0cDovL2V4YW1wbGUuY29tL3B1YmxpYy9yZXBvcnQucGRmIFwidGl0bGVcIidcbiAgICB9LFxuICAgIHR5cGVzOiAnWW91IGNhbiBvbmx5IHVwbG9hZCAnLFxuICAgIGJyb3dzZTogJ0Jyb3dzZS4uLicsXG4gICAgZHJvcGhpbnQ6ICdZb3UgY2FuIGFsc28gZHJhZyBmaWxlcyBmcm9tIHlvdXIgY29tcHV0ZXIgYW5kIGRyb3AgdGhlbSBoZXJlIScsXG4gICAgZHJvcDogJ0Ryb3AgeW91ciBmaWxlIGhlcmUgdG8gYmVnaW4gdXBsb2FkLi4uJyxcbiAgICB1cGxvYWQ6ICcsIG9yIHVwbG9hZCBhIGZpbGUnLFxuICAgIHVwbG9hZGluZzogJ1VwbG9hZGluZyB5b3VyIGZpbGUuLi4nLFxuICAgIHVwbG9hZGZhaWxlZDogJ1RoZSB1cGxvYWQgZmFpbGVkISBUaGF0XFwncyBhbGwgd2Uga25vdy4nXG4gIH0sXG4gIG1vZGVzOiB7XG4gICAgd3lzaXd5ZzogJ3d5c2l3eWcnLFxuICAgIG1hcmtkb3duOiAnbVxcdTIxOTMnLFxuICB9LFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuL2NsYXNzZXMnKTtcbnZhciBkcmFnQ2xhc3MgPSAnd2stZHJhZ2dpbmcnO1xudmFyIGRyYWdDbGFzc1NwZWNpZmljID0gJ3drLWNvbnRhaW5lci1kcmFnZ2luZyc7XG52YXIgcm9vdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuZnVuY3Rpb24gdXBsb2FkcyAoY29udGFpbmVyLCBkcm9wYXJlYSwgZWRpdG9yLCBvcHRpb25zLCByZW1vdmUpIHtcbiAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdlbnRlcicsIGRyYWdnaW5nKTtcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdlbmQnLCBkcmFnc3RvcCk7XG4gIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdtb3VzZW91dCcsIGRyYWdzdG9wKTtcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdvdmVyJywgaGFuZGxlRHJhZ092ZXIsIGZhbHNlKTtcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2Ryb3AnLCBoYW5kbGVGaWxlU2VsZWN0LCBmYWxzZSk7XG5cbiAgZnVuY3Rpb24gZHJhZ2dpbmcgKCkge1xuICAgIGNsYXNzZXMuYWRkKGRyb3BhcmVhLCBkcmFnQ2xhc3MpO1xuICAgIGNsYXNzZXMuYWRkKGRyb3BhcmVhLCBkcmFnQ2xhc3NTcGVjaWZpYyk7XG4gIH1cbiAgZnVuY3Rpb24gZHJhZ3N0b3AgKCkge1xuICAgIGRyYWdzdG9wcGVyKGRyb3BhcmVhKTtcbiAgfVxuICBmdW5jdGlvbiBoYW5kbGVEcmFnT3ZlciAoZSkge1xuICAgIHN0b3AoZSk7XG4gICAgZHJhZ2dpbmcoKTtcbiAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuICB9XG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVTZWxlY3QgKGUpIHtcbiAgICBkcmFnc3RvcCgpO1xuICAgIHN0b3AoZSk7XG4gICAgZWRpdG9yLnJ1bkNvbW1hbmQoZnVuY3Rpb24gcnVubmVyIChjaHVua3MsIG1vZGUpIHtcbiAgICAgIHZhciBmaWxlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGUuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIHZhciB0eXBlID0gaW5mZXJUeXBlKGZpbGVzKTtcbiAgICAgIGVkaXRvci5saW5rT3JJbWFnZU9yQXR0YWNobWVudCh0eXBlLCBmaWxlcykuY2FsbCh0aGlzLCBtb2RlLCBjaHVua3MpO1xuICAgIH0pO1xuICB9XG4gIGZ1bmN0aW9uIGluZmVyVHlwZSAoZmlsZXMpIHtcbiAgICBpZiAob3B0aW9ucy5pbWFnZXMgJiYgIW9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIH1cbiAgICBpZiAoIW9wdGlvbnMuaW1hZ2VzICYmIG9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIHJldHVybiAnYXR0YWNobWVudCc7XG4gICAgfVxuICAgIGlmIChmaWxlcy5ldmVyeShtYXRjaGVzKG9wdGlvbnMuaW1hZ2VzLnZhbGlkYXRlIHx8IG5ldmVyKSkpIHtcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIH1cbiAgICByZXR1cm4gJ2F0dGFjaG1lbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBtYXRjaGVyIChmaWxlKSB7IHJldHVybiBmbihmaWxlKTsgfTtcbn1cbmZ1bmN0aW9uIG5ldmVyICgpIHtcbiAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gc3RvcCAoZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG59XG5mdW5jdGlvbiBkcmFnc3RvcHBlciAoZHJvcGFyZWEpIHtcbiAgY2xhc3Nlcy5ybShkcm9wYXJlYSwgZHJhZ0NsYXNzKTtcbiAgY2xhc3Nlcy5ybShkcm9wYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xufVxuXG51cGxvYWRzLnN0b3AgPSBkcmFnc3RvcHBlcjtcbm1vZHVsZS5leHBvcnRzID0gdXBsb2FkcztcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gT2JqZWN0LmFzc2lnbiBwb2x5ZmlsbFxuLy8gSWdub3JlIFBvbHlmaWxsIGNvZGUgZm9yIGxpbnRpbmcgKG92ZXJyaWRpbmcgZ2xvYmFscyBoZXJlIGlzIGV4cGVjdGVkKVxuLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuaWYgKHR5cGVvZiBPYmplY3QuYXNzaWduICE9ICdmdW5jdGlvbicpIHtcbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2Fzc2lnblxuICBPYmplY3QuYXNzaWduID0gZnVuY3Rpb24odGFyZ2V0LCB2YXJBcmdzKSB7IC8vIC5sZW5ndGggb2YgZnVuY3Rpb24gaXMgMlxuICAgIGlmICh0YXJnZXQgPT09IG51bGwgfHwgdGFyZ2V0ID09PSB1bmRlZmluZWQpIHsgLy8gVHlwZUVycm9yIGlmIHVuZGVmaW5lZCBvciBudWxsXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCB1bmRlZmluZWQgb3IgbnVsbCB0byBvYmplY3QnKTtcbiAgICB9XG5cbiAgICB2YXIgdG8gPSBPYmplY3QodGFyZ2V0KTtcblxuICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICB2YXIgbmV4dFNvdXJjZSA9IGFyZ3VtZW50c1tpbmRleF07XG5cbiAgICAgIGlmIChuZXh0U291cmNlICE9PSBudWxsICYmIG5leHRTb3VyY2UgIT09IHVuZGVmaW5lZCkgeyAvLyBTa2lwIG92ZXIgaWYgdW5kZWZpbmVkIG9yIG51bGxcbiAgICAgICAgZm9yICh2YXIgbmV4dEtleSBpbiBuZXh0U291cmNlKSB7XG4gICAgICAgICAgLy8gQXZvaWQgYnVncyB3aGVuIGhhc093blByb3BlcnR5IGlzIHNoYWRvd2VkXG4gICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChuZXh0U291cmNlLCBuZXh0S2V5KSkge1xuICAgICAgICAgICAgdG9bbmV4dEtleV0gPSBuZXh0U291cmNlW25leHRLZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdG87XG4gIH07XG59XG5cbi8vIEN1c3RvbSBFdmVudCBDb25zdHJ1Y3RvciBQb2x5ZmlsbFxuKGZ1bmN0aW9uICgpIHtcbiAgaWYgKCB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ID09PSBcImZ1bmN0aW9uXCIgKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICggZXZlbnQsIHBhcmFtcyApIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UsIGRldGFpbDogdW5kZWZpbmVkIH07XG4gICAgdmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG4gICAgZXZ0LmluaXRDdXN0b21FdmVudCggZXZlbnQsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCApO1xuICAgIHJldHVybiBldnQ7XG4gICB9XG5cbiAgQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcblxuICB3aW5kb3cuQ3VzdG9tRXZlbnQgPSBDdXN0b21FdmVudDtcbn0pKCk7XG5cbi8vIE1vdXNlIEV2ZW50IENvbnN0cnVjdG9yIFBvbHlmaWxsXG4oZnVuY3Rpb24gKHdpbmRvdykge1xuICB0cnkge1xuICAgIG5ldyBNb3VzZUV2ZW50KCd0ZXN0Jyk7XG4gICAgcmV0dXJuIGZhbHNlOyAvLyBObyBuZWVkIHRvIHBvbHlmaWxsXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBOZWVkIHRvIHBvbHlmaWxsIC0gZmFsbCB0aHJvdWdoXG4gIH1cblxuICAvLyBQb2x5ZmlsbHMgRE9NNCBNb3VzZUV2ZW50XG5cbiAgdmFyIE1vdXNlRXZlbnQgPSBmdW5jdGlvbiAoZXZlbnRUeXBlLCBwYXJhbXMpIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UgfTtcbiAgICB2YXIgbW91c2VFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50Jyk7XG4gICAgbW91c2VFdmVudC5pbml0TW91c2VFdmVudChldmVudFR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgd2luZG93LCAwLCAwLCAwLCAwLCAwLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgMCwgbnVsbCk7XG5cbiAgICByZXR1cm4gbW91c2VFdmVudDtcbiAgfTtcblxuICBNb3VzZUV2ZW50LnByb3RvdHlwZSA9IEV2ZW50LnByb3RvdHlwZTtcblxuICB3aW5kb3cuTW91c2VFdmVudCA9IE1vdXNlRXZlbnQ7XG59KSh3aW5kb3cpO1xuLyoganNoaW50IGlnbm9yZTplbmQgKi9cblxudmFyIGV4aXN0cyA9IGV4cG9ydHMuZXhpc3RzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gb2JqICE9PSB1bmRlZmluZWQgJiYgb2JqICE9PSBudWxsO1xufTtcblxuZXhwb3J0cy5jbG9uZSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIG9iaik7XG59O1xuXG5leHBvcnRzLmV4dGVuZCA9IE9iamVjdC5hc3NpZ247XG5cbmV4cG9ydHMuZGVmYXVsdHNEZWVwID0gZnVuY3Rpb24gKHRhcmdldCkge1xuICBpZiAoIWV4aXN0cyh0YXJnZXQpKSB7IC8vIFR5cGVFcnJvciBpZiB1bmRlZmluZWQgb3IgbnVsbFxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IHVuZGVmaW5lZCBvciBudWxsIHRvIG9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHRvID0gZXhwb3J0cy5jbG9uZSh0YXJnZXQpO1xuXG4gIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaW5kZXhdO1xuXG4gICAgaWYgKG5leHRTb3VyY2UgIT09IG51bGwpIHsgLy8gU2tpcCBvdmVyIGlmIHVuZGVmaW5lZCBvciBudWxsXG4gICAgICBmb3IgKHZhciBuZXh0S2V5IGluIG5leHRTb3VyY2UpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChuZXh0U291cmNlLCBuZXh0S2V5KSkge1xuICAgICAgICAgIGlmKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkodG8sIG5leHRLZXkpKSB7XG4gICAgICAgICAgICBpZihleGlzdHModG9bbmV4dEtleV0pICYmIGV4aXN0cyhuZXh0U291cmNlW25leHRLZXldKSAmJiB0eXBlb2YgdG9bbmV4dEtleV0gPT09ICdvYmplY3QnICYmIHR5cGVvZiBuZXh0U291cmNlW25leHRLZXldID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICB0b1tuZXh0S2V5XSA9IGV4cG9ydHMuZGVmYXVsdHNEZWVwKHRvW25leHRLZXldLCBuZXh0U291cmNlW25leHRLZXldKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vIEVsc2U6IERvbid0IG92ZXJyaWRlIGV4aXN0aW5nIHZhbHVlc1xuICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG5leHRTb3VyY2VbbmV4dEtleV0gPT09ICdvYmplY3QnICYmIG5leHRTb3VyY2VbbmV4dEtleV0gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRvW25leHRLZXldID0gZXhwb3J0cy5jbG9uZShuZXh0U291cmNlW25leHRLZXldKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdG9bbmV4dEtleV0gPSBuZXh0U291cmNlW25leHRLZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfSAvLyBlbmQgc291cmNlIGlmIGNoZWNrXG4gICAgICB9IC8vIGVuZCBmb3JcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdG87XG59O1xuXG5leHBvcnRzLmRpc3BhdGNoQ3VzdG9tRXZlbnQgPSBmdW5jdGlvbiAoZWxlbWVudCwgZXZlbnQsIHBhcmFtcykge1xuICB2YXIgZXYgPSBuZXcgQ3VzdG9tRXZlbnQoZXZlbnQsIHBhcmFtcyk7XG4gIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChldik7XG59O1xuXG5leHBvcnRzLmRpc3BhdGNoQ2xpY2tFdmVudCA9IGZ1bmN0aW9uIChlbGVtZW50KSB7XG4gIHZhciBldiA9IG5ldyBNb3VzZUV2ZW50KCdjbGljaycpO1xuICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXYpO1xufTtcbiJdfQ==
