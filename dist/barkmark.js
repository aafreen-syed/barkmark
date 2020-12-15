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
},{"./fixEOL":11,"./html/HtmlChunks":13,"./isVisibleElement":22,"./markdown/MarkdownChunks":25}],3:[function(require,module,exports){
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

},{"./manager":23,"./strings":43}],4:[function(require,module,exports){
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

},{"./html/blockquote":14,"./html/boldOrItalic":15,"./html/codeblock":16,"./html/heading":17,"./html/hr":18,"./html/linkOrImageOrAttachment":19,"./html/list":20,"./markdown/blockquote":26,"./markdown/boldOrItalic":27,"./markdown/codeblock":28,"./markdown/heading":29,"./markdown/hr":30,"./markdown/linkOrImageOrAttachment":31,"./markdown/list":32,"./utils":45}],5:[function(require,module,exports){
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
var mac = /\bMac OS\b/.test(global.navigator.userAgent);
var doc = document;

function Editor (textarea, options) {
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
    parent: textarea.parentNode,
    droparea: tag({ c: 'wk-container-drop' }),
    switchboard: tag({ c: 'wk-switchboard' }),
    commands: tag({ c: 'wk-commands' }),
  };

  this.shortcuts = new ShortcutManager();
  this.modes = {};
  this.mode = 'markdown'; // While initializing we are always showing the textarea "markdown" view

  tag({ t: 'span', c: 'wk-drop-text', x: strings.prompts.drop, p: this.components.droparea });
  tag({ t: 'p', c: ['wk-drop-icon'].concat(o.classes.dropicon).join(' '), p: this.components.droparea });

  // Attach Components
  classes.add(parent, 'wk-container');
  parent.insertBefore(this.components.commands, this.textarea);
  if (this.placeholder) { parent.appendChild(this.placeholder); }
  parent.appendChild(this.components.switchboard);
  // TODO
  // if (this.options.images || this.options.attachments) {
    // parent[mov](this.components.droparea);
    // uploads(parent, this.components.droparea, this, o, remove);
  // }

  if(o.markdown) {
    this.registerMode('markdown', TextSurface, {
      active: (!o.defaultMode || !o[o.defaultMode] || o.defaultMode === 'markdown'),
      shortcutKey: 'm',
    });
  }
  if(o.wysiwyg) {
    this.registerMode('wysiwyg', WysiwygSurface, {
      active: o.defaultMode === 'wysiwyg' || !o.markdown,
      shortcutKey: 'p',
      classes: o.classes.wysiwyg || [],
    });

    this.placeholder = tag({ c: 'wk-wysiwyg-placeholder wk-hide', x: textarea.placeholder });
    this.placeholder.addEventListener('click', this.modes.wysiwyg.surface.focus.bind(this.modes.wysiwyg.surface));
  }

  bindCommands(this, o);
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

  this.shortcuts.clear();

  var parent = this.components.parent;
  classes.rm(parent, 'wk-container');

  // Remove components
  parent.removeChild(this.components.commands);
  if (this.placeholder) { parent.removeChild(this.placeholder); }
  parent.removeChild(this.components.switchboard);

  // Remove all modes that aren't using the textarea
  var modes = Object.keys(this.modes);
  var self = this;
  modes.forEach(function (mode) {
    if(self.modes[mode].element !== self.textarea) {
      parent.removeChild(self.modes[mode].element);
    }
    // TODO Detach change event listeners for surface elements
    this.shortcuts.detach(self.modes[mode].element);
  });

  // TODO
  // if (this.options.images || this.options.attachments) {
    // parent.removeChild(this.components.droparea);
    // uploads(parent, this.components.droparea, this, o, remove);
  // }
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

Editor.prototype.registerMode = function (name, Mode, options) {
  var buttonClasses = ['wk-mode'];
  if(options.active) {
    buttonClasses.push('wk-mode-active');
  } else {
    buttonClasses.push('wk-mode-inactive');
  }

  var stored = this.modes[name] = {
    button: tag({ t: 'button', c: buttonClasses.join(' ') }),
    surface: new Mode(this, options),
  };

  stored.element = stored.surface.current();
  stored.history = new InputHistory(stored.surface, name);

  if(stored.element !== this.textarea) {
    // We need to attach the element
    this.components.parent.insertBefore(stored.element, this.components.switchboard);
  }

  // Attach button
  this.components.switchboard.appendChild(stored.button);
  stored.button.textContent = strings.modes[name] || name;
  stored.button.addEventListener('click', this.setMode.bind(this, name));
  stored.button.type = 'button';
  stored.button.tabIndex = -1; // TODO Investigate better ways to bypass issues here for accessibility
  var title = strings.titles[name];
  if (title) {
    stored.button.setAttribute('title', mac ? macify(title) : title);
  }

  // Register shortcut
  this.shortcuts.attach(stored.element);
  if(options.shortcutKey) {
    this.shortcuts.add(options.shortcutKey, !!options.shift, this.setMode.bind(this, name));
  }

  // Set Mode if Active
  if(options.active) {
    this.setMode(name);
    stored.button.setAttribute('disabled', true);
  }

  return stored;
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

  currentMode.surface.off('change', stashChanges);
  nextMode.surface.writeMarkdown(currentMode.surface.toMarkdown());
  nextMode.surface.on('change', stashChanges);

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

  function stashChanges () {
    if(nextMode.element !== self.textarea) {
      self.textarea.value = nextMode.surface.toMarkdown();
      utils.dispatchBrowserEvent(self.textarea, 'input');
      utils.dispatchBrowserEvent(self.textarea, 'change');
    }
  }
};

Editor.prototype.getMarkdown = function () {
  return this.getSurface().toMarkdown();
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9lZGl0b3IuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xuLy8gdmFyIHVwbG9hZHMgPSByZXF1aXJlKCcuL3VwbG9hZHMnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi9zdHJpbmdzJyk7XG52YXIgYmluZENvbW1hbmRzID0gcmVxdWlyZSgnLi9iaW5kQ29tbWFuZHMnKTtcbnZhciBJbnB1dEhpc3RvcnkgPSByZXF1aXJlKCcuL0lucHV0SGlzdG9yeScpO1xudmFyIFNob3J0Y3V0TWFuYWdlciA9IHJlcXVpcmUoJy4vc2hvcnRjdXRzJyk7XG52YXIgZ2V0Q29tbWFuZEhhbmRsZXIgPSByZXF1aXJlKCcuL2dldENvbW1hbmRIYW5kbGVyJyk7XG52YXIgVGV4dFN1cmZhY2UgPSByZXF1aXJlKCcuL21vZGVzL21hcmtkb3duL3RleHRhcmVhU3VyZmFjZScpO1xudmFyIFd5c2l3eWdTdXJmYWNlID0gcmVxdWlyZSgnLi9tb2Rlcy93eXNpd3lnL3d5c2l3eWdTdXJmYWNlJyk7XG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4vY2xhc3NlcycpO1xudmFyIHJlbmRlcmVycyA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzJyk7XG52YXIgcHJvbXB0ID0gcmVxdWlyZSgnLi9wcm9tcHRzL3Byb21wdCcpO1xudmFyIGNsb3NlUHJvbXB0cyA9IHJlcXVpcmUoJy4vcHJvbXB0cy9jbG9zZScpO1xudmFyIG1hYyA9IC9cXGJNYWMgT1NcXGIvLnRlc3QoZ2xvYmFsLm5hdmlnYXRvci51c2VyQWdlbnQpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xuXG5mdW5jdGlvbiBFZGl0b3IgKHRleHRhcmVhLCBvcHRpb25zKSB7XG4gIHRoaXMudGV4dGFyZWEgPSB0ZXh0YXJlYTtcbiAgdmFyIHBhcmVudCA9IHRleHRhcmVhLnBhcmVudE5vZGU7XG4gIHZhciBvID0gdGhpcy5vcHRpb25zID0gdXRpbHMuZGVmYXVsdHNEZWVwKG9wdGlvbnMgfHwge30sIHtcbiAgICAvLyBEZWZhdWx0IE9wdGlvbiBWYWx1ZXNcbiAgICBtYXJrZG93bjogdHJ1ZSxcbiAgICB3eXNpd3lnOiB0cnVlLFxuICAgIGhyOiBmYWxzZSxcbiAgICBzdG9yYWdlOiB0cnVlLFxuICAgIGZlbmNpbmc6IHRydWUsXG4gICAgcmVuZGVyOiB7XG4gICAgICBtb2Rlczoge30sXG4gICAgICBjb21tYW5kczoge30sXG4gICAgfSxcbiAgICBwcm9tcHRzOiB7XG4gICAgICBsaW5rOiBwcm9tcHQsXG4gICAgICBpbWFnZTogcHJvbXB0LFxuICAgICAgYXR0YWNobWVudDogcHJvbXB0LFxuICAgICAgY2xvc2U6IGNsb3NlUHJvbXB0cyxcbiAgICB9LFxuICAgIGNsYXNzZXM6IHtcbiAgICAgIHd5c2l3eWc6IFtdLFxuICAgICAgcHJvbXB0czoge30sXG4gICAgICBpbnB1dDoge30sXG4gICAgfSxcbiAgfSk7XG5cbiAgaWYgKCFvLm1hcmtkb3duICYmICFvLnd5c2l3eWcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2JhcmttYXJrIGV4cGVjdHMgYXQgbGVhc3Qgb25lIGlucHV0IG1vZGUgdG8gYmUgYXZhaWxhYmxlJyk7XG4gIH1cblxuICBpZiAoby5zdG9yYWdlID09PSB0cnVlKSB7IG8uc3RvcmFnZSA9ICdiYXJrbWFya19pbnB1dF9tb2RlJzsgfVxuXG4gIHZhciBwcmVmZXJlbmNlID0gby5zdG9yYWdlICYmIEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oby5zdG9yYWdlKSk7XG4gIGlmIChwcmVmZXJlbmNlKSB7XG4gICAgby5kZWZhdWx0TW9kZSA9IHByZWZlcmVuY2U7XG4gIH1cblxuICB0aGlzLmNvbXBvbmVudHMgPSB7XG4gICAgdGV4dGFyZWE6IHRleHRhcmVhLFxuICAgIHBhcmVudDogdGV4dGFyZWEucGFyZW50Tm9kZSxcbiAgICBkcm9wYXJlYTogdGFnKHsgYzogJ3drLWNvbnRhaW5lci1kcm9wJyB9KSxcbiAgICBzd2l0Y2hib2FyZDogdGFnKHsgYzogJ3drLXN3aXRjaGJvYXJkJyB9KSxcbiAgICBjb21tYW5kczogdGFnKHsgYzogJ3drLWNvbW1hbmRzJyB9KSxcbiAgfTtcblxuICB0aGlzLnNob3J0Y3V0cyA9IG5ldyBTaG9ydGN1dE1hbmFnZXIoKTtcbiAgdGhpcy5tb2RlcyA9IHt9O1xuICB0aGlzLm1vZGUgPSAnbWFya2Rvd24nOyAvLyBXaGlsZSBpbml0aWFsaXppbmcgd2UgYXJlIGFsd2F5cyBzaG93aW5nIHRoZSB0ZXh0YXJlYSBcIm1hcmtkb3duXCIgdmlld1xuXG4gIHRhZyh7IHQ6ICdzcGFuJywgYzogJ3drLWRyb3AtdGV4dCcsIHg6IHN0cmluZ3MucHJvbXB0cy5kcm9wLCBwOiB0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEgfSk7XG4gIHRhZyh7IHQ6ICdwJywgYzogWyd3ay1kcm9wLWljb24nXS5jb25jYXQoby5jbGFzc2VzLmRyb3BpY29uKS5qb2luKCcgJyksIHA6IHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSB9KTtcblxuICAvLyBBdHRhY2ggQ29tcG9uZW50c1xuICBjbGFzc2VzLmFkZChwYXJlbnQsICd3ay1jb250YWluZXInKTtcbiAgcGFyZW50Lmluc2VydEJlZm9yZSh0aGlzLmNvbXBvbmVudHMuY29tbWFuZHMsIHRoaXMudGV4dGFyZWEpO1xuICBpZiAodGhpcy5wbGFjZWhvbGRlcikgeyBwYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5wbGFjZWhvbGRlcik7IH1cbiAgcGFyZW50LmFwcGVuZENoaWxkKHRoaXMuY29tcG9uZW50cy5zd2l0Y2hib2FyZCk7XG4gIC8vIFRPRE9cbiAgLy8gaWYgKHRoaXMub3B0aW9ucy5pbWFnZXMgfHwgdGhpcy5vcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgLy8gcGFyZW50W21vdl0odGhpcy5jb21wb25lbnRzLmRyb3BhcmVhKTtcbiAgICAvLyB1cGxvYWRzKHBhcmVudCwgdGhpcy5jb21wb25lbnRzLmRyb3BhcmVhLCB0aGlzLCBvLCByZW1vdmUpO1xuICAvLyB9XG5cbiAgaWYoby5tYXJrZG93bikge1xuICAgIHRoaXMucmVnaXN0ZXJNb2RlKCdtYXJrZG93bicsIFRleHRTdXJmYWNlLCB7XG4gICAgICBhY3RpdmU6ICghby5kZWZhdWx0TW9kZSB8fCAhb1tvLmRlZmF1bHRNb2RlXSB8fCBvLmRlZmF1bHRNb2RlID09PSAnbWFya2Rvd24nKSxcbiAgICAgIHNob3J0Y3V0S2V5OiAnbScsXG4gICAgfSk7XG4gIH1cbiAgaWYoby53eXNpd3lnKSB7XG4gICAgdGhpcy5yZWdpc3Rlck1vZGUoJ3d5c2l3eWcnLCBXeXNpd3lnU3VyZmFjZSwge1xuICAgICAgYWN0aXZlOiBvLmRlZmF1bHRNb2RlID09PSAnd3lzaXd5ZycgfHwgIW8ubWFya2Rvd24sXG4gICAgICBzaG9ydGN1dEtleTogJ3AnLFxuICAgICAgY2xhc3Nlczogby5jbGFzc2VzLnd5c2l3eWcgfHwgW10sXG4gICAgfSk7XG5cbiAgICB0aGlzLnBsYWNlaG9sZGVyID0gdGFnKHsgYzogJ3drLXd5c2l3eWctcGxhY2Vob2xkZXIgd2staGlkZScsIHg6IHRleHRhcmVhLnBsYWNlaG9sZGVyIH0pO1xuICAgIHRoaXMucGxhY2Vob2xkZXIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLm1vZGVzLnd5c2l3eWcuc3VyZmFjZS5mb2N1cy5iaW5kKHRoaXMubW9kZXMud3lzaXd5Zy5zdXJmYWNlKSk7XG4gIH1cblxuICBiaW5kQ29tbWFuZHModGhpcywgbyk7XG59XG5cbkVkaXRvci5wcm90b3R5cGUuZ2V0U3VyZmFjZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5zdXJmYWNlO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5hZGRDb21tYW5kID0gZnVuY3Rpb24gKGtleSwgc2hpZnQsIGZuKSB7XG4gIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBmbiA9IHNoaWZ0O1xuICAgIHNoaWZ0ID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgdGhpcy5zaG9ydGN1dHMuYWRkKGtleSwgc2hpZnQsIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCBmbikpO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5hZGRDb21tYW5kQnV0dG9uID0gZnVuY3Rpb24gKGlkLCBrZXksIHNoaWZ0LCBmbikge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGZuID0ga2V5O1xuICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICBzaGlmdCA9IHVuZGVmaW5lZDtcbiAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgZm4gPSBzaGlmdDtcbiAgICBzaGlmdCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHZhciBidXR0b24gPSB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLWNvbW1hbmQnLCBwOiB0aGlzLmNvbXBvbmVudHMuY29tbWFuZHMgfSk7XG4gIHZhciBjdXN0b20gPSB0aGlzLm9wdGlvbnMucmVuZGVyLmNvbW1hbmRzO1xuICB2YXIgcmVuZGVyID0gdHlwZW9mIGN1c3RvbSA9PT0gJ2Z1bmN0aW9uJyA/IGN1c3RvbSA6IHJlbmRlcmVycy5jb21tYW5kcztcbiAgdmFyIHRpdGxlID0gc3RyaW5ncy50aXRsZXNbaWRdO1xuICBpZiAodGl0bGUpIHtcbiAgICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsIG1hYyA/IG1hY2lmeSh0aXRsZSkgOiB0aXRsZSk7XG4gIH1cbiAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgYnV0dG9uLnRhYkluZGV4ID0gLTE7XG4gIHJlbmRlcihidXR0b24sIGlkKTtcbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZ2V0Q29tbWFuZEhhbmRsZXIodGhpcywgdGhpcy5tb2Rlc1t0aGlzLm1vZGVdLmhpc3RvcnksIGZuKSk7XG4gIGlmIChrZXkpIHtcbiAgICB0aGlzLmFkZENvbW1hbmQoa2V5LCBzaGlmdCwgZm4pO1xuICB9XG4gIHJldHVybiBidXR0b247XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnJ1bkNvbW1hbmQgPSBmdW5jdGlvbiAoZm4pIHtcbiAgZ2V0Q29tbWFuZEhhbmRsZXIodGhpcywgdGhpcy5tb2Rlc1t0aGlzLm1vZGVdLmhpc3RvcnksIHJlYXJyYW5nZSkobnVsbCk7XG5cbiAgZnVuY3Rpb24gcmVhcnJhbmdlIChlLCBtb2RlLCBjaHVua3MpIHtcbiAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBjaHVua3MsIG1vZGUpO1xuICB9XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnBhcnNlTWFya2Rvd24gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm9wdGlvbnMucGFyc2VNYXJrZG93bi5hcHBseSh0aGlzLm9wdGlvbnMucGFyc2VNYXJrZG93biwgYXJndW1lbnRzKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUucGFyc2VIVE1MID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5vcHRpb25zLnBhcnNlSFRNTC5hcHBseSh0aGlzLm9wdGlvbnMucGFyc2VIVE1MLCBhcmd1bWVudHMpO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5tb2RlICE9PSAnbWFya2Rvd24nKSB7XG4gICAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IHRoaXMuZ2V0TWFya2Rvd24oKTtcbiAgfVxuICBjbGFzc2VzLnJtKHRoaXMudGV4dGFyZWEsICd3ay1oaWRlJyk7XG5cbiAgdGhpcy5zaG9ydGN1dHMuY2xlYXIoKTtcblxuICB2YXIgcGFyZW50ID0gdGhpcy5jb21wb25lbnRzLnBhcmVudDtcbiAgY2xhc3Nlcy5ybShwYXJlbnQsICd3ay1jb250YWluZXInKTtcblxuICAvLyBSZW1vdmUgY29tcG9uZW50c1xuICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5jb21wb25lbnRzLmNvbW1hbmRzKTtcbiAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMucGxhY2Vob2xkZXIpOyB9XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQpO1xuXG4gIC8vIFJlbW92ZSBhbGwgbW9kZXMgdGhhdCBhcmVuJ3QgdXNpbmcgdGhlIHRleHRhcmVhXG4gIHZhciBtb2RlcyA9IE9iamVjdC5rZXlzKHRoaXMubW9kZXMpO1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG1vZGVzLmZvckVhY2goZnVuY3Rpb24gKG1vZGUpIHtcbiAgICBpZihzZWxmLm1vZGVzW21vZGVdLmVsZW1lbnQgIT09IHNlbGYudGV4dGFyZWEpIHtcbiAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChzZWxmLm1vZGVzW21vZGVdLmVsZW1lbnQpO1xuICAgIH1cbiAgICAvLyBUT0RPIERldGFjaCBjaGFuZ2UgZXZlbnQgbGlzdGVuZXJzIGZvciBzdXJmYWNlIGVsZW1lbnRzXG4gICAgdGhpcy5zaG9ydGN1dHMuZGV0YWNoKHNlbGYubW9kZXNbbW9kZV0uZWxlbWVudCk7XG4gIH0pO1xuXG4gIC8vIFRPRE9cbiAgLy8gaWYgKHRoaXMub3B0aW9ucy5pbWFnZXMgfHwgdGhpcy5vcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgLy8gcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSk7XG4gICAgLy8gdXBsb2FkcyhwYXJlbnQsIHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSwgdGhpcywgbywgcmVtb3ZlKTtcbiAgLy8gfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS52YWx1ZSA9IGZ1bmN0aW9uIGdldE9yU2V0VmFsdWUgKGlucHV0KSB7XG4gIHZhciBtYXJrZG93biA9IFN0cmluZyhpbnB1dCk7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICB2YXIgc2V0cyA9IGFyZ3VtZW50cy5sZW5ndGggPT09IDE7XG4gIGlmIChzZXRzKSB7XG4gICAgaWYgKHRoaXMubW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgICBtYXJrZG93biA9IGFzSHRtbCgpO1xuICAgIH1cbiAgICB0aGlzLmdldFN1cmZhY2UoKS53cml0ZShtYXJrZG93bik7XG4gICAgdGhpcy5tb2Rlc1t0aGlzLm1vZGVdLmhpc3RvcnkucmVzZXQoKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzLmdldE1hcmtkb3duKCk7XG5cbiAgZnVuY3Rpb24gYXNIdG1sICgpIHtcbiAgICByZXR1cm4gc2VsZi5vcHRpb25zLnBhcnNlTWFya2Rvd24obWFya2Rvd24pO1xuICB9XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnJlZ2lzdGVyTW9kZSA9IGZ1bmN0aW9uIChuYW1lLCBNb2RlLCBvcHRpb25zKSB7XG4gIHZhciBidXR0b25DbGFzc2VzID0gWyd3ay1tb2RlJ107XG4gIGlmKG9wdGlvbnMuYWN0aXZlKSB7XG4gICAgYnV0dG9uQ2xhc3Nlcy5wdXNoKCd3ay1tb2RlLWFjdGl2ZScpO1xuICB9IGVsc2Uge1xuICAgIGJ1dHRvbkNsYXNzZXMucHVzaCgnd2stbW9kZS1pbmFjdGl2ZScpO1xuICB9XG5cbiAgdmFyIHN0b3JlZCA9IHRoaXMubW9kZXNbbmFtZV0gPSB7XG4gICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogYnV0dG9uQ2xhc3Nlcy5qb2luKCcgJykgfSksXG4gICAgc3VyZmFjZTogbmV3IE1vZGUodGhpcywgb3B0aW9ucyksXG4gIH07XG5cbiAgc3RvcmVkLmVsZW1lbnQgPSBzdG9yZWQuc3VyZmFjZS5jdXJyZW50KCk7XG4gIHN0b3JlZC5oaXN0b3J5ID0gbmV3IElucHV0SGlzdG9yeShzdG9yZWQuc3VyZmFjZSwgbmFtZSk7XG5cbiAgaWYoc3RvcmVkLmVsZW1lbnQgIT09IHRoaXMudGV4dGFyZWEpIHtcbiAgICAvLyBXZSBuZWVkIHRvIGF0dGFjaCB0aGUgZWxlbWVudFxuICAgIHRoaXMuY29tcG9uZW50cy5wYXJlbnQuaW5zZXJ0QmVmb3JlKHN0b3JlZC5lbGVtZW50LCB0aGlzLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQpO1xuICB9XG5cbiAgLy8gQXR0YWNoIGJ1dHRvblxuICB0aGlzLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQuYXBwZW5kQ2hpbGQoc3RvcmVkLmJ1dHRvbik7XG4gIHN0b3JlZC5idXR0b24udGV4dENvbnRlbnQgPSBzdHJpbmdzLm1vZGVzW25hbWVdIHx8IG5hbWU7XG4gIHN0b3JlZC5idXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCB0aGlzLnNldE1vZGUuYmluZCh0aGlzLCBuYW1lKSk7XG4gIHN0b3JlZC5idXR0b24udHlwZSA9ICdidXR0b24nO1xuICBzdG9yZWQuYnV0dG9uLnRhYkluZGV4ID0gLTE7IC8vIFRPRE8gSW52ZXN0aWdhdGUgYmV0dGVyIHdheXMgdG8gYnlwYXNzIGlzc3VlcyBoZXJlIGZvciBhY2Nlc3NpYmlsaXR5XG4gIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW25hbWVdO1xuICBpZiAodGl0bGUpIHtcbiAgICBzdG9yZWQuYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICB9XG5cbiAgLy8gUmVnaXN0ZXIgc2hvcnRjdXRcbiAgdGhpcy5zaG9ydGN1dHMuYXR0YWNoKHN0b3JlZC5lbGVtZW50KTtcbiAgaWYob3B0aW9ucy5zaG9ydGN1dEtleSkge1xuICAgIHRoaXMuc2hvcnRjdXRzLmFkZChvcHRpb25zLnNob3J0Y3V0S2V5LCAhIW9wdGlvbnMuc2hpZnQsIHRoaXMuc2V0TW9kZS5iaW5kKHRoaXMsIG5hbWUpKTtcbiAgfVxuXG4gIC8vIFNldCBNb2RlIGlmIEFjdGl2ZVxuICBpZihvcHRpb25zLmFjdGl2ZSkge1xuICAgIHRoaXMuc2V0TW9kZShuYW1lKTtcbiAgICBzdG9yZWQuYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCB0cnVlKTtcbiAgfVxuXG4gIHJldHVybiBzdG9yZWQ7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnNldE1vZGUgPSBmdW5jdGlvbiAoZ29Ub01vZGUsIGUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY3VycmVudE1vZGUgPSB0aGlzLm1vZGVzW3RoaXMubW9kZV0gfHwge307XG4gIHZhciBuZXh0TW9kZSA9IHRoaXMubW9kZXNbZ29Ub01vZGVdO1xuICB2YXIgb2xkID0gY3VycmVudE1vZGUuYnV0dG9uO1xuICB2YXIgYnV0dG9uID0gbmV4dE1vZGUuYnV0dG9uO1xuICB2YXIgZm9jdXNpbmcgPSAhIWUgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IGN1cnJlbnRNb2RlLmVsZW1lbnQgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IG5leHRNb2RlLmVsZW1lbnQ7XG5cbiAgc3RvcChlKTtcblxuICBpZiAoY3VycmVudE1vZGUgPT09IG5leHRNb2RlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy50ZXh0YXJlYS5ibHVyKCk7IC8vIGF2ZXJ0IGNocm9tZSByZXBhaW50IGJ1Z3NcblxuICBjdXJyZW50TW9kZS5zdXJmYWNlLm9mZignY2hhbmdlJywgc3Rhc2hDaGFuZ2VzKTtcbiAgbmV4dE1vZGUuc3VyZmFjZS53cml0ZU1hcmtkb3duKGN1cnJlbnRNb2RlLnN1cmZhY2UudG9NYXJrZG93bigpKTtcbiAgbmV4dE1vZGUuc3VyZmFjZS5vbignY2hhbmdlJywgc3Rhc2hDaGFuZ2VzKTtcblxuICBjbGFzc2VzLmFkZChjdXJyZW50TW9kZS5lbGVtZW50LCAnd2staGlkZScpO1xuICBjbGFzc2VzLnJtKG5leHRNb2RlLmVsZW1lbnQsICd3ay1oaWRlJyk7XG5cbiAgaWYgKGdvVG9Nb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICBpZiAodGhpcy5wbGFjZWhvbGRlcikgeyBjbGFzc2VzLnJtKHRoaXMucGxhY2Vob2xkZXIsICd3ay1oaWRlJyk7IH1cbiAgfSBlbHNlIHtcbiAgICBpZiAodGhpcy5wbGFjZWhvbGRlcikgeyBjbGFzc2VzLmFkZCh0aGlzLnBsYWNlaG9sZGVyLCAnd2staGlkZScpOyB9XG4gIH1cblxuICBpZiAoZm9jdXNpbmcpIHtcbiAgICBuZXh0TW9kZS5zdXJmYWNlLmZvY3VzKCk7XG4gIH1cblxuICBjbGFzc2VzLmFkZChidXR0b24sICd3ay1tb2RlLWFjdGl2ZScpO1xuICBjbGFzc2VzLnJtKG9sZCwgJ3drLW1vZGUtYWN0aXZlJyk7XG4gIGNsYXNzZXMuYWRkKG9sZCwgJ3drLW1vZGUtaW5hY3RpdmUnKTtcbiAgY2xhc3Nlcy5ybShidXR0b24sICd3ay1tb2RlLWluYWN0aXZlJyk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyk7XG4gIG9sZC5yZW1vdmVBdHRyaWJ1dGUoJ2Rpc2FibGVkJyk7XG4gIHRoaXMubW9kZSA9IGdvVG9Nb2RlO1xuXG4gIGlmICh0aGlzLm9wdGlvbnMuc3RvcmFnZSkge1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHRoaXMub3B0aW9ucy5zdG9yYWdlLCBKU09OLnN0cmluZ2lmeShnb1RvTW9kZSkpO1xuICB9XG5cbiAgLy8gdGhpcy5oaXN0b3J5LnNldElucHV0TW9kZShnb1RvTW9kZSk7XG4gIGZpcmVMYXRlci5jYWxsKHRoaXMsICdiYXJrbWFyay1tb2RlLWNoYW5nZScpO1xuXG4gIGZ1bmN0aW9uIHN0YXNoQ2hhbmdlcyAoKSB7XG4gICAgaWYobmV4dE1vZGUuZWxlbWVudCAhPT0gc2VsZi50ZXh0YXJlYSkge1xuICAgICAgc2VsZi50ZXh0YXJlYS52YWx1ZSA9IG5leHRNb2RlLnN1cmZhY2UudG9NYXJrZG93bigpO1xuICAgICAgdXRpbHMuZGlzcGF0Y2hCcm93c2VyRXZlbnQoc2VsZi50ZXh0YXJlYSwgJ2lucHV0Jyk7XG4gICAgICB1dGlscy5kaXNwYXRjaEJyb3dzZXJFdmVudChzZWxmLnRleHRhcmVhLCAnY2hhbmdlJyk7XG4gICAgfVxuICB9XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLmdldE1hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5nZXRTdXJmYWNlKCkudG9NYXJrZG93bigpO1xufTtcblxuLypcbiAgdmFyIGVkaXRvciA9IHtcbiAgICBhZGRDb21tYW5kOiBhZGRDb21tYW5kLFxuICAgIGFkZENvbW1hbmRCdXR0b246IGFkZENvbW1hbmRCdXR0b24sXG4gICAgcnVuQ29tbWFuZDogcnVuQ29tbWFuZCxcbiAgICBwYXJzZU1hcmtkb3duOiBvLnBhcnNlTWFya2Rvd24sXG4gICAgcGFyc2VIVE1MOiBvLnBhcnNlSFRNTCxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHZhbHVlOiBnZXRPclNldFZhbHVlLFxuICAgIHRleHRhcmVhOiB0ZXh0YXJlYSxcbiAgICBlZGl0YWJsZTogby53eXNpd3lnID8gZWRpdGFibGUgOiBudWxsLFxuICAgIHNldE1vZGU6IHBlcnNpc3RNb2RlLFxuICAgIGhpc3Rvcnk6IHtcbiAgICAgIHVuZG86IGhpc3RvcnkudW5kbyxcbiAgICAgIHJlZG86IGhpc3RvcnkucmVkbyxcbiAgICAgIGNhblVuZG86IGhpc3RvcnkuY2FuVW5kbyxcbiAgICAgIGNhblJlZG86IGhpc3RvcnkuY2FuUmVkb1xuICAgIH0sXG4gICAgbW9kZTogJ21hcmtkb3duJ1xuICB9O1xuKi9cblxuZnVuY3Rpb24gZmlyZUxhdGVyICh0eXBlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2V0VGltZW91dChmdW5jdGlvbiBmaXJlICgpIHtcbiAgICB1dGlscy5kaXNwYXRjaEN1c3RvbUV2ZW50KHNlbGYudGV4dGFyZWEsIHR5cGUpO1xuICB9LCAwKTtcbn1cblxuZnVuY3Rpb24gdGFnIChvcHRpb25zKSB7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQoby50IHx8ICdkaXYnKTtcbiAgZWwuY2xhc3NOYW1lID0gby5jIHx8ICcnO1xuICBlbC50ZXh0Q29udGVudCA9IG8ueCB8fCAnJztcbiAgaWYgKG8ucCkgeyBvLnAuYXBwZW5kQ2hpbGQoZWwpOyB9XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gc3RvcCAoZSkge1xuICBpZiAoZSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IH1cbn1cblxuZnVuY3Rpb24gbWFjaWZ5ICh0ZXh0KSB7XG4gIHJldHVybiB0ZXh0XG4gICAgLnJlcGxhY2UoL1xcYmN0cmxcXGIvaSwgJ1xcdTIzMTgnKVxuICAgIC5yZXBsYWNlKC9cXGJhbHRcXGIvaSwgJ1xcdTIzMjUnKVxuICAgIC5yZXBsYWNlKC9cXGJzaGlmdFxcYi9pLCAnXFx1MjFlNycpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEVkaXRvcjtcbiJdfQ==
},{"./InputHistory":1,"./bindCommands":4,"./classes":7,"./getCommandHandler":12,"./modes/markdown/textareaSurface":35,"./modes/wysiwyg/wysiwygSurface":36,"./prompts/close":38,"./prompts/prompt":39,"./renderers":41,"./shortcuts":42,"./strings":43,"./utils":45}],9:[function(require,module,exports){
'use strict';

// Event Object
function Evt(name, details) {
  this.name = name;
  this.details = details;
  this.executionStopped = false;
}
Evt.prototype.stopPropagation = Evt.prototype.stopExecution = function () {
  this.executionStopped = true;
};

// Extension Functionality
function on (event, callback) {
  this._events = this._events || {};
  if(!this._events[event]) {
    this._events[event] = [];
  }

  this._events[event].push(callback);
}

function off (event, callback) {
  this._events = this._events || {};
  if(!this._events[event]) {
    return false;
  }

  if(arguments.length === 1) {
    delete this._events[event];
  } else {
    var idx = this._events[event].indexOf(callback);

    if(idx < 0) { return false; }
    this._events[event].splice(idx, 1);

    if(!this._events[event].length) {
      delete this._events[event];
    }
  }

  return true;
}

function trigger (event) {
  this._events = this._events || {};
  if(!this._events[event]) {
    return;
  }

  var evt = new Evt(event, Array.prototype.slice.call(arguments, 1));
  var args = Array.prototype.slice.call(arguments, 1);
  args.unshift(evt);
  for(var h = 0; h < this._events[event].length; h++) {
    this._events[event][h].apply(this, args);
    if(evt.executionStopped) {
      break;
    }
  }

  return evt;
}

module.exports = {
  extend: function (obj) {
    obj.prototype.on = on.bind(obj);
    obj.prototype.off = off.bind(obj);
    obj.prototype.trigger = trigger.bind(obj);
  },
};

},{}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
'use strict';

function fixEOL (text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = fixEOL;

},{}],12:[function(require,module,exports){
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

},{"./InputState":2}],13:[function(require,module,exports){
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

},{"../chunks/trim":6}],14:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function blockquote (chunks) {
  wrapping('blockquote', strings.placeholders.quote, chunks);
}

module.exports = blockquote;

},{"../strings":43,"./wrapping":21}],15:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function boldOrItalic (chunks, type) {
  wrapping(type === 'bold' ? 'strong' : 'em', strings.placeholders[type], chunks);
}

module.exports = boldOrItalic;

},{"../strings":43,"./wrapping":21}],16:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function codeblock (chunks) {
  wrapping('pre><code', strings.placeholders.code, chunks);
}

module.exports = codeblock;

},{"../strings":43,"./wrapping":21}],17:[function(require,module,exports){
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

},{"../strings":43}],18:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.before += '\n<hr>\n';
  chunks.selection = '';
}

module.exports = hr;

},{}],19:[function(require,module,exports){
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
      function tagopen (link) { return '<a href="' + link.href + '"' + getTitle(link) + classes + ' target="_blank" rel="noopener noreferrer">'; }
      function tagclose () { return '</a>'; }
      function toAnotherLink (link) { return ' ' + tagopen(link) + tagclose(); }
    }
  }
}

module.exports = linkOrImageOrAttachment;

},{"../chunks/parseLinkInput":5,"../once":37,"../strings":43,"../utils":45}],20:[function(require,module,exports){
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

},{"../strings":43}],21:[function(require,module,exports){
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

},{}],22:[function(require,module,exports){
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
},{}],23:[function(require,module,exports){
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

},{"./editor":8}],24:[function(require,module,exports){
'use strict';

function many (text, times) {
  return new Array(times + 1).join(text);
}

module.exports = many;

},{}],25:[function(require,module,exports){
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

},{"../chunks/trim":6,"../extendRegExp":10,"../many":24}],26:[function(require,module,exports){
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

},{"../strings":43,"./settings":33,"./wrapping":34}],27:[function(require,module,exports){
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

},{"../strings":43}],28:[function(require,module,exports){
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

},{"../strings":43}],29:[function(require,module,exports){
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

},{"../many":24,"../strings":43}],30:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.startTag = '----------\n';
  chunks.selection = '';
  chunks.skip({ left: 2, right: 1, any: true });
}

module.exports = hr;

},{}],31:[function(require,module,exports){
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

},{"../chunks/parseLinkInput":5,"../once":37,"../strings":43}],32:[function(require,module,exports){
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

},{"../many":24,"../strings":43,"./settings":33,"./wrapping":34}],33:[function(require,module,exports){
'use strict';

module.exports = {
  lineLength: 72
};

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
'use strict';

var Events = require('../../events');
var utils = require('../../utils');

function TextSurface (editor) {
  var textarea = this.textarea = editor.textarea;

  var self = this;
  var _cached = this.read();
  var debouncedChange = utils.debounce(sendChange, 100);

  textarea.addEventListener('blur', sendChange);
  textarea.addEventListener('cut', sendChange);
  textarea.addEventListener('paste', sendChange);
  textarea.addEventListener('change', debouncedChange);
  textarea.addEventListener('input', debouncedChange);
  textarea.addEventListener('keypress', debouncedChange);

  function sendChange () {
    var updated = self.read();
    if(_cached !== updated) {
      _cached = updated;
      self.trigger('change', updated);
    }
  }
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

TextSurface.prototype.toMarkdown = function () {
  return this.read();
};

TextSurface.prototype.writeMarkdown = function (markdown) {
  return this.write((markdown || '').trim());
};

TextSurface.prototype.toHTML = function () {
  return this.editor.parseMarkdown(this.read());
};
Events.extend(TextSurface);

module.exports = TextSurface;

},{"../../events":9,"../../utils":45}],36:[function(require,module,exports){
(function (global){
'use strict';

var Events = require('../../events');
var utils = require('../../utils');

var doc = global.document;
var ropen = /^(<[^>]+(?: [^>]*)?>)/;
var rclose = /(<\/[^>]+>)$/;
var rparagraph = /^<p><\/p>\n?$/i;

function WysiwygSurface (editor, options) {
  this.editor = editor;
  var editable = this.editable = doc.createElement('div');
  editable.className = ['wk-wysiwyg', 'wk-hide'].concat(options.classes).join(' ');
  editable.contentEditable = true;

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

WysiwygSurface.prototype.toMarkdown = function () {
  return this.editor.parseHTML(this.read());
};

WysiwygSurface.prototype.writeMarkdown = function (markdown) {
  var html = this.editor.parseMarkdown(markdown || '')
    .replace(rparagraph, '') // Remove empty <p> tags
    .trim();
  return this.write(html);
};

WysiwygSurface.prototype.toHTML = function () {
  return this.read();
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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9tb2Rlcy93eXNpd3lnL3d5c2l3eWdTdXJmYWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vZXZlbnRzJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi8uLi91dGlscycpO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIHJvcGVuID0gL14oPFtePl0rKD86IFtePl0qKT8+KS87XG52YXIgcmNsb3NlID0gLyg8XFwvW14+XSs+KSQvO1xudmFyIHJwYXJhZ3JhcGggPSAvXjxwPjxcXC9wPlxcbj8kL2k7XG5cbmZ1bmN0aW9uIFd5c2l3eWdTdXJmYWNlIChlZGl0b3IsIG9wdGlvbnMpIHtcbiAgdGhpcy5lZGl0b3IgPSBlZGl0b3I7XG4gIHZhciBlZGl0YWJsZSA9IHRoaXMuZWRpdGFibGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGVkaXRhYmxlLmNsYXNzTmFtZSA9IFsnd2std3lzaXd5ZycsICd3ay1oaWRlJ10uY29uY2F0KG9wdGlvbnMuY2xhc3Nlcykuam9pbignICcpO1xuICBlZGl0YWJsZS5jb250ZW50RWRpdGFibGUgPSB0cnVlO1xuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIF9jYWNoZWQgPSB0aGlzLnJlYWQoKTtcbiAgdmFyIGRlYm91bmNlZENoYW5nZSA9IHV0aWxzLmRlYm91bmNlKHNlbmRDaGFuZ2UsIDIwMCk7XG5cbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIHNlbmRDaGFuZ2UpO1xuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdjdXQnLCBzZW5kQ2hhbmdlKTtcbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcigncGFzdGUnLCBzZW5kQ2hhbmdlKTtcbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcigndGV4dGlucHV0JywgZGVib3VuY2VkQ2hhbmdlKTtcbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBkZWJvdW5jZWRDaGFuZ2UpO1xuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIGRlYm91bmNlZENoYW5nZSk7XG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgZGVib3VuY2VkQ2hhbmdlKTtcblxuICBmdW5jdGlvbiBzZW5kQ2hhbmdlICgpIHtcbiAgICB2YXIgdXBkYXRlZCA9IHNlbGYucmVhZCgpO1xuICAgIGlmKF9jYWNoZWQgIT09IHVwZGF0ZWQpIHtcbiAgICAgIF9jYWNoZWQgPSB1cGRhdGVkO1xuICAgICAgc2VsZi50cmlnZ2VyKCdjaGFuZ2UnLCB1cGRhdGVkKTtcbiAgICB9XG4gIH1cbn1cblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLmZvY3VzID0gZnVuY3Rpb24gKGZvcmNlSW1tZWRpYXRlKSB7XG4gIGlmKGZvcmNlSW1tZWRpYXRlKSB7XG4gICAgdGhpcy5lZGl0YWJsZS5mb2N1cygpO1xuICB9IGVsc2Uge1xuICAgIHNldFRpbWVvdXQodGhpcy5lZGl0YWJsZS5mb2N1cy5iaW5kKHRoaXMuZWRpdGFibGUpLCAwKTtcbiAgfVxufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVkaXRhYmxlLmlubmVySFRNTDtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICB0aGlzLmVkaXRhYmxlLmlubmVySFRNTCA9IHZhbHVlO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVkaXRhYmxlO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLndyaXRlU2VsZWN0aW9uID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciBjaHVua3MgPSBzdGF0ZS5jYWNoZWRDaHVua3MgfHwgc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gIHZhciBzdGFydCA9IHVuZXNjYXBlVGV4dChjaHVua3MuYmVmb3JlKS5sZW5ndGg7XG4gIHZhciBlbmQgPSBzdGFydCArIHVuZXNjYXBlVGV4dChjaHVua3Muc2VsZWN0aW9uKS5sZW5ndGg7XG4gIHZhciBwID0gZG9jLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciBzdGFydFJhbmdlU2V0ID0gZmFsc2U7XG4gIHZhciBlbmRSYW5nZVNldCA9IGZhbHNlO1xuXG4gIHdhbGsodGhpcy5lZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgdGhpcy5lZGl0YWJsZS5mb2N1cygpO1xuICB2YXIgc2VsZWN0aW9uID0gZG9jLmdldFNlbGVjdGlvbigpO1xuICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gIHNlbGVjdGlvbi5hZGRSYW5nZShwKTtcblxuICBmdW5jdGlvbiBwZWVrIChjb250ZXh0LCBlbCkge1xuICAgIHZhciBjdXJzb3IgPSB1bmVzY2FwZVRleHQoY29udGV4dC50ZXh0KS5sZW5ndGg7XG4gICAgdmFyIGNvbnRlbnQgPSByZWFkTm9kZShlbCwgZmFsc2UpLmxlbmd0aDtcbiAgICB2YXIgc3VtID0gY3Vyc29yICsgY29udGVudDtcbiAgICBpZiAoIXN0YXJ0UmFuZ2VTZXQgJiYgc3VtID49IHN0YXJ0KSB7XG4gICAgICBwLnNldFN0YXJ0KGVsLCBib3VuZGVkKHN0YXJ0IC0gY3Vyc29yKSk7XG4gICAgICBzdGFydFJhbmdlU2V0ID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKCFlbmRSYW5nZVNldCAmJiBzdW0gPj0gZW5kKSB7XG4gICAgICBwLnNldEVuZChlbCwgYm91bmRlZChlbmQgLSBjdXJzb3IpKTtcbiAgICAgIGVuZFJhbmdlU2V0ID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBib3VuZGVkIChvZmZzZXQpIHtcbiAgICAgIHJldHVybiBNYXRoLm1heCgwLCBNYXRoLm1pbihjb250ZW50LCBvZmZzZXQpKTtcbiAgICB9XG4gIH1cbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5yZWFkU2VsZWN0aW9uID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciBzZWwgPSBkb2MuZ2V0U2VsZWN0aW9uKCk7XG4gIHZhciBkaXN0YW5jZSA9IHdhbGsodGhpcy5lZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgdmFyIHN0YXJ0ID0gZGlzdGFuY2Uuc3RhcnQgfHwgMDtcbiAgdmFyIGVuZCA9IGRpc3RhbmNlLmVuZCB8fCAwO1xuXG4gIHN0YXRlLnRleHQgPSBkaXN0YW5jZS50ZXh0O1xuXG4gIGlmIChlbmQgPiBzdGFydCkge1xuICAgIHN0YXRlLnN0YXJ0ID0gc3RhcnQ7XG4gICAgc3RhdGUuZW5kID0gZW5kO1xuICB9IGVsc2Uge1xuICAgIHN0YXRlLnN0YXJ0ID0gZW5kO1xuICAgIHN0YXRlLmVuZCA9IHN0YXJ0O1xuICB9XG5cbiAgZnVuY3Rpb24gcGVlayAoY29udGV4dCwgZWwpIHtcbiAgICB2YXIgZWxUZXh0ID0gKGVsLnRleHRDb250ZW50IHx8IGVsLmlubmVyVGV4dCB8fCAnJyk7XG5cbiAgICBpZiAoZWwgPT09IHNlbC5hbmNob3JOb2RlKSB7XG4gICAgICBjb250ZXh0LnN0YXJ0ID0gY29udGV4dC50ZXh0Lmxlbmd0aCArIGVzY2FwZU5vZGVUZXh0KGVsVGV4dC5zdWJzdHJpbmcoMCwgc2VsLmFuY2hvck9mZnNldCkpLmxlbmd0aDtcbiAgICB9XG4gICAgaWYgKGVsID09PSBzZWwuZm9jdXNOb2RlKSB7XG4gICAgICBjb250ZXh0LmVuZCA9IGNvbnRleHQudGV4dC5sZW5ndGggKyBlc2NhcGVOb2RlVGV4dChlbFRleHQuc3Vic3RyaW5nKDAsIHNlbC5mb2N1c09mZnNldCkpLmxlbmd0aDtcbiAgICB9XG4gIH1cbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS50b01hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lZGl0b3IucGFyc2VIVE1MKHRoaXMucmVhZCgpKTtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS53cml0ZU1hcmtkb3duID0gZnVuY3Rpb24gKG1hcmtkb3duKSB7XG4gIHZhciBodG1sID0gdGhpcy5lZGl0b3IucGFyc2VNYXJrZG93bihtYXJrZG93biB8fCAnJylcbiAgICAucmVwbGFjZShycGFyYWdyYXBoLCAnJykgLy8gUmVtb3ZlIGVtcHR5IDxwPiB0YWdzXG4gICAgLnRyaW0oKTtcbiAgcmV0dXJuIHRoaXMud3JpdGUoaHRtbCk7XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUudG9IVE1MID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5yZWFkKCk7XG59O1xuXG5mdW5jdGlvbiB3YWxrIChlbCwgcGVlaywgY3R4LCBzaWJsaW5ncykge1xuICB2YXIgY29udGV4dCA9IGN0eCB8fCB7IHRleHQ6ICcnIH07XG5cbiAgaWYgKCFlbCkge1xuICAgIHJldHVybiBjb250ZXh0O1xuICB9XG5cbiAgdmFyIGVsTm9kZSA9IGVsLm5vZGVUeXBlID09PSAxO1xuICB2YXIgdGV4dE5vZGUgPSBlbC5ub2RlVHlwZSA9PT0gMztcblxuICBwZWVrKGNvbnRleHQsIGVsKTtcblxuICBpZiAodGV4dE5vZGUpIHtcbiAgICBjb250ZXh0LnRleHQgKz0gcmVhZE5vZGUoZWwpO1xuICB9XG4gIGlmIChlbE5vZGUpIHtcbiAgICBpZiAoZWwub3V0ZXJIVE1MLm1hdGNoKHJvcGVuKSkgeyBjb250ZXh0LnRleHQgKz0gUmVnRXhwLiQxOyB9XG4gICAgQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZWwuY2hpbGROb2RlcykuZm9yRWFjaCh3YWxrQ2hpbGRyZW4pO1xuICAgIGlmIChlbC5vdXRlckhUTUwubWF0Y2gocmNsb3NlKSkgeyBjb250ZXh0LnRleHQgKz0gUmVnRXhwLiQxOyB9XG4gIH1cbiAgaWYgKHNpYmxpbmdzICE9PSBmYWxzZSAmJiBlbC5uZXh0U2libGluZykge1xuICAgIHJldHVybiB3YWxrKGVsLm5leHRTaWJsaW5nLCBwZWVrLCBjb250ZXh0KTtcbiAgfVxuICByZXR1cm4gY29udGV4dDtcblxuICBmdW5jdGlvbiB3YWxrQ2hpbGRyZW4gKGNoaWxkKSB7XG4gICAgd2FsayhjaGlsZCwgcGVlaywgY29udGV4dCwgZmFsc2UpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWROb2RlIChlbCwgZXNjYXBlKSB7XG4gIGlmKGVsLm5vZGVUeXBlID09PSAzKSB7XG4gICAgaWYoZXNjYXBlID09PSBmYWxzZSkge1xuICAgICAgcmV0dXJuIGVsLnRleHRDb250ZW50IHx8IGVsLmlubmVyVGV4dCB8fCAnJztcbiAgICB9XG5cbiAgICByZXR1cm4gZXNjYXBlTm9kZVRleHQoZWwpO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuZnVuY3Rpb24gZXNjYXBlTm9kZVRleHQgKGVsKSB7XG4gIGVsID0gZWwgfHwgJyc7XG4gIGlmKGVsLm5vZGVUeXBlID09PSAzKSB7XG4gICAgZWwgPSBlbC5jbG9uZU5vZGUoKTtcbiAgfSBlbHNlIHtcbiAgICBlbCA9IGRvYy5jcmVhdGVUZXh0Tm9kZShlbCk7XG4gIH1cblxuICAvLyBVc2luZyBicm93c2VyIGVzY2FwaW5nIHRvIGNsZWFuIHVwIGFueSBzcGVjaWFsIGNoYXJhY3RlcnNcbiAgdmFyIHRvVGV4dCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9UZXh0LmFwcGVuZENoaWxkKGVsKTtcbiAgcmV0dXJuIHRvVGV4dC5pbm5lckhUTUwgfHwgJyc7XG59XG5cbmZ1bmN0aW9uIHVuZXNjYXBlVGV4dCAoZWwpIHtcbiAgaWYoZWwubm9kZVR5cGUpIHtcbiAgICByZXR1cm4gZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnO1xuICB9XG5cbiAgdmFyIHRvVGV4dCA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgdG9UZXh0LnRleHRDb250ZW50ID0gZWw7XG4gIHJldHVybiB0b1RleHQudGV4dENvbnRlbnQ7XG59XG5cbkV2ZW50cy5leHRlbmQoV3lzaXd5Z1N1cmZhY2UpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFd5c2l3eWdTdXJmYWNlO1xuIl19
},{"../../events":9,"../../utils":45}],37:[function(require,module,exports){
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

},{}],38:[function(require,module,exports){
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

},{}],39:[function(require,module,exports){
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
    // options.surface.focus(options.mode);
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

},{"../classes":7,"../strings":43,"../uploads":44,"./render":40}],40:[function(require,module,exports){
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
},{"../classes":7,"../strings":43}],41:[function(require,module,exports){
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

},{"./strings":43}],42:[function(require,module,exports){
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

},{}],43:[function(require,module,exports){
'use strict';

module.exports = {
  placeholders: {
    bold: 'strong text',
    italic: 'emphasized text',
    quote: 'quoted text',
    code: 'code goes here',
    listitem: 'list item',
    heading: 'Heading Text',
    link: 'enter link description',
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

},{}],44:[function(require,module,exports){
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

},{"./classes":7}],45:[function(require,module,exports){
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
          if(Object.prototype.hasOwnProperty.call(to, nextKey)) {
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

exports.dispatchBrowserEvent = function (element, event) {
  var ev = new Event(event);
  element.dispatchEvent(ev);
};

exports.dispatchClickEvent = function (element) {
  var ev = new MouseEvent('click');
  element.dispatchEvent(ev);
};

exports.debounce = function (cb, ms) {
  var tmr;
  return function () {
    var self = this,
      args = Array.prototype.slice.call(arguments);

    clearTimeout(tmr);
    tmr = setTimeout(function () {
      tmr = undefined;
      cb.apply(self, args);
    }, ms);
  };
};

},{}]},{},[3])(3)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvSW5wdXRIaXN0b3J5LmpzIiwic3JjL0lucHV0U3RhdGUuanMiLCJzcmMvYmFya21hcmsuanMiLCJzcmMvYmluZENvbW1hbmRzLmpzIiwic3JjL2NodW5rcy9wYXJzZUxpbmtJbnB1dC5qcyIsInNyYy9jaHVua3MvdHJpbS5qcyIsInNyYy9jbGFzc2VzLmpzIiwic3JjL2VkaXRvci5qcyIsInNyYy9ldmVudHMuanMiLCJzcmMvZXh0ZW5kUmVnRXhwLmpzIiwic3JjL2ZpeEVPTC5qcyIsInNyYy9nZXRDb21tYW5kSGFuZGxlci5qcyIsInNyYy9odG1sL0h0bWxDaHVua3MuanMiLCJzcmMvaHRtbC9ibG9ja3F1b3RlLmpzIiwic3JjL2h0bWwvYm9sZE9ySXRhbGljLmpzIiwic3JjL2h0bWwvY29kZWJsb2NrLmpzIiwic3JjL2h0bWwvaGVhZGluZy5qcyIsInNyYy9odG1sL2hyLmpzIiwic3JjL2h0bWwvbGlua09ySW1hZ2VPckF0dGFjaG1lbnQuanMiLCJzcmMvaHRtbC9saXN0LmpzIiwic3JjL2h0bWwvd3JhcHBpbmcuanMiLCJzcmMvaXNWaXNpYmxlRWxlbWVudC5qcyIsInNyYy9tYW5hZ2VyLmpzIiwic3JjL21hbnkuanMiLCJzcmMvbWFya2Rvd24vTWFya2Rvd25DaHVua3MuanMiLCJzcmMvbWFya2Rvd24vYmxvY2txdW90ZS5qcyIsInNyYy9tYXJrZG93bi9ib2xkT3JJdGFsaWMuanMiLCJzcmMvbWFya2Rvd24vY29kZWJsb2NrLmpzIiwic3JjL21hcmtkb3duL2hlYWRpbmcuanMiLCJzcmMvbWFya2Rvd24vaHIuanMiLCJzcmMvbWFya2Rvd24vbGlua09ySW1hZ2VPckF0dGFjaG1lbnQuanMiLCJzcmMvbWFya2Rvd24vbGlzdC5qcyIsInNyYy9tYXJrZG93bi9zZXR0aW5ncy5qcyIsInNyYy9tYXJrZG93bi93cmFwcGluZy5qcyIsInNyYy9tb2Rlcy9tYXJrZG93bi90ZXh0YXJlYVN1cmZhY2UuanMiLCJzcmMvbW9kZXMvd3lzaXd5Zy93eXNpd3lnU3VyZmFjZS5qcyIsInNyYy9vbmNlLmpzIiwic3JjL3Byb21wdHMvY2xvc2UuanMiLCJzcmMvcHJvbXB0cy9wcm9tcHQuanMiLCJzcmMvcHJvbXB0cy9yZW5kZXIuanMiLCJzcmMvcmVuZGVyZXJzLmpzIiwic3JjL3Nob3J0Y3V0cy5qcyIsInNyYy9zdHJpbmdzLmpzIiwic3JjL3VwbG9hZHMuanMiLCJzcmMvdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIElucHV0U3RhdGUgPSByZXF1aXJlKCcuL0lucHV0U3RhdGUnKTtcblxuZnVuY3Rpb24gSW5wdXRIaXN0b3J5IChzdXJmYWNlLCBtb2RlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG5cbiAgc3RhdGUuaW5wdXRNb2RlID0gbW9kZTtcbiAgc3RhdGUuc3VyZmFjZSA9IHN1cmZhY2U7XG4gIHN0YXRlLnJlc2V0KCk7XG5cbiAgbGlzdGVuKHN1cmZhY2UuY3VycmVudCgpKTtcblxuICBmdW5jdGlvbiBsaXN0ZW4gKGVsKSB7XG4gICAgdmFyIHBhc3RlSGFuZGxlciA9IHNlbGZpZShoYW5kbGVQYXN0ZSk7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBwcmV2ZW50Q3RybFlaKTtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgc2VsZmllKGhhbmRsZUN0cmxZWikpO1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBzZWxmaWUoaGFuZGxlTW9kZUNoYW5nZSkpO1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHNldE1vdmluZyk7XG4gICAgZWwub25wYXN0ZSA9IHBhc3RlSGFuZGxlcjtcbiAgICBlbC5vbmRyb3AgPSBwYXN0ZUhhbmRsZXI7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRNb3ZpbmcgKCkge1xuICAgIHN0YXRlLnNldE1vZGUoJ21vdmluZycpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VsZmllIChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiBoYW5kbGVyIChlKSB7IHJldHVybiBmbi5jYWxsKG51bGwsIHN0YXRlLCBlKTsgfTtcbiAgfVxufVxuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNldElucHV0TW9kZSA9IGZ1bmN0aW9uIChtb2RlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmlucHV0TW9kZSA9IG1vZGU7XG4gIHN0YXRlLnJlc2V0KCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5pbnB1dFN0YXRlID0gbnVsbDtcbiAgc3RhdGUubGFzdFN0YXRlID0gbnVsbDtcbiAgc3RhdGUuaGlzdG9yeSA9IFtdO1xuICBzdGF0ZS5oaXN0b3J5UG9pbnRlciA9IDA7XG4gIHN0YXRlLmhpc3RvcnlNb2RlID0gJ25vbmUnO1xuICBzdGF0ZS5yZWZyZXNoaW5nID0gbnVsbDtcbiAgc3RhdGUucmVmcmVzaFN0YXRlKHRydWUpO1xuICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgcmV0dXJuIHN0YXRlO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5zZXRDb21tYW5kTW9kZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnY29tbWFuZCc7XG4gIHN0YXRlLnNhdmVTdGF0ZSgpO1xuICBzdGF0ZS5yZWZyZXNoaW5nID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG4gIH0sIDApO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5jYW5VbmRvID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5oaXN0b3J5UG9pbnRlciA+IDE7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLmNhblJlZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5UG9pbnRlciArIDFdO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS51bmRvID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBpZiAoc3RhdGUuY2FuVW5kbygpKSB7XG4gICAgaWYgKHN0YXRlLmxhc3RTdGF0ZSkge1xuICAgICAgc3RhdGUubGFzdFN0YXRlLnJlc3RvcmUoKTtcbiAgICAgIHN0YXRlLmxhc3RTdGF0ZSA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXJdID0gbmV3IElucHV0U3RhdGUoc3RhdGUuc3VyZmFjZSwgc3RhdGUuaW5wdXRNb2RlKTtcbiAgICAgIHN0YXRlLmhpc3RvcnlbLS1zdGF0ZS5oaXN0b3J5UG9pbnRlcl0ucmVzdG9yZSgpO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdub25lJztcbiAgc3RhdGUuc3VyZmFjZS5mb2N1cyhzdGF0ZS5pbnB1dE1vZGUpO1xuICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUucmVkbyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgaWYgKHN0YXRlLmNhblJlZG8oKSkge1xuICAgIHN0YXRlLmhpc3RvcnlbKytzdGF0ZS5oaXN0b3J5UG9pbnRlcl0ucmVzdG9yZSgpO1xuICB9XG5cbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnbm9uZSc7XG4gIHN0YXRlLnN1cmZhY2UuZm9jdXMoc3RhdGUuaW5wdXRNb2RlKTtcbiAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNldE1vZGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgaWYgKHN0YXRlLmhpc3RvcnlNb2RlICE9PSB2YWx1ZSkge1xuICAgIHN0YXRlLmhpc3RvcnlNb2RlID0gdmFsdWU7XG4gICAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gIH1cbiAgc3RhdGUucmVmcmVzaGluZyA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xuICB9LCAxKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUucmVmcmVzaFN0YXRlID0gZnVuY3Rpb24gKGluaXRpYWxTdGF0ZSkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5pbnB1dFN0YXRlID0gbmV3IElucHV0U3RhdGUoc3RhdGUuc3VyZmFjZSwgc3RhdGUuaW5wdXRNb2RlLCBpbml0aWFsU3RhdGUpO1xuICBzdGF0ZS5yZWZyZXNoaW5nID0gbnVsbDtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2F2ZVN0YXRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICB2YXIgY3VycmVudCA9IHN0YXRlLmlucHV0U3RhdGUgfHwgbmV3IElucHV0U3RhdGUoc3RhdGUuc3VyZmFjZSwgc3RhdGUuaW5wdXRNb2RlKTtcblxuICBpZiAoc3RhdGUuaGlzdG9yeU1vZGUgPT09ICdtb3ZpbmcnKSB7XG4gICAgaWYgKCFzdGF0ZS5sYXN0U3RhdGUpIHtcbiAgICAgIHN0YXRlLmxhc3RTdGF0ZSA9IGN1cnJlbnQ7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBpZiAoc3RhdGUubGFzdFN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXIgLSAxXS50ZXh0ICE9PSBzdGF0ZS5sYXN0U3RhdGUudGV4dCkge1xuICAgICAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlcisrXSA9IHN0YXRlLmxhc3RTdGF0ZTtcbiAgICB9XG4gICAgc3RhdGUubGFzdFN0YXRlID0gbnVsbDtcbiAgfVxuICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyKytdID0gY3VycmVudDtcbiAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlciArIDFdID0gbnVsbDtcbn07XG5cbmZ1bmN0aW9uIGhhbmRsZUN0cmxZWiAoc3RhdGUsIGUpIHtcbiAgdmFyIGhhbmRsZWQgPSBmYWxzZTtcbiAgdmFyIGtleUNvZGUgPSBlLmNoYXJDb2RlIHx8IGUua2V5Q29kZTtcbiAgdmFyIGtleUNvZGVDaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZShrZXlDb2RlKTtcblxuICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkge1xuICAgIHN3aXRjaCAoa2V5Q29kZUNoYXIudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAneSc6XG4gICAgICAgIHN0YXRlLnJlZG8oKTtcbiAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICd6JzpcbiAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICAgICAgICBzdGF0ZS5yZWRvKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdGUudW5kbygpO1xuICAgICAgICB9XG4gICAgICAgIGhhbmRsZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAoaGFuZGxlZCAmJiBlLnByZXZlbnREZWZhdWx0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU1vZGVDaGFuZ2UgKHN0YXRlLCBlKSB7XG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGtleUNvZGUgPSBlLmtleUNvZGU7XG5cbiAgaWYgKChrZXlDb2RlID49IDMzICYmIGtleUNvZGUgPD0gNDApIHx8IChrZXlDb2RlID49IDYzMjMyICYmIGtleUNvZGUgPD0gNjMyMzUpKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnbW92aW5nJyk7XG4gIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gOCB8fCBrZXlDb2RlID09PSA0NiB8fCBrZXlDb2RlID09PSAxMjcpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCdkZWxldGluZycpO1xuICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDEzKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnbmV3bGluZXMnKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAyNykge1xuICAgIHN0YXRlLnNldE1vZGUoJ2VzY2FwZScpO1xuICB9IGVsc2UgaWYgKChrZXlDb2RlIDwgMTYgfHwga2V5Q29kZSA+IDIwKSAmJiBrZXlDb2RlICE9PSA5MSkge1xuICAgIHN0YXRlLnNldE1vZGUoJ3R5cGluZycpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVBhc3RlIChzdGF0ZSkge1xuICBpZiAoc3RhdGUuaW5wdXRTdGF0ZSAmJiBzdGF0ZS5pbnB1dFN0YXRlLnRleHQgIT09IHN0YXRlLnN1cmZhY2UucmVhZChzdGF0ZS5pbnB1dE1vZGUpICYmIHN0YXRlLnJlZnJlc2hpbmcgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdwYXN0ZSc7XG4gICAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gICAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJldmVudEN0cmxZWiAoZSkge1xuICB2YXIga2V5Q29kZSA9IGUuY2hhckNvZGUgfHwgZS5rZXlDb2RlO1xuICB2YXIgeXogPSBrZXlDb2RlID09PSA4OSB8fCBrZXlDb2RlID09PSA5MDtcbiAgdmFyIGN0cmwgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5O1xuICBpZiAoY3RybCAmJiB5eikge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0SGlzdG9yeTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBpc1Zpc2libGVFbGVtZW50ID0gcmVxdWlyZSgnLi9pc1Zpc2libGVFbGVtZW50Jyk7XG52YXIgZml4RU9MID0gcmVxdWlyZSgnLi9maXhFT0wnKTtcbnZhciBNYXJrZG93bkNodW5rcyA9IHJlcXVpcmUoJy4vbWFya2Rvd24vTWFya2Rvd25DaHVua3MnKTtcbnZhciBIdG1sQ2h1bmtzID0gcmVxdWlyZSgnLi9odG1sL0h0bWxDaHVua3MnKTtcbnZhciBjaHVua3MgPSB7XG4gIG1hcmtkb3duOiBNYXJrZG93bkNodW5rcyxcbiAgaHRtbDogSHRtbENodW5rcyxcbiAgd3lzaXd5ZzogSHRtbENodW5rc1xufTtcblxuZnVuY3Rpb24gSW5wdXRTdGF0ZSAoc3VyZmFjZSwgbW9kZSwgaW5pdGlhbFN0YXRlKSB7XG4gIHRoaXMubW9kZSA9IG1vZGU7XG4gIHRoaXMuc3VyZmFjZSA9IHN1cmZhY2U7XG4gIHRoaXMuaW5pdGlhbFN0YXRlID0gaW5pdGlhbFN0YXRlIHx8IGZhbHNlO1xuICB0aGlzLmluaXQoKTtcbn1cblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAoIWlzVmlzaWJsZUVsZW1lbnQoZWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghdGhpcy5pbml0aWFsU3RhdGUgJiYgZG9jLmFjdGl2ZUVsZW1lbnQgJiYgZG9jLmFjdGl2ZUVsZW1lbnQgIT09IGVsKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNlbGYuc3VyZmFjZS5yZWFkU2VsZWN0aW9uKHNlbGYpO1xuICBzZWxmLnNjcm9sbFRvcCA9IGVsLnNjcm9sbFRvcDtcbiAgaWYgKCFzZWxmLnRleHQpIHtcbiAgICBzZWxmLnRleHQgPSBzZWxmLnN1cmZhY2UucmVhZChzZWxmLm1vZGUpO1xuICB9XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5zZWxlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKCFpc1Zpc2libGVFbGVtZW50KGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBzZWxmLnN1cmZhY2Uud3JpdGVTZWxlY3Rpb24oc2VsZik7XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5yZXN0b3JlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICh0eXBlb2Ygc2VsZi50ZXh0ID09PSAnc3RyaW5nJyAmJiBzZWxmLnRleHQgIT09IHNlbGYuc3VyZmFjZS5yZWFkKCkpIHtcbiAgICBzZWxmLnN1cmZhY2Uud3JpdGUoc2VsZi50ZXh0KTtcbiAgfVxuICBzZWxmLnNlbGVjdCgpO1xuICBlbC5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmdldENodW5rcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2h1bmsgPSBuZXcgY2h1bmtzW3NlbGYubW9kZV0oKTtcbiAgY2h1bmsuYmVmb3JlID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoMCwgc2VsZi5zdGFydCkpO1xuICBjaHVuay5zdGFydFRhZyA9ICcnO1xuICBjaHVuay5zZWxlY3Rpb24gPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLnN0YXJ0LCBzZWxmLmVuZCkpO1xuICBjaHVuay5lbmRUYWcgPSAnJztcbiAgY2h1bmsuYWZ0ZXIgPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLmVuZCkpO1xuICBjaHVuay5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbiAgc2VsZi5jYWNoZWRDaHVua3MgPSBjaHVuaztcbiAgcmV0dXJuIGNodW5rO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2V0Q2h1bmtzID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2h1bmsuYmVmb3JlID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc3RhcnRUYWc7XG4gIGNodW5rLmFmdGVyID0gY2h1bmsuZW5kVGFnICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc3RhcnQgPSBjaHVuay5iZWZvcmUubGVuZ3RoO1xuICBzZWxmLmVuZCA9IGNodW5rLmJlZm9yZS5sZW5ndGggKyBjaHVuay5zZWxlY3Rpb24ubGVuZ3RoO1xuICBzZWxmLnRleHQgPSBjaHVuay5iZWZvcmUgKyBjaHVuay5zZWxlY3Rpb24gKyBjaHVuay5hZnRlcjtcbiAgc2VsZi5zY3JvbGxUb3AgPSBjaHVuay5zY3JvbGxUb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0U3RhdGU7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OUpibkIxZEZOMFlYUmxMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCa2IyTWdQU0JuYkc5aVlXd3VaRzlqZFcxbGJuUTdYRzUyWVhJZ2FYTldhWE5wWW14bFJXeGxiV1Z1ZENBOUlISmxjWFZwY21Vb0p5NHZhWE5XYVhOcFlteGxSV3hsYldWdWRDY3BPMXh1ZG1GeUlHWnBlRVZQVENBOUlISmxjWFZwY21Vb0p5NHZabWw0UlU5TUp5azdYRzUyWVhJZ1RXRnlhMlJ2ZDI1RGFIVnVhM01nUFNCeVpYRjFhWEpsS0NjdUwyMWhjbXRrYjNkdUwwMWhjbXRrYjNkdVEyaDFibXR6SnlrN1hHNTJZWElnU0hSdGJFTm9kVzVyY3lBOUlISmxjWFZwY21Vb0p5NHZhSFJ0YkM5SWRHMXNRMmgxYm10ekp5azdYRzUyWVhJZ1kyaDFibXR6SUQwZ2UxeHVJQ0J0WVhKclpHOTNiam9nVFdGeWEyUnZkMjVEYUhWdWEzTXNYRzRnSUdoMGJXdzZJRWgwYld4RGFIVnVhM01zWEc0Z0lIZDVjMmwzZVdjNklFaDBiV3hEYUhWdWEzTmNibjA3WEc1Y2JtWjFibU4wYVc5dUlFbHVjSFYwVTNSaGRHVWdLSE4xY21aaFkyVXNJRzF2WkdVc0lHbHVhWFJwWVd4VGRHRjBaU2tnZTF4dUlDQjBhR2x6TG0xdlpHVWdQU0J0YjJSbE8xeHVJQ0IwYUdsekxuTjFjbVpoWTJVZ1BTQnpkWEptWVdObE8xeHVJQ0IwYUdsekxtbHVhWFJwWVd4VGRHRjBaU0E5SUdsdWFYUnBZV3hUZEdGMFpTQjhmQ0JtWVd4elpUdGNiaUFnZEdocGN5NXBibWwwS0NrN1hHNTlYRzVjYmtsdWNIVjBVM1JoZEdVdWNISnZkRzkwZVhCbExtbHVhWFFnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhaaGNpQnpaV3htSUQwZ2RHaHBjenRjYmlBZ2RtRnlJR1ZzSUQwZ2MyVnNaaTV6ZFhKbVlXTmxMbU4xY25KbGJuUW9jMlZzWmk1dGIyUmxLVHRjYmlBZ2FXWWdLQ0ZwYzFacGMybGliR1ZGYkdWdFpXNTBLR1ZzS1NrZ2UxeHVJQ0FnSUhKbGRIVnlianRjYmlBZ2ZWeHVJQ0JwWmlBb0lYUm9hWE11YVc1cGRHbGhiRk4wWVhSbElDWW1JR1J2WXk1aFkzUnBkbVZGYkdWdFpXNTBJQ1ltSUdSdll5NWhZM1JwZG1WRmJHVnRaVzUwSUNFOVBTQmxiQ2tnZTF4dUlDQWdJSEpsZEhWeWJqdGNiaUFnZlZ4dUlDQnpaV3htTG5OMWNtWmhZMlV1Y21WaFpGTmxiR1ZqZEdsdmJpaHpaV3htS1R0Y2JpQWdjMlZzWmk1elkzSnZiR3hVYjNBZ1BTQmxiQzV6WTNKdmJHeFViM0E3WEc0Z0lHbG1JQ2doYzJWc1ppNTBaWGgwS1NCN1hHNGdJQ0FnYzJWc1ppNTBaWGgwSUQwZ2MyVnNaaTV6ZFhKbVlXTmxMbkpsWVdRb2MyVnNaaTV0YjJSbEtUdGNiaUFnZlZ4dWZUdGNibHh1U1c1d2RYUlRkR0YwWlM1d2NtOTBiM1I1Y0dVdWMyVnNaV04wSUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNCMllYSWdjMlZzWmlBOUlIUm9hWE03WEc0Z0lIWmhjaUJsYkNBOUlITmxiR1l1YzNWeVptRmpaUzVqZFhKeVpXNTBLSE5sYkdZdWJXOWtaU2s3WEc0Z0lHbG1JQ2doYVhOV2FYTnBZbXhsUld4bGJXVnVkQ2hsYkNrcElIdGNiaUFnSUNCeVpYUjFjbTQ3WEc0Z0lIMWNiaUFnYzJWc1ppNXpkWEptWVdObExuZHlhWFJsVTJWc1pXTjBhVzl1S0hObGJHWXBPMXh1ZlR0Y2JseHVTVzV3ZFhSVGRHRjBaUzV3Y205MGIzUjVjR1V1Y21WemRHOXlaU0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnZG1GeUlITmxiR1lnUFNCMGFHbHpPMXh1SUNCMllYSWdaV3dnUFNCelpXeG1Mbk4xY21aaFkyVXVZM1Z5Y21WdWRDaHpaV3htTG0xdlpHVXBPMXh1SUNCcFppQW9kSGx3Wlc5bUlITmxiR1l1ZEdWNGRDQTlQVDBnSjNOMGNtbHVaeWNnSmlZZ2MyVnNaaTUwWlhoMElDRTlQU0J6Wld4bUxuTjFjbVpoWTJVdWNtVmhaQ2dwS1NCN1hHNGdJQ0FnYzJWc1ppNXpkWEptWVdObExuZHlhWFJsS0hObGJHWXVkR1Y0ZENrN1hHNGdJSDFjYmlBZ2MyVnNaaTV6Wld4bFkzUW9LVHRjYmlBZ1pXd3VjMk55YjJ4c1ZHOXdJRDBnYzJWc1ppNXpZM0p2Ykd4VWIzQTdYRzU5TzF4dVhHNUpibkIxZEZOMFlYUmxMbkJ5YjNSdmRIbHdaUzVuWlhSRGFIVnVhM01nUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhaaGNpQnpaV3htSUQwZ2RHaHBjenRjYmlBZ2RtRnlJR05vZFc1cklEMGdibVYzSUdOb2RXNXJjMXR6Wld4bUxtMXZaR1ZkS0NrN1hHNGdJR05vZFc1ckxtSmxabTl5WlNBOUlHWnBlRVZQVENoelpXeG1MblJsZUhRdWMzVmljM1J5YVc1bktEQXNJSE5sYkdZdWMzUmhjblFwS1R0Y2JpQWdZMmgxYm1zdWMzUmhjblJVWVdjZ1BTQW5KenRjYmlBZ1kyaDFibXN1YzJWc1pXTjBhVzl1SUQwZ1ptbDRSVTlNS0hObGJHWXVkR1Y0ZEM1emRXSnpkSEpwYm1jb2MyVnNaaTV6ZEdGeWRDd2djMlZzWmk1bGJtUXBLVHRjYmlBZ1kyaDFibXN1Wlc1a1ZHRm5JRDBnSnljN1hHNGdJR05vZFc1ckxtRm1kR1Z5SUQwZ1ptbDRSVTlNS0hObGJHWXVkR1Y0ZEM1emRXSnpkSEpwYm1jb2MyVnNaaTVsYm1RcEtUdGNiaUFnWTJoMWJtc3VjMk55YjJ4c1ZHOXdJRDBnYzJWc1ppNXpZM0p2Ykd4VWIzQTdYRzRnSUhObGJHWXVZMkZqYUdWa1EyaDFibXR6SUQwZ1kyaDFibXM3WEc0Z0lISmxkSFZ5YmlCamFIVnVhenRjYm4wN1hHNWNia2x1Y0hWMFUzUmhkR1V1Y0hKdmRHOTBlWEJsTG5ObGRFTm9kVzVyY3lBOUlHWjFibU4wYVc5dUlDaGphSFZ1YXlrZ2UxeHVJQ0IyWVhJZ2MyVnNaaUE5SUhSb2FYTTdYRzRnSUdOb2RXNXJMbUpsWm05eVpTQTlJR05vZFc1ckxtSmxabTl5WlNBcklHTm9kVzVyTG5OMFlYSjBWR0ZuTzF4dUlDQmphSFZ1YXk1aFpuUmxjaUE5SUdOb2RXNXJMbVZ1WkZSaFp5QXJJR05vZFc1ckxtRm1kR1Z5TzF4dUlDQnpaV3htTG5OMFlYSjBJRDBnWTJoMWJtc3VZbVZtYjNKbExteGxibWQwYUR0Y2JpQWdjMlZzWmk1bGJtUWdQU0JqYUhWdWF5NWlaV1p2Y21VdWJHVnVaM1JvSUNzZ1kyaDFibXN1YzJWc1pXTjBhVzl1TG14bGJtZDBhRHRjYmlBZ2MyVnNaaTUwWlhoMElEMGdZMmgxYm1zdVltVm1iM0psSUNzZ1kyaDFibXN1YzJWc1pXTjBhVzl1SUNzZ1kyaDFibXN1WVdaMFpYSTdYRzRnSUhObGJHWXVjMk55YjJ4c1ZHOXdJRDBnWTJoMWJtc3VjMk55YjJ4c1ZHOXdPMXh1ZlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQkpibkIxZEZOMFlYUmxPMXh1SWwxOSIsIid1c2Ugc3RyaWN0JztcblxudmFyIE1hbmFnZXIgPSByZXF1aXJlKCcuL21hbmFnZXInKTtcblxudmFyIG1hbmFnZXIgPSBuZXcgTWFuYWdlcigpO1xuXG5mdW5jdGlvbiBiYXJrbWFyayAodGV4dGFyZWEsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG1hbmFnZXIuZ2V0KHRleHRhcmVhLCBvcHRpb25zKTtcbn1cblxuYmFya21hcmsuZmluZCA9IGZ1bmN0aW9uICh0ZXh0YXJlYSkge1xuICByZXR1cm4gbWFuYWdlci5maW5kKHRleHRhcmVhKTtcbn07XG5cbmJhcmttYXJrLnN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBiYXJrbWFyaztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIGNvbW1hbmRzID0ge1xuICBtYXJrZG93bjoge1xuICAgIGJvbGRPckl0YWxpYzogcmVxdWlyZSgnLi9tYXJrZG93bi9ib2xkT3JJdGFsaWMnKSxcbiAgICBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDogcmVxdWlyZSgnLi9tYXJrZG93bi9saW5rT3JJbWFnZU9yQXR0YWNobWVudCcpLFxuICAgIGJsb2NrcXVvdGU6IHJlcXVpcmUoJy4vbWFya2Rvd24vYmxvY2txdW90ZScpLFxuICAgIGNvZGVibG9jazogcmVxdWlyZSgnLi9tYXJrZG93bi9jb2RlYmxvY2snKSxcbiAgICBoZWFkaW5nOiByZXF1aXJlKCcuL21hcmtkb3duL2hlYWRpbmcnKSxcbiAgICBsaXN0OiByZXF1aXJlKCcuL21hcmtkb3duL2xpc3QnKSxcbiAgICBocjogcmVxdWlyZSgnLi9tYXJrZG93bi9ocicpXG4gIH0sXG4gIGh0bWw6IHtcbiAgICBib2xkT3JJdGFsaWM6IHJlcXVpcmUoJy4vaHRtbC9ib2xkT3JJdGFsaWMnKSxcbiAgICBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDogcmVxdWlyZSgnLi9odG1sL2xpbmtPckltYWdlT3JBdHRhY2htZW50JyksXG4gICAgYmxvY2txdW90ZTogcmVxdWlyZSgnLi9odG1sL2Jsb2NrcXVvdGUnKSxcbiAgICBjb2RlYmxvY2s6IHJlcXVpcmUoJy4vaHRtbC9jb2RlYmxvY2snKSxcbiAgICBoZWFkaW5nOiByZXF1aXJlKCcuL2h0bWwvaGVhZGluZycpLFxuICAgIGxpc3Q6IHJlcXVpcmUoJy4vaHRtbC9saXN0JyksXG4gICAgaHI6IHJlcXVpcmUoJy4vaHRtbC9ocicpXG4gIH1cbn07XG5cbmNvbW1hbmRzLnd5c2l3eWcgPSBjb21tYW5kcy5odG1sO1xuXG5mdW5jdGlvbiBiaW5kQ29tbWFuZHMgKGVkaXRvciwgb3B0aW9ucykge1xuICBiaW5kKCdib2xkJywgJ2InLCBib2xkKTtcbiAgYmluZCgnaXRhbGljJywgJ2knLCBpdGFsaWMpO1xuICBiaW5kKCdxdW90ZScsICdqJywgcm91dGVyKCdibG9ja3F1b3RlJykpO1xuICBiaW5kKCdjb2RlJywgJ2UnLCBjb2RlKTtcbiAgYmluZCgnb2wnLCAnbycsIG9sKTtcbiAgYmluZCgndWwnLCAndScsIHVsKTtcbiAgYmluZCgnaGVhZGluZycsICdkJywgcm91dGVyKCdoZWFkaW5nJykpO1xuICBlZGl0b3Iuc2hvd0xpbmtEaWFsb2cgPSBmYWJyaWNhdG9yKGJpbmQoJ2xpbmsnLCAnaycsIGxpbmtPckltYWdlT3JBdHRhY2htZW50KCdsaW5rJykpKTtcbiAgZWRpdG9yLnNob3dJbWFnZURpYWxvZyA9IGZhYnJpY2F0b3IoYmluZCgnaW1hZ2UnLCAnZycsIGxpbmtPckltYWdlT3JBdHRhY2htZW50KCdpbWFnZScpKSk7XG4gIGVkaXRvci5saW5rT3JJbWFnZU9yQXR0YWNobWVudCA9IGxpbmtPckltYWdlT3JBdHRhY2htZW50O1xuXG4gIGlmIChvcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgZWRpdG9yLnNob3dBdHRhY2htZW50RGlhbG9nID0gZmFicmljYXRvcihiaW5kKCdhdHRhY2htZW50JywgJ2snLCB0cnVlLCBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCgnYXR0YWNobWVudCcpKSk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuaHIpIHsgYmluZCgnaHInLCAnY21kK24nLCByb3V0ZXIoJ2hyJykpOyB9XG5cbiAgZnVuY3Rpb24gZmFicmljYXRvciAoZWwpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gb3BlbiAoKSB7XG4gICAgICB1dGlscy5kaXNwYXRjaENsaWNrRXZlbnQoZWwpO1xuICAgIH07XG4gIH1cbiAgZnVuY3Rpb24gYm9sZCAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0uYm9sZE9ySXRhbGljKGNodW5rcywgJ2JvbGQnKTtcbiAgfVxuICBmdW5jdGlvbiBpdGFsaWMgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmJvbGRPckl0YWxpYyhjaHVua3MsICdpdGFsaWMnKTtcbiAgfVxuICBmdW5jdGlvbiBjb2RlIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5jb2RlYmxvY2soY2h1bmtzLCB7IGZlbmNpbmc6IG9wdGlvbnMuZmVuY2luZyB9KTtcbiAgfVxuICBmdW5jdGlvbiB1bCAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0ubGlzdChjaHVua3MsIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiBvbCAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0ubGlzdChjaHVua3MsIHRydWUpO1xuICB9XG4gIGZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50ICh0eXBlLCBhdXRvVXBsb2FkKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50SW52b2tlIChtb2RlLCBjaHVua3MpIHtcbiAgICAgIGNvbW1hbmRzW21vZGVdLmxpbmtPckltYWdlT3JBdHRhY2htZW50LmNhbGwodGhpcywgY2h1bmtzLCB7XG4gICAgICAgIGVkaXRvcjogZWRpdG9yLFxuICAgICAgICBtb2RlOiBtb2RlLFxuICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICBwcm9tcHRzOiBvcHRpb25zLnByb21wdHMsXG4gICAgICAgIHVwbG9hZDogb3B0aW9uc1t0eXBlICsgJ3MnXSxcbiAgICAgICAgY2xhc3Nlczogb3B0aW9ucy5jbGFzc2VzLFxuICAgICAgICBtZXJnZUh0bWxBbmRBdHRhY2htZW50OiBvcHRpb25zLm1lcmdlSHRtbEFuZEF0dGFjaG1lbnQsXG4gICAgICAgIGF1dG9VcGxvYWQ6IGF1dG9VcGxvYWRcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cbiAgZnVuY3Rpb24gYmluZCAoaWQsIGtleSwgc2hpZnQsIGZuKSB7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgZm4gPSBzaGlmdDtcbiAgICAgIHNoaWZ0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiBlZGl0b3IuYWRkQ29tbWFuZEJ1dHRvbihpZCwga2V5LCBzaGlmdCwgc3VwcHJlc3MoZm4pKTtcbiAgfVxuICBmdW5jdGlvbiByb3V0ZXIgKG1ldGhvZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiByb3V0ZWQgKG1vZGUsIGNodW5rcykgeyBjb21tYW5kc1ttb2RlXVttZXRob2RdLmNhbGwodGhpcywgY2h1bmtzKTsgfTtcbiAgfVxuICBmdW5jdGlvbiBzdG9wIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG4gIGZ1bmN0aW9uIHN1cHByZXNzIChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiBzdXBwcmVzc29yIChlLCBtb2RlLCBjaHVua3MpIHsgc3RvcChlKTsgZm4uY2FsbCh0aGlzLCBtb2RlLCBjaHVua3MpOyB9O1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmluZENvbW1hbmRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmlucHV0ID0gL15cXHMqKC4qPykoPzpcXHMrXCIoLispXCIpP1xccyokLztcbnZhciByZnVsbCA9IC9eKD86aHR0cHM/fGZ0cCk6XFwvXFwvLztcblxuZnVuY3Rpb24gcGFyc2VMaW5rSW5wdXQgKGlucHV0KSB7XG4gIHJldHVybiBwYXJzZXIuYXBwbHkobnVsbCwgaW5wdXQubWF0Y2gocmlucHV0KSk7XG5cbiAgZnVuY3Rpb24gcGFyc2VyIChhbGwsIGxpbmssIHRpdGxlKSB7XG4gICAgdmFyIGhyZWYgPSBsaW5rLnJlcGxhY2UoL1xcPy4qJC8sIHF1ZXJ5VW5lbmNvZGVkUmVwbGFjZXIpO1xuICAgIGhyZWYgPSBkZWNvZGVVUklDb21wb25lbnQoaHJlZik7XG4gICAgaHJlZiA9IGVuY29kZVVSSShocmVmKS5yZXBsYWNlKC8nL2csICclMjcnKS5yZXBsYWNlKC9cXCgvZywgJyUyOCcpLnJlcGxhY2UoL1xcKS9nLCAnJTI5Jyk7XG4gICAgaHJlZiA9IGhyZWYucmVwbGFjZSgvXFw/LiokLywgcXVlcnlFbmNvZGVkUmVwbGFjZXIpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGhyZWY6IGZvcm1hdEhyZWYoaHJlZiksIHRpdGxlOiBmb3JtYXRUaXRsZSh0aXRsZSlcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHF1ZXJ5VW5lbmNvZGVkUmVwbGFjZXIgKHF1ZXJ5KSB7XG4gIHJldHVybiBxdWVyeS5yZXBsYWNlKC9cXCsvZywgJyAnKTtcbn1cblxuZnVuY3Rpb24gcXVlcnlFbmNvZGVkUmVwbGFjZXIgKHF1ZXJ5KSB7XG4gIHJldHVybiBxdWVyeS5yZXBsYWNlKC9cXCsvZywgJyUyYicpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUaXRsZSAodGl0bGUpIHtcbiAgaWYgKCF0aXRsZSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHRpdGxlXG4gICAgLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0SHJlZiAodXJsKSB7XG4gIHZhciBocmVmID0gdXJsLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKTtcbiAgaWYgKGhyZWYubGVuZ3RoICYmIGhyZWZbMF0gIT09ICcvJyAmJiAhcmZ1bGwudGVzdChocmVmKSkge1xuICAgIHJldHVybiAnaHR0cDovLycgKyBocmVmO1xuICB9XG4gIHJldHVybiBocmVmO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlTGlua0lucHV0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB0cmltIChyZW1vdmUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChyZW1vdmUpIHtcbiAgICBiZWZvcmVSZXBsYWNlciA9IGFmdGVyUmVwbGFjZXIgPSAnJztcbiAgfVxuICBzZWxmLnNlbGVjdGlvbiA9IHNlbGYuc2VsZWN0aW9uLnJlcGxhY2UoL14oXFxzKikvLCBiZWZvcmVSZXBsYWNlcikucmVwbGFjZSgvKFxccyopJC8sIGFmdGVyUmVwbGFjZXIpO1xuXG4gIGZ1bmN0aW9uIGJlZm9yZVJlcGxhY2VyICh0ZXh0KSB7XG4gICAgc2VsZi5iZWZvcmUgKz0gdGV4dDsgcmV0dXJuICcnO1xuICB9XG4gIGZ1bmN0aW9uIGFmdGVyUmVwbGFjZXIgKHRleHQpIHtcbiAgICBzZWxmLmFmdGVyID0gdGV4dCArIHNlbGYuYWZ0ZXI7IHJldHVybiAnJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBydHJpbSA9IC9eXFxzK3xcXHMrJC9nO1xudmFyIHJzcGFjZXMgPSAvXFxzKy9nO1xuXG5mdW5jdGlvbiBhZGRDbGFzcyAoZWwsIGNscykge1xuICB2YXIgY3VycmVudCA9IGVsLmNsYXNzTmFtZTtcbiAgaWYgKGN1cnJlbnQuaW5kZXhPZihjbHMpID09PSAtMSkge1xuICAgIGVsLmNsYXNzTmFtZSA9IChjdXJyZW50ICsgJyAnICsgY2xzKS5yZXBsYWNlKHJ0cmltLCAnJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcm1DbGFzcyAoZWwsIGNscykge1xuICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShjbHMsICcnKS5yZXBsYWNlKHJ0cmltLCAnJykucmVwbGFjZShyc3BhY2VzLCAnICcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRDbGFzcyxcbiAgcm06IHJtQ2xhc3Ncbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8vIHZhciB1cGxvYWRzID0gcmVxdWlyZSgnLi91cGxvYWRzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4vc3RyaW5ncycpO1xudmFyIGJpbmRDb21tYW5kcyA9IHJlcXVpcmUoJy4vYmluZENvbW1hbmRzJyk7XG52YXIgSW5wdXRIaXN0b3J5ID0gcmVxdWlyZSgnLi9JbnB1dEhpc3RvcnknKTtcbnZhciBTaG9ydGN1dE1hbmFnZXIgPSByZXF1aXJlKCcuL3Nob3J0Y3V0cycpO1xudmFyIGdldENvbW1hbmRIYW5kbGVyID0gcmVxdWlyZSgnLi9nZXRDb21tYW5kSGFuZGxlcicpO1xudmFyIFRleHRTdXJmYWNlID0gcmVxdWlyZSgnLi9tb2Rlcy9tYXJrZG93bi90ZXh0YXJlYVN1cmZhY2UnKTtcbnZhciBXeXNpd3lnU3VyZmFjZSA9IHJlcXVpcmUoJy4vbW9kZXMvd3lzaXd5Zy93eXNpd3lnU3VyZmFjZScpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuL2NsYXNzZXMnKTtcbnZhciByZW5kZXJlcnMgPSByZXF1aXJlKCcuL3JlbmRlcmVycycpO1xudmFyIHByb21wdCA9IHJlcXVpcmUoJy4vcHJvbXB0cy9wcm9tcHQnKTtcbnZhciBjbG9zZVByb21wdHMgPSByZXF1aXJlKCcuL3Byb21wdHMvY2xvc2UnKTtcbnZhciBtYWMgPSAvXFxiTWFjIE9TXFxiLy50ZXN0KGdsb2JhbC5uYXZpZ2F0b3IudXNlckFnZW50KTtcbnZhciBkb2MgPSBkb2N1bWVudDtcblxuZnVuY3Rpb24gRWRpdG9yICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB0aGlzLnRleHRhcmVhID0gdGV4dGFyZWE7XG4gIHZhciBwYXJlbnQgPSB0ZXh0YXJlYS5wYXJlbnROb2RlO1xuICB2YXIgbyA9IHRoaXMub3B0aW9ucyA9IHV0aWxzLmRlZmF1bHRzRGVlcChvcHRpb25zIHx8IHt9LCB7XG4gICAgLy8gRGVmYXVsdCBPcHRpb24gVmFsdWVzXG4gICAgbWFya2Rvd246IHRydWUsXG4gICAgd3lzaXd5ZzogdHJ1ZSxcbiAgICBocjogZmFsc2UsXG4gICAgc3RvcmFnZTogdHJ1ZSxcbiAgICBmZW5jaW5nOiB0cnVlLFxuICAgIHJlbmRlcjoge1xuICAgICAgbW9kZXM6IHt9LFxuICAgICAgY29tbWFuZHM6IHt9LFxuICAgIH0sXG4gICAgcHJvbXB0czoge1xuICAgICAgbGluazogcHJvbXB0LFxuICAgICAgaW1hZ2U6IHByb21wdCxcbiAgICAgIGF0dGFjaG1lbnQ6IHByb21wdCxcbiAgICAgIGNsb3NlOiBjbG9zZVByb21wdHMsXG4gICAgfSxcbiAgICBjbGFzc2VzOiB7XG4gICAgICB3eXNpd3lnOiBbXSxcbiAgICAgIHByb21wdHM6IHt9LFxuICAgICAgaW5wdXQ6IHt9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghby5tYXJrZG93biAmJiAhby53eXNpd3lnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXJrbWFyayBleHBlY3RzIGF0IGxlYXN0IG9uZSBpbnB1dCBtb2RlIHRvIGJlIGF2YWlsYWJsZScpO1xuICB9XG5cbiAgaWYgKG8uc3RvcmFnZSA9PT0gdHJ1ZSkgeyBvLnN0b3JhZ2UgPSAnYmFya21hcmtfaW5wdXRfbW9kZSc7IH1cblxuICB2YXIgcHJlZmVyZW5jZSA9IG8uc3RvcmFnZSAmJiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKG8uc3RvcmFnZSkpO1xuICBpZiAocHJlZmVyZW5jZSkge1xuICAgIG8uZGVmYXVsdE1vZGUgPSBwcmVmZXJlbmNlO1xuICB9XG5cbiAgdGhpcy5jb21wb25lbnRzID0ge1xuICAgIHRleHRhcmVhOiB0ZXh0YXJlYSxcbiAgICBwYXJlbnQ6IHRleHRhcmVhLnBhcmVudE5vZGUsXG4gICAgZHJvcGFyZWE6IHRhZyh7IGM6ICd3ay1jb250YWluZXItZHJvcCcgfSksXG4gICAgc3dpdGNoYm9hcmQ6IHRhZyh7IGM6ICd3ay1zd2l0Y2hib2FyZCcgfSksXG4gICAgY29tbWFuZHM6IHRhZyh7IGM6ICd3ay1jb21tYW5kcycgfSksXG4gIH07XG5cbiAgdGhpcy5zaG9ydGN1dHMgPSBuZXcgU2hvcnRjdXRNYW5hZ2VyKCk7XG4gIHRoaXMubW9kZXMgPSB7fTtcbiAgdGhpcy5tb2RlID0gJ21hcmtkb3duJzsgLy8gV2hpbGUgaW5pdGlhbGl6aW5nIHdlIGFyZSBhbHdheXMgc2hvd2luZyB0aGUgdGV4dGFyZWEgXCJtYXJrZG93blwiIHZpZXdcblxuICB0YWcoeyB0OiAnc3BhbicsIGM6ICd3ay1kcm9wLXRleHQnLCB4OiBzdHJpbmdzLnByb21wdHMuZHJvcCwgcDogdGhpcy5jb21wb25lbnRzLmRyb3BhcmVhIH0pO1xuICB0YWcoeyB0OiAncCcsIGM6IFsnd2stZHJvcC1pY29uJ10uY29uY2F0KG8uY2xhc3Nlcy5kcm9waWNvbikuam9pbignICcpLCBwOiB0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEgfSk7XG5cbiAgLy8gQXR0YWNoIENvbXBvbmVudHNcbiAgY2xhc3Nlcy5hZGQocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUodGhpcy5jb21wb25lbnRzLmNvbW1hbmRzLCB0aGlzLnRleHRhcmVhKTtcbiAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgcGFyZW50LmFwcGVuZENoaWxkKHRoaXMucGxhY2Vob2xkZXIpOyB9XG4gIHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQpO1xuICAvLyBUT0RPXG4gIC8vIGlmICh0aGlzLm9wdGlvbnMuaW1hZ2VzIHx8IHRoaXMub3B0aW9ucy5hdHRhY2htZW50cykge1xuICAgIC8vIHBhcmVudFttb3ZdKHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSk7XG4gICAgLy8gdXBsb2FkcyhwYXJlbnQsIHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSwgdGhpcywgbywgcmVtb3ZlKTtcbiAgLy8gfVxuXG4gIGlmKG8ubWFya2Rvd24pIHtcbiAgICB0aGlzLnJlZ2lzdGVyTW9kZSgnbWFya2Rvd24nLCBUZXh0U3VyZmFjZSwge1xuICAgICAgYWN0aXZlOiAoIW8uZGVmYXVsdE1vZGUgfHwgIW9bby5kZWZhdWx0TW9kZV0gfHwgby5kZWZhdWx0TW9kZSA9PT0gJ21hcmtkb3duJyksXG4gICAgICBzaG9ydGN1dEtleTogJ20nLFxuICAgIH0pO1xuICB9XG4gIGlmKG8ud3lzaXd5Zykge1xuICAgIHRoaXMucmVnaXN0ZXJNb2RlKCd3eXNpd3lnJywgV3lzaXd5Z1N1cmZhY2UsIHtcbiAgICAgIGFjdGl2ZTogby5kZWZhdWx0TW9kZSA9PT0gJ3d5c2l3eWcnIHx8ICFvLm1hcmtkb3duLFxuICAgICAgc2hvcnRjdXRLZXk6ICdwJyxcbiAgICAgIGNsYXNzZXM6IG8uY2xhc3Nlcy53eXNpd3lnIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbGFjZWhvbGRlciA9IHRhZyh7IGM6ICd3ay13eXNpd3lnLXBsYWNlaG9sZGVyIHdrLWhpZGUnLCB4OiB0ZXh0YXJlYS5wbGFjZWhvbGRlciB9KTtcbiAgICB0aGlzLnBsYWNlaG9sZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5tb2Rlcy53eXNpd3lnLnN1cmZhY2UuZm9jdXMuYmluZCh0aGlzLm1vZGVzLnd5c2l3eWcuc3VyZmFjZSkpO1xuICB9XG5cbiAgYmluZENvbW1hbmRzKHRoaXMsIG8pO1xufVxuXG5FZGl0b3IucHJvdG90eXBlLmdldFN1cmZhY2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm1vZGVzW3RoaXMubW9kZV0uc3VyZmFjZTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuYWRkQ29tbWFuZCA9IGZ1bmN0aW9uIChrZXksIHNoaWZ0LCBmbikge1xuICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZm4gPSBzaGlmdDtcbiAgICBzaGlmdCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHRoaXMuc2hvcnRjdXRzLmFkZChrZXksIHNoaWZ0LCBnZXRDb21tYW5kSGFuZGxlcih0aGlzLCB0aGlzLm1vZGVzW3RoaXMubW9kZV0uaGlzdG9yeSwgZm4pKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuYWRkQ29tbWFuZEJ1dHRvbiA9IGZ1bmN0aW9uIChpZCwga2V5LCBzaGlmdCwgZm4pIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBmbiA9IGtleTtcbiAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGZuID0gc2hpZnQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICB2YXIgYnV0dG9uID0gdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1jb21tYW5kJywgcDogdGhpcy5jb21wb25lbnRzLmNvbW1hbmRzIH0pO1xuICB2YXIgY3VzdG9tID0gdGhpcy5vcHRpb25zLnJlbmRlci5jb21tYW5kcztcbiAgdmFyIHJlbmRlciA9IHR5cGVvZiBjdXN0b20gPT09ICdmdW5jdGlvbicgPyBjdXN0b20gOiByZW5kZXJlcnMuY29tbWFuZHM7XG4gIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgaWYgKHRpdGxlKSB7XG4gICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICB9XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuICByZW5kZXIoYnV0dG9uLCBpZCk7XG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCBmbikpO1xuICBpZiAoa2V5KSB7XG4gICAgdGhpcy5hZGRDb21tYW5kKGtleSwgc2hpZnQsIGZuKTtcbiAgfVxuICByZXR1cm4gYnV0dG9uO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5ydW5Db21tYW5kID0gZnVuY3Rpb24gKGZuKSB7XG4gIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCByZWFycmFuZ2UpKG51bGwpO1xuXG4gIGZ1bmN0aW9uIHJlYXJyYW5nZSAoZSwgbW9kZSwgY2h1bmtzKSB7XG4gICAgcmV0dXJuIGZuLmNhbGwodGhpcywgY2h1bmtzLCBtb2RlKTtcbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5wYXJzZU1hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5vcHRpb25zLnBhcnNlTWFya2Rvd24uYXBwbHkodGhpcy5vcHRpb25zLnBhcnNlTWFya2Rvd24sIGFyZ3VtZW50cyk7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnBhcnNlSFRNTCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9ucy5wYXJzZUhUTUwuYXBwbHkodGhpcy5vcHRpb25zLnBhcnNlSFRNTCwgYXJndW1lbnRzKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMubW9kZSAhPT0gJ21hcmtkb3duJykge1xuICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSB0aGlzLmdldE1hcmtkb3duKCk7XG4gIH1cbiAgY2xhc3Nlcy5ybSh0aGlzLnRleHRhcmVhLCAnd2staGlkZScpO1xuXG4gIHRoaXMuc2hvcnRjdXRzLmNsZWFyKCk7XG5cbiAgdmFyIHBhcmVudCA9IHRoaXMuY29tcG9uZW50cy5wYXJlbnQ7XG4gIGNsYXNzZXMucm0ocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG5cbiAgLy8gUmVtb3ZlIGNvbXBvbmVudHNcbiAgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuY29tcG9uZW50cy5jb21tYW5kcyk7XG4gIGlmICh0aGlzLnBsYWNlaG9sZGVyKSB7IHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLnBsYWNlaG9sZGVyKTsgfVxuICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5jb21wb25lbnRzLnN3aXRjaGJvYXJkKTtcblxuICAvLyBSZW1vdmUgYWxsIG1vZGVzIHRoYXQgYXJlbid0IHVzaW5nIHRoZSB0ZXh0YXJlYVxuICB2YXIgbW9kZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVzKTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBtb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChtb2RlKSB7XG4gICAgaWYoc2VsZi5tb2Rlc1ttb2RlXS5lbGVtZW50ICE9PSBzZWxmLnRleHRhcmVhKSB7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoc2VsZi5tb2Rlc1ttb2RlXS5lbGVtZW50KTtcbiAgICB9XG4gICAgLy8gVE9ETyBEZXRhY2ggY2hhbmdlIGV2ZW50IGxpc3RlbmVycyBmb3Igc3VyZmFjZSBlbGVtZW50c1xuICAgIHRoaXMuc2hvcnRjdXRzLmRldGFjaChzZWxmLm1vZGVzW21vZGVdLmVsZW1lbnQpO1xuICB9KTtcblxuICAvLyBUT0RPXG4gIC8vIGlmICh0aGlzLm9wdGlvbnMuaW1hZ2VzIHx8IHRoaXMub3B0aW9ucy5hdHRhY2htZW50cykge1xuICAgIC8vIHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEpO1xuICAgIC8vIHVwbG9hZHMocGFyZW50LCB0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEsIHRoaXMsIG8sIHJlbW92ZSk7XG4gIC8vIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbiBnZXRPclNldFZhbHVlIChpbnB1dCkge1xuICB2YXIgbWFya2Rvd24gPSBTdHJpbmcoaW5wdXQpO1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHNldHMgPSBhcmd1bWVudHMubGVuZ3RoID09PSAxO1xuICBpZiAoc2V0cykge1xuICAgIGlmICh0aGlzLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgbWFya2Rvd24gPSBhc0h0bWwoKTtcbiAgICB9XG4gICAgdGhpcy5nZXRTdXJmYWNlKCkud3JpdGUobWFya2Rvd24pO1xuICAgIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LnJlc2V0KCk7XG4gIH1cblxuICByZXR1cm4gdGhpcy5nZXRNYXJrZG93bigpO1xuXG4gIGZ1bmN0aW9uIGFzSHRtbCAoKSB7XG4gICAgcmV0dXJuIHNlbGYub3B0aW9ucy5wYXJzZU1hcmtkb3duKG1hcmtkb3duKTtcbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5yZWdpc3Rlck1vZGUgPSBmdW5jdGlvbiAobmFtZSwgTW9kZSwgb3B0aW9ucykge1xuICB2YXIgYnV0dG9uQ2xhc3NlcyA9IFsnd2stbW9kZSddO1xuICBpZihvcHRpb25zLmFjdGl2ZSkge1xuICAgIGJ1dHRvbkNsYXNzZXMucHVzaCgnd2stbW9kZS1hY3RpdmUnKTtcbiAgfSBlbHNlIHtcbiAgICBidXR0b25DbGFzc2VzLnB1c2goJ3drLW1vZGUtaW5hY3RpdmUnKTtcbiAgfVxuXG4gIHZhciBzdG9yZWQgPSB0aGlzLm1vZGVzW25hbWVdID0ge1xuICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6IGJ1dHRvbkNsYXNzZXMuam9pbignICcpIH0pLFxuICAgIHN1cmZhY2U6IG5ldyBNb2RlKHRoaXMsIG9wdGlvbnMpLFxuICB9O1xuXG4gIHN0b3JlZC5lbGVtZW50ID0gc3RvcmVkLnN1cmZhY2UuY3VycmVudCgpO1xuICBzdG9yZWQuaGlzdG9yeSA9IG5ldyBJbnB1dEhpc3Rvcnkoc3RvcmVkLnN1cmZhY2UsIG5hbWUpO1xuXG4gIGlmKHN0b3JlZC5lbGVtZW50ICE9PSB0aGlzLnRleHRhcmVhKSB7XG4gICAgLy8gV2UgbmVlZCB0byBhdHRhY2ggdGhlIGVsZW1lbnRcbiAgICB0aGlzLmNvbXBvbmVudHMucGFyZW50Lmluc2VydEJlZm9yZShzdG9yZWQuZWxlbWVudCwgdGhpcy5jb21wb25lbnRzLnN3aXRjaGJvYXJkKTtcbiAgfVxuXG4gIC8vIEF0dGFjaCBidXR0b25cbiAgdGhpcy5jb21wb25lbnRzLnN3aXRjaGJvYXJkLmFwcGVuZENoaWxkKHN0b3JlZC5idXR0b24pO1xuICBzdG9yZWQuYnV0dG9uLnRleHRDb250ZW50ID0gc3RyaW5ncy5tb2Rlc1tuYW1lXSB8fCBuYW1lO1xuICBzdG9yZWQuYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5zZXRNb2RlLmJpbmQodGhpcywgbmFtZSkpO1xuICBzdG9yZWQuYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgc3RvcmVkLmJ1dHRvbi50YWJJbmRleCA9IC0xOyAvLyBUT0RPIEludmVzdGlnYXRlIGJldHRlciB3YXlzIHRvIGJ5cGFzcyBpc3N1ZXMgaGVyZSBmb3IgYWNjZXNzaWJpbGl0eVxuICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tuYW1lXTtcbiAgaWYgKHRpdGxlKSB7XG4gICAgc3RvcmVkLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgbWFjID8gbWFjaWZ5KHRpdGxlKSA6IHRpdGxlKTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIHNob3J0Y3V0XG4gIHRoaXMuc2hvcnRjdXRzLmF0dGFjaChzdG9yZWQuZWxlbWVudCk7XG4gIGlmKG9wdGlvbnMuc2hvcnRjdXRLZXkpIHtcbiAgICB0aGlzLnNob3J0Y3V0cy5hZGQob3B0aW9ucy5zaG9ydGN1dEtleSwgISFvcHRpb25zLnNoaWZ0LCB0aGlzLnNldE1vZGUuYmluZCh0aGlzLCBuYW1lKSk7XG4gIH1cblxuICAvLyBTZXQgTW9kZSBpZiBBY3RpdmVcbiAgaWYob3B0aW9ucy5hY3RpdmUpIHtcbiAgICB0aGlzLnNldE1vZGUobmFtZSk7XG4gICAgc3RvcmVkLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgdHJ1ZSk7XG4gIH1cblxuICByZXR1cm4gc3RvcmVkO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5zZXRNb2RlID0gZnVuY3Rpb24gKGdvVG9Nb2RlLCBlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGN1cnJlbnRNb2RlID0gdGhpcy5tb2Rlc1t0aGlzLm1vZGVdIHx8IHt9O1xuICB2YXIgbmV4dE1vZGUgPSB0aGlzLm1vZGVzW2dvVG9Nb2RlXTtcbiAgdmFyIG9sZCA9IGN1cnJlbnRNb2RlLmJ1dHRvbjtcbiAgdmFyIGJ1dHRvbiA9IG5leHRNb2RlLmJ1dHRvbjtcbiAgdmFyIGZvY3VzaW5nID0gISFlIHx8IGRvYy5hY3RpdmVFbGVtZW50ID09PSBjdXJyZW50TW9kZS5lbGVtZW50IHx8IGRvYy5hY3RpdmVFbGVtZW50ID09PSBuZXh0TW9kZS5lbGVtZW50O1xuXG4gIHN0b3AoZSk7XG5cbiAgaWYgKGN1cnJlbnRNb2RlID09PSBuZXh0TW9kZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMudGV4dGFyZWEuYmx1cigpOyAvLyBhdmVydCBjaHJvbWUgcmVwYWludCBidWdzXG5cbiAgY3VycmVudE1vZGUuc3VyZmFjZS5vZmYoJ2NoYW5nZScsIHN0YXNoQ2hhbmdlcyk7XG4gIG5leHRNb2RlLnN1cmZhY2Uud3JpdGVNYXJrZG93bihjdXJyZW50TW9kZS5zdXJmYWNlLnRvTWFya2Rvd24oKSk7XG4gIG5leHRNb2RlLnN1cmZhY2Uub24oJ2NoYW5nZScsIHN0YXNoQ2hhbmdlcyk7XG5cbiAgY2xhc3Nlcy5hZGQoY3VycmVudE1vZGUuZWxlbWVudCwgJ3drLWhpZGUnKTtcbiAgY2xhc3Nlcy5ybShuZXh0TW9kZS5lbGVtZW50LCAnd2staGlkZScpO1xuXG4gIGlmIChnb1RvTW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgY2xhc3Nlcy5ybSh0aGlzLnBsYWNlaG9sZGVyLCAnd2staGlkZScpOyB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgY2xhc3Nlcy5hZGQodGhpcy5wbGFjZWhvbGRlciwgJ3drLWhpZGUnKTsgfVxuICB9XG5cbiAgaWYgKGZvY3VzaW5nKSB7XG4gICAgbmV4dE1vZGUuc3VyZmFjZS5mb2N1cygpO1xuICB9XG5cbiAgY2xhc3Nlcy5hZGQoYnV0dG9uLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgY2xhc3Nlcy5ybShvbGQsICd3ay1tb2RlLWFjdGl2ZScpO1xuICBjbGFzc2VzLmFkZChvbGQsICd3ay1tb2RlLWluYWN0aXZlJyk7XG4gIGNsYXNzZXMucm0oYnV0dG9uLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICBvbGQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICB0aGlzLm1vZGUgPSBnb1RvTW9kZTtcblxuICBpZiAodGhpcy5vcHRpb25zLnN0b3JhZ2UpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLm9wdGlvbnMuc3RvcmFnZSwgSlNPTi5zdHJpbmdpZnkoZ29Ub01vZGUpKTtcbiAgfVxuXG4gIC8vIHRoaXMuaGlzdG9yeS5zZXRJbnB1dE1vZGUoZ29Ub01vZGUpO1xuICBmaXJlTGF0ZXIuY2FsbCh0aGlzLCAnYmFya21hcmstbW9kZS1jaGFuZ2UnKTtcblxuICBmdW5jdGlvbiBzdGFzaENoYW5nZXMgKCkge1xuICAgIGlmKG5leHRNb2RlLmVsZW1lbnQgIT09IHNlbGYudGV4dGFyZWEpIHtcbiAgICAgIHNlbGYudGV4dGFyZWEudmFsdWUgPSBuZXh0TW9kZS5zdXJmYWNlLnRvTWFya2Rvd24oKTtcbiAgICAgIHV0aWxzLmRpc3BhdGNoQnJvd3NlckV2ZW50KHNlbGYudGV4dGFyZWEsICdpbnB1dCcpO1xuICAgICAgdXRpbHMuZGlzcGF0Y2hCcm93c2VyRXZlbnQoc2VsZi50ZXh0YXJlYSwgJ2NoYW5nZScpO1xuICAgIH1cbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5nZXRNYXJrZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZ2V0U3VyZmFjZSgpLnRvTWFya2Rvd24oKTtcbn07XG5cbi8qXG4gIHZhciBlZGl0b3IgPSB7XG4gICAgYWRkQ29tbWFuZDogYWRkQ29tbWFuZCxcbiAgICBhZGRDb21tYW5kQnV0dG9uOiBhZGRDb21tYW5kQnV0dG9uLFxuICAgIHJ1bkNvbW1hbmQ6IHJ1bkNvbW1hbmQsXG4gICAgcGFyc2VNYXJrZG93bjogby5wYXJzZU1hcmtkb3duLFxuICAgIHBhcnNlSFRNTDogby5wYXJzZUhUTUwsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICB2YWx1ZTogZ2V0T3JTZXRWYWx1ZSxcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IG8ud3lzaXd5ZyA/IGVkaXRhYmxlIDogbnVsbCxcbiAgICBzZXRNb2RlOiBwZXJzaXN0TW9kZSxcbiAgICBoaXN0b3J5OiB7XG4gICAgICB1bmRvOiBoaXN0b3J5LnVuZG8sXG4gICAgICByZWRvOiBoaXN0b3J5LnJlZG8sXG4gICAgICBjYW5VbmRvOiBoaXN0b3J5LmNhblVuZG8sXG4gICAgICBjYW5SZWRvOiBoaXN0b3J5LmNhblJlZG9cbiAgICB9LFxuICAgIG1vZGU6ICdtYXJrZG93bidcbiAgfTtcbiovXG5cbmZ1bmN0aW9uIGZpcmVMYXRlciAodHlwZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24gZmlyZSAoKSB7XG4gICAgdXRpbHMuZGlzcGF0Y2hDdXN0b21FdmVudChzZWxmLnRleHRhcmVhLCB0eXBlKTtcbiAgfSwgMCk7XG59XG5cbmZ1bmN0aW9uIHRhZyAob3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KG8udCB8fCAnZGl2Jyk7XG4gIGVsLmNsYXNzTmFtZSA9IG8uYyB8fCAnJztcbiAgZWwudGV4dENvbnRlbnQgPSBvLnggfHwgJyc7XG4gIGlmIChvLnApIHsgby5wLmFwcGVuZENoaWxkKGVsKTsgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgaWYgKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpOyB9XG59XG5cbmZ1bmN0aW9uIG1hY2lmeSAodGV4dCkge1xuICByZXR1cm4gdGV4dFxuICAgIC5yZXBsYWNlKC9cXGJjdHJsXFxiL2ksICdcXHUyMzE4JylcbiAgICAucmVwbGFjZSgvXFxiYWx0XFxiL2ksICdcXHUyMzI1JylcbiAgICAucmVwbGFjZSgvXFxic2hpZnRcXGIvaSwgJ1xcdTIxZTcnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3I7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OWxaR2wwYjNJdWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklqdEJRVUZCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOTFkR2xzY3ljcE8xeHVMeThnZG1GeUlIVndiRzloWkhNZ1BTQnlaWEYxYVhKbEtDY3VMM1Z3Ykc5aFpITW5LVHRjYm5aaGNpQnpkSEpwYm1keklEMGdjbVZ4ZFdseVpTZ25MaTl6ZEhKcGJtZHpKeWs3WEc1MllYSWdZbWx1WkVOdmJXMWhibVJ6SUQwZ2NtVnhkV2x5WlNnbkxpOWlhVzVrUTI5dGJXRnVaSE1uS1R0Y2JuWmhjaUJKYm5CMWRFaHBjM1J2Y25rZ1BTQnlaWEYxYVhKbEtDY3VMMGx1Y0hWMFNHbHpkRzl5ZVNjcE8xeHVkbUZ5SUZOb2IzSjBZM1YwVFdGdVlXZGxjaUE5SUhKbGNYVnBjbVVvSnk0dmMyaHZjblJqZFhSekp5azdYRzUyWVhJZ1oyVjBRMjl0YldGdVpFaGhibVJzWlhJZ1BTQnlaWEYxYVhKbEtDY3VMMmRsZEVOdmJXMWhibVJJWVc1a2JHVnlKeWs3WEc1MllYSWdWR1Y0ZEZOMWNtWmhZMlVnUFNCeVpYRjFhWEpsS0NjdUwyMXZaR1Z6TDIxaGNtdGtiM2R1TDNSbGVIUmhjbVZoVTNWeVptRmpaU2NwTzF4dWRtRnlJRmQ1YzJsM2VXZFRkWEptWVdObElEMGdjbVZ4ZFdseVpTZ25MaTl0YjJSbGN5OTNlWE5wZDNsbkwzZDVjMmwzZVdkVGRYSm1ZV05sSnlrN1hHNTJZWElnWTJ4aGMzTmxjeUE5SUhKbGNYVnBjbVVvSnk0dlkyeGhjM05sY3ljcE8xeHVkbUZ5SUhKbGJtUmxjbVZ5Y3lBOUlISmxjWFZwY21Vb0p5NHZjbVZ1WkdWeVpYSnpKeWs3WEc1MllYSWdjSEp2YlhCMElEMGdjbVZ4ZFdseVpTZ25MaTl3Y205dGNIUnpMM0J5YjIxd2RDY3BPMXh1ZG1GeUlHTnNiM05sVUhKdmJYQjBjeUE5SUhKbGNYVnBjbVVvSnk0dmNISnZiWEIwY3k5amJHOXpaU2NwTzF4dWRtRnlJRzFoWXlBOUlDOWNYR0pOWVdNZ1QxTmNYR0l2TG5SbGMzUW9aMnh2WW1Gc0xtNWhkbWxuWVhSdmNpNTFjMlZ5UVdkbGJuUXBPMXh1ZG1GeUlHUnZZeUE5SUdSdlkzVnRaVzUwTzF4dVhHNW1kVzVqZEdsdmJpQkZaR2wwYjNJZ0tIUmxlSFJoY21WaExDQnZjSFJwYjI1ektTQjdYRzRnSUhSb2FYTXVkR1Y0ZEdGeVpXRWdQU0IwWlhoMFlYSmxZVHRjYmlBZ2RtRnlJSEJoY21WdWRDQTlJSFJsZUhSaGNtVmhMbkJoY21WdWRFNXZaR1U3WEc0Z0lIWmhjaUJ2SUQwZ2RHaHBjeTV2Y0hScGIyNXpJRDBnZFhScGJITXVaR1ZtWVhWc2RITkVaV1Z3S0c5d2RHbHZibk1nZkh3Z2UzMHNJSHRjYmlBZ0lDQXZMeUJFWldaaGRXeDBJRTl3ZEdsdmJpQldZV3gxWlhOY2JpQWdJQ0J0WVhKclpHOTNiam9nZEhKMVpTeGNiaUFnSUNCM2VYTnBkM2xuT2lCMGNuVmxMRnh1SUNBZ0lHaHlPaUJtWVd4elpTeGNiaUFnSUNCemRHOXlZV2RsT2lCMGNuVmxMRnh1SUNBZ0lHWmxibU5wYm1jNklIUnlkV1VzWEc0Z0lDQWdjbVZ1WkdWeU9pQjdYRzRnSUNBZ0lDQnRiMlJsY3pvZ2UzMHNYRzRnSUNBZ0lDQmpiMjF0WVc1a2N6b2dlMzBzWEc0Z0lDQWdmU3hjYmlBZ0lDQndjbTl0Y0hSek9pQjdYRzRnSUNBZ0lDQnNhVzVyT2lCd2NtOXRjSFFzWEc0Z0lDQWdJQ0JwYldGblpUb2djSEp2YlhCMExGeHVJQ0FnSUNBZ1lYUjBZV05vYldWdWREb2djSEp2YlhCMExGeHVJQ0FnSUNBZ1kyeHZjMlU2SUdOc2IzTmxVSEp2YlhCMGN5eGNiaUFnSUNCOUxGeHVJQ0FnSUdOc1lYTnpaWE02SUh0Y2JpQWdJQ0FnSUhkNWMybDNlV2M2SUZ0ZExGeHVJQ0FnSUNBZ2NISnZiWEIwY3pvZ2UzMHNYRzRnSUNBZ0lDQnBibkIxZERvZ2UzMHNYRzRnSUNBZ2ZTeGNiaUFnZlNrN1hHNWNiaUFnYVdZZ0tDRnZMbTFoY210a2IzZHVJQ1ltSUNGdkxuZDVjMmwzZVdjcElIdGNiaUFnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjJKaGNtdHRZWEpySUdWNGNHVmpkSE1nWVhRZ2JHVmhjM1FnYjI1bElHbHVjSFYwSUcxdlpHVWdkRzhnWW1VZ1lYWmhhV3hoWW14bEp5azdYRzRnSUgxY2JseHVJQ0JwWmlBb2J5NXpkRzl5WVdkbElEMDlQU0IwY25WbEtTQjdJRzh1YzNSdmNtRm5aU0E5SUNkaVlYSnJiV0Z5YTE5cGJuQjFkRjl0YjJSbEp6c2dmVnh1WEc0Z0lIWmhjaUJ3Y21WbVpYSmxibU5sSUQwZ2J5NXpkRzl5WVdkbElDWW1JRXBUVDA0dWNHRnljMlVvYkc5allXeFRkRzl5WVdkbExtZGxkRWwwWlcwb2J5NXpkRzl5WVdkbEtTazdYRzRnSUdsbUlDaHdjbVZtWlhKbGJtTmxLU0I3WEc0Z0lDQWdieTVrWldaaGRXeDBUVzlrWlNBOUlIQnlaV1psY21WdVkyVTdYRzRnSUgxY2JseHVJQ0IwYUdsekxtTnZiWEJ2Ym1WdWRITWdQU0I3WEc0Z0lDQWdkR1Y0ZEdGeVpXRTZJSFJsZUhSaGNtVmhMRnh1SUNBZ0lIQmhjbVZ1ZERvZ2RHVjRkR0Z5WldFdWNHRnlaVzUwVG05a1pTeGNiaUFnSUNCa2NtOXdZWEpsWVRvZ2RHRm5LSHNnWXpvZ0ozZHJMV052Ym5SaGFXNWxjaTFrY205d0p5QjlLU3hjYmlBZ0lDQnpkMmwwWTJoaWIyRnlaRG9nZEdGbktIc2dZem9nSjNkckxYTjNhWFJqYUdKdllYSmtKeUI5S1N4Y2JpQWdJQ0JqYjIxdFlXNWtjem9nZEdGbktIc2dZem9nSjNkckxXTnZiVzFoYm1Sekp5QjlLU3hjYmlBZ2ZUdGNibHh1SUNCMGFHbHpMbk5vYjNKMFkzVjBjeUE5SUc1bGR5QlRhRzl5ZEdOMWRFMWhibUZuWlhJb0tUdGNiaUFnZEdocGN5NXRiMlJsY3lBOUlIdDlPMXh1SUNCMGFHbHpMbTF2WkdVZ1BTQW5iV0Z5YTJSdmQyNG5PeUF2THlCWGFHbHNaU0JwYm1sMGFXRnNhWHBwYm1jZ2QyVWdZWEpsSUdGc2QyRjVjeUJ6YUc5M2FXNW5JSFJvWlNCMFpYaDBZWEpsWVNCY0ltMWhjbXRrYjNkdVhDSWdkbWxsZDF4dVhHNGdJSFJoWnloN0lIUTZJQ2R6Y0dGdUp5d2dZem9nSjNkckxXUnliM0F0ZEdWNGRDY3NJSGc2SUhOMGNtbHVaM011Y0hKdmJYQjBjeTVrY205d0xDQndPaUIwYUdsekxtTnZiWEJ2Ym1WdWRITXVaSEp2Y0dGeVpXRWdmU2s3WEc0Z0lIUmhaeWg3SUhRNklDZHdKeXdnWXpvZ1d5ZDNheTFrY205d0xXbGpiMjRuWFM1amIyNWpZWFFvYnk1amJHRnpjMlZ6TG1SeWIzQnBZMjl1S1M1cWIybHVLQ2NnSnlrc0lIQTZJSFJvYVhNdVkyOXRjRzl1Wlc1MGN5NWtjbTl3WVhKbFlTQjlLVHRjYmx4dUlDQXZMeUJCZEhSaFkyZ2dRMjl0Y0c5dVpXNTBjMXh1SUNCamJHRnpjMlZ6TG1Ga1pDaHdZWEpsYm5Rc0lDZDNheTFqYjI1MFlXbHVaWEluS1R0Y2JpQWdjR0Z5Wlc1MExtbHVjMlZ5ZEVKbFptOXlaU2gwYUdsekxtTnZiWEJ2Ym1WdWRITXVZMjl0YldGdVpITXNJSFJvYVhNdWRHVjRkR0Z5WldFcE8xeHVJQ0JwWmlBb2RHaHBjeTV3YkdGalpXaHZiR1JsY2lrZ2V5QndZWEpsYm5RdVlYQndaVzVrUTJocGJHUW9kR2hwY3k1d2JHRmpaV2h2YkdSbGNpazdJSDFjYmlBZ2NHRnlaVzUwTG1Gd2NHVnVaRU5vYVd4a0tIUm9hWE11WTI5dGNHOXVaVzUwY3k1emQybDBZMmhpYjJGeVpDazdYRzRnSUM4dklGUlBSRTljYmlBZ0x5OGdhV1lnS0hSb2FYTXViM0IwYVc5dWN5NXBiV0ZuWlhNZ2ZId2dkR2hwY3k1dmNIUnBiMjV6TG1GMGRHRmphRzFsYm5SektTQjdYRzRnSUNBZ0x5OGdjR0Z5Wlc1MFcyMXZkbDBvZEdocGN5NWpiMjF3YjI1bGJuUnpMbVJ5YjNCaGNtVmhLVHRjYmlBZ0lDQXZMeUIxY0d4dllXUnpLSEJoY21WdWRDd2dkR2hwY3k1amIyMXdiMjVsYm5SekxtUnliM0JoY21WaExDQjBhR2x6TENCdkxDQnlaVzF2ZG1VcE8xeHVJQ0F2THlCOVhHNWNiaUFnYVdZb2J5NXRZWEpyWkc5M2Jpa2dlMXh1SUNBZ0lIUm9hWE11Y21WbmFYTjBaWEpOYjJSbEtDZHRZWEpyWkc5M2JpY3NJRlJsZUhSVGRYSm1ZV05sTENCN1hHNGdJQ0FnSUNCaFkzUnBkbVU2SUNnaGJ5NWtaV1poZFd4MFRXOWtaU0I4ZkNBaGIxdHZMbVJsWm1GMWJIUk5iMlJsWFNCOGZDQnZMbVJsWm1GMWJIUk5iMlJsSUQwOVBTQW5iV0Z5YTJSdmQyNG5LU3hjYmlBZ0lDQWdJSE5vYjNKMFkzVjBTMlY1T2lBbmJTY3NYRzRnSUNBZ2ZTazdYRzRnSUgxY2JpQWdhV1lvYnk1M2VYTnBkM2xuS1NCN1hHNGdJQ0FnZEdocGN5NXlaV2RwYzNSbGNrMXZaR1VvSjNkNWMybDNlV2NuTENCWGVYTnBkM2xuVTNWeVptRmpaU3dnZTF4dUlDQWdJQ0FnWVdOMGFYWmxPaUJ2TG1SbFptRjFiSFJOYjJSbElEMDlQU0FuZDNsemFYZDVaeWNnZkh3Z0lXOHViV0Z5YTJSdmQyNHNYRzRnSUNBZ0lDQnphRzl5ZEdOMWRFdGxlVG9nSjNBbkxGeHVJQ0FnSUNBZ1kyeGhjM05sY3pvZ2J5NWpiR0Z6YzJWekxuZDVjMmwzZVdjZ2ZId2dXMTBzWEc0Z0lDQWdmU2s3WEc1Y2JpQWdJQ0IwYUdsekxuQnNZV05sYUc5c1pHVnlJRDBnZEdGbktIc2dZem9nSjNkckxYZDVjMmwzZVdjdGNHeGhZMlZvYjJ4a1pYSWdkMnN0YUdsa1pTY3NJSGc2SUhSbGVIUmhjbVZoTG5Cc1lXTmxhRzlzWkdWeUlIMHBPMXh1SUNBZ0lIUm9hWE11Y0d4aFkyVm9iMnhrWlhJdVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnblkyeHBZMnNuTENCMGFHbHpMbTF2WkdWekxuZDVjMmwzZVdjdWMzVnlabUZqWlM1bWIyTjFjeTVpYVc1a0tIUm9hWE11Ylc5a1pYTXVkM2x6YVhkNVp5NXpkWEptWVdObEtTazdYRzRnSUgxY2JseHVJQ0JpYVc1a1EyOXRiV0Z1WkhNb2RHaHBjeXdnYnlrN1hHNTlYRzVjYmtWa2FYUnZjaTV3Y205MGIzUjVjR1V1WjJWMFUzVnlabUZqWlNBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2NtVjBkWEp1SUhSb2FYTXViVzlrWlhOYmRHaHBjeTV0YjJSbFhTNXpkWEptWVdObE8xeHVmVHRjYmx4dVJXUnBkRzl5TG5CeWIzUnZkSGx3WlM1aFpHUkRiMjF0WVc1a0lEMGdablZ1WTNScGIyNGdLR3RsZVN3Z2MyaHBablFzSUdadUtTQjdYRzRnSUdsbUtHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnZ1BUMDlJRElwSUh0Y2JpQWdJQ0JtYmlBOUlITm9hV1owTzF4dUlDQWdJSE5vYVdaMElEMGdkVzVrWldacGJtVmtPMXh1SUNCOVhHNWNiaUFnZEdocGN5NXphRzl5ZEdOMWRITXVZV1JrS0d0bGVTd2djMmhwWm5Rc0lHZGxkRU52YlcxaGJtUklZVzVrYkdWeUtIUm9hWE1zSUhSb2FYTXViVzlrWlhOYmRHaHBjeTV0YjJSbFhTNW9hWE4wYjNKNUxDQm1iaWtwTzF4dWZUdGNibHh1UldScGRHOXlMbkJ5YjNSdmRIbHdaUzVoWkdSRGIyMXRZVzVrUW5WMGRHOXVJRDBnWm5WdVkzUnBiMjRnS0dsa0xDQnJaWGtzSUhOb2FXWjBMQ0JtYmlrZ2UxeHVJQ0JwWmlBb1lYSm5kVzFsYm5SekxteGxibWQwYUNBOVBUMGdNaWtnZTF4dUlDQWdJR1p1SUQwZ2EyVjVPMXh1SUNBZ0lHdGxlU0E5SUhWdVpHVm1hVzVsWkR0Y2JpQWdJQ0J6YUdsbWRDQTlJSFZ1WkdWbWFXNWxaRHRjYmlBZ2ZTQmxiSE5sSUdsbUlDaGhjbWQxYldWdWRITXViR1Z1WjNSb0lEMDlQU0F6S1NCN1hHNGdJQ0FnWm00Z1BTQnphR2xtZER0Y2JpQWdJQ0J6YUdsbWRDQTlJSFZ1WkdWbWFXNWxaRHRjYmlBZ2ZWeHVYRzRnSUhaaGNpQmlkWFIwYjI0Z1BTQjBZV2NvZXlCME9pQW5ZblYwZEc5dUp5d2dZem9nSjNkckxXTnZiVzFoYm1RbkxDQndPaUIwYUdsekxtTnZiWEJ2Ym1WdWRITXVZMjl0YldGdVpITWdmU2s3WEc0Z0lIWmhjaUJqZFhOMGIyMGdQU0IwYUdsekxtOXdkR2x2Ym5NdWNtVnVaR1Z5TG1OdmJXMWhibVJ6TzF4dUlDQjJZWElnY21WdVpHVnlJRDBnZEhsd1pXOW1JR04xYzNSdmJTQTlQVDBnSjJaMWJtTjBhVzl1SnlBL0lHTjFjM1J2YlNBNklISmxibVJsY21WeWN5NWpiMjF0WVc1a2N6dGNiaUFnZG1GeUlIUnBkR3hsSUQwZ2MzUnlhVzVuY3k1MGFYUnNaWE5iYVdSZE8xeHVJQ0JwWmlBb2RHbDBiR1VwSUh0Y2JpQWdJQ0JpZFhSMGIyNHVjMlYwUVhSMGNtbGlkWFJsS0NkMGFYUnNaU2NzSUcxaFl5QS9JRzFoWTJsbWVTaDBhWFJzWlNrZ09pQjBhWFJzWlNrN1hHNGdJSDFjYmlBZ1luVjBkRzl1TG5SNWNHVWdQU0FuWW5WMGRHOXVKenRjYmlBZ1luVjBkRzl1TG5SaFlrbHVaR1Y0SUQwZ0xURTdYRzRnSUhKbGJtUmxjaWhpZFhSMGIyNHNJR2xrS1R0Y2JpQWdZblYwZEc5dUxtRmtaRVYyWlc1MFRHbHpkR1Z1WlhJb0oyTnNhV05ySnl3Z1oyVjBRMjl0YldGdVpFaGhibVJzWlhJb2RHaHBjeXdnZEdocGN5NXRiMlJsYzF0MGFHbHpMbTF2WkdWZExtaHBjM1J2Y25rc0lHWnVLU2s3WEc0Z0lHbG1JQ2hyWlhrcElIdGNiaUFnSUNCMGFHbHpMbUZrWkVOdmJXMWhibVFvYTJWNUxDQnphR2xtZEN3Z1ptNHBPMXh1SUNCOVhHNGdJSEpsZEhWeWJpQmlkWFIwYjI0N1hHNTlPMXh1WEc1RlpHbDBiM0l1Y0hKdmRHOTBlWEJsTG5KMWJrTnZiVzFoYm1RZ1BTQm1kVzVqZEdsdmJpQW9abTRwSUh0Y2JpQWdaMlYwUTI5dGJXRnVaRWhoYm1Sc1pYSW9kR2hwY3l3Z2RHaHBjeTV0YjJSbGMxdDBhR2x6TG0xdlpHVmRMbWhwYzNSdmNua3NJSEpsWVhKeVlXNW5aU2tvYm5Wc2JDazdYRzVjYmlBZ1puVnVZM1JwYjI0Z2NtVmhjbkpoYm1kbElDaGxMQ0J0YjJSbExDQmphSFZ1YTNNcElIdGNiaUFnSUNCeVpYUjFjbTRnWm00dVkyRnNiQ2gwYUdsekxDQmphSFZ1YTNNc0lHMXZaR1VwTzF4dUlDQjlYRzU5TzF4dVhHNUZaR2wwYjNJdWNISnZkRzkwZVhCbExuQmhjbk5sVFdGeWEyUnZkMjRnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhKbGRIVnliaUIwYUdsekxtOXdkR2x2Ym5NdWNHRnljMlZOWVhKclpHOTNiaTVoY0hCc2VTaDBhR2x6TG05d2RHbHZibk11Y0dGeWMyVk5ZWEpyWkc5M2Jpd2dZWEpuZFcxbGJuUnpLVHRjYm4wN1hHNWNia1ZrYVhSdmNpNXdjbTkwYjNSNWNHVXVjR0Z5YzJWSVZFMU1JRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1dmNIUnBiMjV6TG5CaGNuTmxTRlJOVEM1aGNIQnNlU2gwYUdsekxtOXdkR2x2Ym5NdWNHRnljMlZJVkUxTUxDQmhjbWQxYldWdWRITXBPMXh1ZlR0Y2JseHVSV1JwZEc5eUxuQnliM1J2ZEhsd1pTNWtaWE4wY205NUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQnBaaUFvZEdocGN5NXRiMlJsSUNFOVBTQW5iV0Z5YTJSdmQyNG5LU0I3WEc0Z0lDQWdkR2hwY3k1MFpYaDBZWEpsWVM1MllXeDFaU0E5SUhSb2FYTXVaMlYwVFdGeWEyUnZkMjRvS1R0Y2JpQWdmVnh1SUNCamJHRnpjMlZ6TG5KdEtIUm9hWE11ZEdWNGRHRnlaV0VzSUNkM2F5MW9hV1JsSnlrN1hHNWNiaUFnZEdocGN5NXphRzl5ZEdOMWRITXVZMnhsWVhJb0tUdGNibHh1SUNCMllYSWdjR0Z5Wlc1MElEMGdkR2hwY3k1amIyMXdiMjVsYm5SekxuQmhjbVZ1ZER0Y2JpQWdZMnhoYzNObGN5NXliU2h3WVhKbGJuUXNJQ2QzYXkxamIyNTBZV2x1WlhJbktUdGNibHh1SUNBdkx5QlNaVzF2ZG1VZ1kyOXRjRzl1Wlc1MGMxeHVJQ0J3WVhKbGJuUXVjbVZ0YjNabFEyaHBiR1FvZEdocGN5NWpiMjF3YjI1bGJuUnpMbU52YlcxaGJtUnpLVHRjYmlBZ2FXWWdLSFJvYVhNdWNHeGhZMlZvYjJ4a1pYSXBJSHNnY0dGeVpXNTBMbkpsYlc5MlpVTm9hV3hrS0hSb2FYTXVjR3hoWTJWb2IyeGtaWElwT3lCOVhHNGdJSEJoY21WdWRDNXlaVzF2ZG1WRGFHbHNaQ2gwYUdsekxtTnZiWEJ2Ym1WdWRITXVjM2RwZEdOb1ltOWhjbVFwTzF4dVhHNGdJQzh2SUZKbGJXOTJaU0JoYkd3Z2JXOWtaWE1nZEdoaGRDQmhjbVZ1SjNRZ2RYTnBibWNnZEdobElIUmxlSFJoY21WaFhHNGdJSFpoY2lCdGIyUmxjeUE5SUU5aWFtVmpkQzVyWlhsektIUm9hWE11Ylc5a1pYTXBPMXh1SUNCMllYSWdjMlZzWmlBOUlIUm9hWE03WEc0Z0lHMXZaR1Z6TG1admNrVmhZMmdvWm5WdVkzUnBiMjRnS0cxdlpHVXBJSHRjYmlBZ0lDQnBaaWh6Wld4bUxtMXZaR1Z6VzIxdlpHVmRMbVZzWlcxbGJuUWdJVDA5SUhObGJHWXVkR1Y0ZEdGeVpXRXBJSHRjYmlBZ0lDQWdJSEJoY21WdWRDNXlaVzF2ZG1WRGFHbHNaQ2h6Wld4bUxtMXZaR1Z6VzIxdlpHVmRMbVZzWlcxbGJuUXBPMXh1SUNBZ0lIMWNiaUFnSUNBdkx5QlVUMFJQSUVSbGRHRmphQ0JqYUdGdVoyVWdaWFpsYm5RZ2JHbHpkR1Z1WlhKeklHWnZjaUJ6ZFhKbVlXTmxJR1ZzWlcxbGJuUnpYRzRnSUNBZ2RHaHBjeTV6YUc5eWRHTjFkSE11WkdWMFlXTm9LSE5sYkdZdWJXOWtaWE5iYlc5a1pWMHVaV3hsYldWdWRDazdYRzRnSUgwcE8xeHVYRzRnSUM4dklGUlBSRTljYmlBZ0x5OGdhV1lnS0hSb2FYTXViM0IwYVc5dWN5NXBiV0ZuWlhNZ2ZId2dkR2hwY3k1dmNIUnBiMjV6TG1GMGRHRmphRzFsYm5SektTQjdYRzRnSUNBZ0x5OGdjR0Z5Wlc1MExuSmxiVzkyWlVOb2FXeGtLSFJvYVhNdVkyOXRjRzl1Wlc1MGN5NWtjbTl3WVhKbFlTazdYRzRnSUNBZ0x5OGdkWEJzYjJGa2N5aHdZWEpsYm5Rc0lIUm9hWE11WTI5dGNHOXVaVzUwY3k1a2NtOXdZWEpsWVN3Z2RHaHBjeXdnYnl3Z2NtVnRiM1psS1R0Y2JpQWdMeThnZlZ4dWZUdGNibHh1UldScGRHOXlMbkJ5YjNSdmRIbHdaUzUyWVd4MVpTQTlJR1oxYm1OMGFXOXVJR2RsZEU5eVUyVjBWbUZzZFdVZ0tHbHVjSFYwS1NCN1hHNGdJSFpoY2lCdFlYSnJaRzkzYmlBOUlGTjBjbWx1WnlocGJuQjFkQ2s3WEc0Z0lIWmhjaUJ6Wld4bUlEMGdkR2hwY3p0Y2JseHVJQ0IyWVhJZ2MyVjBjeUE5SUdGeVozVnRaVzUwY3k1c1pXNW5kR2dnUFQwOUlERTdYRzRnSUdsbUlDaHpaWFJ6S1NCN1hHNGdJQ0FnYVdZZ0tIUm9hWE11Ylc5a1pTQTlQVDBnSjNkNWMybDNlV2NuS1NCN1hHNGdJQ0FnSUNCdFlYSnJaRzkzYmlBOUlHRnpTSFJ0YkNncE8xeHVJQ0FnSUgxY2JpQWdJQ0IwYUdsekxtZGxkRk4xY21aaFkyVW9LUzUzY21sMFpTaHRZWEpyWkc5M2JpazdYRzRnSUNBZ2RHaHBjeTV0YjJSbGMxdDBhR2x6TG0xdlpHVmRMbWhwYzNSdmNua3VjbVZ6WlhRb0tUdGNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQjBhR2x6TG1kbGRFMWhjbXRrYjNkdUtDazdYRzVjYmlBZ1puVnVZM1JwYjI0Z1lYTklkRzFzSUNncElIdGNiaUFnSUNCeVpYUjFjbTRnYzJWc1ppNXZjSFJwYjI1ekxuQmhjbk5sVFdGeWEyUnZkMjRvYldGeWEyUnZkMjRwTzF4dUlDQjlYRzU5TzF4dVhHNUZaR2wwYjNJdWNISnZkRzkwZVhCbExuSmxaMmx6ZEdWeVRXOWtaU0E5SUdaMWJtTjBhVzl1SUNodVlXMWxMQ0JOYjJSbExDQnZjSFJwYjI1ektTQjdYRzRnSUhaaGNpQmlkWFIwYjI1RGJHRnpjMlZ6SUQwZ1d5ZDNheTF0YjJSbEoxMDdYRzRnSUdsbUtHOXdkR2x2Ym5NdVlXTjBhWFpsS1NCN1hHNGdJQ0FnWW5WMGRHOXVRMnhoYzNObGN5NXdkWE5vS0NkM2F5MXRiMlJsTFdGamRHbDJaU2NwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUdKMWRIUnZia05zWVhOelpYTXVjSFZ6YUNnbmQyc3RiVzlrWlMxcGJtRmpkR2wyWlNjcE8xeHVJQ0I5WEc1Y2JpQWdkbUZ5SUhOMGIzSmxaQ0E5SUhSb2FYTXViVzlrWlhOYmJtRnRaVjBnUFNCN1hHNGdJQ0FnWW5WMGRHOXVPaUIwWVdjb2V5QjBPaUFuWW5WMGRHOXVKeXdnWXpvZ1luVjBkRzl1UTJ4aGMzTmxjeTVxYjJsdUtDY2dKeWtnZlNrc1hHNGdJQ0FnYzNWeVptRmpaVG9nYm1WM0lFMXZaR1VvZEdocGN5d2diM0IwYVc5dWN5a3NYRzRnSUgwN1hHNWNiaUFnYzNSdmNtVmtMbVZzWlcxbGJuUWdQU0J6ZEc5eVpXUXVjM1Z5Wm1GalpTNWpkWEp5Wlc1MEtDazdYRzRnSUhOMGIzSmxaQzVvYVhOMGIzSjVJRDBnYm1WM0lFbHVjSFYwU0dsemRHOXllU2h6ZEc5eVpXUXVjM1Z5Wm1GalpTd2dibUZ0WlNrN1hHNWNiaUFnYVdZb2MzUnZjbVZrTG1Wc1pXMWxiblFnSVQwOUlIUm9hWE11ZEdWNGRHRnlaV0VwSUh0Y2JpQWdJQ0F2THlCWFpTQnVaV1ZrSUhSdklHRjBkR0ZqYUNCMGFHVWdaV3hsYldWdWRGeHVJQ0FnSUhSb2FYTXVZMjl0Y0c5dVpXNTBjeTV3WVhKbGJuUXVhVzV6WlhKMFFtVm1iM0psS0hOMGIzSmxaQzVsYkdWdFpXNTBMQ0IwYUdsekxtTnZiWEJ2Ym1WdWRITXVjM2RwZEdOb1ltOWhjbVFwTzF4dUlDQjlYRzVjYmlBZ0x5OGdRWFIwWVdOb0lHSjFkSFJ2Ymx4dUlDQjBhR2x6TG1OdmJYQnZibVZ1ZEhNdWMzZHBkR05vWW05aGNtUXVZWEJ3Wlc1a1EyaHBiR1FvYzNSdmNtVmtMbUoxZEhSdmJpazdYRzRnSUhOMGIzSmxaQzVpZFhSMGIyNHVkR1Y0ZEVOdmJuUmxiblFnUFNCemRISnBibWR6TG0xdlpHVnpXMjVoYldWZElIeDhJRzVoYldVN1hHNGdJSE4wYjNKbFpDNWlkWFIwYjI0dVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnblkyeHBZMnNuTENCMGFHbHpMbk5sZEUxdlpHVXVZbWx1WkNoMGFHbHpMQ0J1WVcxbEtTazdYRzRnSUhOMGIzSmxaQzVpZFhSMGIyNHVkSGx3WlNBOUlDZGlkWFIwYjI0bk8xeHVJQ0J6ZEc5eVpXUXVZblYwZEc5dUxuUmhZa2x1WkdWNElEMGdMVEU3SUM4dklGUlBSRThnU1c1MlpYTjBhV2RoZEdVZ1ltVjBkR1Z5SUhkaGVYTWdkRzhnWW5sd1lYTnpJR2x6YzNWbGN5Qm9aWEpsSUdadmNpQmhZMk5sYzNOcFltbHNhWFI1WEc0Z0lIWmhjaUIwYVhSc1pTQTlJSE4wY21sdVozTXVkR2wwYkdWelcyNWhiV1ZkTzF4dUlDQnBaaUFvZEdsMGJHVXBJSHRjYmlBZ0lDQnpkRzl5WldRdVluVjBkRzl1TG5ObGRFRjBkSEpwWW5WMFpTZ25kR2wwYkdVbkxDQnRZV01nUHlCdFlXTnBabmtvZEdsMGJHVXBJRG9nZEdsMGJHVXBPMXh1SUNCOVhHNWNiaUFnTHk4Z1VtVm5hWE4wWlhJZ2MyaHZjblJqZFhSY2JpQWdkR2hwY3k1emFHOXlkR04xZEhNdVlYUjBZV05vS0hOMGIzSmxaQzVsYkdWdFpXNTBLVHRjYmlBZ2FXWW9iM0IwYVc5dWN5NXphRzl5ZEdOMWRFdGxlU2tnZTF4dUlDQWdJSFJvYVhNdWMyaHZjblJqZFhSekxtRmtaQ2h2Y0hScGIyNXpMbk5vYjNKMFkzVjBTMlY1TENBaElXOXdkR2x2Ym5NdWMyaHBablFzSUhSb2FYTXVjMlYwVFc5a1pTNWlhVzVrS0hSb2FYTXNJRzVoYldVcEtUdGNiaUFnZlZ4dVhHNGdJQzh2SUZObGRDQk5iMlJsSUdsbUlFRmpkR2wyWlZ4dUlDQnBaaWh2Y0hScGIyNXpMbUZqZEdsMlpTa2dlMXh1SUNBZ0lIUm9hWE11YzJWMFRXOWtaU2h1WVcxbEtUdGNiaUFnSUNCemRHOXlaV1F1WW5WMGRHOXVMbk5sZEVGMGRISnBZblYwWlNnblpHbHpZV0pzWldRbkxDQjBjblZsS1R0Y2JpQWdmVnh1WEc0Z0lISmxkSFZ5YmlCemRHOXlaV1E3WEc1OU8xeHVYRzVGWkdsMGIzSXVjSEp2ZEc5MGVYQmxMbk5sZEUxdlpHVWdQU0JtZFc1amRHbHZiaUFvWjI5VWIwMXZaR1VzSUdVcElIdGNiaUFnZG1GeUlITmxiR1lnUFNCMGFHbHpPMXh1SUNCMllYSWdZM1Z5Y21WdWRFMXZaR1VnUFNCMGFHbHpMbTF2WkdWelczUm9hWE11Ylc5a1pWMGdmSHdnZTMwN1hHNGdJSFpoY2lCdVpYaDBUVzlrWlNBOUlIUm9hWE11Ylc5a1pYTmJaMjlVYjAxdlpHVmRPMXh1SUNCMllYSWdiMnhrSUQwZ1kzVnljbVZ1ZEUxdlpHVXVZblYwZEc5dU8xeHVJQ0IyWVhJZ1luVjBkRzl1SUQwZ2JtVjRkRTF2WkdVdVluVjBkRzl1TzF4dUlDQjJZWElnWm05amRYTnBibWNnUFNBaElXVWdmSHdnWkc5akxtRmpkR2wyWlVWc1pXMWxiblFnUFQwOUlHTjFjbkpsYm5STmIyUmxMbVZzWlcxbGJuUWdmSHdnWkc5akxtRmpkR2wyWlVWc1pXMWxiblFnUFQwOUlHNWxlSFJOYjJSbExtVnNaVzFsYm5RN1hHNWNiaUFnYzNSdmNDaGxLVHRjYmx4dUlDQnBaaUFvWTNWeWNtVnVkRTF2WkdVZ1BUMDlJRzVsZUhSTmIyUmxLU0I3WEc0Z0lDQWdjbVYwZFhKdU8xeHVJQ0I5WEc1Y2JpQWdkR2hwY3k1MFpYaDBZWEpsWVM1aWJIVnlLQ2s3SUM4dklHRjJaWEowSUdOb2NtOXRaU0J5WlhCaGFXNTBJR0oxWjNOY2JseHVJQ0JqZFhKeVpXNTBUVzlrWlM1emRYSm1ZV05sTG05bVppZ25ZMmhoYm1kbEp5d2djM1JoYzJoRGFHRnVaMlZ6S1R0Y2JpQWdibVY0ZEUxdlpHVXVjM1Z5Wm1GalpTNTNjbWwwWlUxaGNtdGtiM2R1S0dOMWNuSmxiblJOYjJSbExuTjFjbVpoWTJVdWRHOU5ZWEpyWkc5M2JpZ3BLVHRjYmlBZ2JtVjRkRTF2WkdVdWMzVnlabUZqWlM1dmJpZ25ZMmhoYm1kbEp5d2djM1JoYzJoRGFHRnVaMlZ6S1R0Y2JseHVJQ0JqYkdGemMyVnpMbUZrWkNoamRYSnlaVzUwVFc5a1pTNWxiR1Z0Wlc1MExDQW5kMnN0YUdsa1pTY3BPMXh1SUNCamJHRnpjMlZ6TG5KdEtHNWxlSFJOYjJSbExtVnNaVzFsYm5Rc0lDZDNheTFvYVdSbEp5azdYRzVjYmlBZ2FXWWdLR2R2Vkc5TmIyUmxJRDA5UFNBbmQzbHphWGQ1WnljcElIdGNiaUFnSUNCcFppQW9kR2hwY3k1d2JHRmpaV2h2YkdSbGNpa2dleUJqYkdGemMyVnpMbkp0S0hSb2FYTXVjR3hoWTJWb2IyeGtaWElzSUNkM2F5MW9hV1JsSnlrN0lIMWNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQnBaaUFvZEdocGN5NXdiR0ZqWldodmJHUmxjaWtnZXlCamJHRnpjMlZ6TG1Ga1pDaDBhR2x6TG5Cc1lXTmxhRzlzWkdWeUxDQW5kMnN0YUdsa1pTY3BPeUI5WEc0Z0lIMWNibHh1SUNCcFppQW9abTlqZFhOcGJtY3BJSHRjYmlBZ0lDQnVaWGgwVFc5a1pTNXpkWEptWVdObExtWnZZM1Z6S0NrN1hHNGdJSDFjYmx4dUlDQmpiR0Z6YzJWekxtRmtaQ2hpZFhSMGIyNHNJQ2QzYXkxdGIyUmxMV0ZqZEdsMlpTY3BPMXh1SUNCamJHRnpjMlZ6TG5KdEtHOXNaQ3dnSjNkckxXMXZaR1V0WVdOMGFYWmxKeWs3WEc0Z0lHTnNZWE56WlhNdVlXUmtLRzlzWkN3Z0ozZHJMVzF2WkdVdGFXNWhZM1JwZG1VbktUdGNiaUFnWTJ4aGMzTmxjeTV5YlNoaWRYUjBiMjRzSUNkM2F5MXRiMlJsTFdsdVlXTjBhWFpsSnlrN1hHNGdJR0oxZEhSdmJpNXpaWFJCZEhSeWFXSjFkR1VvSjJScGMyRmliR1ZrSnl3Z0oyUnBjMkZpYkdWa0p5azdYRzRnSUc5c1pDNXlaVzF2ZG1WQmRIUnlhV0oxZEdVb0oyUnBjMkZpYkdWa0p5azdYRzRnSUhSb2FYTXViVzlrWlNBOUlHZHZWRzlOYjJSbE8xeHVYRzRnSUdsbUlDaDBhR2x6TG05d2RHbHZibk11YzNSdmNtRm5aU2tnZTF4dUlDQWdJR3h2WTJGc1UzUnZjbUZuWlM1elpYUkpkR1Z0S0hSb2FYTXViM0IwYVc5dWN5NXpkRzl5WVdkbExDQktVMDlPTG5OMGNtbHVaMmxtZVNobmIxUnZUVzlrWlNrcE8xeHVJQ0I5WEc1Y2JpQWdMeThnZEdocGN5NW9hWE4wYjNKNUxuTmxkRWx1Y0hWMFRXOWtaU2huYjFSdlRXOWtaU2s3WEc0Z0lHWnBjbVZNWVhSbGNpNWpZV3hzS0hSb2FYTXNJQ2RpWVhKcmJXRnlheTF0YjJSbExXTm9ZVzVuWlNjcE8xeHVYRzRnSUdaMWJtTjBhVzl1SUhOMFlYTm9RMmhoYm1kbGN5QW9LU0I3WEc0Z0lDQWdhV1lvYm1WNGRFMXZaR1V1Wld4bGJXVnVkQ0FoUFQwZ2MyVnNaaTUwWlhoMFlYSmxZU2tnZTF4dUlDQWdJQ0FnYzJWc1ppNTBaWGgwWVhKbFlTNTJZV3gxWlNBOUlHNWxlSFJOYjJSbExuTjFjbVpoWTJVdWRHOU5ZWEpyWkc5M2JpZ3BPMXh1SUNBZ0lDQWdkWFJwYkhNdVpHbHpjR0YwWTJoQ2NtOTNjMlZ5UlhabGJuUW9jMlZzWmk1MFpYaDBZWEpsWVN3Z0oybHVjSFYwSnlrN1hHNGdJQ0FnSUNCMWRHbHNjeTVrYVhOd1lYUmphRUp5YjNkelpYSkZkbVZ1ZENoelpXeG1MblJsZUhSaGNtVmhMQ0FuWTJoaGJtZGxKeWs3WEc0Z0lDQWdmVnh1SUNCOVhHNTlPMXh1WEc1RlpHbDBiM0l1Y0hKdmRHOTBlWEJsTG1kbGRFMWhjbXRrYjNkdUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQnlaWFIxY200Z2RHaHBjeTVuWlhSVGRYSm1ZV05sS0NrdWRHOU5ZWEpyWkc5M2JpZ3BPMXh1ZlR0Y2JseHVMeXBjYmlBZ2RtRnlJR1ZrYVhSdmNpQTlJSHRjYmlBZ0lDQmhaR1JEYjIxdFlXNWtPaUJoWkdSRGIyMXRZVzVrTEZ4dUlDQWdJR0ZrWkVOdmJXMWhibVJDZFhSMGIyNDZJR0ZrWkVOdmJXMWhibVJDZFhSMGIyNHNYRzRnSUNBZ2NuVnVRMjl0YldGdVpEb2djblZ1UTI5dGJXRnVaQ3hjYmlBZ0lDQndZWEp6WlUxaGNtdGtiM2R1T2lCdkxuQmhjbk5sVFdGeWEyUnZkMjRzWEc0Z0lDQWdjR0Z5YzJWSVZFMU1PaUJ2TG5CaGNuTmxTRlJOVEN4Y2JpQWdJQ0JrWlhOMGNtOTVPaUJrWlhOMGNtOTVMRnh1SUNBZ0lIWmhiSFZsT2lCblpYUlBjbE5sZEZaaGJIVmxMRnh1SUNBZ0lIUmxlSFJoY21WaE9pQjBaWGgwWVhKbFlTeGNiaUFnSUNCbFpHbDBZV0pzWlRvZ2J5NTNlWE5wZDNsbklEOGdaV1JwZEdGaWJHVWdPaUJ1ZFd4c0xGeHVJQ0FnSUhObGRFMXZaR1U2SUhCbGNuTnBjM1JOYjJSbExGeHVJQ0FnSUdocGMzUnZjbms2SUh0Y2JpQWdJQ0FnSUhWdVpHODZJR2hwYzNSdmNua3VkVzVrYnl4Y2JpQWdJQ0FnSUhKbFpHODZJR2hwYzNSdmNua3VjbVZrYnl4Y2JpQWdJQ0FnSUdOaGJsVnVaRzg2SUdocGMzUnZjbmt1WTJGdVZXNWtieXhjYmlBZ0lDQWdJR05oYmxKbFpHODZJR2hwYzNSdmNua3VZMkZ1VW1Wa2IxeHVJQ0FnSUgwc1hHNGdJQ0FnYlc5a1pUb2dKMjFoY210a2IzZHVKMXh1SUNCOU8xeHVLaTljYmx4dVpuVnVZM1JwYjI0Z1ptbHlaVXhoZEdWeUlDaDBlWEJsS1NCN1hHNGdJSFpoY2lCelpXeG1JRDBnZEdocGN6dGNiaUFnYzJWMFZHbHRaVzkxZENobWRXNWpkR2x2YmlCbWFYSmxJQ2dwSUh0Y2JpQWdJQ0IxZEdsc2N5NWthWE53WVhSamFFTjFjM1J2YlVWMlpXNTBLSE5sYkdZdWRHVjRkR0Z5WldFc0lIUjVjR1VwTzF4dUlDQjlMQ0F3S1R0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnZEdGbklDaHZjSFJwYjI1ektTQjdYRzRnSUhaaGNpQnZJRDBnYjNCMGFXOXVjeUI4ZkNCN2ZUdGNiaUFnZG1GeUlHVnNJRDBnWkc5akxtTnlaV0YwWlVWc1pXMWxiblFvYnk1MElIeDhJQ2RrYVhZbktUdGNiaUFnWld3dVkyeGhjM05PWVcxbElEMGdieTVqSUh4OElDY25PMXh1SUNCbGJDNTBaWGgwUTI5dWRHVnVkQ0E5SUc4dWVDQjhmQ0FuSnp0Y2JpQWdhV1lnS0c4dWNDa2dleUJ2TG5BdVlYQndaVzVrUTJocGJHUW9aV3dwT3lCOVhHNGdJSEpsZEhWeWJpQmxiRHRjYm4xY2JseHVablZ1WTNScGIyNGdjM1J2Y0NBb1pTa2dlMXh1SUNCcFppQW9aU2tnZXlCbExuQnlaWFpsYm5SRVpXWmhkV3gwS0NrN0lHVXVjM1J2Y0ZCeWIzQmhaMkYwYVc5dUtDazdJSDFjYm4xY2JseHVablZ1WTNScGIyNGdiV0ZqYVdaNUlDaDBaWGgwS1NCN1hHNGdJSEpsZEhWeWJpQjBaWGgwWEc0Z0lDQWdMbkpsY0d4aFkyVW9MMXhjWW1OMGNteGNYR0l2YVN3Z0oxeGNkVEl6TVRnbktWeHVJQ0FnSUM1eVpYQnNZV05sS0M5Y1hHSmhiSFJjWEdJdmFTd2dKMXhjZFRJek1qVW5LVnh1SUNBZ0lDNXlaWEJzWVdObEtDOWNYR0p6YUdsbWRGeGNZaTlwTENBblhGeDFNakZsTnljcE8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUVWa2FYUnZjanRjYmlKZGZRPT0iLCIndXNlIHN0cmljdCc7XG5cbi8vIEV2ZW50IE9iamVjdFxuZnVuY3Rpb24gRXZ0KG5hbWUsIGRldGFpbHMpIHtcbiAgdGhpcy5uYW1lID0gbmFtZTtcbiAgdGhpcy5kZXRhaWxzID0gZGV0YWlscztcbiAgdGhpcy5leGVjdXRpb25TdG9wcGVkID0gZmFsc2U7XG59XG5FdnQucHJvdG90eXBlLnN0b3BQcm9wYWdhdGlvbiA9IEV2dC5wcm90b3R5cGUuc3RvcEV4ZWN1dGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5leGVjdXRpb25TdG9wcGVkID0gdHJ1ZTtcbn07XG5cbi8vIEV4dGVuc2lvbiBGdW5jdGlvbmFsaXR5XG5mdW5jdGlvbiBvbiAoZXZlbnQsIGNhbGxiYWNrKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgaWYoIXRoaXMuX2V2ZW50c1tldmVudF0pIHtcbiAgICB0aGlzLl9ldmVudHNbZXZlbnRdID0gW107XG4gIH1cblxuICB0aGlzLl9ldmVudHNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xufVxuXG5mdW5jdGlvbiBvZmYgKGV2ZW50LCBjYWxsYmFjaykge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIGlmKCF0aGlzLl9ldmVudHNbZXZlbnRdKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbZXZlbnRdO1xuICB9IGVsc2Uge1xuICAgIHZhciBpZHggPSB0aGlzLl9ldmVudHNbZXZlbnRdLmluZGV4T2YoY2FsbGJhY2spO1xuXG4gICAgaWYoaWR4IDwgMCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICB0aGlzLl9ldmVudHNbZXZlbnRdLnNwbGljZShpZHgsIDEpO1xuXG4gICAgaWYoIXRoaXMuX2V2ZW50c1tldmVudF0ubGVuZ3RoKSB7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW2V2ZW50XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICBpZighdGhpcy5fZXZlbnRzW2V2ZW50XSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBldnQgPSBuZXcgRXZ0KGV2ZW50LCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICBhcmdzLnVuc2hpZnQoZXZ0KTtcbiAgZm9yKHZhciBoID0gMDsgaCA8IHRoaXMuX2V2ZW50c1tldmVudF0ubGVuZ3RoOyBoKyspIHtcbiAgICB0aGlzLl9ldmVudHNbZXZlbnRdW2hdLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIGlmKGV2dC5leGVjdXRpb25TdG9wcGVkKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXZ0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXh0ZW5kOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgb2JqLnByb3RvdHlwZS5vbiA9IG9uLmJpbmQob2JqKTtcbiAgICBvYmoucHJvdG90eXBlLm9mZiA9IG9mZi5iaW5kKG9iaik7XG4gICAgb2JqLnByb3RvdHlwZS50cmlnZ2VyID0gdHJpZ2dlci5iaW5kKG9iaik7XG4gIH0sXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBleHRlbmRSZWdFeHAgKHJlZ2V4LCBwcmUsIHBvc3QpIHtcbiAgdmFyIHBhdHRlcm4gPSByZWdleC50b1N0cmluZygpO1xuICB2YXIgZmxhZ3M7XG5cbiAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSgvXFwvKFtnaW1dKikkLywgY2FwdHVyZUZsYWdzKTtcbiAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSgvKF5cXC98XFwvJCkvZywgJycpO1xuICBwYXR0ZXJuID0gcHJlICsgcGF0dGVybiArIHBvc3Q7XG4gIHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4sIGZsYWdzKTtcblxuICBmdW5jdGlvbiBjYXB0dXJlRmxhZ3MgKGFsbCwgZikge1xuICAgIGZsYWdzID0gZjtcbiAgICByZXR1cm4gJyc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRSZWdFeHA7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZpeEVPTCAodGV4dCkge1xuICByZXR1cm4gdGV4dC5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpLnJlcGxhY2UoL1xcci9nLCAnXFxuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZml4RU9MO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSW5wdXRTdGF0ZSA9IHJlcXVpcmUoJy4vSW5wdXRTdGF0ZScpO1xuXG5mdW5jdGlvbiBnZXRDb21tYW5kSGFuZGxlciAoZWRpdG9yLCBoaXN0b3J5LCBmbikge1xuICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlQ29tbWFuZCAoZSkge1xuICAgIHZhciBzdXJmYWNlID0gZWRpdG9yLmdldFN1cmZhY2UoKTtcbiAgICBzdXJmYWNlLmZvY3VzKHRydWUpO1xuICAgIGhpc3Rvcnkuc2V0Q29tbWFuZE1vZGUoKTtcblxuICAgIHZhciBzdGF0ZSA9IG5ldyBJbnB1dFN0YXRlKHN1cmZhY2UsIGVkaXRvci5tb2RlKTtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gICAgdmFyIGFzeW5jSGFuZGxlciA9IHtcbiAgICAgIGFzeW5jOiBhc3luYywgaW1tZWRpYXRlOiB0cnVlXG4gICAgfTtcblxuICAgIGZuLmNhbGwoYXN5bmNIYW5kbGVyLCBlLCBlZGl0b3IubW9kZSwgY2h1bmtzKTtcblxuICAgIGlmIChhc3luY0hhbmRsZXIuaW1tZWRpYXRlKSB7XG4gICAgICBkb25lKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXN5bmMgKCkge1xuICAgICAgYXN5bmNIYW5kbGVyLmltbWVkaWF0ZSA9IGZhbHNlO1xuICAgICAgcmV0dXJuIGRvbmU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZG9uZSAoKSB7XG4gICAgICBzdXJmYWNlLmZvY3VzKCk7XG4gICAgICBzdGF0ZS5zZXRDaHVua3MoY2h1bmtzKTtcbiAgICAgIHN0YXRlLnJlc3RvcmUoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0Q29tbWFuZEhhbmRsZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0cmltQ2h1bmtzID0gcmVxdWlyZSgnLi4vY2h1bmtzL3RyaW0nKTtcblxuZnVuY3Rpb24gSHRtbENodW5rcyAoKSB7XG59XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnRyaW0gPSB0cmltQ2h1bmtzO1xuXG5IdG1sQ2h1bmtzLnByb3RvdHlwZS5maW5kVGFncyA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnNraXAgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0bWxDaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBibG9ja3F1b3RlIChjaHVua3MpIHtcbiAgd3JhcHBpbmcoJ2Jsb2NrcXVvdGUnLCBzdHJpbmdzLnBsYWNlaG9sZGVycy5xdW90ZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBibG9ja3F1b3RlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcblxuZnVuY3Rpb24gYm9sZE9ySXRhbGljIChjaHVua3MsIHR5cGUpIHtcbiAgd3JhcHBpbmcodHlwZSA9PT0gJ2JvbGQnID8gJ3N0cm9uZycgOiAnZW0nLCBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBib2xkT3JJdGFsaWM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBjb2RlYmxvY2sgKGNodW5rcykge1xuICB3cmFwcGluZygncHJlPjxjb2RlJywgc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHJsZWFkaW5nID0gLzxoKFsxLTZdKSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9oKFsxLTZdKT4vO1xuXG5mdW5jdGlvbiBoZWFkaW5nIChjaHVua3MpIHtcbiAgY2h1bmtzLnRyaW0oKTtcblxuICB2YXIgdHJhaWwgPSBydHJhaWxpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpO1xuICB2YXIgbGVhZCA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSk7XG4gIGlmIChsZWFkICYmIHRyYWlsICYmIGxlYWRbMV0gPT09IHRyYWlsWzFdKSB7XG4gICAgc3dhcCgpO1xuICB9IGVsc2Uge1xuICAgIGFkZCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc3dhcCAoKSB7XG4gICAgdmFyIGxldmVsID0gcGFyc2VJbnQobGVhZFsxXSwgMTApO1xuICAgIHZhciBuZXh0ID0gbGV2ZWwgPD0gMSA/IDQgOiBsZXZlbCAtIDE7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJzxoJyArIG5leHQgKyAnPicpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJzwvaCcgKyBuZXh0ICsgJz4nKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZCAoKSB7XG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuaGVhZGluZztcbiAgICB9XG4gICAgY2h1bmtzLmJlZm9yZSArPSAnPGgxPic7XG4gICAgY2h1bmtzLmFmdGVyID0gJzwvaDE+JyArIGNodW5rcy5hZnRlcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhlYWRpbmc7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGhyIChjaHVua3MpIHtcbiAgY2h1bmtzLmJlZm9yZSArPSAnXFxuPGhyPlxcbic7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSAnJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBocjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcbnZhciBvbmNlID0gcmVxdWlyZSgnLi4vb25jZScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcGFyc2VMaW5rSW5wdXQgPSByZXF1aXJlKCcuLi9jaHVua3MvcGFyc2VMaW5rSW5wdXQnKTtcbnZhciBybGVhZGluZyA9IC88YSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9hPi87XG52YXIgcmltYWdlID0gLzxpbWcoIFtePl0qKT9cXC8+JC87XG5cbmZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50IChjaHVua3MsIG9wdGlvbnMpIHtcbiAgdmFyIHR5cGUgPSBvcHRpb25zLnR5cGU7XG4gIHZhciBpbWFnZSA9IHR5cGUgPT09ICdpbWFnZSc7XG4gIHZhciByZXN1bWU7XG5cbiAgaWYgKHR5cGUgIT09ICdhdHRhY2htZW50Jykge1xuICAgIGNodW5rcy50cmltKCk7XG4gIH1cblxuICBpZiAocmVtb3ZhbCgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmVzdW1lID0gdGhpcy5hc3luYygpO1xuXG4gIG9wdGlvbnMucHJvbXB0cy5jbG9zZSgpO1xuICAob3B0aW9ucy5wcm9tcHRzW3R5cGVdIHx8IG9wdGlvbnMucHJvbXB0cy5saW5rKShvcHRpb25zLCBvbmNlKHJlc29sdmVkKSk7XG5cbiAgZnVuY3Rpb24gcmVtb3ZhbCAoKSB7XG4gICAgaWYgKGltYWdlKSB7XG4gICAgICBpZiAocmltYWdlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICcnO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJ0cmFpbGluZy5leGVjKGNodW5rcy5hZnRlcikgJiYgcmxlYWRpbmcuZXhlYyhjaHVua3MuYmVmb3JlKSkge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlZCAocmVzdWx0KSB7XG4gICAgdmFyIHBhcnRzO1xuICAgIHZhciBsaW5rcyA9IHJlc3VsdC5kZWZpbml0aW9ucy5tYXAocGFyc2VMaW5rSW5wdXQpLmZpbHRlcihsb25nKTtcbiAgICBpZiAobGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXN1bWUoKTsgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbGluayA9IGxpbmtzWzBdO1xuXG4gICAgaWYgKHR5cGUgPT09ICdhdHRhY2htZW50Jykge1xuICAgICAgcGFydHMgPSBvcHRpb25zLm1lcmdlSHRtbEFuZEF0dGFjaG1lbnQoY2h1bmtzLmJlZm9yZSArIGNodW5rcy5zZWxlY3Rpb24gKyBjaHVua3MuYWZ0ZXIsIGxpbmspO1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IHBhcnRzLmJlZm9yZTtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBwYXJ0cy5zZWxlY3Rpb247XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBwYXJ0cy5hZnRlcjtcbiAgICAgIHJlc3VtZSgpO1xuICAgICAgdXRpbHMuZGlzcGF0Y2hDdXN0b21FdmVudChvcHRpb25zLnN1cmZhY2UudGV4dGFyZWEsICd3b29mbWFyay1tb2RlLWNoYW5nZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpbWFnZSkge1xuICAgICAgaW1hZ2VXcmFwKGxpbmssIGxpbmtzLnNsaWNlKDEpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlua1dyYXAobGluaywgbGlua3Muc2xpY2UoMSkpO1xuICAgIH1cblxuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgIH1cbiAgICByZXN1bWUoKTtcblxuICAgIGZ1bmN0aW9uIGxvbmcgKGxpbmspIHtcbiAgICAgIHJldHVybiBsaW5rLmhyZWYubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRUaXRsZSAobGluaykge1xuICAgICAgcmV0dXJuIGxpbmsudGl0bGUgPyAnIHRpdGxlPVwiJyArIGxpbmsudGl0bGUgKyAnXCInIDogJyc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW1hZ2VXcmFwIChsaW5rLCByZXN0KSB7XG4gICAgICB2YXIgYWZ0ZXIgPSBjaHVua3MuYWZ0ZXI7XG4gICAgICBjaHVua3MuYmVmb3JlICs9IHRhZ29wZW4obGluayk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSB0YWdjbG9zZShsaW5rKTtcbiAgICAgIGlmIChyZXN0Lmxlbmd0aCkge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgKz0gcmVzdC5tYXAodG9Bbm90aGVySW1hZ2UpLmpvaW4oJycpO1xuICAgICAgfVxuICAgICAgY2h1bmtzLmFmdGVyICs9IGFmdGVyO1xuICAgICAgZnVuY3Rpb24gdGFnb3BlbiAobGluaykgeyByZXR1cm4gJzxpbWcgc3JjPVwiJyArIGxpbmsuaHJlZiArICdcIiBhbHQ9XCInOyB9XG4gICAgICBmdW5jdGlvbiB0YWdjbG9zZSAobGluaykgeyByZXR1cm4gJ1wiJyArIGdldFRpdGxlKGxpbmspICsgJyAvPic7IH1cbiAgICAgIGZ1bmN0aW9uIHRvQW5vdGhlckltYWdlIChsaW5rKSB7IHJldHVybiAnICcgKyB0YWdvcGVuKGxpbmspICsgdGFnY2xvc2UobGluayk7IH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaW5rV3JhcCAobGluaywgcmVzdCkge1xuICAgICAgdmFyIGFmdGVyID0gY2h1bmtzLmFmdGVyO1xuICAgICAgdmFyIG5hbWVzID0gb3B0aW9ucy5jbGFzc2VzLmlucHV0LmxpbmtzO1xuICAgICAgdmFyIGNsYXNzZXMgPSBuYW1lcyA/ICcgY2xhc3M9XCInICsgbmFtZXMgKyAnXCInIDogJyc7XG4gICAgICBjaHVua3MuYmVmb3JlICs9IHRhZ29wZW4obGluayk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSB0YWdjbG9zZSgpO1xuICAgICAgaWYgKHJlc3QubGVuZ3RoKSB7XG4gICAgICAgIGNodW5rcy5hZnRlciArPSByZXN0Lm1hcCh0b0Fub3RoZXJMaW5rKS5qb2luKCcnKTtcbiAgICAgIH1cbiAgICAgIGNodW5rcy5hZnRlciArPSBhZnRlcjtcbiAgICAgIGZ1bmN0aW9uIHRhZ29wZW4gKGxpbmspIHsgcmV0dXJuICc8YSBocmVmPVwiJyArIGxpbmsuaHJlZiArICdcIicgKyBnZXRUaXRsZShsaW5rKSArIGNsYXNzZXMgKyAnIHRhcmdldD1cIl9ibGFua1wiIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIj4nOyB9XG4gICAgICBmdW5jdGlvbiB0YWdjbG9zZSAoKSB7IHJldHVybiAnPC9hPic7IH1cbiAgICAgIGZ1bmN0aW9uIHRvQW5vdGhlckxpbmsgKGxpbmspIHsgcmV0dXJuICcgJyArIHRhZ29wZW4obGluaykgKyB0YWdjbG9zZSgpOyB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHJsZWZ0c2luZ2xlID0gLzwodWx8b2wpKCBbXj5dKik/Plxccyo8bGkoIFtePl0qKT8+JC87XG52YXIgcnJpZ2h0c2luZ2xlID0gL148XFwvbGk+XFxzKjxcXC8odWx8b2wpPi87XG52YXIgcmxlZnRpdGVtID0gLzxsaSggW14+XSopPz4kLztcbnZhciBycmlnaHRpdGVtID0gL148XFwvbGkoIFtePl0qKT8+LztcbnZhciByb3BlbiA9IC9ePCh1bHxvbCkoIFtePl0qKT8+JC87XG5cbmZ1bmN0aW9uIGxpc3QgKGNodW5rcywgb3JkZXJlZCkge1xuICB2YXIgdGFnID0gb3JkZXJlZCA/ICdvbCcgOiAndWwnO1xuICB2YXIgb2xpc3QgPSAnPCcgKyB0YWcgKyAnPic7XG4gIHZhciBjbGlzdCA9ICc8LycgKyB0YWcgKyAnPic7XG5cbiAgY2h1bmtzLnRyaW0oKTtcblxuICBpZiAocmxlZnRzaW5nbGUudGVzdChjaHVua3MuYmVmb3JlKSAmJiBycmlnaHRzaW5nbGUudGVzdChjaHVua3MuYWZ0ZXIpKSB7XG4gICAgaWYgKHRhZyA9PT0gUmVnRXhwLiQxKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWZ0c2luZ2xlLCAnJyk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShycmlnaHRzaW5nbGUsICcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICB2YXIgdWxTdGFydCA9IGNodW5rcy5iZWZvcmUubGFzdEluZGV4T2YoJzx1bCcpO1xuICB2YXIgb2xTdGFydCA9IGNodW5rcy5iZWZvcmUubGFzdEluZGV4T2YoJzxvbCcpO1xuICB2YXIgY2xvc2VUYWcgPSBjaHVua3MuYWZ0ZXIuaW5kZXhPZignPC91bD4nKTtcbiAgaWYgKGNsb3NlVGFnID09PSAtMSkge1xuICAgIGNsb3NlVGFnID0gY2h1bmtzLmFmdGVyLmluZGV4T2YoJzwvb2w+Jyk7XG4gIH1cbiAgaWYgKGNsb3NlVGFnID09PSAtMSkge1xuICAgIGFkZCgpOyByZXR1cm47XG4gIH1cbiAgdmFyIG9wZW5TdGFydCA9IHVsU3RhcnQgPiBvbFN0YXJ0ID8gdWxTdGFydCA6IG9sU3RhcnQ7XG4gIGlmIChvcGVuU3RhcnQgPT09IC0xKSB7XG4gICAgYWRkKCk7IHJldHVybjtcbiAgfVxuICB2YXIgb3BlbkVuZCA9IGNodW5rcy5iZWZvcmUuaW5kZXhPZignPicsIG9wZW5TdGFydCk7XG4gIGlmIChvcGVuRW5kID09PSAtMSkge1xuICAgIGFkZCgpOyByZXR1cm47XG4gIH1cblxuICB2YXIgb3BlblRhZyA9IGNodW5rcy5iZWZvcmUuc3Vic3RyKG9wZW5TdGFydCwgb3BlbkVuZCAtIG9wZW5TdGFydCArIDEpO1xuICBpZiAocm9wZW4udGVzdChvcGVuVGFnKSkge1xuICAgIGlmICh0YWcgIT09IFJlZ0V4cC4kMSkge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUuc3Vic3RyKDAsIG9wZW5TdGFydCkgKyAnPCcgKyB0YWcgKyBjaHVua3MuYmVmb3JlLnN1YnN0cihvcGVuU3RhcnQgKyAzKTtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5zdWJzdHIoMCwgY2xvc2VUYWcpICsgJzwvJyArIHRhZyArIGNodW5rcy5hZnRlci5zdWJzdHIoY2xvc2VUYWcgKyA0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJsZWZ0aXRlbS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJyaWdodGl0ZW0udGVzdChjaHVua3MuYWZ0ZXIpKSB7XG4gICAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlZnRpdGVtLCAnJyk7XG4gICAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJyaWdodGl0ZW0sICcnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkZCh0cnVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhZGQgKGxpc3QpIHtcbiAgICB2YXIgb3BlbiA9IGxpc3QgPyAnJyA6IG9saXN0O1xuICAgIHZhciBjbG9zZSA9IGxpc3QgPyAnJyA6IGNsaXN0O1xuXG4gICAgY2h1bmtzLmJlZm9yZSArPSBvcGVuICsgJzxsaT4nO1xuICAgIGNodW5rcy5hZnRlciA9ICc8L2xpPicgKyBjbG9zZSArIGNodW5rcy5hZnRlcjtcblxuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmxpc3RpdGVtO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3Q7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHdyYXBwaW5nICh0YWcsIHBsYWNlaG9sZGVyLCBjaHVua3MpIHtcbiAgdmFyIG9wZW4gPSAnPCcgKyB0YWc7XG4gIHZhciBjbG9zZSA9ICc8LycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKTtcbiAgdmFyIHJsZWFkaW5nID0gbmV3IFJlZ0V4cChvcGVuICsgJyggW14+XSopPz4kJywgJ2knKTtcbiAgdmFyIHJ0cmFpbGluZyA9IG5ldyBSZWdFeHAoJ14nICsgY2xvc2UgKyAnPicsICdpJyk7XG4gIHZhciByb3BlbiA9IG5ldyBSZWdFeHAob3BlbiArICcoIFtePl0qKT8+JywgJ2lnJyk7XG4gIHZhciByY2xvc2UgPSBuZXcgUmVnRXhwKGNsb3NlICsgJyggW14+XSopPz4nLCAnaWcnKTtcblxuICBjaHVua3MudHJpbSgpO1xuXG4gIHZhciB0cmFpbCA9IHJ0cmFpbGluZy5leGVjKGNodW5rcy5hZnRlcik7XG4gIHZhciBsZWFkID0gcmxlYWRpbmcuZXhlYyhjaHVua3MuYmVmb3JlKTtcbiAgaWYgKGxlYWQgJiYgdHJhaWwpIHtcbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gcGxhY2Vob2xkZXI7XG4gICAgfVxuICAgIHZhciBvcGVuZWQgPSByb3Blbi50ZXN0KGNodW5rcy5zZWxlY3Rpb24pO1xuICAgIGlmIChvcGVuZWQpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm9wZW4sICcnKTtcbiAgICAgIGlmICghc3Vycm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSArPSBvcGVuICsgJz4nO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgY2xvc2VkID0gcmNsb3NlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbik7XG4gICAgaWYgKGNsb3NlZCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShyY2xvc2UsICcnKTtcbiAgICAgIGlmICghc3Vycm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gY2xvc2UgKyAnPicgKyBjaHVua3MuYWZ0ZXI7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChvcGVuZWQgfHwgY2xvc2VkKSB7XG4gICAgICBwdXNob3ZlcigpOyByZXR1cm47XG4gICAgfVxuICAgIGlmIChzdXJyb3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgaWYgKHJsZWFkaW5nLnRlc3QoY2h1bmtzLmJlZm9yZSkpIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSArPSBjbG9zZSArICc+JztcbiAgICAgIH1cbiAgICAgIGlmIChydHJhaWxpbmcudGVzdChjaHVua3MuYWZ0ZXIpKSB7XG4gICAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gb3BlbiArICc+JyArIGNodW5rcy5hZnRlcjtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFjbG9zZWJvdW5kZWQoY2h1bmtzLCB0YWcpKSB7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjbG9zZSArICc+JyArIGNodW5rcy5hZnRlcjtcbiAgICAgIGNodW5rcy5iZWZvcmUgKz0gb3BlbiArICc+JztcbiAgICB9XG4gICAgcHVzaG92ZXIoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hvdmVyICgpIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoLzwoXFwvKT8oW14+IF0rKSggW14+XSopPz4vaWcsIHB1c2hvdmVyT3RoZXJUYWdzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hvdmVyT3RoZXJUYWdzIChhbGwsIGNsb3NpbmcsIHRhZywgYSwgaSkge1xuICAgIHZhciBhdHRycyA9IGEgfHwgJyc7XG4gICAgdmFyIG9wZW4gPSAhY2xvc2luZztcbiAgICB2YXIgcmNsb3NlZCA9IG5ldyBSZWdFeHAoJzxcXC8nICsgdGFnLnJlcGxhY2UoLzwvZywgJzwvJykgKyAnPicsICdpJyk7XG4gICAgdmFyIHJvcGVuZWQgPSBuZXcgUmVnRXhwKCc8JyArIHRhZyArICcoIFtePl0qKT8+JywgJ2knKTtcbiAgICBpZiAob3BlbiAmJiAhcmNsb3NlZC50ZXN0KGNodW5rcy5zZWxlY3Rpb24uc3Vic3RyKGkpKSkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiArPSAnPC8nICsgdGFnICsgJz4nO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL14oPFxcL1tePl0rPikvLCAnJDE8JyArIHRhZyArIGF0dHJzICsgJz4nKTtcbiAgICB9XG5cbiAgICBpZiAoY2xvc2luZyAmJiAhcm9wZW5lZC50ZXN0KGNodW5rcy5zZWxlY3Rpb24uc3Vic3RyKDAsIGkpKSkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICc8JyArIHRhZyArIGF0dHJzICsgJz4nICsgY2h1bmtzLnNlbGVjdGlvbjtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UoLyg8W14+XSsoPzogW14+XSopPz4pJC8sICc8LycgKyB0YWcgKyAnPiQxJyk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNsb3NlYm91bmRlZCAoY2h1bmtzLCB0YWcpIHtcbiAgdmFyIHJjbG9zZWxlZnQgPSBuZXcgUmVnRXhwKCc8LycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKSArICc+JCcsICdpJyk7XG4gIHZhciByb3BlbnJpZ2h0ID0gbmV3IFJlZ0V4cCgnXjwnICsgdGFnICsgJyg/OiBbXj5dKik/PicsICdpJyk7XG4gIHZhciBib3VuZGVkID0gcmNsb3NlbGVmdC50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJvcGVucmlnaHQudGVzdChjaHVua3MuYWZ0ZXIpO1xuICBpZiAoYm91bmRlZCkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmNsb3NlbGVmdCwgJycpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJvcGVucmlnaHQsICcnKTtcbiAgfVxuICByZXR1cm4gYm91bmRlZDtcbn1cblxuZnVuY3Rpb24gc3Vycm91bmRlZCAoY2h1bmtzLCB0YWcpIHtcbiAgdmFyIHJvcGVuID0gbmV3IFJlZ0V4cCgnPCcgKyB0YWcgKyAnKD86IFtePl0qKT8+JywgJ2lnJyk7XG4gIHZhciByY2xvc2UgPSBuZXcgUmVnRXhwKCc8XFwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpICsgJz4nLCAnaWcnKTtcbiAgdmFyIG9wZW5zQmVmb3JlID0gY291bnQoY2h1bmtzLmJlZm9yZSwgcm9wZW4pO1xuICB2YXIgb3BlbnNBZnRlciA9IGNvdW50KGNodW5rcy5hZnRlciwgcm9wZW4pO1xuICB2YXIgY2xvc2VzQmVmb3JlID0gY291bnQoY2h1bmtzLmJlZm9yZSwgcmNsb3NlKTtcbiAgdmFyIGNsb3Nlc0FmdGVyID0gY291bnQoY2h1bmtzLmFmdGVyLCByY2xvc2UpO1xuICB2YXIgb3BlbiA9IG9wZW5zQmVmb3JlIC0gY2xvc2VzQmVmb3JlID4gMDtcbiAgdmFyIGNsb3NlID0gY2xvc2VzQWZ0ZXIgLSBvcGVuc0FmdGVyID4gMDtcbiAgcmV0dXJuIG9wZW4gJiYgY2xvc2U7XG5cbiAgZnVuY3Rpb24gY291bnQgKHRleHQsIHJlZ2V4KSB7XG4gICAgdmFyIG1hdGNoID0gdGV4dC5tYXRjaChyZWdleCk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4gbWF0Y2gubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdyYXBwaW5nO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBpc1Zpc2libGVFbGVtZW50IChlbGVtKSB7XG4gIGlmIChnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZSkge1xuICAgIHJldHVybiBnbG9iYWwuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtLCBudWxsKS5nZXRQcm9wZXJ0eVZhbHVlKCdkaXNwbGF5JykgIT09ICdub25lJztcbiAgfSBlbHNlIGlmIChlbGVtLmN1cnJlbnRTdHlsZSkge1xuICAgIHJldHVybiBlbGVtLmN1cnJlbnRTdHlsZS5kaXNwbGF5ICE9PSAnbm9uZSc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBpc1Zpc2libGVFbGVtZW50O1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTlwYzFacGMybGliR1ZGYkdWdFpXNTBMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1Wm5WdVkzUnBiMjRnYVhOV2FYTnBZbXhsUld4bGJXVnVkQ0FvWld4bGJTa2dlMXh1SUNCcFppQW9aMnh2WW1Gc0xtZGxkRU52YlhCMWRHVmtVM1I1YkdVcElIdGNiaUFnSUNCeVpYUjFjbTRnWjJ4dlltRnNMbWRsZEVOdmJYQjFkR1ZrVTNSNWJHVW9aV3hsYlN3Z2JuVnNiQ2t1WjJWMFVISnZjR1Z5ZEhsV1lXeDFaU2duWkdsemNHeGhlU2NwSUNFOVBTQW5ibTl1WlNjN1hHNGdJSDBnWld4elpTQnBaaUFvWld4bGJTNWpkWEp5Wlc1MFUzUjViR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaV3hsYlM1amRYSnlaVzUwVTNSNWJHVXVaR2x6Y0d4aGVTQWhQVDBnSjI1dmJtVW5PMXh1SUNCOVhHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnYVhOV2FYTnBZbXhsUld4bGJXVnVkRHRjYmlKZGZRPT0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjYWNoZSA9IFtdO1xudmFyIEVkaXRvciA9IHJlcXVpcmUoJy4vZWRpdG9yJyk7XG5cbmZ1bmN0aW9uIE1hbmFnZXIgKCkge1xuICB0aGlzLmNhY2hlID0gW107XG59XG5cbk1hbmFnZXIucHJvdG90eXBlLmZpbmQgPSBmdW5jdGlvbiAodGV4dGFyZWEpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNhY2hlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh0aGlzLmNhY2hlW2ldICYmIHRoaXMuY2FjaGVbaV0udGV4dGFyZWEgPT09IHRleHRhcmVhKSB7XG4gICAgICByZXR1cm4gdGhpcy5jYWNoZVtpXTtcbiAgICB9XG4gIH1cbn07XG5cbk1hbmFnZXIucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB2YXIgZWRpdG9yID0gdGhpcy5maW5kKHRleHRhcmVhKTtcbiAgaWYoZWRpdG9yKSB7XG4gICAgcmV0dXJuIGVkaXRvci5lZGl0b3I7XG4gIH1cblxuICBlZGl0b3IgPSBuZXcgRWRpdG9yKHRleHRhcmVhLCBvcHRpb25zKTtcbiAgY2FjaGUucHVzaCh7XG4gICAgdGV4dGFyZWE6IHRleHRhcmVhLFxuICAgIGVkaXRvcjogZWRpdG9yLFxuICAgIG9wdGlvbnM6IG9wdGlvbnMsXG4gIH0pO1xuXG4gIHJldHVybiBlZGl0b3I7XG59O1xuXG5NYW5hZ2VyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAodGV4dGFyZWEpIHtcbiAgdmFyIGVkaXRvciA9IHRoaXMuZmluZCh0ZXh0YXJlYSk7XG4gIGlmKCFlZGl0b3IpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBlZGl0b3IuZWRpdG9yLmRlc3Ryb3koKTtcbiAgY2FjaGUuc3BsaWNlKGNhY2hlLmluZGV4T2YoZWRpdG9yKSwgMSk7XG4gIHJldHVybiB0cnVlO1xufTtcblxuTWFuYWdlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBjYWNoZWQ7XG4gIHdoaWxlIChjYWNoZWQgPSB0aGlzLmNhY2hlLnBvcCgpKSB7XG4gICAgY2FjaGVkLmVkaXRvci5kZXN0cm95KCk7XG4gIH1cbn07XG5cbk1hbmFnZXIucHJvdG90eXBlLmVhY2ggPSBmdW5jdGlvbiAoZm4pIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0aGlzLmNhY2hlLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBjYWNoZWQgPSB0aGlzLmNhY2hlW2ldO1xuICAgIGZuKGNhY2hlZC5lZGl0b3IsIGNhY2hlZC50ZXh0YXJlYSwgY2FjaGVkLm9wdGlvbnMpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1hbmFnZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG1hbnkgKHRleHQsIHRpbWVzKSB7XG4gIHJldHVybiBuZXcgQXJyYXkodGltZXMgKyAxKS5qb2luKHRleHQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG1hbnk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIGV4dGVuZFJlZ0V4cCA9IHJlcXVpcmUoJy4uL2V4dGVuZFJlZ0V4cCcpO1xudmFyIHRyaW1DaHVua3MgPSByZXF1aXJlKCcuLi9jaHVua3MvdHJpbScpO1xuXG5mdW5jdGlvbiBNYXJrZG93bkNodW5rcyAoKSB7XG59XG5cbk1hcmtkb3duQ2h1bmtzLnByb3RvdHlwZS50cmltID0gdHJpbUNodW5rcztcblxuTWFya2Rvd25DaHVua3MucHJvdG90eXBlLmZpbmRUYWdzID0gZnVuY3Rpb24gKHN0YXJ0UmVnZXgsIGVuZFJlZ2V4KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIHJlZ2V4O1xuXG4gIGlmIChzdGFydFJlZ2V4KSB7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoc3RhcnRSZWdleCwgJycsICckJyk7XG4gICAgdGhpcy5iZWZvcmUgPSB0aGlzLmJlZm9yZS5yZXBsYWNlKHJlZ2V4LCBzdGFydFJlcGxhY2VyKTtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChzdGFydFJlZ2V4LCAnXicsICcnKTtcbiAgICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UocmVnZXgsIHN0YXJ0UmVwbGFjZXIpO1xuICB9XG5cbiAgaWYgKGVuZFJlZ2V4KSB7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoZW5kUmVnZXgsICcnLCAnJCcpO1xuICAgIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZShyZWdleCwgZW5kUmVwbGFjZXIpO1xuICAgIHJlZ2V4ID0gZXh0ZW5kUmVnRXhwKGVuZFJlZ2V4LCAnXicsICcnKTtcbiAgICB0aGlzLmFmdGVyID0gdGhpcy5hZnRlci5yZXBsYWNlKHJlZ2V4LCBlbmRSZXBsYWNlcik7XG4gIH1cblxuICBmdW5jdGlvbiBzdGFydFJlcGxhY2VyIChtYXRjaCkge1xuICAgIHNlbGYuc3RhcnRUYWcgPSBzZWxmLnN0YXJ0VGFnICsgbWF0Y2g7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGVuZFJlcGxhY2VyIChtYXRjaCkge1xuICAgIHNlbGYuZW5kVGFnID0gbWF0Y2ggKyBzZWxmLmVuZFRhZzsgcmV0dXJuICcnO1xuICB9XG59O1xuXG5NYXJrZG93bkNodW5rcy5wcm90b3R5cGUuc2tpcCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgdmFyIGJlZm9yZUNvdW50ID0gJ2JlZm9yZScgaW4gbyA/IG8uYmVmb3JlIDogMTtcbiAgdmFyIGFmdGVyQ291bnQgPSAnYWZ0ZXInIGluIG8gPyBvLmFmdGVyIDogMTtcblxuICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UoLyheXFxuKikvLCAnJyk7XG4gIHRoaXMuc3RhcnRUYWcgPSB0aGlzLnN0YXJ0VGFnICsgUmVnRXhwLiQxO1xuICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UoLyhcXG4qJCkvLCAnJyk7XG4gIHRoaXMuZW5kVGFnID0gdGhpcy5lbmRUYWcgKyBSZWdFeHAuJDE7XG4gIHRoaXMuc3RhcnRUYWcgPSB0aGlzLnN0YXJ0VGFnLnJlcGxhY2UoLyheXFxuKikvLCAnJyk7XG4gIHRoaXMuYmVmb3JlID0gdGhpcy5iZWZvcmUgKyBSZWdFeHAuJDE7XG4gIHRoaXMuZW5kVGFnID0gdGhpcy5lbmRUYWcucmVwbGFjZSgvKFxcbiokKS8sICcnKTtcbiAgdGhpcy5hZnRlciA9IHRoaXMuYWZ0ZXIgKyBSZWdFeHAuJDE7XG5cbiAgaWYgKHRoaXMuYmVmb3JlKSB7XG4gICAgdGhpcy5iZWZvcmUgPSByZXBsYWNlKHRoaXMuYmVmb3JlLCArK2JlZm9yZUNvdW50LCAnJCcpO1xuICB9XG5cbiAgaWYgKHRoaXMuYWZ0ZXIpIHtcbiAgICB0aGlzLmFmdGVyID0gcmVwbGFjZSh0aGlzLmFmdGVyLCArK2FmdGVyQ291bnQsICcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2UgKHRleHQsIGNvdW50LCBzdWZmaXgpIHtcbiAgICB2YXIgcmVnZXggPSBvLmFueSA/ICdcXFxcbionIDogbWFueSgnXFxcXG4/JywgY291bnQpO1xuICAgIHZhciByZXBsYWNlbWVudCA9IG1hbnkoJ1xcbicsIGNvdW50KTtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKG5ldyBSZWdFeHAocmVnZXggKyBzdWZmaXgpLCByZXBsYWNlbWVudCk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWFya2Rvd25DaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xudmFyIHNldHRpbmdzID0gcmVxdWlyZSgnLi9zZXR0aW5ncycpO1xudmFyIHJ0cmFpbGJsYW5rbGluZSA9IC8oPlsgXFx0XSopJC87XG52YXIgcmxlYWRibGFua2xpbmUgPSAvXig+WyBcXHRdKikvO1xudmFyIHJuZXdsaW5lZmVuY2luZyA9IC9eKFxcbiopKFteXFxyXSs/KShcXG4qKSQvO1xudmFyIHJlbmR0YWcgPSAvXigoKFxcbnxeKShcXG5bIFxcdF0qKSo+KC4rXFxuKSouKikrKFxcblsgXFx0XSopKikvO1xudmFyIHJsZWFkYnJhY2tldCA9IC9eXFxuKCg+fFxccykqKVxcbi87XG52YXIgcnRyYWlsYnJhY2tldCA9IC9cXG4oKD58XFxzKSopXFxuJC87XG5cbmZ1bmN0aW9uIGJsb2NrcXVvdGUgKGNodW5rcykge1xuICB2YXIgbWF0Y2ggPSAnJztcbiAgdmFyIGxlZnRPdmVyID0gJyc7XG4gIHZhciBsaW5lO1xuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm5ld2xpbmVmZW5jaW5nLCBuZXdsaW5lcmVwbGFjZXIpO1xuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJ0cmFpbGJsYW5rbGluZSwgdHJhaWxibGFua2xpbmVyZXBsYWNlcik7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL14oXFxzfD4pKyQvLCAnJyk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uIHx8IHN0cmluZ3MucGxhY2Vob2xkZXJzLnF1b3RlO1xuXG4gIGlmIChjaHVua3MuYmVmb3JlKSB7XG4gICAgYmVmb3JlUHJvY2Vzc2luZygpO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gbWF0Y2g7XG4gIGNodW5rcy5iZWZvcmUgPSBsZWZ0T3ZlcjtcblxuICBpZiAoY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL15cXG4/LywgJ1xcbicpO1xuICB9XG5cbiAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmVuZHRhZywgZW5kdGFncmVwbGFjZXIpO1xuXG4gIGlmICgvXig/IVsgXXswLDN9PikvbS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgd3JhcHBpbmcud3JhcChjaHVua3MsIHNldHRpbmdzLmxpbmVMZW5ndGggLSAyKTtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eL2dtLCAnPiAnKTtcbiAgICByZXBsYWNlQmxhbmtzSW5UYWdzKHRydWUpO1xuICAgIGNodW5rcy5za2lwKCk7XG4gIH0gZWxzZSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXlsgXXswLDN9PiA/L2dtLCAnJyk7XG4gICAgd3JhcHBpbmcudW53cmFwKGNodW5rcyk7XG4gICAgcmVwbGFjZUJsYW5rc0luVGFncyhmYWxzZSk7XG5cbiAgICBpZiAoIS9eKFxcbnxeKVsgXXswLDN9Pi8udGVzdChjaHVua3Muc2VsZWN0aW9uKSAmJiBjaHVua3Muc3RhcnRUYWcpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5zdGFydFRhZy5yZXBsYWNlKC9cXG57MCwyfSQvLCAnXFxuXFxuJyk7XG4gICAgfVxuXG4gICAgaWYgKCEvKFxcbnxeKVsgXXswLDN9Pi4qJC8udGVzdChjaHVua3Muc2VsZWN0aW9uKSAmJiBjaHVua3MuZW5kVGFnKSB7XG4gICAgICBjaHVua3MuZW5kVGFnID0gY2h1bmtzLmVuZFRhZy5yZXBsYWNlKC9eXFxuezAsMn0vLCAnXFxuXFxuJyk7XG4gICAgfVxuICB9XG5cbiAgaWYgKCEvXFxuLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybGVhZGJsYW5rbGluZSwgbGVhZGJsYW5rbGluZXJlcGxhY2VyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5ld2xpbmVyZXBsYWNlciAoYWxsLCBiZWZvcmUsIHRleHQsIGFmdGVyKSB7XG4gICAgY2h1bmtzLmJlZm9yZSArPSBiZWZvcmU7XG4gICAgY2h1bmtzLmFmdGVyID0gYWZ0ZXIgKyBjaHVua3MuYWZ0ZXI7XG4gICAgcmV0dXJuIHRleHQ7XG4gIH1cblxuICBmdW5jdGlvbiB0cmFpbGJsYW5rbGluZXJlcGxhY2VyIChhbGwsIGJsYW5rKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGJsYW5rICsgY2h1bmtzLnNlbGVjdGlvbjsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gbGVhZGJsYW5rbGluZXJlcGxhY2VyIChhbGwsIGJsYW5rcykge1xuICAgIGNodW5rcy5zdGFydFRhZyArPSBibGFua3M7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIGJlZm9yZVByb2Nlc3NpbmcgKCkge1xuICAgIHZhciBsaW5lcyA9IGNodW5rcy5iZWZvcmUucmVwbGFjZSgvXFxuJC8sICcnKS5zcGxpdCgnXFxuJyk7XG4gICAgdmFyIGNoYWluZWQgPSBmYWxzZTtcbiAgICB2YXIgZ29vZDtcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGdvb2QgPSBmYWxzZTtcbiAgICAgIGxpbmUgPSBsaW5lc1tpXTtcbiAgICAgIGNoYWluZWQgPSBjaGFpbmVkICYmIGxpbmUubGVuZ3RoID4gMDtcbiAgICAgIGlmICgvXj4vLnRlc3QobGluZSkpIHtcbiAgICAgICAgZ29vZCA9IHRydWU7XG4gICAgICAgIGlmICghY2hhaW5lZCAmJiBsaW5lLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICBjaGFpbmVkID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmICgvXlsgXFx0XSokLy50ZXN0KGxpbmUpKSB7XG4gICAgICAgIGdvb2QgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZ29vZCA9IGNoYWluZWQ7XG4gICAgICB9XG4gICAgICBpZiAoZ29vZCkge1xuICAgICAgICBtYXRjaCArPSBsaW5lICsgJ1xcbic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZWZ0T3ZlciArPSBtYXRjaCArIGxpbmU7XG4gICAgICAgIG1hdGNoID0gJ1xcbic7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCEvKF58XFxuKT4vLnRlc3QobWF0Y2gpKSB7XG4gICAgICBsZWZ0T3ZlciArPSBtYXRjaDtcbiAgICAgIG1hdGNoID0gJyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW5kdGFncmVwbGFjZXIgKGFsbCkge1xuICAgIGNodW5rcy5lbmRUYWcgPSBhbGw7IHJldHVybiAnJztcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2VCbGFua3NJblRhZ3MgKGJyYWNrZXQpIHtcbiAgICB2YXIgcmVwbGFjZW1lbnQgPSBicmFja2V0ID8gJz4gJyA6ICcnO1xuXG4gICAgaWYgKGNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UocnRyYWlsYnJhY2tldCwgcmVwbGFjZXIpO1xuICAgIH1cbiAgICBpZiAoY2h1bmtzLmVuZFRhZykge1xuICAgICAgY2h1bmtzLmVuZFRhZyA9IGNodW5rcy5lbmRUYWcucmVwbGFjZShybGVhZGJyYWNrZXQsIHJlcGxhY2VyKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiByZXBsYWNlciAoYWxsLCBtYXJrZG93bikge1xuICAgICAgcmV0dXJuICdcXG4nICsgbWFya2Rvd24ucmVwbGFjZSgvXlsgXXswLDN9Pj9bIFxcdF0qJC9nbSwgcmVwbGFjZW1lbnQpICsgJ1xcbic7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmxvY2txdW90ZTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJsZWFkaW5nID0gL14oXFwqKikvO1xudmFyIHJ0cmFpbGluZyA9IC8oXFwqKiQpLztcbnZhciBydHJhaWxpbmdzcGFjZSA9IC8oXFxzPykkLztcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xuXG5mdW5jdGlvbiBib2xkT3JJdGFsaWMgKGNodW5rcywgdHlwZSkge1xuICB2YXIgcm5ld2xpbmVzID0gL1xcbnsyLH0vZztcbiAgdmFyIHN0YXJDb3VudCA9IHR5cGUgPT09ICdib2xkJyA/IDIgOiAxO1xuXG4gIGNodW5rcy50cmltKCk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2Uocm5ld2xpbmVzLCAnXFxuJyk7XG5cbiAgdmFyIG1hcmt1cDtcbiAgdmFyIGxlYWRTdGFycyA9IHJ0cmFpbGluZy5leGVjKGNodW5rcy5iZWZvcmUpWzBdO1xuICB2YXIgdHJhaWxTdGFycyA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKVswXTtcbiAgdmFyIHN0YXJzID0gJ1xcXFwqeycgKyBzdGFyQ291bnQgKyAnfSc7XG4gIHZhciBmZW5jZSA9IE1hdGgubWluKGxlYWRTdGFycy5sZW5ndGgsIHRyYWlsU3RhcnMubGVuZ3RoKTtcbiAgaWYgKGZlbmNlID49IHN0YXJDb3VudCAmJiAoZmVuY2UgIT09IDIgfHwgc3RhckNvdW50ICE9PSAxKSkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UobmV3IFJlZ0V4cChzdGFycyArICckJywgJycpLCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UobmV3IFJlZ0V4cCgnXicgKyBzdGFycywgJycpLCAnJyk7XG4gIH0gZWxzZSBpZiAoIWNodW5rcy5zZWxlY3Rpb24gJiYgdHJhaWxTdGFycykge1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShydHJhaWxpbmdzcGFjZSwgJycpICsgdHJhaWxTdGFycyArIFJlZ0V4cC4kMTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24gJiYgIXRyYWlsU3RhcnMpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICB9XG5cbiAgICBtYXJrdXAgPSBzdGFyQ291bnQgPT09IDEgPyAnKicgOiAnKionO1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlICsgbWFya3VwO1xuICAgIGNodW5rcy5hZnRlciA9IG1hcmt1cCArIGNodW5rcy5hZnRlcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJvbGRPckl0YWxpYztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcnRleHRiZWZvcmUgPSAvXFxTWyBdKiQvO1xudmFyIHJ0ZXh0YWZ0ZXIgPSAvXlsgXSpcXFMvO1xudmFyIHJuZXdsaW5lID0gL1xcbi87XG52YXIgcmJhY2t0aWNrID0gL2AvO1xudmFyIHJmZW5jZWJlZm9yZSA9IC9gYGBbYS16XSpcXG4/JC87XG52YXIgcmZlbmNlYmVmb3JlaW5zaWRlID0gL15gYGBbYS16XSpcXG4vO1xudmFyIHJmZW5jZWFmdGVyID0gL15cXG4/YGBgLztcbnZhciByZmVuY2VhZnRlcmluc2lkZSA9IC9cXG5gYGAkLztcblxuZnVuY3Rpb24gY29kZWJsb2NrIChjaHVua3MsIG9wdGlvbnMpIHtcbiAgdmFyIG5ld2xpbmVkID0gcm5ld2xpbmUudGVzdChjaHVua3Muc2VsZWN0aW9uKTtcbiAgdmFyIHRyYWlsaW5nID0gcnRleHRhZnRlci50ZXN0KGNodW5rcy5hZnRlcik7XG4gIHZhciBsZWFkaW5nID0gcnRleHRiZWZvcmUudGVzdChjaHVua3MuYmVmb3JlKTtcbiAgdmFyIG91dGZlbmNlZCA9IHJmZW5jZWJlZm9yZS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJmZW5jZWFmdGVyLnRlc3QoY2h1bmtzLmFmdGVyKTtcbiAgaWYgKG91dGZlbmNlZCB8fCBuZXdsaW5lZCB8fCAhKGxlYWRpbmcgfHwgdHJhaWxpbmcpKSB7XG4gICAgYmxvY2sob3V0ZmVuY2VkKTtcbiAgfSBlbHNlIHtcbiAgICBpbmxpbmUoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGlubGluZSAoKSB7XG4gICAgY2h1bmtzLnRyaW0oKTtcbiAgICBjaHVua3MuZmluZFRhZ3MocmJhY2t0aWNrLCByYmFja3RpY2spO1xuXG4gICAgaWYgKCFjaHVua3Muc3RhcnRUYWcgJiYgIWNodW5rcy5lbmRUYWcpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnYCc7XG4gICAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmNvZGU7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChjaHVua3MuZW5kVGFnICYmICFjaHVua3Muc3RhcnRUYWcpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLmVuZFRhZztcbiAgICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJsb2NrIChvdXRmZW5jZWQpIHtcbiAgICBpZiAob3V0ZmVuY2VkKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJmZW5jZWJlZm9yZSwgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmZlbmNlYWZ0ZXIsICcnKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKC9bIF17NH18YGBgW2Etel0qXFxuJC8sIG1lcmdlU2VsZWN0aW9uKTtcbiAgICBjaHVua3Muc2tpcCh7XG4gICAgICBiZWZvcmU6IC8oXFxufF4pKFxcdHxbIF17NCx9fGBgYFthLXpdKlxcbikuKlxcbiQvLnRlc3QoY2h1bmtzLmJlZm9yZSkgPyAwIDogMSxcbiAgICAgIGFmdGVyOiAvXlxcbihcXHR8WyBdezQsfXxcXG5gYGApLy50ZXN0KGNodW5rcy5hZnRlcikgPyAwIDogMVxuICAgIH0pO1xuXG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBpZiAob3B0aW9ucy5mZW5jaW5nKSB7XG4gICAgICAgIGNodW5rcy5zdGFydFRhZyA9ICdgYGBcXG4nO1xuICAgICAgICBjaHVua3MuZW5kVGFnID0gJ1xcbmBgYCc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3Muc3RhcnRUYWcgPSAnICAgICc7XG4gICAgICB9XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHJmZW5jZWJlZm9yZWluc2lkZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIHJmZW5jZWFmdGVyaW5zaWRlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvKF5gYGBbYS16XSpcXG4pfChgYGAkKS9nLCAnJyk7XG4gICAgICB9IGVsc2UgaWYgKC9eWyBdezAsM31cXFMvbS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmZlbmNpbmcpIHtcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9ICdgYGBcXG4nO1xuICAgICAgICAgIGNodW5rcy5hZnRlciA9ICdcXG5gYGAnICsgY2h1bmtzLmFmdGVyO1xuICAgICAgICB9IGVsc2UgaWYgKG5ld2xpbmVkKSB7XG4gICAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXi9nbSwgJyAgICAnKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9ICcgICAgJztcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXig/OlsgXXs0fXxbIF17MCwzfVxcdHxgYGBbYS16XSopL2dtLCAnJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gbWVyZ2VTZWxlY3Rpb24gKGFsbCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGFsbCArIGNodW5rcy5zZWxlY3Rpb247IHJldHVybiAnJztcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGhlYWRpbmcgKGNodW5rcykge1xuICB2YXIgbGV2ZWwgPSAwO1xuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uXG4gICAgLnJlcGxhY2UoL1xccysvZywgJyAnKVxuICAgIC5yZXBsYWNlKC8oXlxccyt8XFxzKyQpL2csICcnKTtcblxuICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSAnIyAnO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5oZWFkaW5nO1xuICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICBjaHVua3Muc2tpcCh7IGJlZm9yZTogMSwgYWZ0ZXI6IDEgfSk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY2h1bmtzLmZpbmRUYWdzKC8jK1sgXSovLCAvWyBdKiMrLyk7XG5cbiAgaWYgKC8jKy8udGVzdChjaHVua3Muc3RhcnRUYWcpKSB7XG4gICAgbGV2ZWwgPSBSZWdFeHAubGFzdE1hdGNoLmxlbmd0aDtcbiAgfVxuXG4gIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnJztcbiAgY2h1bmtzLmZpbmRUYWdzKG51bGwsIC9cXHM/KC0rfD0rKS8pO1xuXG4gIGlmICgvPSsvLnRlc3QoY2h1bmtzLmVuZFRhZykpIHtcbiAgICBsZXZlbCA9IDE7XG4gIH1cblxuICBpZiAoLy0rLy50ZXN0KGNodW5rcy5lbmRUYWcpKSB7XG4gICAgbGV2ZWwgPSAyO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICBjaHVua3Muc2tpcCh7IGJlZm9yZTogMSwgYWZ0ZXI6IDEgfSk7XG5cbiAgdmFyIGxldmVsVG9DcmVhdGUgPSBsZXZlbCA8IDIgPyA0IDogbGV2ZWwgLSAxO1xuICBpZiAobGV2ZWxUb0NyZWF0ZSA+IDApIHtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSBtYW55KCcjJywgbGV2ZWxUb0NyZWF0ZSkgKyAnICc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBoZWFkaW5nO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBociAoY2h1bmtzKSB7XG4gIGNodW5rcy5zdGFydFRhZyA9ICctLS0tLS0tLS0tXFxuJztcbiAgY2h1bmtzLnNlbGVjdGlvbiA9ICcnO1xuICBjaHVua3Muc2tpcCh7IGxlZnQ6IDIsIHJpZ2h0OiAxLCBhbnk6IHRydWUgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaHI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBvbmNlID0gcmVxdWlyZSgnLi4vb25jZScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcGFyc2VMaW5rSW5wdXQgPSByZXF1aXJlKCcuLi9jaHVua3MvcGFyc2VMaW5rSW5wdXQnKTtcbnZhciByZGVmaW5pdGlvbnMgPSAvXlsgXXswLDN9XFxbKCg/OmF0dGFjaG1lbnQtKT9cXGQrKVxcXTpbIFxcdF0qXFxuP1sgXFx0XSo8PyhcXFMrPyk+P1sgXFx0XSpcXG4/WyBcXHRdKig/OihcXG4qKVtcIihdKC4rPylbXCIpXVsgXFx0XSopPyg/Olxcbit8JCkvZ207XG52YXIgcmF0dGFjaG1lbnQgPSAvXmF0dGFjaG1lbnQtKFxcZCspJC9pO1xuXG5mdW5jdGlvbiBleHRyYWN0RGVmaW5pdGlvbnMgKHRleHQsIGRlZmluaXRpb25zKSB7XG4gIHJkZWZpbml0aW9ucy5sYXN0SW5kZXggPSAwO1xuICByZXR1cm4gdGV4dC5yZXBsYWNlKHJkZWZpbml0aW9ucywgcmVwbGFjZXIpO1xuXG4gIGZ1bmN0aW9uIHJlcGxhY2VyIChhbGwsIGlkLCBsaW5rLCBuZXdsaW5lcywgdGl0bGUpIHtcbiAgICBkZWZpbml0aW9uc1tpZF0gPSBhbGwucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG4gICAgaWYgKG5ld2xpbmVzKSB7XG4gICAgICBkZWZpbml0aW9uc1tpZF0gPSBhbGwucmVwbGFjZSgvW1wiKF0oLis/KVtcIildJC8sICcnKTtcbiAgICAgIHJldHVybiBuZXdsaW5lcyArIHRpdGxlO1xuICAgIH1cbiAgICByZXR1cm4gJyc7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHVzaERlZmluaXRpb24gKG9wdGlvbnMpIHtcbiAgdmFyIGNodW5rcyA9IG9wdGlvbnMuY2h1bmtzO1xuICB2YXIgZGVmaW5pdGlvbiA9IG9wdGlvbnMuZGVmaW5pdGlvbjtcbiAgdmFyIGF0dGFjaG1lbnQgPSBvcHRpb25zLmF0dGFjaG1lbnQ7XG4gIHZhciByZWdleCA9IC8oXFxbKSgoPzpcXFtbXlxcXV0qXFxdfFteXFxbXFxdXSkqKShcXF1bIF0/KD86XFxuWyBdKik/XFxbKSgoPzphdHRhY2htZW50LSk/XFxkKykoXFxdKS9nO1xuICB2YXIgYW5jaG9yID0gMDtcbiAgdmFyIGRlZmluaXRpb25zID0ge307XG4gIHZhciBmb290bm90ZXMgPSBbXTtcblxuICBjaHVua3MuYmVmb3JlID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5iZWZvcmUsIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGV4dHJhY3REZWZpbml0aW9ucyhjaHVua3Muc2VsZWN0aW9uLCBkZWZpbml0aW9ucyk7XG4gIGNodW5rcy5hZnRlciA9IGV4dHJhY3REZWZpbml0aW9ucyhjaHVua3MuYWZ0ZXIsIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG5cbiAgaWYgKGRlZmluaXRpb24pIHtcbiAgICBpZiAoIWF0dGFjaG1lbnQpIHsgcHVzaEFuY2hvcihkZWZpbml0aW9uKTsgfVxuICB9IGVsc2Uge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UocmVnZXgsIGdldExpbmspO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IGFuY2hvcjtcblxuICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG5cbiAgaWYgKGNodW5rcy5hZnRlcikge1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKC9cXG4qJC8sICcnKTtcbiAgfVxuICBpZiAoIWNodW5rcy5hZnRlcikge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcbiokLywgJycpO1xuICB9XG5cbiAgYW5jaG9yID0gMDtcbiAgT2JqZWN0LmtleXMoZGVmaW5pdGlvbnMpLmZvckVhY2gocHVzaEF0dGFjaG1lbnRzKTtcblxuICBpZiAoYXR0YWNobWVudCkge1xuICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbik7XG4gIH1cbiAgY2h1bmtzLmFmdGVyICs9ICdcXG5cXG4nICsgZm9vdG5vdGVzLmpvaW4oJ1xcbicpO1xuXG4gIHJldHVybiByZXN1bHQ7XG5cbiAgZnVuY3Rpb24gcHVzaEF0dGFjaG1lbnRzIChkZWZpbml0aW9uKSB7XG4gICAgaWYgKHJhdHRhY2htZW50LnRlc3QoZGVmaW5pdGlvbikpIHtcbiAgICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hBbmNob3IgKGRlZmluaXRpb24pIHtcbiAgICBhbmNob3IrKztcbiAgICBkZWZpbml0aW9uID0gZGVmaW5pdGlvbi5yZXBsYWNlKC9eWyBdezAsM31cXFsoYXR0YWNobWVudC0pPyhcXGQrKVxcXTovLCAnICBbJDEnICsgYW5jaG9yICsgJ106Jyk7XG4gICAgZm9vdG5vdGVzLnB1c2goZGVmaW5pdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMaW5rIChhbGwsIGJlZm9yZSwgaW5uZXIsIGFmdGVySW5uZXIsIGRlZmluaXRpb24sIGVuZCkge1xuICAgIGlubmVyID0gaW5uZXIucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG4gICAgaWYgKGRlZmluaXRpb25zW2RlZmluaXRpb25dKSB7XG4gICAgICBwdXNoQW5jaG9yKGRlZmluaXRpb25zW2RlZmluaXRpb25dKTtcbiAgICAgIHJldHVybiBiZWZvcmUgKyBpbm5lciArIGFmdGVySW5uZXIgKyBhbmNob3IgKyBlbmQ7XG4gICAgfVxuICAgIHJldHVybiBhbGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQgKGNodW5rcywgb3B0aW9ucykge1xuICB2YXIgdHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgdmFyIGltYWdlID0gdHlwZSA9PT0gJ2ltYWdlJztcbiAgdmFyIHJlc3VtZTtcblxuICBjaHVua3MudHJpbSgpO1xuICBjaHVua3MuZmluZFRhZ3MoL1xccyohP1xcWy8sIC9cXF1bIF0/KD86XFxuWyBdKik/KFxcWy4qP1xcXSk/Lyk7XG5cbiAgaWYgKGNodW5rcy5lbmRUYWcubGVuZ3RoID4gMSAmJiBjaHVua3Muc3RhcnRUYWcubGVuZ3RoID4gMCkge1xuICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5zdGFydFRhZy5yZXBsYWNlKC8hP1xcWy8sICcnKTtcbiAgICBjaHVua3MuZW5kVGFnID0gJyc7XG4gICAgcHVzaERlZmluaXRpb24oeyBjaHVua3M6IGNodW5rcyB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnN0YXJ0VGFnICsgY2h1bmtzLnNlbGVjdGlvbiArIGNodW5rcy5lbmRUYWc7XG4gIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnJztcblxuICBpZiAoL1xcblxcbi8udGVzdChjaHVua3Muc2VsZWN0aW9uKSkge1xuICAgIHB1c2hEZWZpbml0aW9uKHsgY2h1bmtzOiBjaHVua3MgfSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJlc3VtZSA9IHRoaXMuYXN5bmMoKTtcblxuICBvcHRpb25zLnByb21wdHMuY2xvc2UoKTtcbiAgKG9wdGlvbnMucHJvbXB0c1t0eXBlXSB8fCBvcHRpb25zLnByb21wdHMubGluaykob3B0aW9ucywgb25jZShyZXNvbHZlZCkpO1xuXG4gIGZ1bmN0aW9uIHJlc29sdmVkIChyZXN1bHQpIHtcbiAgICB2YXIgbGlua3MgPSByZXN1bHRcbiAgICAgIC5kZWZpbml0aW9uc1xuICAgICAgLm1hcChwYXJzZUxpbmtJbnB1dClcbiAgICAgIC5maWx0ZXIobG9uZyk7XG5cbiAgICBsaW5rcy5mb3JFYWNoKHJlbmRlckxpbmspO1xuICAgIHJlc3VtZSgpO1xuXG4gICAgZnVuY3Rpb24gcmVuZGVyTGluayAobGluaywgaSkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICgnICcgKyBjaHVua3Muc2VsZWN0aW9uKS5yZXBsYWNlKC8oW15cXFxcXSg/OlxcXFxcXFxcKSopKD89W1tcXF1dKS9nLCAnJDFcXFxcJykuc3Vic3RyKDEpO1xuXG4gICAgICB2YXIga2V5ID0gcmVzdWx0LmF0dGFjaG1lbnQgPyAnICBbYXR0YWNobWVudC05OTk5XTogJyA6ICcgWzk5OTldOiAnO1xuICAgICAgdmFyIGRlZmluaXRpb24gPSBrZXkgKyBsaW5rLmhyZWYgKyAobGluay50aXRsZSA/ICcgXCInICsgbGluay50aXRsZSArICdcIicgOiAnJyk7XG4gICAgICB2YXIgYW5jaG9yID0gcHVzaERlZmluaXRpb24oe1xuICAgICAgICBjaHVua3M6IGNodW5rcyxcbiAgICAgICAgZGVmaW5pdGlvbjogZGVmaW5pdGlvbixcbiAgICAgICAgYXR0YWNobWVudDogcmVzdWx0LmF0dGFjaG1lbnRcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXJlc3VsdC5hdHRhY2htZW50KSB7XG4gICAgICAgIGFkZCgpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBhZGQgKCkge1xuICAgICAgICBjaHVua3Muc3RhcnRUYWcgPSBpbWFnZSA/ICchWycgOiAnWyc7XG4gICAgICAgIGNodW5rcy5lbmRUYWcgPSAnXVsnICsgYW5jaG9yICsgJ10nO1xuXG4gICAgICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpIDwgbGlua3MubGVuZ3RoIC0gMSkgeyAvLyBoYXMgbXVsdGlwbGUgbGlua3MsIG5vdCB0aGUgbGFzdCBvbmVcbiAgICAgICAgICBjaHVua3MuYmVmb3JlICs9IGNodW5rcy5zdGFydFRhZyArIGNodW5rcy5zZWxlY3Rpb24gKyBjaHVua3MuZW5kVGFnICsgJ1xcbic7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsb25nIChsaW5rKSB7XG4gICAgICByZXR1cm4gbGluay5ocmVmLmxlbmd0aCA+IDA7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBtYW55ID0gcmVxdWlyZSgnLi4vbWFueScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgd3JhcHBpbmcgPSByZXF1aXJlKCcuL3dyYXBwaW5nJyk7XG52YXIgc2V0dGluZ3MgPSByZXF1aXJlKCcuL3NldHRpbmdzJyk7XG52YXIgcnByZXZpb3VzID0gLyhcXG58XikoKFsgXXswLDN9KFsqKy1dfFxcZCtbLl0pWyBcXHRdKy4qKShcXG4uK3xcXG57Mix9KFsqKy1dLip8XFxkK1suXSlbIFxcdF0rLip8XFxuezIsfVsgXFx0XStcXFMuKikqKVxcbiokLztcbnZhciBybmV4dCA9IC9eXFxuKigoWyBdezAsM30oWyorLV18XFxkK1suXSlbIFxcdF0rLiopKFxcbi4rfFxcbnsyLH0oWyorLV0uKnxcXGQrWy5dKVsgXFx0XSsuKnxcXG57Mix9WyBcXHRdK1xcUy4qKSopXFxuKi87XG52YXIgcmJ1bGxldHR5cGUgPSAvXlxccyooWyorLV0pLztcbnZhciByc2tpcHBlciA9IC9bXlxcbl1cXG5cXG5bXlxcbl0vO1xuXG5mdW5jdGlvbiBwYWQgKHRleHQpIHtcbiAgcmV0dXJuICcgJyArIHRleHQgKyAnICc7XG59XG5cbmZ1bmN0aW9uIGxpc3QgKGNodW5rcywgb3JkZXJlZCkge1xuICB2YXIgYnVsbGV0ID0gJy0nO1xuICB2YXIgbnVtID0gMTtcbiAgdmFyIGRpZ2l0YWw7XG4gIHZhciBiZWZvcmVTa2lwID0gMTtcbiAgdmFyIGFmdGVyU2tpcCA9IDE7XG5cbiAgY2h1bmtzLmZpbmRUYWdzKC8oXFxufF4pKlsgXXswLDN9KFsqKy1dfFxcZCtbLl0pXFxzKy8sIG51bGwpO1xuXG4gIGlmIChjaHVua3MuYmVmb3JlICYmICEvXFxuJC8udGVzdChjaHVua3MuYmVmb3JlKSAmJiAhL15cXG4vLnRlc3QoY2h1bmtzLnN0YXJ0VGFnKSkge1xuICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLnN0YXJ0VGFnO1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcnO1xuICB9XG5cbiAgaWYgKGNodW5rcy5zdGFydFRhZykge1xuICAgIGRpZ2l0YWwgPSAvXFxkK1suXS8udGVzdChjaHVua3Muc3RhcnRUYWcpO1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcnO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcblsgXXs0fS9nLCAnXFxuJyk7XG4gICAgd3JhcHBpbmcudW53cmFwKGNodW5rcyk7XG4gICAgY2h1bmtzLnNraXAoKTtcblxuICAgIGlmIChkaWdpdGFsKSB7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShybmV4dCwgZ2V0UHJlZml4ZWRJdGVtKTtcbiAgICB9XG4gICAgaWYgKG9yZGVyZWQgPT09IGRpZ2l0YWwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH1cblxuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJwcmV2aW91cywgYmVmb3JlUmVwbGFjZXIpO1xuXG4gIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5saXN0aXRlbTtcbiAgfVxuXG4gIHZhciBwcmVmaXggPSBuZXh0QnVsbGV0KCk7XG4gIHZhciBzcGFjZXMgPSBtYW55KCcgJywgcHJlZml4Lmxlbmd0aCk7XG5cbiAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2Uocm5leHQsIGFmdGVyUmVwbGFjZXIpO1xuICBjaHVua3MudHJpbSh0cnVlKTtcbiAgY2h1bmtzLnNraXAoeyBiZWZvcmU6IGJlZm9yZVNraXAsIGFmdGVyOiBhZnRlclNraXAsIGFueTogdHJ1ZSB9KTtcbiAgY2h1bmtzLnN0YXJ0VGFnID0gcHJlZml4O1xuICB3cmFwcGluZy53cmFwKGNodW5rcywgc2V0dGluZ3MubGluZUxlbmd0aCAtIHByZWZpeC5sZW5ndGgpO1xuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9cXG4vZywgJ1xcbicgKyBzcGFjZXMpO1xuXG4gIGZ1bmN0aW9uIGJlZm9yZVJlcGxhY2VyICh0ZXh0KSB7XG4gICAgaWYgKHJidWxsZXR0eXBlLnRlc3QodGV4dCkpIHtcbiAgICAgIGJ1bGxldCA9IFJlZ0V4cC4kMTtcbiAgICB9XG4gICAgYmVmb3JlU2tpcCA9IHJza2lwcGVyLnRlc3QodGV4dCkgPyAxIDogMDtcbiAgICByZXR1cm4gZ2V0UHJlZml4ZWRJdGVtKHRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gYWZ0ZXJSZXBsYWNlciAodGV4dCkge1xuICAgIGFmdGVyU2tpcCA9IHJza2lwcGVyLnRlc3QodGV4dCkgPyAxIDogMDtcbiAgICByZXR1cm4gZ2V0UHJlZml4ZWRJdGVtKHRleHQpO1xuICB9XG5cbiAgZnVuY3Rpb24gbmV4dEJ1bGxldCAoKSB7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIHJldHVybiBwYWQoKG51bSsrKSArICcuJyk7XG4gICAgfVxuICAgIHJldHVybiBwYWQoYnVsbGV0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldFByZWZpeGVkSXRlbSAodGV4dCkge1xuICAgIHZhciBybWFya2VycyA9IC9eWyBdezAsM30oWyorLV18XFxkK1suXSlcXHMvZ207XG4gICAgcmV0dXJuIHRleHQucmVwbGFjZShybWFya2VycywgbmV4dEJ1bGxldCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbGluZUxlbmd0aDogNzJcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBwcmVmaXhlcyA9ICcoPzpcXFxcc3s0LH18XFxcXHMqPnxcXFxccyotXFxcXHMrfFxcXFxzKlxcXFxkK1xcXFwufD18XFxcXCt8LXxffFxcXFwqfCN8XFxcXHMqXFxcXFtbXlxcbl1dK1xcXFxdOiknO1xudmFyIHJsZWFkaW5ncHJlZml4ZXMgPSBuZXcgUmVnRXhwKCdeJyArIHByZWZpeGVzLCAnJyk7XG52YXIgcnRleHQgPSBuZXcgUmVnRXhwKCcoW15cXFxcbl0pXFxcXG4oPyEoXFxcXG58JyArIHByZWZpeGVzICsgJykpJywgJ2cnKTtcbnZhciBydHJhaWxpbmdzcGFjZXMgPSAvXFxzKyQvO1xuXG5mdW5jdGlvbiB3cmFwIChjaHVua3MsIGxlbikge1xuICB2YXIgcmVnZXggPSBuZXcgUmVnRXhwKCcoLnsxLCcgKyBsZW4gKyAnfSkoICt8JFxcXFxuPyknLCAnZ20nKTtcblxuICB1bndyYXAoY2h1bmtzKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb25cbiAgICAucmVwbGFjZShyZWdleCwgcmVwbGFjZXIpXG4gICAgLnJlcGxhY2UocnRyYWlsaW5nc3BhY2VzLCAnJyk7XG5cbiAgZnVuY3Rpb24gcmVwbGFjZXIgKGxpbmUsIG1hcmtlZCkge1xuICAgIHJldHVybiBybGVhZGluZ3ByZWZpeGVzLnRlc3QobGluZSkgPyBsaW5lIDogbWFya2VkICsgJ1xcbic7XG4gIH1cbn1cblxuZnVuY3Rpb24gdW53cmFwIChjaHVua3MpIHtcbiAgcnRleHQubGFzdEluZGV4ID0gMDtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShydGV4dCwgJyQxICQyJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB3cmFwOiB3cmFwLFxuICB1bndyYXA6IHVud3JhcFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uLy4uL2V2ZW50cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gVGV4dFN1cmZhY2UgKGVkaXRvcikge1xuICB2YXIgdGV4dGFyZWEgPSB0aGlzLnRleHRhcmVhID0gZWRpdG9yLnRleHRhcmVhO1xuXG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIF9jYWNoZWQgPSB0aGlzLnJlYWQoKTtcbiAgdmFyIGRlYm91bmNlZENoYW5nZSA9IHV0aWxzLmRlYm91bmNlKHNlbmRDaGFuZ2UsIDEwMCk7XG5cbiAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIHNlbmRDaGFuZ2UpO1xuICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdjdXQnLCBzZW5kQ2hhbmdlKTtcbiAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcigncGFzdGUnLCBzZW5kQ2hhbmdlKTtcbiAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgZGVib3VuY2VkQ2hhbmdlKTtcbiAgdGV4dGFyZWEuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCBkZWJvdW5jZWRDaGFuZ2UpO1xuICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIGRlYm91bmNlZENoYW5nZSk7XG5cbiAgZnVuY3Rpb24gc2VuZENoYW5nZSAoKSB7XG4gICAgdmFyIHVwZGF0ZWQgPSBzZWxmLnJlYWQoKTtcbiAgICBpZihfY2FjaGVkICE9PSB1cGRhdGVkKSB7XG4gICAgICBfY2FjaGVkID0gdXBkYXRlZDtcbiAgICAgIHNlbGYudHJpZ2dlcignY2hhbmdlJywgdXBkYXRlZCk7XG4gICAgfVxuICB9XG59XG5cblRleHRTdXJmYWNlLnByb3RvdHlwZS5mb2N1cyA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy50ZXh0YXJlYS5mb2N1cygpO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnRleHRhcmVhLnZhbHVlO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHRoaXMudGV4dGFyZWEudmFsdWUgPSB2YWx1ZTtcbn07XG5cblRleHRTdXJmYWNlLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy50ZXh0YXJlYTtcbn07XG5cblRleHRTdXJmYWNlLnByb3RvdHlwZS53cml0ZVNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XG4gIHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgPSBzdGF0ZS5zdGFydDtcbiAgdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBzdGF0ZS5lbmQ7XG4gIHRoaXMudGV4dGFyZWEuc2Nyb2xsVG9wID0gc3RhdGUuc2Nyb2xsVG9wO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLnJlYWRTZWxlY3Rpb24gPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgc3RhdGUuc3RhcnQgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICBzdGF0ZS5lbmQgPSB0aGlzLnRleHRhcmVhLnNlbGVjdGlvbkVuZDtcbn07XG5cblRleHRTdXJmYWNlLnByb3RvdHlwZS50b01hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5yZWFkKCk7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUud3JpdGVNYXJrZG93biA9IGZ1bmN0aW9uIChtYXJrZG93bikge1xuICByZXR1cm4gdGhpcy53cml0ZSgobWFya2Rvd24gfHwgJycpLnRyaW0oKSk7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUudG9IVE1MID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lZGl0b3IucGFyc2VNYXJrZG93bih0aGlzLnJlYWQoKSk7XG59O1xuRXZlbnRzLmV4dGVuZChUZXh0U3VyZmFjZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gVGV4dFN1cmZhY2U7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBFdmVudHMgPSByZXF1aXJlKCcuLi8uLi9ldmVudHMnKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uLy4uL3V0aWxzJyk7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgcm9wZW4gPSAvXig8W14+XSsoPzogW14+XSopPz4pLztcbnZhciByY2xvc2UgPSAvKDxcXC9bXj5dKz4pJC87XG52YXIgcnBhcmFncmFwaCA9IC9ePHA+PFxcL3A+XFxuPyQvaTtcblxuZnVuY3Rpb24gV3lzaXd5Z1N1cmZhY2UgKGVkaXRvciwgb3B0aW9ucykge1xuICB0aGlzLmVkaXRvciA9IGVkaXRvcjtcbiAgdmFyIGVkaXRhYmxlID0gdGhpcy5lZGl0YWJsZSA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgZWRpdGFibGUuY2xhc3NOYW1lID0gWyd3ay13eXNpd3lnJywgJ3drLWhpZGUnXS5jb25jYXQob3B0aW9ucy5jbGFzc2VzKS5qb2luKCcgJyk7XG4gIGVkaXRhYmxlLmNvbnRlbnRFZGl0YWJsZSA9IHRydWU7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgX2NhY2hlZCA9IHRoaXMucmVhZCgpO1xuICB2YXIgZGVib3VuY2VkQ2hhbmdlID0gdXRpbHMuZGVib3VuY2Uoc2VuZENoYW5nZSwgMjAwKTtcblxuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgc2VuZENoYW5nZSk7XG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ2N1dCcsIHNlbmRDaGFuZ2UpO1xuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdwYXN0ZScsIHNlbmRDaGFuZ2UpO1xuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCd0ZXh0aW5wdXQnLCBkZWJvdW5jZWRDaGFuZ2UpO1xuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGRlYm91bmNlZENoYW5nZSk7XG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZGVib3VuY2VkQ2hhbmdlKTtcbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCBkZWJvdW5jZWRDaGFuZ2UpO1xuXG4gIGZ1bmN0aW9uIHNlbmRDaGFuZ2UgKCkge1xuICAgIHZhciB1cGRhdGVkID0gc2VsZi5yZWFkKCk7XG4gICAgaWYoX2NhY2hlZCAhPT0gdXBkYXRlZCkge1xuICAgICAgX2NhY2hlZCA9IHVwZGF0ZWQ7XG4gICAgICBzZWxmLnRyaWdnZXIoJ2NoYW5nZScsIHVwZGF0ZWQpO1xuICAgIH1cbiAgfVxufVxuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUuZm9jdXMgPSBmdW5jdGlvbiAoZm9yY2VJbW1lZGlhdGUpIHtcbiAgaWYoZm9yY2VJbW1lZGlhdGUpIHtcbiAgICB0aGlzLmVkaXRhYmxlLmZvY3VzKCk7XG4gIH0gZWxzZSB7XG4gICAgc2V0VGltZW91dCh0aGlzLmVkaXRhYmxlLmZvY3VzLmJpbmQodGhpcy5lZGl0YWJsZSksIDApO1xuICB9XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWRpdGFibGUuaW5uZXJIVE1MO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLndyaXRlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHRoaXMuZWRpdGFibGUuaW5uZXJIVE1MID0gdmFsdWU7XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUuY3VycmVudCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWRpdGFibGU7XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUud3JpdGVTZWxlY3Rpb24gPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIGNodW5rcyA9IHN0YXRlLmNhY2hlZENodW5rcyB8fCBzdGF0ZS5nZXRDaHVua3MoKTtcbiAgdmFyIHN0YXJ0ID0gdW5lc2NhcGVUZXh0KGNodW5rcy5iZWZvcmUpLmxlbmd0aDtcbiAgdmFyIGVuZCA9IHN0YXJ0ICsgdW5lc2NhcGVUZXh0KGNodW5rcy5zZWxlY3Rpb24pLmxlbmd0aDtcbiAgdmFyIHAgPSBkb2MuY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHN0YXJ0UmFuZ2VTZXQgPSBmYWxzZTtcbiAgdmFyIGVuZFJhbmdlU2V0ID0gZmFsc2U7XG5cbiAgd2Fsayh0aGlzLmVkaXRhYmxlLmZpcnN0Q2hpbGQsIHBlZWspO1xuICB0aGlzLmVkaXRhYmxlLmZvY3VzKCk7XG4gIHZhciBzZWxlY3Rpb24gPSBkb2MuZ2V0U2VsZWN0aW9uKCk7XG4gIHNlbGVjdGlvbi5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgc2VsZWN0aW9uLmFkZFJhbmdlKHApO1xuXG4gIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgdmFyIGN1cnNvciA9IHVuZXNjYXBlVGV4dChjb250ZXh0LnRleHQpLmxlbmd0aDtcbiAgICB2YXIgY29udGVudCA9IHJlYWROb2RlKGVsLCBmYWxzZSkubGVuZ3RoO1xuICAgIHZhciBzdW0gPSBjdXJzb3IgKyBjb250ZW50O1xuICAgIGlmICghc3RhcnRSYW5nZVNldCAmJiBzdW0gPj0gc3RhcnQpIHtcbiAgICAgIHAuc2V0U3RhcnQoZWwsIGJvdW5kZWQoc3RhcnQgLSBjdXJzb3IpKTtcbiAgICAgIHN0YXJ0UmFuZ2VTZXQgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAoIWVuZFJhbmdlU2V0ICYmIHN1bSA+PSBlbmQpIHtcbiAgICAgIHAuc2V0RW5kKGVsLCBib3VuZGVkKGVuZCAtIGN1cnNvcikpO1xuICAgICAgZW5kUmFuZ2VTZXQgPSB0cnVlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGJvdW5kZWQgKG9mZnNldCkge1xuICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgubWluKGNvbnRlbnQsIG9mZnNldCkpO1xuICAgIH1cbiAgfVxufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLnJlYWRTZWxlY3Rpb24gPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIHNlbCA9IGRvYy5nZXRTZWxlY3Rpb24oKTtcbiAgdmFyIGRpc3RhbmNlID0gd2Fsayh0aGlzLmVkaXRhYmxlLmZpcnN0Q2hpbGQsIHBlZWspO1xuICB2YXIgc3RhcnQgPSBkaXN0YW5jZS5zdGFydCB8fCAwO1xuICB2YXIgZW5kID0gZGlzdGFuY2UuZW5kIHx8IDA7XG5cbiAgc3RhdGUudGV4dCA9IGRpc3RhbmNlLnRleHQ7XG5cbiAgaWYgKGVuZCA+IHN0YXJ0KSB7XG4gICAgc3RhdGUuc3RhcnQgPSBzdGFydDtcbiAgICBzdGF0ZS5lbmQgPSBlbmQ7XG4gIH0gZWxzZSB7XG4gICAgc3RhdGUuc3RhcnQgPSBlbmQ7XG4gICAgc3RhdGUuZW5kID0gc3RhcnQ7XG4gIH1cblxuICBmdW5jdGlvbiBwZWVrIChjb250ZXh0LCBlbCkge1xuICAgIHZhciBlbFRleHQgPSAoZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnKTtcblxuICAgIGlmIChlbCA9PT0gc2VsLmFuY2hvck5vZGUpIHtcbiAgICAgIGNvbnRleHQuc3RhcnQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgZXNjYXBlTm9kZVRleHQoZWxUZXh0LnN1YnN0cmluZygwLCBzZWwuYW5jaG9yT2Zmc2V0KSkubGVuZ3RoO1xuICAgIH1cbiAgICBpZiAoZWwgPT09IHNlbC5mb2N1c05vZGUpIHtcbiAgICAgIGNvbnRleHQuZW5kID0gY29udGV4dC50ZXh0Lmxlbmd0aCArIGVzY2FwZU5vZGVUZXh0KGVsVGV4dC5zdWJzdHJpbmcoMCwgc2VsLmZvY3VzT2Zmc2V0KSkubGVuZ3RoO1xuICAgIH1cbiAgfVxufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLnRvTWFya2Rvd24gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVkaXRvci5wYXJzZUhUTUwodGhpcy5yZWFkKCkpO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLndyaXRlTWFya2Rvd24gPSBmdW5jdGlvbiAobWFya2Rvd24pIHtcbiAgdmFyIGh0bWwgPSB0aGlzLmVkaXRvci5wYXJzZU1hcmtkb3duKG1hcmtkb3duIHx8ICcnKVxuICAgIC5yZXBsYWNlKHJwYXJhZ3JhcGgsICcnKSAvLyBSZW1vdmUgZW1wdHkgPHA+IHRhZ3NcbiAgICAudHJpbSgpO1xuICByZXR1cm4gdGhpcy53cml0ZShodG1sKTtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS50b0hUTUwgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnJlYWQoKTtcbn07XG5cbmZ1bmN0aW9uIHdhbGsgKGVsLCBwZWVrLCBjdHgsIHNpYmxpbmdzKSB7XG4gIHZhciBjb250ZXh0ID0gY3R4IHx8IHsgdGV4dDogJycgfTtcblxuICBpZiAoIWVsKSB7XG4gICAgcmV0dXJuIGNvbnRleHQ7XG4gIH1cblxuICB2YXIgZWxOb2RlID0gZWwubm9kZVR5cGUgPT09IDE7XG4gIHZhciB0ZXh0Tm9kZSA9IGVsLm5vZGVUeXBlID09PSAzO1xuXG4gIHBlZWsoY29udGV4dCwgZWwpO1xuXG4gIGlmICh0ZXh0Tm9kZSkge1xuICAgIGNvbnRleHQudGV4dCArPSByZWFkTm9kZShlbCk7XG4gIH1cbiAgaWYgKGVsTm9kZSkge1xuICAgIGlmIChlbC5vdXRlckhUTUwubWF0Y2gocm9wZW4pKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgICBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChlbC5jaGlsZE5vZGVzKS5mb3JFYWNoKHdhbGtDaGlsZHJlbik7XG4gICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyY2xvc2UpKSB7IGNvbnRleHQudGV4dCArPSBSZWdFeHAuJDE7IH1cbiAgfVxuICBpZiAoc2libGluZ3MgIT09IGZhbHNlICYmIGVsLm5leHRTaWJsaW5nKSB7XG4gICAgcmV0dXJuIHdhbGsoZWwubmV4dFNpYmxpbmcsIHBlZWssIGNvbnRleHQpO1xuICB9XG4gIHJldHVybiBjb250ZXh0O1xuXG4gIGZ1bmN0aW9uIHdhbGtDaGlsZHJlbiAoY2hpbGQpIHtcbiAgICB3YWxrKGNoaWxkLCBwZWVrLCBjb250ZXh0LCBmYWxzZSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVhZE5vZGUgKGVsLCBlc2NhcGUpIHtcbiAgaWYoZWwubm9kZVR5cGUgPT09IDMpIHtcbiAgICBpZihlc2NhcGUgPT09IGZhbHNlKSB7XG4gICAgICByZXR1cm4gZWwudGV4dENvbnRlbnQgfHwgZWwuaW5uZXJUZXh0IHx8ICcnO1xuICAgIH1cblxuICAgIHJldHVybiBlc2NhcGVOb2RlVGV4dChlbCk7XG4gIH1cbiAgcmV0dXJuICcnO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVOb2RlVGV4dCAoZWwpIHtcbiAgZWwgPSBlbCB8fCAnJztcbiAgaWYoZWwubm9kZVR5cGUgPT09IDMpIHtcbiAgICBlbCA9IGVsLmNsb25lTm9kZSgpO1xuICB9IGVsc2Uge1xuICAgIGVsID0gZG9jLmNyZWF0ZVRleHROb2RlKGVsKTtcbiAgfVxuXG4gIC8vIFVzaW5nIGJyb3dzZXIgZXNjYXBpbmcgdG8gY2xlYW4gdXAgYW55IHNwZWNpYWwgY2hhcmFjdGVyc1xuICB2YXIgdG9UZXh0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b1RleHQuYXBwZW5kQ2hpbGQoZWwpO1xuICByZXR1cm4gdG9UZXh0LmlubmVySFRNTCB8fCAnJztcbn1cblxuZnVuY3Rpb24gdW5lc2NhcGVUZXh0IChlbCkge1xuICBpZihlbC5ub2RlVHlwZSkge1xuICAgIHJldHVybiBlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJyc7XG4gIH1cblxuICB2YXIgdG9UZXh0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICB0b1RleHQudGV4dENvbnRlbnQgPSBlbDtcbiAgcmV0dXJuIHRvVGV4dC50ZXh0Q29udGVudDtcbn1cblxuRXZlbnRzLmV4dGVuZChXeXNpd3lnU3VyZmFjZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gV3lzaXd5Z1N1cmZhY2U7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXRiMlJsY3k5M2VYTnBkM2xuTDNkNWMybDNlV2RUZFhKbVlXTmxMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnUlhabGJuUnpJRDBnY21WeGRXbHlaU2duTGk0dkxpNHZaWFpsYm5Sekp5azdYRzUyWVhJZ2RYUnBiSE1nUFNCeVpYRjFhWEpsS0NjdUxpOHVMaTkxZEdsc2N5Y3BPMXh1WEc1MllYSWdaRzlqSUQwZ1oyeHZZbUZzTG1SdlkzVnRaVzUwTzF4dWRtRnlJSEp2Y0dWdUlEMGdMMTRvUEZ0ZVBsMHJLRDg2SUZ0ZVBsMHFLVDgrS1M4N1hHNTJZWElnY21Oc2IzTmxJRDBnTHlnOFhGd3ZXMTQrWFNzK0tTUXZPMXh1ZG1GeUlISndZWEpoWjNKaGNHZ2dQU0F2WGp4d1BqeGNYQzl3UGx4Y2JqOGtMMms3WEc1Y2JtWjFibU4wYVc5dUlGZDVjMmwzZVdkVGRYSm1ZV05sSUNobFpHbDBiM0lzSUc5d2RHbHZibk1wSUh0Y2JpQWdkR2hwY3k1bFpHbDBiM0lnUFNCbFpHbDBiM0k3WEc0Z0lIWmhjaUJsWkdsMFlXSnNaU0E5SUhSb2FYTXVaV1JwZEdGaWJHVWdQU0JrYjJNdVkzSmxZWFJsUld4bGJXVnVkQ2duWkdsMkp5azdYRzRnSUdWa2FYUmhZbXhsTG1Oc1lYTnpUbUZ0WlNBOUlGc25kMnN0ZDNsemFYZDVaeWNzSUNkM2F5MW9hV1JsSjEwdVkyOXVZMkYwS0c5d2RHbHZibk11WTJ4aGMzTmxjeWt1YW05cGJpZ25JQ2NwTzF4dUlDQmxaR2wwWVdKc1pTNWpiMjUwWlc1MFJXUnBkR0ZpYkdVZ1BTQjBjblZsTzF4dVhHNGdJSFpoY2lCelpXeG1JRDBnZEdocGN6dGNiaUFnZG1GeUlGOWpZV05vWldRZ1BTQjBhR2x6TG5KbFlXUW9LVHRjYmlBZ2RtRnlJR1JsWW05MWJtTmxaRU5vWVc1blpTQTlJSFYwYVd4ekxtUmxZbTkxYm1ObEtITmxibVJEYUdGdVoyVXNJREl3TUNrN1hHNWNiaUFnWldScGRHRmliR1V1WVdSa1JYWmxiblJNYVhOMFpXNWxjaWduWW14MWNpY3NJSE5sYm1SRGFHRnVaMlVwTzF4dUlDQmxaR2wwWVdKc1pTNWhaR1JGZG1WdWRFeHBjM1JsYm1WeUtDZGpkWFFuTENCelpXNWtRMmhoYm1kbEtUdGNiaUFnWldScGRHRmliR1V1WVdSa1JYWmxiblJNYVhOMFpXNWxjaWduY0dGemRHVW5MQ0J6Wlc1a1EyaGhibWRsS1R0Y2JpQWdaV1JwZEdGaWJHVXVZV1JrUlhabGJuUk1hWE4wWlc1bGNpZ25kR1Y0ZEdsdWNIVjBKeXdnWkdWaWIzVnVZMlZrUTJoaGJtZGxLVHRjYmlBZ1pXUnBkR0ZpYkdVdVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnbmFXNXdkWFFuTENCa1pXSnZkVzVqWldSRGFHRnVaMlVwTzF4dUlDQmxaR2wwWVdKc1pTNWhaR1JGZG1WdWRFeHBjM1JsYm1WeUtDZHJaWGx3Y21WemN5Y3NJR1JsWW05MWJtTmxaRU5vWVc1blpTazdYRzRnSUdWa2FYUmhZbXhsTG1Ga1pFVjJaVzUwVEdsemRHVnVaWElvSjJ0bGVYVndKeXdnWkdWaWIzVnVZMlZrUTJoaGJtZGxLVHRjYmx4dUlDQm1kVzVqZEdsdmJpQnpaVzVrUTJoaGJtZGxJQ2dwSUh0Y2JpQWdJQ0IyWVhJZ2RYQmtZWFJsWkNBOUlITmxiR1l1Y21WaFpDZ3BPMXh1SUNBZ0lHbG1LRjlqWVdOb1pXUWdJVDA5SUhWd1pHRjBaV1FwSUh0Y2JpQWdJQ0FnSUY5allXTm9aV1FnUFNCMWNHUmhkR1ZrTzF4dUlDQWdJQ0FnYzJWc1ppNTBjbWxuWjJWeUtDZGphR0Z1WjJVbkxDQjFjR1JoZEdWa0tUdGNiaUFnSUNCOVhHNGdJSDFjYm4xY2JseHVWM2x6YVhkNVoxTjFjbVpoWTJVdWNISnZkRzkwZVhCbExtWnZZM1Z6SUQwZ1puVnVZM1JwYjI0Z0tHWnZjbU5sU1cxdFpXUnBZWFJsS1NCN1hHNGdJR2xtS0dadmNtTmxTVzF0WldScFlYUmxLU0I3WEc0Z0lDQWdkR2hwY3k1bFpHbDBZV0pzWlM1bWIyTjFjeWdwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhObGRGUnBiV1Z2ZFhRb2RHaHBjeTVsWkdsMFlXSnNaUzVtYjJOMWN5NWlhVzVrS0hSb2FYTXVaV1JwZEdGaWJHVXBMQ0F3S1R0Y2JpQWdmVnh1ZlR0Y2JseHVWM2x6YVhkNVoxTjFjbVpoWTJVdWNISnZkRzkwZVhCbExuSmxZV1FnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhKbGRIVnliaUIwYUdsekxtVmthWFJoWW14bExtbHVibVZ5U0ZSTlREdGNibjA3WEc1Y2JsZDVjMmwzZVdkVGRYSm1ZV05sTG5CeWIzUnZkSGx3WlM1M2NtbDBaU0E5SUdaMWJtTjBhVzl1SUNoMllXeDFaU2tnZTF4dUlDQjBhR2x6TG1Wa2FYUmhZbXhsTG1sdWJtVnlTRlJOVENBOUlIWmhiSFZsTzF4dWZUdGNibHh1VjNsemFYZDVaMU4xY21aaFkyVXVjSEp2ZEc5MGVYQmxMbU4xY25KbGJuUWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJSEpsZEhWeWJpQjBhR2x6TG1Wa2FYUmhZbXhsTzF4dWZUdGNibHh1VjNsemFYZDVaMU4xY21aaFkyVXVjSEp2ZEc5MGVYQmxMbmR5YVhSbFUyVnNaV04wYVc5dUlEMGdablZ1WTNScGIyNGdLSE4wWVhSbEtTQjdYRzRnSUhaaGNpQmphSFZ1YTNNZ1BTQnpkR0YwWlM1allXTm9aV1JEYUhWdWEzTWdmSHdnYzNSaGRHVXVaMlYwUTJoMWJtdHpLQ2s3WEc0Z0lIWmhjaUJ6ZEdGeWRDQTlJSFZ1WlhOallYQmxWR1Y0ZENoamFIVnVhM011WW1WbWIzSmxLUzVzWlc1bmRHZzdYRzRnSUhaaGNpQmxibVFnUFNCemRHRnlkQ0FySUhWdVpYTmpZWEJsVkdWNGRDaGphSFZ1YTNNdWMyVnNaV04wYVc5dUtTNXNaVzVuZEdnN1hHNGdJSFpoY2lCd0lEMGdaRzlqTG1OeVpXRjBaVkpoYm1kbEtDazdYRzRnSUhaaGNpQnpkR0Z5ZEZKaGJtZGxVMlYwSUQwZ1ptRnNjMlU3WEc0Z0lIWmhjaUJsYm1SU1lXNW5aVk5sZENBOUlHWmhiSE5sTzF4dVhHNGdJSGRoYkdzb2RHaHBjeTVsWkdsMFlXSnNaUzVtYVhKemRFTm9hV3hrTENCd1pXVnJLVHRjYmlBZ2RHaHBjeTVsWkdsMFlXSnNaUzVtYjJOMWN5Z3BPMXh1SUNCMllYSWdjMlZzWldOMGFXOXVJRDBnWkc5akxtZGxkRk5sYkdWamRHbHZiaWdwTzF4dUlDQnpaV3hsWTNScGIyNHVjbVZ0YjNabFFXeHNVbUZ1WjJWektDazdYRzRnSUhObGJHVmpkR2x2Ymk1aFpHUlNZVzVuWlNod0tUdGNibHh1SUNCbWRXNWpkR2x2YmlCd1pXVnJJQ2hqYjI1MFpYaDBMQ0JsYkNrZ2UxeHVJQ0FnSUhaaGNpQmpkWEp6YjNJZ1BTQjFibVZ6WTJGd1pWUmxlSFFvWTI5dWRHVjRkQzUwWlhoMEtTNXNaVzVuZEdnN1hHNGdJQ0FnZG1GeUlHTnZiblJsYm5RZ1BTQnlaV0ZrVG05a1pTaGxiQ3dnWm1Gc2MyVXBMbXhsYm1kMGFEdGNiaUFnSUNCMllYSWdjM1Z0SUQwZ1kzVnljMjl5SUNzZ1kyOXVkR1Z1ZER0Y2JpQWdJQ0JwWmlBb0lYTjBZWEowVW1GdVoyVlRaWFFnSmlZZ2MzVnRJRDQ5SUhOMFlYSjBLU0I3WEc0Z0lDQWdJQ0J3TG5ObGRGTjBZWEowS0dWc0xDQmliM1Z1WkdWa0tITjBZWEowSUMwZ1kzVnljMjl5S1NrN1hHNGdJQ0FnSUNCemRHRnlkRkpoYm1kbFUyVjBJRDBnZEhKMVpUdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tDRmxibVJTWVc1blpWTmxkQ0FtSmlCemRXMGdQajBnWlc1a0tTQjdYRzRnSUNBZ0lDQndMbk5sZEVWdVpDaGxiQ3dnWW05MWJtUmxaQ2hsYm1RZ0xTQmpkWEp6YjNJcEtUdGNiaUFnSUNBZ0lHVnVaRkpoYm1kbFUyVjBJRDBnZEhKMVpUdGNiaUFnSUNCOVhHNWNiaUFnSUNCbWRXNWpkR2x2YmlCaWIzVnVaR1ZrSUNodlptWnpaWFFwSUh0Y2JpQWdJQ0FnSUhKbGRIVnliaUJOWVhSb0xtMWhlQ2d3TENCTllYUm9MbTFwYmloamIyNTBaVzUwTENCdlptWnpaWFFwS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibjA3WEc1Y2JsZDVjMmwzZVdkVGRYSm1ZV05sTG5CeWIzUnZkSGx3WlM1eVpXRmtVMlZzWldOMGFXOXVJRDBnWm5WdVkzUnBiMjRnS0hOMFlYUmxLU0I3WEc0Z0lIWmhjaUJ6Wld3Z1BTQmtiMk11WjJWMFUyVnNaV04wYVc5dUtDazdYRzRnSUhaaGNpQmthWE4wWVc1alpTQTlJSGRoYkdzb2RHaHBjeTVsWkdsMFlXSnNaUzVtYVhKemRFTm9hV3hrTENCd1pXVnJLVHRjYmlBZ2RtRnlJSE4wWVhKMElEMGdaR2x6ZEdGdVkyVXVjM1JoY25RZ2ZId2dNRHRjYmlBZ2RtRnlJR1Z1WkNBOUlHUnBjM1JoYm1ObExtVnVaQ0I4ZkNBd08xeHVYRzRnSUhOMFlYUmxMblJsZUhRZ1BTQmthWE4wWVc1alpTNTBaWGgwTzF4dVhHNGdJR2xtSUNobGJtUWdQaUJ6ZEdGeWRDa2dlMXh1SUNBZ0lITjBZWFJsTG5OMFlYSjBJRDBnYzNSaGNuUTdYRzRnSUNBZ2MzUmhkR1V1Wlc1a0lEMGdaVzVrTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUhOMFlYUmxMbk4wWVhKMElEMGdaVzVrTzF4dUlDQWdJSE4wWVhSbExtVnVaQ0E5SUhOMFlYSjBPMXh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnY0dWbGF5QW9ZMjl1ZEdWNGRDd2daV3dwSUh0Y2JpQWdJQ0IyWVhJZ1pXeFVaWGgwSUQwZ0tHVnNMblJsZUhSRGIyNTBaVzUwSUh4OElHVnNMbWx1Ym1WeVZHVjRkQ0I4ZkNBbkp5azdYRzVjYmlBZ0lDQnBaaUFvWld3Z1BUMDlJSE5sYkM1aGJtTm9iM0pPYjJSbEtTQjdYRzRnSUNBZ0lDQmpiMjUwWlhoMExuTjBZWEowSUQwZ1kyOXVkR1Y0ZEM1MFpYaDBMbXhsYm1kMGFDQXJJR1Z6WTJGd1pVNXZaR1ZVWlhoMEtHVnNWR1Y0ZEM1emRXSnpkSEpwYm1jb01Dd2djMlZzTG1GdVkyaHZjazltWm5ObGRDa3BMbXhsYm1kMGFEdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tHVnNJRDA5UFNCelpXd3VabTlqZFhOT2IyUmxLU0I3WEc0Z0lDQWdJQ0JqYjI1MFpYaDBMbVZ1WkNBOUlHTnZiblJsZUhRdWRHVjRkQzVzWlc1bmRHZ2dLeUJsYzJOaGNHVk9iMlJsVkdWNGRDaGxiRlJsZUhRdWMzVmljM1J5YVc1bktEQXNJSE5sYkM1bWIyTjFjMDltWm5ObGRDa3BMbXhsYm1kMGFEdGNiaUFnSUNCOVhHNGdJSDFjYm4wN1hHNWNibGQ1YzJsM2VXZFRkWEptWVdObExuQnliM1J2ZEhsd1pTNTBiMDFoY210a2IzZHVJRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1bFpHbDBiM0l1Y0dGeWMyVklWRTFNS0hSb2FYTXVjbVZoWkNncEtUdGNibjA3WEc1Y2JsZDVjMmwzZVdkVGRYSm1ZV05sTG5CeWIzUnZkSGx3WlM1M2NtbDBaVTFoY210a2IzZHVJRDBnWm5WdVkzUnBiMjRnS0cxaGNtdGtiM2R1S1NCN1hHNGdJSFpoY2lCb2RHMXNJRDBnZEdocGN5NWxaR2wwYjNJdWNHRnljMlZOWVhKclpHOTNiaWh0WVhKclpHOTNiaUI4ZkNBbkp5bGNiaUFnSUNBdWNtVndiR0ZqWlNoeWNHRnlZV2R5WVhCb0xDQW5KeWtnTHk4Z1VtVnRiM1psSUdWdGNIUjVJRHh3UGlCMFlXZHpYRzRnSUNBZ0xuUnlhVzBvS1R0Y2JpQWdjbVYwZFhKdUlIUm9hWE11ZDNKcGRHVW9hSFJ0YkNrN1hHNTlPMXh1WEc1WGVYTnBkM2xuVTNWeVptRmpaUzV3Y205MGIzUjVjR1V1ZEc5SVZFMU1JRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1eVpXRmtLQ2s3WEc1OU8xeHVYRzVtZFc1amRHbHZiaUIzWVd4cklDaGxiQ3dnY0dWbGF5d2dZM1I0TENCemFXSnNhVzVuY3lrZ2UxeHVJQ0IyWVhJZ1kyOXVkR1Y0ZENBOUlHTjBlQ0I4ZkNCN0lIUmxlSFE2SUNjbklIMDdYRzVjYmlBZ2FXWWdLQ0ZsYkNrZ2UxeHVJQ0FnSUhKbGRIVnliaUJqYjI1MFpYaDBPMXh1SUNCOVhHNWNiaUFnZG1GeUlHVnNUbTlrWlNBOUlHVnNMbTV2WkdWVWVYQmxJRDA5UFNBeE8xeHVJQ0IyWVhJZ2RHVjRkRTV2WkdVZ1BTQmxiQzV1YjJSbFZIbHdaU0E5UFQwZ016dGNibHh1SUNCd1pXVnJLR052Ym5SbGVIUXNJR1ZzS1R0Y2JseHVJQ0JwWmlBb2RHVjRkRTV2WkdVcElIdGNiaUFnSUNCamIyNTBaWGgwTG5SbGVIUWdLejBnY21WaFpFNXZaR1VvWld3cE8xeHVJQ0I5WEc0Z0lHbG1JQ2hsYkU1dlpHVXBJSHRjYmlBZ0lDQnBaaUFvWld3dWIzVjBaWEpJVkUxTUxtMWhkR05vS0hKdmNHVnVLU2tnZXlCamIyNTBaWGgwTG5SbGVIUWdLejBnVW1WblJYaHdMaVF4T3lCOVhHNGdJQ0FnUVhKeVlYa3VjSEp2ZEc5MGVYQmxMbk5zYVdObExtTmhiR3dvWld3dVkyaHBiR1JPYjJSbGN5a3VabTl5UldGamFDaDNZV3hyUTJocGJHUnlaVzRwTzF4dUlDQWdJR2xtSUNobGJDNXZkWFJsY2toVVRVd3ViV0YwWTJnb2NtTnNiM05sS1NrZ2V5QmpiMjUwWlhoMExuUmxlSFFnS3owZ1VtVm5SWGh3TGlReE95QjlYRzRnSUgxY2JpQWdhV1lnS0hOcFlteHBibWR6SUNFOVBTQm1ZV3h6WlNBbUppQmxiQzV1WlhoMFUybGliR2x1WnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUIzWVd4cktHVnNMbTVsZUhSVGFXSnNhVzVuTENCd1pXVnJMQ0JqYjI1MFpYaDBLVHRjYmlBZ2ZWeHVJQ0J5WlhSMWNtNGdZMjl1ZEdWNGREdGNibHh1SUNCbWRXNWpkR2x2YmlCM1lXeHJRMmhwYkdSeVpXNGdLR05vYVd4a0tTQjdYRzRnSUNBZ2QyRnNheWhqYUdsc1pDd2djR1ZsYXl3Z1kyOXVkR1Y0ZEN3Z1ptRnNjMlVwTzF4dUlDQjlYRzU5WEc1Y2JtWjFibU4wYVc5dUlISmxZV1JPYjJSbElDaGxiQ3dnWlhOallYQmxLU0I3WEc0Z0lHbG1LR1ZzTG01dlpHVlVlWEJsSUQwOVBTQXpLU0I3WEc0Z0lDQWdhV1lvWlhOallYQmxJRDA5UFNCbVlXeHpaU2tnZTF4dUlDQWdJQ0FnY21WMGRYSnVJR1ZzTG5SbGVIUkRiMjUwWlc1MElIeDhJR1ZzTG1sdWJtVnlWR1Y0ZENCOGZDQW5KenRjYmlBZ0lDQjlYRzVjYmlBZ0lDQnlaWFIxY200Z1pYTmpZWEJsVG05a1pWUmxlSFFvWld3cE8xeHVJQ0I5WEc0Z0lISmxkSFZ5YmlBbkp6dGNibjFjYmx4dVpuVnVZM1JwYjI0Z1pYTmpZWEJsVG05a1pWUmxlSFFnS0dWc0tTQjdYRzRnSUdWc0lEMGdaV3dnZkh3Z0p5YzdYRzRnSUdsbUtHVnNMbTV2WkdWVWVYQmxJRDA5UFNBektTQjdYRzRnSUNBZ1pXd2dQU0JsYkM1amJHOXVaVTV2WkdVb0tUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQmxiQ0E5SUdSdll5NWpjbVZoZEdWVVpYaDBUbTlrWlNobGJDazdYRzRnSUgxY2JseHVJQ0F2THlCVmMybHVaeUJpY205M2MyVnlJR1Z6WTJGd2FXNW5JSFJ2SUdOc1pXRnVJSFZ3SUdGdWVTQnpjR1ZqYVdGc0lHTm9ZWEpoWTNSbGNuTmNiaUFnZG1GeUlIUnZWR1Y0ZENBOUlHUnZZeTVqY21WaGRHVkZiR1Z0Wlc1MEtDZGthWFluS1R0Y2JpQWdkRzlVWlhoMExtRndjR1Z1WkVOb2FXeGtLR1ZzS1R0Y2JpQWdjbVYwZFhKdUlIUnZWR1Y0ZEM1cGJtNWxja2hVVFV3Z2ZId2dKeWM3WEc1OVhHNWNibVoxYm1OMGFXOXVJSFZ1WlhOallYQmxWR1Y0ZENBb1pXd3BJSHRjYmlBZ2FXWW9aV3d1Ym05a1pWUjVjR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaV3d1ZEdWNGRFTnZiblJsYm5RZ2ZId2daV3d1YVc1dVpYSlVaWGgwSUh4OElDY25PMXh1SUNCOVhHNWNiaUFnZG1GeUlIUnZWR1Y0ZENBOUlHUnZZeTVqY21WaGRHVkZiR1Z0Wlc1MEtDZGthWFluS1R0Y2JpQWdkRzlVWlhoMExuUmxlSFJEYjI1MFpXNTBJRDBnWld3N1hHNGdJSEpsZEhWeWJpQjBiMVJsZUhRdWRHVjRkRU52Ym5SbGJuUTdYRzU5WEc1Y2JrVjJaVzUwY3k1bGVIUmxibVFvVjNsemFYZDVaMU4xY21aaFkyVXBPMXh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUZkNWMybDNlV2RUZFhKbVlXTmxPMXh1SWwxOSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gb25jZSAoZm4pIHtcbiAgdmFyIGRpc3Bvc2VkO1xuICByZXR1cm4gZnVuY3Rpb24gZGlzcG9zYWJsZSAoKSB7XG4gICAgaWYgKGRpc3Bvc2VkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGRpc3Bvc2VkID0gdHJ1ZTtcbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBvbmNlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIGhvbWVicmV3UVNBIChjbGFzc05hbWUpIHtcbiAgdmFyIHJlc3VsdHMgPSBbXTtcbiAgdmFyIGFsbCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnKicpO1xuICB2YXIgaTtcbiAgZm9yIChpIGluIGFsbCkge1xuICAgIGlmICh3cmFwKGFsbFtpXS5jbGFzc05hbWUpLmluZGV4T2Yod3JhcChjbGFzc05hbWUpKSAhPT0gLTEpIHtcbiAgICAgIHJlc3VsdHMucHVzaChhbGxbaV0pO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0cztcbn1cblxuZnVuY3Rpb24gd3JhcCAodGV4dCkge1xuICByZXR1cm4gJyAnICsgdGV4dCArICcgJztcbn1cblxuZnVuY3Rpb24gY2xvc2VQcm9tcHRzICgpIHtcbiAgaWYgKGRvYy5ib2R5LnF1ZXJ5U2VsZWN0b3JBbGwpIHtcbiAgICByZW1vdmUoZG9jLmJvZHkucXVlcnlTZWxlY3RvckFsbCgnLndrLXByb21wdCcpKTtcbiAgfSBlbHNlIHtcbiAgICByZW1vdmUoaG9tZWJyZXdRU0EoJ3drLXByb21wdCcpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUgKHByb21wdHMpIHtcbiAgdmFyIGxlbiA9IHByb21wdHMubGVuZ3RoO1xuICB2YXIgaTtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcHJvbXB0c1tpXS5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHByb21wdHNbaV0pO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gY2xvc2VQcm9tcHRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyB2YXIgYnVyZWF1Y3JhY3kgPSByZXF1aXJlKCdidXJlYXVjcmFjeScpO1xudmFyIHJlbmRlciA9IHJlcXVpcmUoJy4vcmVuZGVyJyk7XG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4uL2NsYXNzZXMnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHVwbG9hZHMgPSByZXF1aXJlKCcuLi91cGxvYWRzJyk7XG52YXIgRU5URVJfS0VZID0gMTM7XG52YXIgRVNDQVBFX0tFWSA9IDI3O1xudmFyIGRyYWdDbGFzcyA9ICd3ay1kcmFnZ2luZyc7XG52YXIgZHJhZ0NsYXNzU3BlY2lmaWMgPSAnd2stcHJvbXB0LXVwbG9hZC1kcmFnZ2luZyc7XG52YXIgcm9vdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuZnVuY3Rpb24gY2xhc3NpZnkgKGdyb3VwLCBjbGFzc2VzKSB7XG4gIE9iamVjdC5rZXlzKGdyb3VwKS5mb3JFYWNoKGN1c3RvbWl6ZSk7XG4gIGZ1bmN0aW9uIGN1c3RvbWl6ZSAoa2V5KSB7XG4gICAgaWYgKGNsYXNzZXNba2V5XSkge1xuICAgICAgZ3JvdXBba2V5XS5jbGFzc05hbWUgKz0gJyAnICsgY2xhc3Nlc1trZXldO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9tcHQgKG9wdGlvbnMsIGRvbmUpIHtcbiAgdmFyIHRleHQgPSBzdHJpbmdzLnByb21wdHNbb3B0aW9ucy50eXBlXTtcbiAgdmFyIGRvbSA9IHJlbmRlcih7XG4gICAgaWQ6ICd3ay1wcm9tcHQtJyArIG9wdGlvbnMudHlwZSxcbiAgICB0aXRsZTogdGV4dC50aXRsZSxcbiAgICBkZXNjcmlwdGlvbjogdGV4dC5kZXNjcmlwdGlvbixcbiAgICBwbGFjZWhvbGRlcjogdGV4dC5wbGFjZWhvbGRlclxuICB9KTtcbiAgdmFyIGRvbXVwO1xuXG4gIGRvbS5jYW5jZWwuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCByZW1vdmUpO1xuICBkb20uY2xvc2UuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCByZW1vdmUpO1xuICBkb20ub2suYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBvayk7XG4gIGRvbS5pbnB1dC5hZGRFdmVudExpc3RlbmVyKCdrZXlwcmVzcycsIGVudGVyKTtcbiAgZG9tLmRpYWxvZy5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZXNjKTtcbiAgY2xhc3NpZnkoZG9tLCBvcHRpb25zLmNsYXNzZXMucHJvbXB0cyk7XG5cbiAgdmFyIHVwbG9hZCA9IG9wdGlvbnMudXBsb2FkO1xuICBpZiAodHlwZW9mIHVwbG9hZCA9PT0gJ3N0cmluZycpIHtcbiAgICB1cGxvYWQgPSB7IHVybDogdXBsb2FkIH07XG4gIH1cblxuICB2YXIgYnVyZWF1Y3JhdCA9IG51bGw7XG4gIGlmICh1cGxvYWQpIHtcbiAgICBidXJlYXVjcmF0ID0gYXJyYW5nZVVwbG9hZHMoKTtcbiAgICBpZiAob3B0aW9ucy5hdXRvVXBsb2FkKSB7XG4gICAgICBidXJlYXVjcmF0LnN1Ym1pdChvcHRpb25zLmF1dG9VcGxvYWQpO1xuICAgIH1cbiAgfVxuXG4gIHNldFRpbWVvdXQoZm9jdXNEaWFsb2csIDApO1xuXG4gIGZ1bmN0aW9uIGZvY3VzRGlhbG9nICgpIHtcbiAgICBkb20uaW5wdXQuZm9jdXMoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVudGVyIChlKSB7XG4gICAgdmFyIGtleSA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmIChrZXkgPT09IEVOVEVSX0tFWSkge1xuICAgICAgb2soKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlc2MgKGUpIHtcbiAgICB2YXIga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKGtleSA9PT0gRVNDQVBFX0tFWSkge1xuICAgICAgcmVtb3ZlKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb2sgKCkge1xuICAgIHJlbW92ZSgpO1xuICAgIGRvbmUoeyBkZWZpbml0aW9uczogW2RvbS5pbnB1dC52YWx1ZV0gfSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmUgKCkge1xuICAgIGlmICh1cGxvYWQpIHsgYmluZFVwbG9hZEV2ZW50cyh0cnVlKTsgfVxuICAgIGlmIChkb20uZGlhbG9nLnBhcmVudEVsZW1lbnQpIHsgZG9tLmRpYWxvZy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGRvbS5kaWFsb2cpOyB9XG4gICAgLy8gb3B0aW9ucy5zdXJmYWNlLmZvY3VzKG9wdGlvbnMubW9kZSk7XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kVXBsb2FkRXZlbnRzIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdkcmFnZW50ZXInLCBkcmFnZ2luZyk7XG4gICAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdlbmQnLCBkcmFnc3RvcCk7XG4gICAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ21vdXNlb3V0JywgZHJhZ3N0b3ApO1xuICB9XG5cbiAgZnVuY3Rpb24gZHJhZ2dpbmcgKCkge1xuICAgIGNsYXNzZXMuYWRkKGRvbXVwLmFyZWEsIGRyYWdDbGFzcyk7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAuYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xuICB9XG4gIGZ1bmN0aW9uIGRyYWdzdG9wICgpIHtcbiAgICBjbGFzc2VzLnJtKGRvbXVwLmFyZWEsIGRyYWdDbGFzcyk7XG4gICAgY2xhc3Nlcy5ybShkb211cC5hcmVhLCBkcmFnQ2xhc3NTcGVjaWZpYyk7XG4gICAgdXBsb2Fkcy5zdG9wKG9wdGlvbnMuc3VyZmFjZS5kcm9wYXJlYSk7XG4gIH1cblxuICBmdW5jdGlvbiBhcnJhbmdlVXBsb2FkcyAoKSB7XG4gICAgZG9tdXAgPSByZW5kZXIudXBsb2Fkcyhkb20sIHN0cmluZ3MucHJvbXB0cy50eXBlcyArICh1cGxvYWQucmVzdHJpY3Rpb24gfHwgb3B0aW9ucy50eXBlICsgJ3MnKSk7XG4gICAgYmluZFVwbG9hZEV2ZW50cygpO1xuICAgIGRvbXVwLmFyZWEuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCBoYW5kbGVEcmFnT3ZlciwgZmFsc2UpO1xuICAgIGRvbXVwLmFyZWEuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGhhbmRsZUZpbGVTZWxlY3QsIGZhbHNlKTtcbiAgICBjbGFzc2lmeShkb211cCwgb3B0aW9ucy5jbGFzc2VzLnByb21wdHMpO1xuLypcbiAgICB2YXIgYnVyZWF1Y3JhdCA9IGJ1cmVhdWNyYWN5LnNldHVwKGRvbXVwLmZpbGVpbnB1dCwge1xuICAgICAgbWV0aG9kOiB1cGxvYWQubWV0aG9kLFxuICAgICAgZm9ybURhdGE6IHVwbG9hZC5mb3JtRGF0YSxcbiAgICAgIGZpZWxkS2V5OiB1cGxvYWQuZmllbGRLZXksXG4gICAgICBlbmRwb2ludDogdXBsb2FkLnVybCxcbiAgICAgIHZhbGlkYXRlOiAnaW1hZ2UnXG4gICAgfSk7XG5cbiAgICBidXJlYXVjcmF0Lm9uKCdzdGFydGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgY2xhc3Nlcy5ybShkb211cC5mYWlsZWQsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgICAgY2xhc3Nlcy5ybShkb211cC53YXJuaW5nLCAnd2stcHJvbXB0LWVycm9yLXNob3cnKTtcbiAgICB9KTtcbiAgICBidXJlYXVjcmF0Lm9uKCd2YWxpZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNsYXNzZXMuYWRkKGRvbXVwLmFyZWEsICd3ay1wcm9tcHQtdXBsb2FkaW5nJyk7XG4gICAgfSk7XG4gICAgYnVyZWF1Y3JhdC5vbignaW52YWxpZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGNsYXNzZXMuYWRkKGRvbXVwLndhcm5pbmcsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgIH0pO1xuICAgIGJ1cmVhdWNyYXQub24oJ2Vycm9yJywgZnVuY3Rpb24gKCkge1xuICAgICAgY2xhc3Nlcy5hZGQoZG9tdXAuZmFpbGVkLCAnd2stcHJvbXB0LWVycm9yLXNob3cnKTtcbiAgICB9KTtcbiAgICBidXJlYXVjcmF0Lm9uKCdzdWNjZXNzJywgcmVjZWl2ZWRJbWFnZXMpO1xuICAgIGJ1cmVhdWNyYXQub24oJ2VuZGVkJywgZnVuY3Rpb24gKCkge1xuICAgICAgY2xhc3Nlcy5ybShkb211cC5hcmVhLCAnd2stcHJvbXB0LXVwbG9hZGluZycpO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIGJ1cmVhdWNyYXQ7XG5cbiAgICBmdW5jdGlvbiByZWNlaXZlZEltYWdlcyAocmVzdWx0cykge1xuICAgICAgdmFyIGJvZHkgPSByZXN1bHRzWzBdO1xuICAgICAgZG9tLmlucHV0LnZhbHVlID0gYm9keS5ocmVmICsgJyBcIicgKyBib2R5LnRpdGxlICsgJ1wiJztcbiAgICAgIHJlbW92ZSgpO1xuICAgICAgZG9uZSh7XG4gICAgICAgIGRlZmluaXRpb25zOiByZXN1bHRzLm1hcCh0b0RlZmluaXRpb24pLFxuICAgICAgICBhdHRhY2htZW50OiBvcHRpb25zLnR5cGUgPT09ICdhdHRhY2htZW50J1xuICAgICAgfSk7XG4gICAgICBmdW5jdGlvbiB0b0RlZmluaXRpb24gKHJlc3VsdCkge1xuICAgICAgICByZXR1cm4gcmVzdWx0LmhyZWYgKyAnIFwiJyArIHJlc3VsdC50aXRsZSArICdcIic7XG4gICAgICB9XG4gICAgfSAqL1xuICB9XG5cbiAgZnVuY3Rpb24gaGFuZGxlRHJhZ092ZXIgKGUpIHtcbiAgICBzdG9wKGUpO1xuICAgIGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVGaWxlU2VsZWN0IChlKSB7XG4gICAgZHJhZ3N0b3AoKTtcbiAgICBzdG9wKGUpO1xuICAgIGJ1cmVhdWNyYXQuc3VibWl0KGUuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHByb21wdDtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuLi9jbGFzc2VzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBhYyA9ICdhcHBlbmRDaGlsZCc7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBlICh0eXBlLCBjbHMsIHRleHQpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNscztcbiAgaWYgKHRleHQpIHtcbiAgICBlbC50ZXh0Q29udGVudCA9IHRleHQ7XG4gIH1cbiAgcmV0dXJuIGVsO1xufVxuXG5mdW5jdGlvbiByZW5kZXIgKG9wdGlvbnMpIHtcbiAgdmFyIGRvbSA9IHtcbiAgICBkaWFsb2c6IGUoJ2FydGljbGUnLCAnd2stcHJvbXB0ICcgKyBvcHRpb25zLmlkKSxcbiAgICBjbG9zZTogZSgnYScsICd3ay1wcm9tcHQtY2xvc2UnKSxcbiAgICBoZWFkZXI6IGUoJ2hlYWRlcicsICd3ay1wcm9tcHQtaGVhZGVyJyksXG4gICAgaDE6IGUoJ2gxJywgJ3drLXByb21wdC10aXRsZScsIG9wdGlvbnMudGl0bGUpLFxuICAgIHNlY3Rpb246IGUoJ3NlY3Rpb24nLCAnd2stcHJvbXB0LWJvZHknKSxcbiAgICBkZXNjOiBlKCdwJywgJ3drLXByb21wdC1kZXNjcmlwdGlvbicsIG9wdGlvbnMuZGVzY3JpcHRpb24pLFxuICAgIGlucHV0Q29udGFpbmVyOiBlKCdkaXYnLCAnd2stcHJvbXB0LWlucHV0LWNvbnRhaW5lcicpLFxuICAgIGlucHV0OiBlKCdpbnB1dCcsICd3ay1wcm9tcHQtaW5wdXQnKSxcbiAgICBjYW5jZWw6IGUoJ2J1dHRvbicsICd3ay1wcm9tcHQtY2FuY2VsJywgJ0NhbmNlbCcpLFxuICAgIG9rOiBlKCdidXR0b24nLCAnd2stcHJvbXB0LW9rJywgJ09rJyksXG4gICAgZm9vdGVyOiBlKCdmb290ZXInLCAnd2stcHJvbXB0LWJ1dHRvbnMnKVxuICB9O1xuICBkb20ub2sudHlwZSA9ICdidXR0b24nO1xuICBkb20uaGVhZGVyW2FjXShkb20uaDEpO1xuICBkb20uc2VjdGlvblthY10oZG9tLmRlc2MpO1xuICBkb20uc2VjdGlvblthY10oZG9tLmlucHV0Q29udGFpbmVyKTtcbiAgZG9tLmlucHV0Q29udGFpbmVyW2FjXShkb20uaW5wdXQpO1xuICBkb20uaW5wdXQucGxhY2Vob2xkZXIgPSBvcHRpb25zLnBsYWNlaG9sZGVyO1xuICBkb20uY2FuY2VsLnR5cGUgPSAnYnV0dG9uJztcbiAgZG9tLmZvb3RlclthY10oZG9tLmNhbmNlbCk7XG4gIGRvbS5mb290ZXJbYWNdKGRvbS5vayk7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5jbG9zZSk7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5oZWFkZXIpO1xuICBkb20uZGlhbG9nW2FjXShkb20uc2VjdGlvbik7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5mb290ZXIpO1xuICBkb2MuYm9keVthY10oZG9tLmRpYWxvZyk7XG4gIHJldHVybiBkb207XG59XG5cbmZ1bmN0aW9uIHVwbG9hZHMgKGRvbSwgd2FybmluZykge1xuICB2YXIgZnVwID0gJ3drLXByb21wdC1maWxldXBsb2FkJztcbiAgdmFyIGRvbXVwID0ge1xuICAgIGFyZWE6IGUoJ3NlY3Rpb24nLCAnd2stcHJvbXB0LXVwbG9hZC1hcmVhJyksXG4gICAgd2FybmluZzogZSgncCcsICd3ay1wcm9tcHQtZXJyb3Igd2std2FybmluZycsIHdhcm5pbmcpLFxuICAgIGZhaWxlZDogZSgncCcsICd3ay1wcm9tcHQtZXJyb3Igd2stZmFpbGVkJywgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZGZhaWxlZCksXG4gICAgdXBsb2FkOiBlKCdsYWJlbCcsICd3ay1wcm9tcHQtdXBsb2FkJyksXG4gICAgdXBsb2FkaW5nOiBlKCdzcGFuJywgJ3drLXByb21wdC1wcm9ncmVzcycsIHN0cmluZ3MucHJvbXB0cy51cGxvYWRpbmcpLFxuICAgIGRyb3A6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LWRyb3AnLCBzdHJpbmdzLnByb21wdHMuZHJvcCksXG4gICAgZHJvcGljb246IGUoJ3AnLCAnd2stZHJvcC1pY29uIHdrLXByb21wdC1kcm9wLWljb24nKSxcbiAgICBicm93c2U6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LWJyb3dzZScsIHN0cmluZ3MucHJvbXB0cy5icm93c2UpLFxuICAgIGRyYWdkcm9wOiBlKCdwJywgJ3drLXByb21wdC1kcmFnZHJvcCcsIHN0cmluZ3MucHJvbXB0cy5kcm9waGludCksXG4gICAgZmlsZWlucHV0OiBlKCdpbnB1dCcsIGZ1cClcbiAgfTtcbiAgZG9tdXAuYXJlYVthY10oZG9tdXAuZHJvcCk7XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLnVwbG9hZGluZyk7XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLmRyb3BpY29uKTtcbiAgZG9tdXAudXBsb2FkW2FjXShkb211cC5icm93c2UpO1xuICBkb211cC51cGxvYWRbYWNdKGRvbXVwLmZpbGVpbnB1dCk7XG4gIGRvbXVwLmZpbGVpbnB1dC5pZCA9IGZ1cDtcbiAgZG9tdXAuZmlsZWlucHV0LnR5cGUgPSAnZmlsZSc7XG4gIGRvbXVwLmZpbGVpbnB1dC5tdWx0aXBsZSA9ICdtdWx0aXBsZSc7XG4gIGRvbS5kaWFsb2cuY2xhc3NOYW1lICs9ICcgd2stcHJvbXB0LXVwbG9hZHMnO1xuICBkb20uaW5wdXRDb250YWluZXIuY2xhc3NOYW1lICs9ICcgd2stcHJvbXB0LWlucHV0LWNvbnRhaW5lci11cGxvYWRzJztcbiAgZG9tLmlucHV0LmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC1pbnB1dC11cGxvYWRzJztcbiAgZG9tLnNlY3Rpb24uaW5zZXJ0QmVmb3JlKGRvbXVwLndhcm5pbmcsIGRvbS5pbnB1dENvbnRhaW5lcik7XG4gIGRvbS5zZWN0aW9uLmluc2VydEJlZm9yZShkb211cC5mYWlsZWQsIGRvbS5pbnB1dENvbnRhaW5lcik7XG4gIGRvbS5zZWN0aW9uW2FjXShkb211cC51cGxvYWQpO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAuZHJhZ2Ryb3ApO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAuYXJlYSk7XG4gIGRvbS5kZXNjLnRleHRDb250ZW50ID0gZG9tLmRlc2MudGV4dENvbnRlbnQgKyBzdHJpbmdzLnByb21wdHMudXBsb2FkO1xuICBkb211cC5maWxlaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignZm9jdXMnLCBmb2N1c2VkRmlsZUlucHV0KTtcbiAgZG9tdXAuZmlsZWlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCBibHVycmVkRmlsZUlucHV0KTtcblxuICBmdW5jdGlvbiBmb2N1c2VkRmlsZUlucHV0ICgpIHtcbiAgICBjbGFzc2VzLmFkZChkb211cC51cGxvYWQsICd3ay1mb2N1c2VkJyk7XG4gIH1cbiAgZnVuY3Rpb24gYmx1cnJlZEZpbGVJbnB1dCAoKSB7XG4gICAgY2xhc3Nlcy5ybShkb211cC51cGxvYWQsICd3ay1mb2N1c2VkJyk7XG4gIH1cbiAgcmV0dXJuIGRvbXVwO1xufVxuXG5yZW5kZXIudXBsb2FkcyA9IHVwbG9hZHM7XG5tb2R1bGUuZXhwb3J0cyA9IHJlbmRlcjtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5d2NtOXRjSFJ6TDNKbGJtUmxjaTVxY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pTzBGQlFVRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmpiR0Z6YzJWeklEMGdjbVZ4ZFdseVpTZ25MaTR2WTJ4aGMzTmxjeWNwTzF4dWRtRnlJSE4wY21sdVozTWdQU0J5WlhGMWFYSmxLQ2N1TGk5emRISnBibWR6SnlrN1hHNTJZWElnWVdNZ1BTQW5ZWEJ3Wlc1a1EyaHBiR1FuTzF4dWRtRnlJR1J2WXlBOUlHZHNiMkpoYkM1a2IyTjFiV1Z1ZER0Y2JseHVablZ1WTNScGIyNGdaU0FvZEhsd1pTd2dZMnh6TENCMFpYaDBLU0I3WEc0Z0lIWmhjaUJsYkNBOUlHUnZZeTVqY21WaGRHVkZiR1Z0Wlc1MEtIUjVjR1VwTzF4dUlDQmxiQzVqYkdGemMwNWhiV1VnUFNCamJITTdYRzRnSUdsbUlDaDBaWGgwS1NCN1hHNGdJQ0FnWld3dWRHVjRkRU52Ym5SbGJuUWdQU0IwWlhoME8xeHVJQ0I5WEc0Z0lISmxkSFZ5YmlCbGJEdGNibjFjYmx4dVpuVnVZM1JwYjI0Z2NtVnVaR1Z5SUNodmNIUnBiMjV6S1NCN1hHNGdJSFpoY2lCa2IyMGdQU0I3WEc0Z0lDQWdaR2xoYkc5bk9pQmxLQ2RoY25ScFkyeGxKeXdnSjNkckxYQnliMjF3ZENBbklDc2diM0IwYVc5dWN5NXBaQ2tzWEc0Z0lDQWdZMnh2YzJVNklHVW9KMkVuTENBbmQyc3RjSEp2YlhCMExXTnNiM05sSnlrc1hHNGdJQ0FnYUdWaFpHVnlPaUJsS0Nkb1pXRmtaWEluTENBbmQyc3RjSEp2YlhCMExXaGxZV1JsY2ljcExGeHVJQ0FnSUdneE9pQmxLQ2RvTVNjc0lDZDNheTF3Y205dGNIUXRkR2wwYkdVbkxDQnZjSFJwYjI1ekxuUnBkR3hsS1N4Y2JpQWdJQ0J6WldOMGFXOXVPaUJsS0NkelpXTjBhVzl1Snl3Z0ozZHJMWEJ5YjIxd2RDMWliMlI1Snlrc1hHNGdJQ0FnWkdWell6b2daU2duY0Njc0lDZDNheTF3Y205dGNIUXRaR1Z6WTNKcGNIUnBiMjRuTENCdmNIUnBiMjV6TG1SbGMyTnlhWEIwYVc5dUtTeGNiaUFnSUNCcGJuQjFkRU52Ym5SaGFXNWxjam9nWlNnblpHbDJKeXdnSjNkckxYQnliMjF3ZEMxcGJuQjFkQzFqYjI1MFlXbHVaWEluS1N4Y2JpQWdJQ0JwYm5CMWREb2daU2duYVc1d2RYUW5MQ0FuZDJzdGNISnZiWEIwTFdsdWNIVjBKeWtzWEc0Z0lDQWdZMkZ1WTJWc09pQmxLQ2RpZFhSMGIyNG5MQ0FuZDJzdGNISnZiWEIwTFdOaGJtTmxiQ2NzSUNkRFlXNWpaV3duS1N4Y2JpQWdJQ0J2YXpvZ1pTZ25ZblYwZEc5dUp5d2dKM2RyTFhCeWIyMXdkQzF2YXljc0lDZFBheWNwTEZ4dUlDQWdJR1p2YjNSbGNqb2daU2duWm05dmRHVnlKeXdnSjNkckxYQnliMjF3ZEMxaWRYUjBiMjV6SnlsY2JpQWdmVHRjYmlBZ1pHOXRMbTlyTG5SNWNHVWdQU0FuWW5WMGRHOXVKenRjYmlBZ1pHOXRMbWhsWVdSbGNsdGhZMTBvWkc5dExtZ3hLVHRjYmlBZ1pHOXRMbk5sWTNScGIyNWJZV05kS0dSdmJTNWtaWE5qS1R0Y2JpQWdaRzl0TG5ObFkzUnBiMjViWVdOZEtHUnZiUzVwYm5CMWRFTnZiblJoYVc1bGNpazdYRzRnSUdSdmJTNXBibkIxZEVOdmJuUmhhVzVsY2x0aFkxMG9aRzl0TG1sdWNIVjBLVHRjYmlBZ1pHOXRMbWx1Y0hWMExuQnNZV05sYUc5c1pHVnlJRDBnYjNCMGFXOXVjeTV3YkdGalpXaHZiR1JsY2p0Y2JpQWdaRzl0TG1OaGJtTmxiQzUwZVhCbElEMGdKMkoxZEhSdmJpYzdYRzRnSUdSdmJTNW1iMjkwWlhKYllXTmRLR1J2YlM1allXNWpaV3dwTzF4dUlDQmtiMjB1Wm05dmRHVnlXMkZqWFNoa2IyMHViMnNwTzF4dUlDQmtiMjB1WkdsaGJHOW5XMkZqWFNoa2IyMHVZMnh2YzJVcE8xeHVJQ0JrYjIwdVpHbGhiRzluVzJGalhTaGtiMjB1YUdWaFpHVnlLVHRjYmlBZ1pHOXRMbVJwWVd4dloxdGhZMTBvWkc5dExuTmxZM1JwYjI0cE8xeHVJQ0JrYjIwdVpHbGhiRzluVzJGalhTaGtiMjB1Wm05dmRHVnlLVHRjYmlBZ1pHOWpMbUp2WkhsYllXTmRLR1J2YlM1a2FXRnNiMmNwTzF4dUlDQnlaWFIxY200Z1pHOXRPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQjFjR3h2WVdSeklDaGtiMjBzSUhkaGNtNXBibWNwSUh0Y2JpQWdkbUZ5SUdaMWNDQTlJQ2QzYXkxd2NtOXRjSFF0Wm1sc1pYVndiRzloWkNjN1hHNGdJSFpoY2lCa2IyMTFjQ0E5SUh0Y2JpQWdJQ0JoY21WaE9pQmxLQ2R6WldOMGFXOXVKeXdnSjNkckxYQnliMjF3ZEMxMWNHeHZZV1F0WVhKbFlTY3BMRnh1SUNBZ0lIZGhjbTVwYm1jNklHVW9KM0FuTENBbmQyc3RjSEp2YlhCMExXVnljbTl5SUhkckxYZGhjbTVwYm1jbkxDQjNZWEp1YVc1bktTeGNiaUFnSUNCbVlXbHNaV1E2SUdVb0ozQW5MQ0FuZDJzdGNISnZiWEIwTFdWeWNtOXlJSGRyTFdaaGFXeGxaQ2NzSUhOMGNtbHVaM011Y0hKdmJYQjBjeTUxY0d4dllXUm1ZV2xzWldRcExGeHVJQ0FnSUhWd2JHOWhaRG9nWlNnbmJHRmlaV3duTENBbmQyc3RjSEp2YlhCMExYVndiRzloWkNjcExGeHVJQ0FnSUhWd2JHOWhaR2x1WnpvZ1pTZ25jM0JoYmljc0lDZDNheTF3Y205dGNIUXRjSEp2WjNKbGMzTW5MQ0J6ZEhKcGJtZHpMbkJ5YjIxd2RITXVkWEJzYjJGa2FXNW5LU3hjYmlBZ0lDQmtjbTl3T2lCbEtDZHpjR0Z1Snl3Z0ozZHJMWEJ5YjIxd2RDMWtjbTl3Snl3Z2MzUnlhVzVuY3k1d2NtOXRjSFJ6TG1SeWIzQXBMRnh1SUNBZ0lHUnliM0JwWTI5dU9pQmxLQ2R3Snl3Z0ozZHJMV1J5YjNBdGFXTnZiaUIzYXkxd2NtOXRjSFF0WkhKdmNDMXBZMjl1Snlrc1hHNGdJQ0FnWW5KdmQzTmxPaUJsS0NkemNHRnVKeXdnSjNkckxYQnliMjF3ZEMxaWNtOTNjMlVuTENCemRISnBibWR6TG5CeWIyMXdkSE11WW5KdmQzTmxLU3hjYmlBZ0lDQmtjbUZuWkhKdmNEb2daU2duY0Njc0lDZDNheTF3Y205dGNIUXRaSEpoWjJSeWIzQW5MQ0J6ZEhKcGJtZHpMbkJ5YjIxd2RITXVaSEp2Y0docGJuUXBMRnh1SUNBZ0lHWnBiR1ZwYm5CMWREb2daU2duYVc1d2RYUW5MQ0JtZFhBcFhHNGdJSDA3WEc0Z0lHUnZiWFZ3TG1GeVpXRmJZV05kS0dSdmJYVndMbVJ5YjNBcE8xeHVJQ0JrYjIxMWNDNWhjbVZoVzJGalhTaGtiMjExY0M1MWNHeHZZV1JwYm1jcE8xeHVJQ0JrYjIxMWNDNWhjbVZoVzJGalhTaGtiMjExY0M1a2NtOXdhV052YmlrN1hHNGdJR1J2YlhWd0xuVndiRzloWkZ0aFkxMG9aRzl0ZFhBdVluSnZkM05sS1R0Y2JpQWdaRzl0ZFhBdWRYQnNiMkZrVzJGalhTaGtiMjExY0M1bWFXeGxhVzV3ZFhRcE8xeHVJQ0JrYjIxMWNDNW1hV3hsYVc1d2RYUXVhV1FnUFNCbWRYQTdYRzRnSUdSdmJYVndMbVpwYkdWcGJuQjFkQzUwZVhCbElEMGdKMlpwYkdVbk8xeHVJQ0JrYjIxMWNDNW1hV3hsYVc1d2RYUXViWFZzZEdsd2JHVWdQU0FuYlhWc2RHbHdiR1VuTzF4dUlDQmtiMjB1WkdsaGJHOW5MbU5zWVhOelRtRnRaU0FyUFNBbklIZHJMWEJ5YjIxd2RDMTFjR3h2WVdSekp6dGNiaUFnWkc5dExtbHVjSFYwUTI5dWRHRnBibVZ5TG1Oc1lYTnpUbUZ0WlNBclBTQW5JSGRyTFhCeWIyMXdkQzFwYm5CMWRDMWpiMjUwWVdsdVpYSXRkWEJzYjJGa2N5YzdYRzRnSUdSdmJTNXBibkIxZEM1amJHRnpjMDVoYldVZ0t6MGdKeUIzYXkxd2NtOXRjSFF0YVc1d2RYUXRkWEJzYjJGa2N5YzdYRzRnSUdSdmJTNXpaV04wYVc5dUxtbHVjMlZ5ZEVKbFptOXlaU2hrYjIxMWNDNTNZWEp1YVc1bkxDQmtiMjB1YVc1d2RYUkRiMjUwWVdsdVpYSXBPMXh1SUNCa2IyMHVjMlZqZEdsdmJpNXBibk5sY25SQ1pXWnZjbVVvWkc5dGRYQXVabUZwYkdWa0xDQmtiMjB1YVc1d2RYUkRiMjUwWVdsdVpYSXBPMXh1SUNCa2IyMHVjMlZqZEdsdmJsdGhZMTBvWkc5dGRYQXVkWEJzYjJGa0tUdGNiaUFnWkc5dExuTmxZM1JwYjI1YllXTmRLR1J2YlhWd0xtUnlZV2RrY205d0tUdGNiaUFnWkc5dExuTmxZM1JwYjI1YllXTmRLR1J2YlhWd0xtRnlaV0VwTzF4dUlDQmtiMjB1WkdWell5NTBaWGgwUTI5dWRHVnVkQ0E5SUdSdmJTNWtaWE5qTG5SbGVIUkRiMjUwWlc1MElDc2djM1J5YVc1bmN5NXdjbTl0Y0hSekxuVndiRzloWkR0Y2JpQWdaRzl0ZFhBdVptbHNaV2x1Y0hWMExtRmtaRVYyWlc1MFRHbHpkR1Z1WlhJb0oyWnZZM1Z6Snl3Z1ptOWpkWE5sWkVacGJHVkpibkIxZENrN1hHNGdJR1J2YlhWd0xtWnBiR1ZwYm5CMWRDNWhaR1JGZG1WdWRFeHBjM1JsYm1WeUtDZGliSFZ5Snl3Z1lteDFjbkpsWkVacGJHVkpibkIxZENrN1hHNWNiaUFnWm5WdVkzUnBiMjRnWm05amRYTmxaRVpwYkdWSmJuQjFkQ0FvS1NCN1hHNGdJQ0FnWTJ4aGMzTmxjeTVoWkdRb1pHOXRkWEF1ZFhCc2IyRmtMQ0FuZDJzdFptOWpkWE5sWkNjcE8xeHVJQ0I5WEc0Z0lHWjFibU4wYVc5dUlHSnNkWEp5WldSR2FXeGxTVzV3ZFhRZ0tDa2dlMXh1SUNBZ0lHTnNZWE56WlhNdWNtMG9aRzl0ZFhBdWRYQnNiMkZrTENBbmQyc3RabTlqZFhObFpDY3BPMXh1SUNCOVhHNGdJSEpsZEhWeWJpQmtiMjExY0R0Y2JuMWNibHh1Y21WdVpHVnlMblZ3Ykc5aFpITWdQU0IxY0d4dllXUnpPMXh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0J5Wlc1a1pYSTdYRzRpWFgwPSIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcblxuZnVuY3Rpb24gY29tbWFuZHMgKGVsLCBpZCkge1xuICBlbC50ZXh0Q29udGVudCA9IHN0cmluZ3MuYnV0dG9uc1tpZF0gfHwgaWQ7XG59XG5cbmZ1bmN0aW9uIG1vZGVzIChlbCwgaWQpIHtcbiAgZWwudGV4dENvbnRlbnQgPSBzdHJpbmdzLm1vZGVzW2lkXSB8fCBpZDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1vZGVzOiBtb2RlcyxcbiAgY29tbWFuZHM6IGNvbW1hbmRzXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBTaG9ydGN1dE1hbmFnZXIoZWxlbWVudCkge1xuICB0aGlzLmJvdW5kSGFuZGxlciA9IHRoaXMuaGFuZGxlRXZlbnQuYmluZCh0aGlzKTtcbiAgdGhpcy5oYW5kbGVycyA9IHt9O1xuICBpZihlbGVtZW50KSB7XG4gICAgdGhpcy5hdHRhY2goZWxlbWVudCk7XG4gIH1cbn1cblxuU2hvcnRjdXRNYW5hZ2VyLnByb3RvdHlwZS5hdHRhY2ggPSBmdW5jdGlvbiAoZWwpIHtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuYm91bmRIYW5kbGVyLCBmYWxzZSk7XG59O1xuXG5TaG9ydGN1dE1hbmFnZXIucHJvdG90eXBlLmRldGFjaCA9IGZ1bmN0aW9uIChlbCkge1xuICBlbC5yZW1vdmVFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5ib3VuZEhhbmRsZXIsIGZhbHNlKTtcbn07XG5cblNob3J0Y3V0TWFuYWdlci5wcm90b3R5cGUuYWRkID0gZnVuY3Rpb24gKGtleSwgc2hpZnQsIGZuKSB7XG4gIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBmbiA9IHNoaWZ0O1xuICAgIHNoaWZ0ID0gZmFsc2U7XG4gIH1cblxuICBpZighdGhpcy5oYW5kbGVyc1trZXldKSB7IHRoaXMuaGFuZGxlcnNba2V5XSA9IFtdOyB9XG4gIHRoaXMuaGFuZGxlcnNba2V5XS5wdXNoKHtcbiAgICBzaGlmdDogISFzaGlmdCxcbiAgICBmbjogZm4sXG4gIH0pO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuU2hvcnRjdXRNYW5hZ2VyLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbiAoa2V5LCBzaGlmdCwgZm4pIHtcbiAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGZuID0gc2hpZnQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICBpZih0aGlzLmhhbmRsZXJzW2tleV0gJiYgdGhpcy5oYW5kbGVyc1trZXldLmxlbmd0aCkge1xuICAgIHZhciBoID0gMCxcbiAgICAgIGwgPSB0aGlzLmhhbmRsZXJzW2tleV0ubGVuZ3RoO1xuICAgIGZvcig7IGggPCBsOyBoKyspIHtcbiAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5oYW5kbGVyc1trZXldW2hdO1xuICAgICAgaWYoaGFuZGxlci5mbiA9PT0gZm4gJiYgKHR5cGVvZiBzaGlmdCA9PT0gJ3VuZGVmaW5lZCcgfHwgaGFuZGxlci5zaGlmdCA9PT0gc2hpZnQpKSB7XG4gICAgICAgIC8vIE1hdGNoLCBkb24ndCBuZWVkIHRvIHByb2Nlc3MgYW55bW9yZVxuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihoIDwgbCkge1xuICAgICAgLy8gV2UgZm91bmQgYSBtYXRjaCwgc3BsaWNlIGl0IG91dFxuICAgICAgdGhpcy5oYW5sZGVycy5zcGxpY2UoaCwgMSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5TaG9ydGN1dE1hbmFnZXIucHJvdG90eXBlLmNsZWFyID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmhhbmRsZXJzID0ge307XG59O1xuXG5TaG9ydGN1dE1hbmFnZXIucHJvdG90eXBlLmhhbmRsZUV2ZW50ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gIGlmKGV2ZW50LmN0cmxLZXkgfHwgZXZlbnQubWV0YUtleSkge1xuICAgIHZhciBjaCA9IGV2ZW50LmtleTtcblxuICAgIGlmKGNoICYmIHRoaXMuaGFuZGxlcnNbY2hdKSB7XG4gICAgICBmb3IodmFyIGggPSAwLCBsID0gdGhpcy5oYW5kbGVyc1tjaF0ubGVuZ3RoOyBoIDwgbDsgaCsrKSB7XG4gICAgICAgIHZhciBoYW5kbGVyID0gdGhpcy5oYW5kbGVyc1tjaF1baF07XG5cbiAgICAgICAgaWYoZXZlbnQuc2hpZnRLZXkgPT09IGhhbmRsZXIuc2hpZnQpIHtcbiAgICAgICAgICAvLyBIYW5kbGUgZXZlbnRcbiAgICAgICAgICBoYW5kbGVyLmZuKGV2ZW50KTtcbiAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICB9XG4gICAgICB9IC8vIEVuZCBmb3IgbG9vcFxuICAgIH0gLy8gRW5kIGhhbmRsZXIgYXJyYXkgY2hlY2tcbiAgfS8vIEVuZCBDVFJML0NNRCBjaGVja1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTaG9ydGN1dE1hbmFnZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBwbGFjZWhvbGRlcnM6IHtcbiAgICBib2xkOiAnc3Ryb25nIHRleHQnLFxuICAgIGl0YWxpYzogJ2VtcGhhc2l6ZWQgdGV4dCcsXG4gICAgcXVvdGU6ICdxdW90ZWQgdGV4dCcsXG4gICAgY29kZTogJ2NvZGUgZ29lcyBoZXJlJyxcbiAgICBsaXN0aXRlbTogJ2xpc3QgaXRlbScsXG4gICAgaGVhZGluZzogJ0hlYWRpbmcgVGV4dCcsXG4gICAgbGluazogJ2VudGVyIGxpbmsgZGVzY3JpcHRpb24nLFxuICAgIGltYWdlOiAnaW1hZ2UgZGVzY3JpcHRpb24nLFxuICAgIGF0dGFjaG1lbnQ6ICdhdHRhY2htZW50IGRlc2NyaXB0aW9uJ1xuICB9LFxuICB0aXRsZXM6IHtcbiAgICBib2xkOiAnU3Ryb25nIDxzdHJvbmc+IEN0cmwrQicsXG4gICAgaXRhbGljOiAnRW1waGFzaXMgPGVtPiBDdHJsK0knLFxuICAgIHF1b3RlOiAnQmxvY2txdW90ZSA8YmxvY2txdW90ZT4gQ3RybCtKJyxcbiAgICBjb2RlOiAnQ29kZSBTYW1wbGUgPHByZT48Y29kZT4gQ3RybCtFJyxcbiAgICBvbDogJ051bWJlcmVkIExpc3QgPG9sPiBDdHJsK08nLFxuICAgIHVsOiAnQnVsbGV0ZWQgTGlzdCA8dWw+IEN0cmwrVScsXG4gICAgaGVhZGluZzogJ0hlYWRpbmcgPGgxPiwgPGgyPiwgLi4uIEN0cmwrRCcsXG4gICAgbGluazogJ0h5cGVybGluayA8YT4gQ3RybCtLJyxcbiAgICBpbWFnZTogJ0ltYWdlIDxpbWc+IEN0cmwrRycsXG4gICAgYXR0YWNobWVudDogJ0F0dGFjaG1lbnQgQ3RybCtTaGlmdCtLJyxcbiAgICBtYXJrZG93bjogJ01hcmtkb3duIE1vZGUgQ3RybCtNJyxcbiAgICBodG1sOiAnSFRNTCBNb2RlIEN0cmwrSCcsXG4gICAgd3lzaXd5ZzogJ1ByZXZpZXcgTW9kZSBDdHJsK1AnXG4gIH0sXG4gIGJ1dHRvbnM6IHtcbiAgICBib2xkOiAnQicsXG4gICAgaXRhbGljOiAnSScsXG4gICAgcXVvdGU6ICdcXHUyMDFjJyxcbiAgICBjb2RlOiAnPC8+JyxcbiAgICBvbDogJzEuJyxcbiAgICB1bDogJ1xcdTI5QkYnLFxuICAgIGhlYWRpbmc6ICdUdCcsXG4gICAgbGluazogJ0xpbmsnLFxuICAgIGltYWdlOiAnSW1hZ2UnLFxuICAgIGF0dGFjaG1lbnQ6ICdBdHRhY2htZW50JyxcbiAgICBocjogJ1xcdTIxYjUnXG4gIH0sXG4gIHByb21wdHM6IHtcbiAgICBsaW5rOiB7XG4gICAgICB0aXRsZTogJ0luc2VydCBMaW5rJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVHlwZSBvciBwYXN0ZSB0aGUgdXJsIHRvIHlvdXIgbGluaycsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS8gXCJ0aXRsZVwiJ1xuICAgIH0sXG4gICAgaW1hZ2U6IHtcbiAgICAgIHRpdGxlOiAnSW5zZXJ0IEltYWdlJyxcbiAgICAgIGRlc2NyaXB0aW9uOiAnRW50ZXIgdGhlIHVybCB0byB5b3VyIGltYWdlJyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnaHR0cDovL2V4YW1wbGUuY29tL3B1YmxpYy9pbWFnZS5wbmcgXCJ0aXRsZVwiJ1xuICAgIH0sXG4gICAgYXR0YWNobWVudDoge1xuICAgICAgdGl0bGU6ICdBdHRhY2ggRmlsZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VudGVyIHRoZSB1cmwgdG8geW91ciBhdHRhY2htZW50JyxcbiAgICAgIHBsYWNlaG9sZGVyOiAnaHR0cDovL2V4YW1wbGUuY29tL3B1YmxpYy9yZXBvcnQucGRmIFwidGl0bGVcIidcbiAgICB9LFxuICAgIHR5cGVzOiAnWW91IGNhbiBvbmx5IHVwbG9hZCAnLFxuICAgIGJyb3dzZTogJ0Jyb3dzZS4uLicsXG4gICAgZHJvcGhpbnQ6ICdZb3UgY2FuIGFsc28gZHJhZyBmaWxlcyBmcm9tIHlvdXIgY29tcHV0ZXIgYW5kIGRyb3AgdGhlbSBoZXJlIScsXG4gICAgZHJvcDogJ0Ryb3AgeW91ciBmaWxlIGhlcmUgdG8gYmVnaW4gdXBsb2FkLi4uJyxcbiAgICB1cGxvYWQ6ICcsIG9yIHVwbG9hZCBhIGZpbGUnLFxuICAgIHVwbG9hZGluZzogJ1VwbG9hZGluZyB5b3VyIGZpbGUuLi4nLFxuICAgIHVwbG9hZGZhaWxlZDogJ1RoZSB1cGxvYWQgZmFpbGVkISBUaGF0XFwncyBhbGwgd2Uga25vdy4nXG4gIH0sXG4gIG1vZGVzOiB7XG4gICAgd3lzaXd5ZzogJ3d5c2l3eWcnLFxuICAgIG1hcmtkb3duOiAnbVxcdTIxOTMnLFxuICB9LFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuL2NsYXNzZXMnKTtcbnZhciBkcmFnQ2xhc3MgPSAnd2stZHJhZ2dpbmcnO1xudmFyIGRyYWdDbGFzc1NwZWNpZmljID0gJ3drLWNvbnRhaW5lci1kcmFnZ2luZyc7XG52YXIgcm9vdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxuZnVuY3Rpb24gdXBsb2FkcyAoY29udGFpbmVyLCBkcm9wYXJlYSwgZWRpdG9yLCBvcHRpb25zLCByZW1vdmUpIHtcbiAgdmFyIG9wID0gcmVtb3ZlID8gJ3JlbW92ZScgOiAnYWRkJztcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdlbnRlcicsIGRyYWdnaW5nKTtcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdlbmQnLCBkcmFnc3RvcCk7XG4gIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdtb3VzZW91dCcsIGRyYWdzdG9wKTtcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdvdmVyJywgaGFuZGxlRHJhZ092ZXIsIGZhbHNlKTtcbiAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2Ryb3AnLCBoYW5kbGVGaWxlU2VsZWN0LCBmYWxzZSk7XG5cbiAgZnVuY3Rpb24gZHJhZ2dpbmcgKCkge1xuICAgIGNsYXNzZXMuYWRkKGRyb3BhcmVhLCBkcmFnQ2xhc3MpO1xuICAgIGNsYXNzZXMuYWRkKGRyb3BhcmVhLCBkcmFnQ2xhc3NTcGVjaWZpYyk7XG4gIH1cbiAgZnVuY3Rpb24gZHJhZ3N0b3AgKCkge1xuICAgIGRyYWdzdG9wcGVyKGRyb3BhcmVhKTtcbiAgfVxuICBmdW5jdGlvbiBoYW5kbGVEcmFnT3ZlciAoZSkge1xuICAgIHN0b3AoZSk7XG4gICAgZHJhZ2dpbmcoKTtcbiAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuICB9XG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVTZWxlY3QgKGUpIHtcbiAgICBkcmFnc3RvcCgpO1xuICAgIHN0b3AoZSk7XG4gICAgZWRpdG9yLnJ1bkNvbW1hbmQoZnVuY3Rpb24gcnVubmVyIChjaHVua3MsIG1vZGUpIHtcbiAgICAgIHZhciBmaWxlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGUuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIHZhciB0eXBlID0gaW5mZXJUeXBlKGZpbGVzKTtcbiAgICAgIGVkaXRvci5saW5rT3JJbWFnZU9yQXR0YWNobWVudCh0eXBlLCBmaWxlcykuY2FsbCh0aGlzLCBtb2RlLCBjaHVua3MpO1xuICAgIH0pO1xuICB9XG4gIGZ1bmN0aW9uIGluZmVyVHlwZSAoZmlsZXMpIHtcbiAgICBpZiAob3B0aW9ucy5pbWFnZXMgJiYgIW9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIH1cbiAgICBpZiAoIW9wdGlvbnMuaW1hZ2VzICYmIG9wdGlvbnMuYXR0YWNobWVudHMpIHtcbiAgICAgIHJldHVybiAnYXR0YWNobWVudCc7XG4gICAgfVxuICAgIGlmIChmaWxlcy5ldmVyeShtYXRjaGVzKG9wdGlvbnMuaW1hZ2VzLnZhbGlkYXRlIHx8IG5ldmVyKSkpIHtcbiAgICAgIHJldHVybiAnaW1hZ2UnO1xuICAgIH1cbiAgICByZXR1cm4gJ2F0dGFjaG1lbnQnO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBtYXRjaGVyIChmaWxlKSB7IHJldHVybiBmbihmaWxlKTsgfTtcbn1cbmZ1bmN0aW9uIG5ldmVyICgpIHtcbiAgcmV0dXJuIGZhbHNlO1xufVxuZnVuY3Rpb24gc3RvcCAoZSkge1xuICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICBlLnByZXZlbnREZWZhdWx0KCk7XG59XG5mdW5jdGlvbiBkcmFnc3RvcHBlciAoZHJvcGFyZWEpIHtcbiAgY2xhc3Nlcy5ybShkcm9wYXJlYSwgZHJhZ0NsYXNzKTtcbiAgY2xhc3Nlcy5ybShkcm9wYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xufVxuXG51cGxvYWRzLnN0b3AgPSBkcmFnc3RvcHBlcjtcbm1vZHVsZS5leHBvcnRzID0gdXBsb2FkcztcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gT2JqZWN0LmFzc2lnbiBwb2x5ZmlsbFxuLy8gSWdub3JlIFBvbHlmaWxsIGNvZGUgZm9yIGxpbnRpbmcgKG92ZXJyaWRpbmcgZ2xvYmFscyBoZXJlIGlzIGV4cGVjdGVkKVxuLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuaWYgKHR5cGVvZiBPYmplY3QuYXNzaWduICE9ICdmdW5jdGlvbicpIHtcbiAgLy8gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvSmF2YVNjcmlwdC9SZWZlcmVuY2UvR2xvYmFsX09iamVjdHMvT2JqZWN0L2Fzc2lnblxuICBPYmplY3QuYXNzaWduID0gZnVuY3Rpb24odGFyZ2V0LCB2YXJBcmdzKSB7IC8vIC5sZW5ndGggb2YgZnVuY3Rpb24gaXMgMlxuICAgIGlmICh0YXJnZXQgPT09IG51bGwgfHwgdGFyZ2V0ID09PSB1bmRlZmluZWQpIHsgLy8gVHlwZUVycm9yIGlmIHVuZGVmaW5lZCBvciBudWxsXG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCB1bmRlZmluZWQgb3IgbnVsbCB0byBvYmplY3QnKTtcbiAgICB9XG5cbiAgICB2YXIgdG8gPSBPYmplY3QodGFyZ2V0KTtcblxuICAgIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICB2YXIgbmV4dFNvdXJjZSA9IGFyZ3VtZW50c1tpbmRleF07XG5cbiAgICAgIGlmIChuZXh0U291cmNlICE9PSBudWxsICYmIG5leHRTb3VyY2UgIT09IHVuZGVmaW5lZCkgeyAvLyBTa2lwIG92ZXIgaWYgdW5kZWZpbmVkIG9yIG51bGxcbiAgICAgICAgZm9yICh2YXIgbmV4dEtleSBpbiBuZXh0U291cmNlKSB7XG4gICAgICAgICAgLy8gQXZvaWQgYnVncyB3aGVuIGhhc093blByb3BlcnR5IGlzIHNoYWRvd2VkXG4gICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChuZXh0U291cmNlLCBuZXh0S2V5KSkge1xuICAgICAgICAgICAgdG9bbmV4dEtleV0gPSBuZXh0U291cmNlW25leHRLZXldO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdG87XG4gIH07XG59XG5cbi8vIEN1c3RvbSBFdmVudCBDb25zdHJ1Y3RvciBQb2x5ZmlsbFxuKGZ1bmN0aW9uICgpIHtcbiAgaWYgKCB0eXBlb2Ygd2luZG93LkN1c3RvbUV2ZW50ID09PSBcImZ1bmN0aW9uXCIgKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGZ1bmN0aW9uIEN1c3RvbUV2ZW50ICggZXZlbnQsIHBhcmFtcyApIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UsIGRldGFpbDogdW5kZWZpbmVkIH07XG4gICAgdmFyIGV2dCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCAnQ3VzdG9tRXZlbnQnICk7XG4gICAgZXZ0LmluaXRDdXN0b21FdmVudCggZXZlbnQsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgcGFyYW1zLmRldGFpbCApO1xuICAgIHJldHVybiBldnQ7XG4gICB9XG5cbiAgQ3VzdG9tRXZlbnQucHJvdG90eXBlID0gd2luZG93LkV2ZW50LnByb3RvdHlwZTtcblxuICB3aW5kb3cuQ3VzdG9tRXZlbnQgPSBDdXN0b21FdmVudDtcbn0pKCk7XG5cbi8vIE1vdXNlIEV2ZW50IENvbnN0cnVjdG9yIFBvbHlmaWxsXG4oZnVuY3Rpb24gKHdpbmRvdykge1xuICB0cnkge1xuICAgIG5ldyBNb3VzZUV2ZW50KCd0ZXN0Jyk7XG4gICAgcmV0dXJuIGZhbHNlOyAvLyBObyBuZWVkIHRvIHBvbHlmaWxsXG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBOZWVkIHRvIHBvbHlmaWxsIC0gZmFsbCB0aHJvdWdoXG4gIH1cblxuICAvLyBQb2x5ZmlsbHMgRE9NNCBNb3VzZUV2ZW50XG5cbiAgdmFyIE1vdXNlRXZlbnQgPSBmdW5jdGlvbiAoZXZlbnRUeXBlLCBwYXJhbXMpIHtcbiAgICBwYXJhbXMgPSBwYXJhbXMgfHwgeyBidWJibGVzOiBmYWxzZSwgY2FuY2VsYWJsZTogZmFsc2UgfTtcbiAgICB2YXIgbW91c2VFdmVudCA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdNb3VzZUV2ZW50Jyk7XG4gICAgbW91c2VFdmVudC5pbml0TW91c2VFdmVudChldmVudFR5cGUsIHBhcmFtcy5idWJibGVzLCBwYXJhbXMuY2FuY2VsYWJsZSwgd2luZG93LCAwLCAwLCAwLCAwLCAwLCBmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgMCwgbnVsbCk7XG5cbiAgICByZXR1cm4gbW91c2VFdmVudDtcbiAgfTtcblxuICBNb3VzZUV2ZW50LnByb3RvdHlwZSA9IEV2ZW50LnByb3RvdHlwZTtcblxuICB3aW5kb3cuTW91c2VFdmVudCA9IE1vdXNlRXZlbnQ7XG59KSh3aW5kb3cpO1xuLyoganNoaW50IGlnbm9yZTplbmQgKi9cblxudmFyIGV4aXN0cyA9IGV4cG9ydHMuZXhpc3RzID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gb2JqICE9PSB1bmRlZmluZWQgJiYgb2JqICE9PSBudWxsO1xufTtcblxuZXhwb3J0cy5jbG9uZSA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe30sIG9iaik7XG59O1xuXG5leHBvcnRzLmV4dGVuZCA9IE9iamVjdC5hc3NpZ247XG5cbmV4cG9ydHMuZGVmYXVsdHNEZWVwID0gZnVuY3Rpb24gKHRhcmdldCkge1xuICBpZiAoIWV4aXN0cyh0YXJnZXQpKSB7IC8vIFR5cGVFcnJvciBpZiB1bmRlZmluZWQgb3IgbnVsbFxuICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjb252ZXJ0IHVuZGVmaW5lZCBvciBudWxsIHRvIG9iamVjdCcpO1xuICB9XG5cbiAgdmFyIHRvID0gZXhwb3J0cy5jbG9uZSh0YXJnZXQpO1xuXG4gIGZvciAodmFyIGluZGV4ID0gMTsgaW5kZXggPCBhcmd1bWVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaW5kZXhdO1xuXG4gICAgaWYgKG5leHRTb3VyY2UgIT09IG51bGwpIHsgLy8gU2tpcCBvdmVyIGlmIHVuZGVmaW5lZCBvciBudWxsXG4gICAgICBmb3IgKHZhciBuZXh0S2V5IGluIG5leHRTb3VyY2UpIHtcbiAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChuZXh0U291cmNlLCBuZXh0S2V5KSkge1xuICAgICAgICAgIGlmKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh0bywgbmV4dEtleSkpIHtcbiAgICAgICAgICAgIGlmKGV4aXN0cyh0b1tuZXh0S2V5XSkgJiYgZXhpc3RzKG5leHRTb3VyY2VbbmV4dEtleV0pICYmIHR5cGVvZiB0b1tuZXh0S2V5XSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIG5leHRTb3VyY2VbbmV4dEtleV0gPT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICAgIHRvW25leHRLZXldID0gZXhwb3J0cy5kZWZhdWx0c0RlZXAodG9bbmV4dEtleV0sIG5leHRTb3VyY2VbbmV4dEtleV0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gRWxzZTogRG9uJ3Qgb3ZlcnJpZGUgZXhpc3RpbmcgdmFsdWVzXG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmV4dFNvdXJjZVtuZXh0S2V5XSA9PT0gJ29iamVjdCcgJiYgbmV4dFNvdXJjZVtuZXh0S2V5XSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdG9bbmV4dEtleV0gPSBleHBvcnRzLmNsb25lKG5leHRTb3VyY2VbbmV4dEtleV0pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0b1tuZXh0S2V5XSA9IG5leHRTb3VyY2VbbmV4dEtleV07XG4gICAgICAgICAgfVxuICAgICAgICB9IC8vIGVuZCBzb3VyY2UgaWYgY2hlY2tcbiAgICAgIH0gLy8gZW5kIGZvclxuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0bztcbn07XG5cbmV4cG9ydHMuZGlzcGF0Y2hDdXN0b21FdmVudCA9IGZ1bmN0aW9uIChlbGVtZW50LCBldmVudCwgcGFyYW1zKSB7XG4gIHZhciBldiA9IG5ldyBDdXN0b21FdmVudChldmVudCwgcGFyYW1zKTtcbiAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2KTtcbn07XG5cbmV4cG9ydHMuZGlzcGF0Y2hCcm93c2VyRXZlbnQgPSBmdW5jdGlvbiAoZWxlbWVudCwgZXZlbnQpIHtcbiAgdmFyIGV2ID0gbmV3IEV2ZW50KGV2ZW50KTtcbiAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2KTtcbn07XG5cbmV4cG9ydHMuZGlzcGF0Y2hDbGlja0V2ZW50ID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcbiAgdmFyIGV2ID0gbmV3IE1vdXNlRXZlbnQoJ2NsaWNrJyk7XG4gIGVsZW1lbnQuZGlzcGF0Y2hFdmVudChldik7XG59O1xuXG5leHBvcnRzLmRlYm91bmNlID0gZnVuY3Rpb24gKGNiLCBtcykge1xuICB2YXIgdG1yO1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMpO1xuXG4gICAgY2xlYXJUaW1lb3V0KHRtcik7XG4gICAgdG1yID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICB0bXIgPSB1bmRlZmluZWQ7XG4gICAgICBjYi5hcHBseShzZWxmLCBhcmdzKTtcbiAgICB9LCBtcyk7XG4gIH07XG59O1xuIl19
