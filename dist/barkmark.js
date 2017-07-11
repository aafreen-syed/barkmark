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
      function tagopen (link) { return '<a href="' + link.href + '"' + getTitle(link) + classes + '>'; }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlc1xcYnJvd3Nlci1wYWNrXFxfcHJlbHVkZS5qcyIsInNyY1xcSW5wdXRIaXN0b3J5LmpzIiwic3JjXFxJbnB1dFN0YXRlLmpzIiwic3JjXFxiYXJrbWFyay5qcyIsInNyY1xcYmluZENvbW1hbmRzLmpzIiwic3JjXFxjaHVua3NcXHBhcnNlTGlua0lucHV0LmpzIiwic3JjXFxjaHVua3NcXHRyaW0uanMiLCJzcmNcXGNsYXNzZXMuanMiLCJzcmNcXGVkaXRvci5qcyIsInNyY1xcZXZlbnRzLmpzIiwic3JjXFxleHRlbmRSZWdFeHAuanMiLCJzcmNcXGZpeEVPTC5qcyIsInNyY1xcZ2V0Q29tbWFuZEhhbmRsZXIuanMiLCJzcmNcXGh0bWxcXEh0bWxDaHVua3MuanMiLCJzcmNcXGh0bWxcXGJsb2NrcXVvdGUuanMiLCJzcmNcXGh0bWxcXGJvbGRPckl0YWxpYy5qcyIsInNyY1xcaHRtbFxcY29kZWJsb2NrLmpzIiwic3JjXFxodG1sXFxoZWFkaW5nLmpzIiwic3JjXFxodG1sXFxoci5qcyIsInNyY1xcaHRtbFxcbGlua09ySW1hZ2VPckF0dGFjaG1lbnQuanMiLCJzcmNcXGh0bWxcXGxpc3QuanMiLCJzcmNcXGh0bWxcXHdyYXBwaW5nLmpzIiwic3JjXFxpc1Zpc2libGVFbGVtZW50LmpzIiwic3JjXFxtYW5hZ2VyLmpzIiwic3JjXFxtYW55LmpzIiwic3JjXFxtYXJrZG93blxcTWFya2Rvd25DaHVua3MuanMiLCJzcmNcXG1hcmtkb3duXFxibG9ja3F1b3RlLmpzIiwic3JjXFxtYXJrZG93blxcYm9sZE9ySXRhbGljLmpzIiwic3JjXFxtYXJrZG93blxcY29kZWJsb2NrLmpzIiwic3JjXFxtYXJrZG93blxcaGVhZGluZy5qcyIsInNyY1xcbWFya2Rvd25cXGhyLmpzIiwic3JjXFxtYXJrZG93blxcbGlua09ySW1hZ2VPckF0dGFjaG1lbnQuanMiLCJzcmNcXG1hcmtkb3duXFxsaXN0LmpzIiwic3JjXFxtYXJrZG93blxcc2V0dGluZ3MuanMiLCJzcmNcXG1hcmtkb3duXFx3cmFwcGluZy5qcyIsInNyY1xcbW9kZXNcXG1hcmtkb3duXFx0ZXh0YXJlYVN1cmZhY2UuanMiLCJzcmNcXG1vZGVzXFx3eXNpd3lnXFx3eXNpd3lnU3VyZmFjZS5qcyIsInNyY1xcb25jZS5qcyIsInNyY1xccHJvbXB0c1xcY2xvc2UuanMiLCJzcmNcXHByb21wdHNcXHByb21wdC5qcyIsInNyY1xccHJvbXB0c1xccmVuZGVyLmpzIiwic3JjXFxyZW5kZXJlcnMuanMiLCJzcmNcXHNob3J0Y3V0cy5qcyIsInNyY1xcc3RyaW5ncy5qcyIsInNyY1xcdXBsb2Fkcy5qcyIsInNyY1xcdXRpbHMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0TUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDclhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9GQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIElucHV0U3RhdGUgPSByZXF1aXJlKCcuL0lucHV0U3RhdGUnKTtcblxuZnVuY3Rpb24gSW5wdXRIaXN0b3J5IChzdXJmYWNlLCBtb2RlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG5cbiAgc3RhdGUuaW5wdXRNb2RlID0gbW9kZTtcbiAgc3RhdGUuc3VyZmFjZSA9IHN1cmZhY2U7XG4gIHN0YXRlLnJlc2V0KCk7XG5cbiAgbGlzdGVuKHN1cmZhY2UuY3VycmVudCgpKTtcblxuICBmdW5jdGlvbiBsaXN0ZW4gKGVsKSB7XG4gICAgdmFyIHBhc3RlSGFuZGxlciA9IHNlbGZpZShoYW5kbGVQYXN0ZSk7XG4gICAgZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBwcmV2ZW50Q3RybFlaKTtcbiAgICBlbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgc2VsZmllKGhhbmRsZUN0cmxZWikpO1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBzZWxmaWUoaGFuZGxlTW9kZUNoYW5nZSkpO1xuICAgIGVsLmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlZG93bicsIHNldE1vdmluZyk7XG4gICAgZWwub25wYXN0ZSA9IHBhc3RlSGFuZGxlcjtcbiAgICBlbC5vbmRyb3AgPSBwYXN0ZUhhbmRsZXI7XG4gIH1cblxuICBmdW5jdGlvbiBzZXRNb3ZpbmcgKCkge1xuICAgIHN0YXRlLnNldE1vZGUoJ21vdmluZycpO1xuICB9XG5cbiAgZnVuY3Rpb24gc2VsZmllIChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiBoYW5kbGVyIChlKSB7IHJldHVybiBmbi5jYWxsKG51bGwsIHN0YXRlLCBlKTsgfTtcbiAgfVxufVxuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNldElucHV0TW9kZSA9IGZ1bmN0aW9uIChtb2RlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmlucHV0TW9kZSA9IG1vZGU7XG4gIHN0YXRlLnJlc2V0KCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5pbnB1dFN0YXRlID0gbnVsbDtcbiAgc3RhdGUubGFzdFN0YXRlID0gbnVsbDtcbiAgc3RhdGUuaGlzdG9yeSA9IFtdO1xuICBzdGF0ZS5oaXN0b3J5UG9pbnRlciA9IDA7XG4gIHN0YXRlLmhpc3RvcnlNb2RlID0gJ25vbmUnO1xuICBzdGF0ZS5yZWZyZXNoaW5nID0gbnVsbDtcbiAgc3RhdGUucmVmcmVzaFN0YXRlKHRydWUpO1xuICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgcmV0dXJuIHN0YXRlO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5zZXRDb21tYW5kTW9kZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnY29tbWFuZCc7XG4gIHN0YXRlLnNhdmVTdGF0ZSgpO1xuICBzdGF0ZS5yZWZyZXNoaW5nID0gc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG4gIH0sIDApO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5jYW5VbmRvID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5oaXN0b3J5UG9pbnRlciA+IDE7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLmNhblJlZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmhpc3RvcnlbdGhpcy5oaXN0b3J5UG9pbnRlciArIDFdO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS51bmRvID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBpZiAoc3RhdGUuY2FuVW5kbygpKSB7XG4gICAgaWYgKHN0YXRlLmxhc3RTdGF0ZSkge1xuICAgICAgc3RhdGUubGFzdFN0YXRlLnJlc3RvcmUoKTtcbiAgICAgIHN0YXRlLmxhc3RTdGF0ZSA9IG51bGw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXJdID0gbmV3IElucHV0U3RhdGUoc3RhdGUuc3VyZmFjZSwgc3RhdGUuaW5wdXRNb2RlKTtcbiAgICAgIHN0YXRlLmhpc3RvcnlbLS1zdGF0ZS5oaXN0b3J5UG9pbnRlcl0ucmVzdG9yZSgpO1xuICAgIH1cbiAgfVxuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdub25lJztcbiAgc3RhdGUuc3VyZmFjZS5mb2N1cyhzdGF0ZS5pbnB1dE1vZGUpO1xuICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUucmVkbyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgaWYgKHN0YXRlLmNhblJlZG8oKSkge1xuICAgIHN0YXRlLmhpc3RvcnlbKytzdGF0ZS5oaXN0b3J5UG9pbnRlcl0ucmVzdG9yZSgpO1xuICB9XG5cbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnbm9uZSc7XG4gIHN0YXRlLnN1cmZhY2UuZm9jdXMoc3RhdGUuaW5wdXRNb2RlKTtcbiAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNldE1vZGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgaWYgKHN0YXRlLmhpc3RvcnlNb2RlICE9PSB2YWx1ZSkge1xuICAgIHN0YXRlLmhpc3RvcnlNb2RlID0gdmFsdWU7XG4gICAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gIH1cbiAgc3RhdGUucmVmcmVzaGluZyA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xuICB9LCAxKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUucmVmcmVzaFN0YXRlID0gZnVuY3Rpb24gKGluaXRpYWxTdGF0ZSkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5pbnB1dFN0YXRlID0gbmV3IElucHV0U3RhdGUoc3RhdGUuc3VyZmFjZSwgc3RhdGUuaW5wdXRNb2RlLCBpbml0aWFsU3RhdGUpO1xuICBzdGF0ZS5yZWZyZXNoaW5nID0gbnVsbDtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2F2ZVN0YXRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICB2YXIgY3VycmVudCA9IHN0YXRlLmlucHV0U3RhdGUgfHwgbmV3IElucHV0U3RhdGUoc3RhdGUuc3VyZmFjZSwgc3RhdGUuaW5wdXRNb2RlKTtcblxuICBpZiAoc3RhdGUuaGlzdG9yeU1vZGUgPT09ICdtb3ZpbmcnKSB7XG4gICAgaWYgKCFzdGF0ZS5sYXN0U3RhdGUpIHtcbiAgICAgIHN0YXRlLmxhc3RTdGF0ZSA9IGN1cnJlbnQ7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBpZiAoc3RhdGUubGFzdFN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXIgLSAxXS50ZXh0ICE9PSBzdGF0ZS5sYXN0U3RhdGUudGV4dCkge1xuICAgICAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlcisrXSA9IHN0YXRlLmxhc3RTdGF0ZTtcbiAgICB9XG4gICAgc3RhdGUubGFzdFN0YXRlID0gbnVsbDtcbiAgfVxuICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyKytdID0gY3VycmVudDtcbiAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlciArIDFdID0gbnVsbDtcbn07XG5cbmZ1bmN0aW9uIGhhbmRsZUN0cmxZWiAoc3RhdGUsIGUpIHtcbiAgdmFyIGhhbmRsZWQgPSBmYWxzZTtcbiAgdmFyIGtleUNvZGUgPSBlLmNoYXJDb2RlIHx8IGUua2V5Q29kZTtcbiAgdmFyIGtleUNvZGVDaGFyID0gU3RyaW5nLmZyb21DaGFyQ29kZShrZXlDb2RlKTtcblxuICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkge1xuICAgIHN3aXRjaCAoa2V5Q29kZUNoYXIudG9Mb3dlckNhc2UoKSkge1xuICAgICAgY2FzZSAneSc6XG4gICAgICAgIHN0YXRlLnJlZG8oKTtcbiAgICAgICAgaGFuZGxlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuXG4gICAgICBjYXNlICd6JzpcbiAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICAgICAgICBzdGF0ZS5yZWRvKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgc3RhdGUudW5kbygpO1xuICAgICAgICB9XG4gICAgICAgIGhhbmRsZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBpZiAoaGFuZGxlZCAmJiBlLnByZXZlbnREZWZhdWx0KSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZU1vZGVDaGFuZ2UgKHN0YXRlLCBlKSB7XG4gIGlmIChlLmN0cmxLZXkgfHwgZS5tZXRhS2V5KSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIGtleUNvZGUgPSBlLmtleUNvZGU7XG5cbiAgaWYgKChrZXlDb2RlID49IDMzICYmIGtleUNvZGUgPD0gNDApIHx8IChrZXlDb2RlID49IDYzMjMyICYmIGtleUNvZGUgPD0gNjMyMzUpKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnbW92aW5nJyk7XG4gIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gOCB8fCBrZXlDb2RlID09PSA0NiB8fCBrZXlDb2RlID09PSAxMjcpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCdkZWxldGluZycpO1xuICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDEzKSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnbmV3bGluZXMnKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAyNykge1xuICAgIHN0YXRlLnNldE1vZGUoJ2VzY2FwZScpO1xuICB9IGVsc2UgaWYgKChrZXlDb2RlIDwgMTYgfHwga2V5Q29kZSA+IDIwKSAmJiBrZXlDb2RlICE9PSA5MSkge1xuICAgIHN0YXRlLnNldE1vZGUoJ3R5cGluZycpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZVBhc3RlIChzdGF0ZSkge1xuICBpZiAoc3RhdGUuaW5wdXRTdGF0ZSAmJiBzdGF0ZS5pbnB1dFN0YXRlLnRleHQgIT09IHN0YXRlLnN1cmZhY2UucmVhZChzdGF0ZS5pbnB1dE1vZGUpICYmIHN0YXRlLnJlZnJlc2hpbmcgPT09IG51bGwpIHtcbiAgICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdwYXN0ZSc7XG4gICAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gICAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJldmVudEN0cmxZWiAoZSkge1xuICB2YXIga2V5Q29kZSA9IGUuY2hhckNvZGUgfHwgZS5rZXlDb2RlO1xuICB2YXIgeXogPSBrZXlDb2RlID09PSA4OSB8fCBrZXlDb2RlID09PSA5MDtcbiAgdmFyIGN0cmwgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5O1xuICBpZiAoY3RybCAmJiB5eikge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0SGlzdG9yeTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBpc1Zpc2libGVFbGVtZW50ID0gcmVxdWlyZSgnLi9pc1Zpc2libGVFbGVtZW50Jyk7XG52YXIgZml4RU9MID0gcmVxdWlyZSgnLi9maXhFT0wnKTtcbnZhciBNYXJrZG93bkNodW5rcyA9IHJlcXVpcmUoJy4vbWFya2Rvd24vTWFya2Rvd25DaHVua3MnKTtcbnZhciBIdG1sQ2h1bmtzID0gcmVxdWlyZSgnLi9odG1sL0h0bWxDaHVua3MnKTtcbnZhciBjaHVua3MgPSB7XG4gIG1hcmtkb3duOiBNYXJrZG93bkNodW5rcyxcbiAgaHRtbDogSHRtbENodW5rcyxcbiAgd3lzaXd5ZzogSHRtbENodW5rc1xufTtcblxuZnVuY3Rpb24gSW5wdXRTdGF0ZSAoc3VyZmFjZSwgbW9kZSwgaW5pdGlhbFN0YXRlKSB7XG4gIHRoaXMubW9kZSA9IG1vZGU7XG4gIHRoaXMuc3VyZmFjZSA9IHN1cmZhY2U7XG4gIHRoaXMuaW5pdGlhbFN0YXRlID0gaW5pdGlhbFN0YXRlIHx8IGZhbHNlO1xuICB0aGlzLmluaXQoKTtcbn1cblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAoIWlzVmlzaWJsZUVsZW1lbnQoZWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghdGhpcy5pbml0aWFsU3RhdGUgJiYgZG9jLmFjdGl2ZUVsZW1lbnQgJiYgZG9jLmFjdGl2ZUVsZW1lbnQgIT09IGVsKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHNlbGYuc3VyZmFjZS5yZWFkU2VsZWN0aW9uKHNlbGYpO1xuICBzZWxmLnNjcm9sbFRvcCA9IGVsLnNjcm9sbFRvcDtcbiAgaWYgKCFzZWxmLnRleHQpIHtcbiAgICBzZWxmLnRleHQgPSBzZWxmLnN1cmZhY2UucmVhZChzZWxmLm1vZGUpO1xuICB9XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5zZWxlY3QgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKCFpc1Zpc2libGVFbGVtZW50KGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBzZWxmLnN1cmZhY2Uud3JpdGVTZWxlY3Rpb24oc2VsZik7XG59O1xuXG5JbnB1dFN0YXRlLnByb3RvdHlwZS5yZXN0b3JlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICh0eXBlb2Ygc2VsZi50ZXh0ID09PSAnc3RyaW5nJyAmJiBzZWxmLnRleHQgIT09IHNlbGYuc3VyZmFjZS5yZWFkKCkpIHtcbiAgICBzZWxmLnN1cmZhY2Uud3JpdGUoc2VsZi50ZXh0KTtcbiAgfVxuICBzZWxmLnNlbGVjdCgpO1xuICBlbC5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmdldENodW5rcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2h1bmsgPSBuZXcgY2h1bmtzW3NlbGYubW9kZV0oKTtcbiAgY2h1bmsuYmVmb3JlID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoMCwgc2VsZi5zdGFydCkpO1xuICBjaHVuay5zdGFydFRhZyA9ICcnO1xuICBjaHVuay5zZWxlY3Rpb24gPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLnN0YXJ0LCBzZWxmLmVuZCkpO1xuICBjaHVuay5lbmRUYWcgPSAnJztcbiAgY2h1bmsuYWZ0ZXIgPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLmVuZCkpO1xuICBjaHVuay5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbiAgc2VsZi5jYWNoZWRDaHVua3MgPSBjaHVuaztcbiAgcmV0dXJuIGNodW5rO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2V0Q2h1bmtzID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2h1bmsuYmVmb3JlID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc3RhcnRUYWc7XG4gIGNodW5rLmFmdGVyID0gY2h1bmsuZW5kVGFnICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc3RhcnQgPSBjaHVuay5iZWZvcmUubGVuZ3RoO1xuICBzZWxmLmVuZCA9IGNodW5rLmJlZm9yZS5sZW5ndGggKyBjaHVuay5zZWxlY3Rpb24ubGVuZ3RoO1xuICBzZWxmLnRleHQgPSBjaHVuay5iZWZvcmUgKyBjaHVuay5zZWxlY3Rpb24gKyBjaHVuay5hZnRlcjtcbiAgc2VsZi5zY3JvbGxUb3AgPSBjaHVuay5zY3JvbGxUb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0U3RhdGU7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OUpibkIxZEZOMFlYUmxMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCa2IyTWdQU0JuYkc5aVlXd3VaRzlqZFcxbGJuUTdYRzUyWVhJZ2FYTldhWE5wWW14bFJXeGxiV1Z1ZENBOUlISmxjWFZwY21Vb0p5NHZhWE5XYVhOcFlteGxSV3hsYldWdWRDY3BPMXh1ZG1GeUlHWnBlRVZQVENBOUlISmxjWFZwY21Vb0p5NHZabWw0UlU5TUp5azdYRzUyWVhJZ1RXRnlhMlJ2ZDI1RGFIVnVhM01nUFNCeVpYRjFhWEpsS0NjdUwyMWhjbXRrYjNkdUwwMWhjbXRrYjNkdVEyaDFibXR6SnlrN1hHNTJZWElnU0hSdGJFTm9kVzVyY3lBOUlISmxjWFZwY21Vb0p5NHZhSFJ0YkM5SWRHMXNRMmgxYm10ekp5azdYRzUyWVhJZ1kyaDFibXR6SUQwZ2UxeHVJQ0J0WVhKclpHOTNiam9nVFdGeWEyUnZkMjVEYUhWdWEzTXNYRzRnSUdoMGJXdzZJRWgwYld4RGFIVnVhM01zWEc0Z0lIZDVjMmwzZVdjNklFaDBiV3hEYUhWdWEzTmNibjA3WEc1Y2JtWjFibU4wYVc5dUlFbHVjSFYwVTNSaGRHVWdLSE4xY21aaFkyVXNJRzF2WkdVc0lHbHVhWFJwWVd4VGRHRjBaU2tnZTF4dUlDQjBhR2x6TG0xdlpHVWdQU0J0YjJSbE8xeHVJQ0IwYUdsekxuTjFjbVpoWTJVZ1BTQnpkWEptWVdObE8xeHVJQ0IwYUdsekxtbHVhWFJwWVd4VGRHRjBaU0E5SUdsdWFYUnBZV3hUZEdGMFpTQjhmQ0JtWVd4elpUdGNiaUFnZEdocGN5NXBibWwwS0NrN1hHNTlYRzVjYmtsdWNIVjBVM1JoZEdVdWNISnZkRzkwZVhCbExtbHVhWFFnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhaaGNpQnpaV3htSUQwZ2RHaHBjenRjYmlBZ2RtRnlJR1ZzSUQwZ2MyVnNaaTV6ZFhKbVlXTmxMbU4xY25KbGJuUW9jMlZzWmk1dGIyUmxLVHRjYmlBZ2FXWWdLQ0ZwYzFacGMybGliR1ZGYkdWdFpXNTBLR1ZzS1NrZ2UxeHVJQ0FnSUhKbGRIVnlianRjYmlBZ2ZWeHVJQ0JwWmlBb0lYUm9hWE11YVc1cGRHbGhiRk4wWVhSbElDWW1JR1J2WXk1aFkzUnBkbVZGYkdWdFpXNTBJQ1ltSUdSdll5NWhZM1JwZG1WRmJHVnRaVzUwSUNFOVBTQmxiQ2tnZTF4dUlDQWdJSEpsZEhWeWJqdGNiaUFnZlZ4dUlDQnpaV3htTG5OMWNtWmhZMlV1Y21WaFpGTmxiR1ZqZEdsdmJpaHpaV3htS1R0Y2JpQWdjMlZzWmk1elkzSnZiR3hVYjNBZ1BTQmxiQzV6WTNKdmJHeFViM0E3WEc0Z0lHbG1JQ2doYzJWc1ppNTBaWGgwS1NCN1hHNGdJQ0FnYzJWc1ppNTBaWGgwSUQwZ2MyVnNaaTV6ZFhKbVlXTmxMbkpsWVdRb2MyVnNaaTV0YjJSbEtUdGNiaUFnZlZ4dWZUdGNibHh1U1c1d2RYUlRkR0YwWlM1d2NtOTBiM1I1Y0dVdWMyVnNaV04wSUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNCMllYSWdjMlZzWmlBOUlIUm9hWE03WEc0Z0lIWmhjaUJsYkNBOUlITmxiR1l1YzNWeVptRmpaUzVqZFhKeVpXNTBLSE5sYkdZdWJXOWtaU2s3WEc0Z0lHbG1JQ2doYVhOV2FYTnBZbXhsUld4bGJXVnVkQ2hsYkNrcElIdGNiaUFnSUNCeVpYUjFjbTQ3WEc0Z0lIMWNiaUFnYzJWc1ppNXpkWEptWVdObExuZHlhWFJsVTJWc1pXTjBhVzl1S0hObGJHWXBPMXh1ZlR0Y2JseHVTVzV3ZFhSVGRHRjBaUzV3Y205MGIzUjVjR1V1Y21WemRHOXlaU0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnZG1GeUlITmxiR1lnUFNCMGFHbHpPMXh1SUNCMllYSWdaV3dnUFNCelpXeG1Mbk4xY21aaFkyVXVZM1Z5Y21WdWRDaHpaV3htTG0xdlpHVXBPMXh1SUNCcFppQW9kSGx3Wlc5bUlITmxiR1l1ZEdWNGRDQTlQVDBnSjNOMGNtbHVaeWNnSmlZZ2MyVnNaaTUwWlhoMElDRTlQU0J6Wld4bUxuTjFjbVpoWTJVdWNtVmhaQ2dwS1NCN1hHNGdJQ0FnYzJWc1ppNXpkWEptWVdObExuZHlhWFJsS0hObGJHWXVkR1Y0ZENrN1hHNGdJSDFjYmlBZ2MyVnNaaTV6Wld4bFkzUW9LVHRjYmlBZ1pXd3VjMk55YjJ4c1ZHOXdJRDBnYzJWc1ppNXpZM0p2Ykd4VWIzQTdYRzU5TzF4dVhHNUpibkIxZEZOMFlYUmxMbkJ5YjNSdmRIbHdaUzVuWlhSRGFIVnVhM01nUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhaaGNpQnpaV3htSUQwZ2RHaHBjenRjYmlBZ2RtRnlJR05vZFc1cklEMGdibVYzSUdOb2RXNXJjMXR6Wld4bUxtMXZaR1ZkS0NrN1hHNGdJR05vZFc1ckxtSmxabTl5WlNBOUlHWnBlRVZQVENoelpXeG1MblJsZUhRdWMzVmljM1J5YVc1bktEQXNJSE5sYkdZdWMzUmhjblFwS1R0Y2JpQWdZMmgxYm1zdWMzUmhjblJVWVdjZ1BTQW5KenRjYmlBZ1kyaDFibXN1YzJWc1pXTjBhVzl1SUQwZ1ptbDRSVTlNS0hObGJHWXVkR1Y0ZEM1emRXSnpkSEpwYm1jb2MyVnNaaTV6ZEdGeWRDd2djMlZzWmk1bGJtUXBLVHRjYmlBZ1kyaDFibXN1Wlc1a1ZHRm5JRDBnSnljN1hHNGdJR05vZFc1ckxtRm1kR1Z5SUQwZ1ptbDRSVTlNS0hObGJHWXVkR1Y0ZEM1emRXSnpkSEpwYm1jb2MyVnNaaTVsYm1RcEtUdGNiaUFnWTJoMWJtc3VjMk55YjJ4c1ZHOXdJRDBnYzJWc1ppNXpZM0p2Ykd4VWIzQTdYRzRnSUhObGJHWXVZMkZqYUdWa1EyaDFibXR6SUQwZ1kyaDFibXM3WEc0Z0lISmxkSFZ5YmlCamFIVnVhenRjYm4wN1hHNWNia2x1Y0hWMFUzUmhkR1V1Y0hKdmRHOTBlWEJsTG5ObGRFTm9kVzVyY3lBOUlHWjFibU4wYVc5dUlDaGphSFZ1YXlrZ2UxeHVJQ0IyWVhJZ2MyVnNaaUE5SUhSb2FYTTdYRzRnSUdOb2RXNXJMbUpsWm05eVpTQTlJR05vZFc1ckxtSmxabTl5WlNBcklHTm9kVzVyTG5OMFlYSjBWR0ZuTzF4dUlDQmphSFZ1YXk1aFpuUmxjaUE5SUdOb2RXNXJMbVZ1WkZSaFp5QXJJR05vZFc1ckxtRm1kR1Z5TzF4dUlDQnpaV3htTG5OMFlYSjBJRDBnWTJoMWJtc3VZbVZtYjNKbExteGxibWQwYUR0Y2JpQWdjMlZzWmk1bGJtUWdQU0JqYUhWdWF5NWlaV1p2Y21VdWJHVnVaM1JvSUNzZ1kyaDFibXN1YzJWc1pXTjBhVzl1TG14bGJtZDBhRHRjYmlBZ2MyVnNaaTUwWlhoMElEMGdZMmgxYm1zdVltVm1iM0psSUNzZ1kyaDFibXN1YzJWc1pXTjBhVzl1SUNzZ1kyaDFibXN1WVdaMFpYSTdYRzRnSUhObGJHWXVjMk55YjJ4c1ZHOXdJRDBnWTJoMWJtc3VjMk55YjJ4c1ZHOXdPMXh1ZlR0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQkpibkIxZEZOMFlYUmxPMXh1SWwxOSIsIid1c2Ugc3RyaWN0JztcblxudmFyIE1hbmFnZXIgPSByZXF1aXJlKCcuL21hbmFnZXInKTtcblxudmFyIG1hbmFnZXIgPSBuZXcgTWFuYWdlcigpO1xuXG5mdW5jdGlvbiBiYXJrbWFyayAodGV4dGFyZWEsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG1hbmFnZXIuZ2V0KHRleHRhcmVhLCBvcHRpb25zKTtcbn1cblxuYmFya21hcmsuZmluZCA9IGZ1bmN0aW9uICh0ZXh0YXJlYSkge1xuICByZXR1cm4gbWFuYWdlci5maW5kKHRleHRhcmVhKTtcbn07XG5cbmJhcmttYXJrLnN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBiYXJrbWFyaztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi91dGlscycpO1xudmFyIGNvbW1hbmRzID0ge1xuICBtYXJrZG93bjoge1xuICAgIGJvbGRPckl0YWxpYzogcmVxdWlyZSgnLi9tYXJrZG93bi9ib2xkT3JJdGFsaWMnKSxcbiAgICBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDogcmVxdWlyZSgnLi9tYXJrZG93bi9saW5rT3JJbWFnZU9yQXR0YWNobWVudCcpLFxuICAgIGJsb2NrcXVvdGU6IHJlcXVpcmUoJy4vbWFya2Rvd24vYmxvY2txdW90ZScpLFxuICAgIGNvZGVibG9jazogcmVxdWlyZSgnLi9tYXJrZG93bi9jb2RlYmxvY2snKSxcbiAgICBoZWFkaW5nOiByZXF1aXJlKCcuL21hcmtkb3duL2hlYWRpbmcnKSxcbiAgICBsaXN0OiByZXF1aXJlKCcuL21hcmtkb3duL2xpc3QnKSxcbiAgICBocjogcmVxdWlyZSgnLi9tYXJrZG93bi9ocicpXG4gIH0sXG4gIGh0bWw6IHtcbiAgICBib2xkT3JJdGFsaWM6IHJlcXVpcmUoJy4vaHRtbC9ib2xkT3JJdGFsaWMnKSxcbiAgICBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDogcmVxdWlyZSgnLi9odG1sL2xpbmtPckltYWdlT3JBdHRhY2htZW50JyksXG4gICAgYmxvY2txdW90ZTogcmVxdWlyZSgnLi9odG1sL2Jsb2NrcXVvdGUnKSxcbiAgICBjb2RlYmxvY2s6IHJlcXVpcmUoJy4vaHRtbC9jb2RlYmxvY2snKSxcbiAgICBoZWFkaW5nOiByZXF1aXJlKCcuL2h0bWwvaGVhZGluZycpLFxuICAgIGxpc3Q6IHJlcXVpcmUoJy4vaHRtbC9saXN0JyksXG4gICAgaHI6IHJlcXVpcmUoJy4vaHRtbC9ocicpXG4gIH1cbn07XG5cbmNvbW1hbmRzLnd5c2l3eWcgPSBjb21tYW5kcy5odG1sO1xuXG5mdW5jdGlvbiBiaW5kQ29tbWFuZHMgKGVkaXRvciwgb3B0aW9ucykge1xuICBiaW5kKCdib2xkJywgJ2InLCBib2xkKTtcbiAgYmluZCgnaXRhbGljJywgJ2knLCBpdGFsaWMpO1xuICBiaW5kKCdxdW90ZScsICdqJywgcm91dGVyKCdibG9ja3F1b3RlJykpO1xuICBiaW5kKCdjb2RlJywgJ2UnLCBjb2RlKTtcbiAgYmluZCgnb2wnLCAnbycsIG9sKTtcbiAgYmluZCgndWwnLCAndScsIHVsKTtcbiAgYmluZCgnaGVhZGluZycsICdkJywgcm91dGVyKCdoZWFkaW5nJykpO1xuICBlZGl0b3Iuc2hvd0xpbmtEaWFsb2cgPSBmYWJyaWNhdG9yKGJpbmQoJ2xpbmsnLCAnaycsIGxpbmtPckltYWdlT3JBdHRhY2htZW50KCdsaW5rJykpKTtcbiAgZWRpdG9yLnNob3dJbWFnZURpYWxvZyA9IGZhYnJpY2F0b3IoYmluZCgnaW1hZ2UnLCAnZycsIGxpbmtPckltYWdlT3JBdHRhY2htZW50KCdpbWFnZScpKSk7XG4gIGVkaXRvci5saW5rT3JJbWFnZU9yQXR0YWNobWVudCA9IGxpbmtPckltYWdlT3JBdHRhY2htZW50O1xuXG4gIGlmIChvcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgZWRpdG9yLnNob3dBdHRhY2htZW50RGlhbG9nID0gZmFicmljYXRvcihiaW5kKCdhdHRhY2htZW50JywgJ2snLCB0cnVlLCBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCgnYXR0YWNobWVudCcpKSk7XG4gIH1cbiAgaWYgKG9wdGlvbnMuaHIpIHsgYmluZCgnaHInLCAnY21kK24nLCByb3V0ZXIoJ2hyJykpOyB9XG5cbiAgZnVuY3Rpb24gZmFicmljYXRvciAoZWwpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gb3BlbiAoKSB7XG4gICAgICB1dGlscy5kaXNwYXRjaENsaWNrRXZlbnQoZWwpO1xuICAgIH07XG4gIH1cbiAgZnVuY3Rpb24gYm9sZCAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0uYm9sZE9ySXRhbGljKGNodW5rcywgJ2JvbGQnKTtcbiAgfVxuICBmdW5jdGlvbiBpdGFsaWMgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmJvbGRPckl0YWxpYyhjaHVua3MsICdpdGFsaWMnKTtcbiAgfVxuICBmdW5jdGlvbiBjb2RlIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5jb2RlYmxvY2soY2h1bmtzLCB7IGZlbmNpbmc6IG9wdGlvbnMuZmVuY2luZyB9KTtcbiAgfVxuICBmdW5jdGlvbiB1bCAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0ubGlzdChjaHVua3MsIGZhbHNlKTtcbiAgfVxuICBmdW5jdGlvbiBvbCAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0ubGlzdChjaHVua3MsIHRydWUpO1xuICB9XG4gIGZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50ICh0eXBlLCBhdXRvVXBsb2FkKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50SW52b2tlIChtb2RlLCBjaHVua3MpIHtcbiAgICAgIGNvbW1hbmRzW21vZGVdLmxpbmtPckltYWdlT3JBdHRhY2htZW50LmNhbGwodGhpcywgY2h1bmtzLCB7XG4gICAgICAgIGVkaXRvcjogZWRpdG9yLFxuICAgICAgICBtb2RlOiBtb2RlLFxuICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICBwcm9tcHRzOiBvcHRpb25zLnByb21wdHMsXG4gICAgICAgIHVwbG9hZDogb3B0aW9uc1t0eXBlICsgJ3MnXSxcbiAgICAgICAgY2xhc3Nlczogb3B0aW9ucy5jbGFzc2VzLFxuICAgICAgICBtZXJnZUh0bWxBbmRBdHRhY2htZW50OiBvcHRpb25zLm1lcmdlSHRtbEFuZEF0dGFjaG1lbnQsXG4gICAgICAgIGF1dG9VcGxvYWQ6IGF1dG9VcGxvYWRcbiAgICAgIH0pO1xuICAgIH07XG4gIH1cbiAgZnVuY3Rpb24gYmluZCAoaWQsIGtleSwgc2hpZnQsIGZuKSB7XG4gICAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgICAgZm4gPSBzaGlmdDtcbiAgICAgIHNoaWZ0ID0gdW5kZWZpbmVkO1xuICAgIH1cblxuICAgIHJldHVybiBlZGl0b3IuYWRkQ29tbWFuZEJ1dHRvbihpZCwga2V5LCBzaGlmdCwgc3VwcHJlc3MoZm4pKTtcbiAgfVxuICBmdW5jdGlvbiByb3V0ZXIgKG1ldGhvZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiByb3V0ZWQgKG1vZGUsIGNodW5rcykgeyBjb21tYW5kc1ttb2RlXVttZXRob2RdLmNhbGwodGhpcywgY2h1bmtzKTsgfTtcbiAgfVxuICBmdW5jdGlvbiBzdG9wIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG4gIGZ1bmN0aW9uIHN1cHByZXNzIChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiBzdXBwcmVzc29yIChlLCBtb2RlLCBjaHVua3MpIHsgc3RvcChlKTsgZm4uY2FsbCh0aGlzLCBtb2RlLCBjaHVua3MpOyB9O1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmluZENvbW1hbmRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmlucHV0ID0gL15cXHMqKC4qPykoPzpcXHMrXCIoLispXCIpP1xccyokLztcbnZhciByZnVsbCA9IC9eKD86aHR0cHM/fGZ0cCk6XFwvXFwvLztcblxuZnVuY3Rpb24gcGFyc2VMaW5rSW5wdXQgKGlucHV0KSB7XG4gIHJldHVybiBwYXJzZXIuYXBwbHkobnVsbCwgaW5wdXQubWF0Y2gocmlucHV0KSk7XG5cbiAgZnVuY3Rpb24gcGFyc2VyIChhbGwsIGxpbmssIHRpdGxlKSB7XG4gICAgdmFyIGhyZWYgPSBsaW5rLnJlcGxhY2UoL1xcPy4qJC8sIHF1ZXJ5VW5lbmNvZGVkUmVwbGFjZXIpO1xuICAgIGhyZWYgPSBkZWNvZGVVUklDb21wb25lbnQoaHJlZik7XG4gICAgaHJlZiA9IGVuY29kZVVSSShocmVmKS5yZXBsYWNlKC8nL2csICclMjcnKS5yZXBsYWNlKC9cXCgvZywgJyUyOCcpLnJlcGxhY2UoL1xcKS9nLCAnJTI5Jyk7XG4gICAgaHJlZiA9IGhyZWYucmVwbGFjZSgvXFw/LiokLywgcXVlcnlFbmNvZGVkUmVwbGFjZXIpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGhyZWY6IGZvcm1hdEhyZWYoaHJlZiksIHRpdGxlOiBmb3JtYXRUaXRsZSh0aXRsZSlcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHF1ZXJ5VW5lbmNvZGVkUmVwbGFjZXIgKHF1ZXJ5KSB7XG4gIHJldHVybiBxdWVyeS5yZXBsYWNlKC9cXCsvZywgJyAnKTtcbn1cblxuZnVuY3Rpb24gcXVlcnlFbmNvZGVkUmVwbGFjZXIgKHF1ZXJ5KSB7XG4gIHJldHVybiBxdWVyeS5yZXBsYWNlKC9cXCsvZywgJyUyYicpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUaXRsZSAodGl0bGUpIHtcbiAgaWYgKCF0aXRsZSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHRpdGxlXG4gICAgLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0SHJlZiAodXJsKSB7XG4gIHZhciBocmVmID0gdXJsLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKTtcbiAgaWYgKGhyZWYubGVuZ3RoICYmIGhyZWZbMF0gIT09ICcvJyAmJiAhcmZ1bGwudGVzdChocmVmKSkge1xuICAgIHJldHVybiAnaHR0cDovLycgKyBocmVmO1xuICB9XG4gIHJldHVybiBocmVmO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlTGlua0lucHV0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB0cmltIChyZW1vdmUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChyZW1vdmUpIHtcbiAgICBiZWZvcmVSZXBsYWNlciA9IGFmdGVyUmVwbGFjZXIgPSAnJztcbiAgfVxuICBzZWxmLnNlbGVjdGlvbiA9IHNlbGYuc2VsZWN0aW9uLnJlcGxhY2UoL14oXFxzKikvLCBiZWZvcmVSZXBsYWNlcikucmVwbGFjZSgvKFxccyopJC8sIGFmdGVyUmVwbGFjZXIpO1xuXG4gIGZ1bmN0aW9uIGJlZm9yZVJlcGxhY2VyICh0ZXh0KSB7XG4gICAgc2VsZi5iZWZvcmUgKz0gdGV4dDsgcmV0dXJuICcnO1xuICB9XG4gIGZ1bmN0aW9uIGFmdGVyUmVwbGFjZXIgKHRleHQpIHtcbiAgICBzZWxmLmFmdGVyID0gdGV4dCArIHNlbGYuYWZ0ZXI7IHJldHVybiAnJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBydHJpbSA9IC9eXFxzK3xcXHMrJC9nO1xudmFyIHJzcGFjZXMgPSAvXFxzKy9nO1xuXG5mdW5jdGlvbiBhZGRDbGFzcyAoZWwsIGNscykge1xuICB2YXIgY3VycmVudCA9IGVsLmNsYXNzTmFtZTtcbiAgaWYgKGN1cnJlbnQuaW5kZXhPZihjbHMpID09PSAtMSkge1xuICAgIGVsLmNsYXNzTmFtZSA9IChjdXJyZW50ICsgJyAnICsgY2xzKS5yZXBsYWNlKHJ0cmltLCAnJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcm1DbGFzcyAoZWwsIGNscykge1xuICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShjbHMsICcnKS5yZXBsYWNlKHJ0cmltLCAnJykucmVwbGFjZShyc3BhY2VzLCAnICcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRDbGFzcyxcbiAgcm06IHJtQ2xhc3Ncbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbi8vIHZhciB1cGxvYWRzID0gcmVxdWlyZSgnLi91cGxvYWRzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4vc3RyaW5ncycpO1xudmFyIGJpbmRDb21tYW5kcyA9IHJlcXVpcmUoJy4vYmluZENvbW1hbmRzJyk7XG52YXIgSW5wdXRIaXN0b3J5ID0gcmVxdWlyZSgnLi9JbnB1dEhpc3RvcnknKTtcbnZhciBTaG9ydGN1dE1hbmFnZXIgPSByZXF1aXJlKCcuL3Nob3J0Y3V0cycpO1xudmFyIGdldENvbW1hbmRIYW5kbGVyID0gcmVxdWlyZSgnLi9nZXRDb21tYW5kSGFuZGxlcicpO1xudmFyIFRleHRTdXJmYWNlID0gcmVxdWlyZSgnLi9tb2Rlcy9tYXJrZG93bi90ZXh0YXJlYVN1cmZhY2UnKTtcbnZhciBXeXNpd3lnU3VyZmFjZSA9IHJlcXVpcmUoJy4vbW9kZXMvd3lzaXd5Zy93eXNpd3lnU3VyZmFjZScpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuL2NsYXNzZXMnKTtcbnZhciByZW5kZXJlcnMgPSByZXF1aXJlKCcuL3JlbmRlcmVycycpO1xudmFyIHByb21wdCA9IHJlcXVpcmUoJy4vcHJvbXB0cy9wcm9tcHQnKTtcbnZhciBjbG9zZVByb21wdHMgPSByZXF1aXJlKCcuL3Byb21wdHMvY2xvc2UnKTtcbnZhciBtYWMgPSAvXFxiTWFjIE9TXFxiLy50ZXN0KGdsb2JhbC5uYXZpZ2F0b3IudXNlckFnZW50KTtcbnZhciBkb2MgPSBkb2N1bWVudDtcblxuZnVuY3Rpb24gRWRpdG9yICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB0aGlzLnRleHRhcmVhID0gdGV4dGFyZWE7XG4gIHZhciBwYXJlbnQgPSB0ZXh0YXJlYS5wYXJlbnROb2RlO1xuICB2YXIgbyA9IHRoaXMub3B0aW9ucyA9IHV0aWxzLmRlZmF1bHRzRGVlcChvcHRpb25zIHx8IHt9LCB7XG4gICAgLy8gRGVmYXVsdCBPcHRpb24gVmFsdWVzXG4gICAgbWFya2Rvd246IHRydWUsXG4gICAgd3lzaXd5ZzogdHJ1ZSxcbiAgICBocjogZmFsc2UsXG4gICAgc3RvcmFnZTogdHJ1ZSxcbiAgICBmZW5jaW5nOiB0cnVlLFxuICAgIHJlbmRlcjoge1xuICAgICAgbW9kZXM6IHt9LFxuICAgICAgY29tbWFuZHM6IHt9LFxuICAgIH0sXG4gICAgcHJvbXB0czoge1xuICAgICAgbGluazogcHJvbXB0LFxuICAgICAgaW1hZ2U6IHByb21wdCxcbiAgICAgIGF0dGFjaG1lbnQ6IHByb21wdCxcbiAgICAgIGNsb3NlOiBjbG9zZVByb21wdHMsXG4gICAgfSxcbiAgICBjbGFzc2VzOiB7XG4gICAgICB3eXNpd3lnOiBbXSxcbiAgICAgIHByb21wdHM6IHt9LFxuICAgICAgaW5wdXQ6IHt9LFxuICAgIH0sXG4gIH0pO1xuXG4gIGlmICghby5tYXJrZG93biAmJiAhby53eXNpd3lnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdiYXJrbWFyayBleHBlY3RzIGF0IGxlYXN0IG9uZSBpbnB1dCBtb2RlIHRvIGJlIGF2YWlsYWJsZScpO1xuICB9XG5cbiAgaWYgKG8uc3RvcmFnZSA9PT0gdHJ1ZSkgeyBvLnN0b3JhZ2UgPSAnYmFya21hcmtfaW5wdXRfbW9kZSc7IH1cblxuICB2YXIgcHJlZmVyZW5jZSA9IG8uc3RvcmFnZSAmJiBKU09OLnBhcnNlKGxvY2FsU3RvcmFnZS5nZXRJdGVtKG8uc3RvcmFnZSkpO1xuICBpZiAocHJlZmVyZW5jZSkge1xuICAgIG8uZGVmYXVsdE1vZGUgPSBwcmVmZXJlbmNlO1xuICB9XG5cbiAgdGhpcy5jb21wb25lbnRzID0ge1xuICAgIHRleHRhcmVhOiB0ZXh0YXJlYSxcbiAgICBwYXJlbnQ6IHRleHRhcmVhLnBhcmVudE5vZGUsXG4gICAgZHJvcGFyZWE6IHRhZyh7IGM6ICd3ay1jb250YWluZXItZHJvcCcgfSksXG4gICAgc3dpdGNoYm9hcmQ6IHRhZyh7IGM6ICd3ay1zd2l0Y2hib2FyZCcgfSksXG4gICAgY29tbWFuZHM6IHRhZyh7IGM6ICd3ay1jb21tYW5kcycgfSksXG4gIH07XG5cbiAgdGhpcy5zaG9ydGN1dHMgPSBuZXcgU2hvcnRjdXRNYW5hZ2VyKCk7XG4gIHRoaXMubW9kZXMgPSB7fTtcbiAgdGhpcy5tb2RlID0gJ21hcmtkb3duJzsgLy8gV2hpbGUgaW5pdGlhbGl6aW5nIHdlIGFyZSBhbHdheXMgc2hvd2luZyB0aGUgdGV4dGFyZWEgXCJtYXJrZG93blwiIHZpZXdcblxuICB0YWcoeyB0OiAnc3BhbicsIGM6ICd3ay1kcm9wLXRleHQnLCB4OiBzdHJpbmdzLnByb21wdHMuZHJvcCwgcDogdGhpcy5jb21wb25lbnRzLmRyb3BhcmVhIH0pO1xuICB0YWcoeyB0OiAncCcsIGM6IFsnd2stZHJvcC1pY29uJ10uY29uY2F0KG8uY2xhc3Nlcy5kcm9waWNvbikuam9pbignICcpLCBwOiB0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEgfSk7XG5cbiAgLy8gQXR0YWNoIENvbXBvbmVudHNcbiAgY2xhc3Nlcy5hZGQocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG4gIHBhcmVudC5pbnNlcnRCZWZvcmUodGhpcy5jb21wb25lbnRzLmNvbW1hbmRzLCB0aGlzLnRleHRhcmVhKTtcbiAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgcGFyZW50LmFwcGVuZENoaWxkKHRoaXMucGxhY2Vob2xkZXIpOyB9XG4gIHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmNvbXBvbmVudHMuc3dpdGNoYm9hcmQpO1xuICAvLyBUT0RPXG4gIC8vIGlmICh0aGlzLm9wdGlvbnMuaW1hZ2VzIHx8IHRoaXMub3B0aW9ucy5hdHRhY2htZW50cykge1xuICAgIC8vIHBhcmVudFttb3ZdKHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSk7XG4gICAgLy8gdXBsb2FkcyhwYXJlbnQsIHRoaXMuY29tcG9uZW50cy5kcm9wYXJlYSwgdGhpcywgbywgcmVtb3ZlKTtcbiAgLy8gfVxuXG4gIGlmKG8ubWFya2Rvd24pIHtcbiAgICB0aGlzLnJlZ2lzdGVyTW9kZSgnbWFya2Rvd24nLCBUZXh0U3VyZmFjZSwge1xuICAgICAgYWN0aXZlOiAoIW8uZGVmYXVsdE1vZGUgfHwgIW9bby5kZWZhdWx0TW9kZV0gfHwgby5kZWZhdWx0TW9kZSA9PT0gJ21hcmtkb3duJyksXG4gICAgICBzaG9ydGN1dEtleTogJ20nLFxuICAgIH0pO1xuICB9XG4gIGlmKG8ud3lzaXd5Zykge1xuICAgIHRoaXMucmVnaXN0ZXJNb2RlKCd3eXNpd3lnJywgV3lzaXd5Z1N1cmZhY2UsIHtcbiAgICAgIGFjdGl2ZTogby5kZWZhdWx0TW9kZSA9PT0gJ3d5c2l3eWcnIHx8ICFvLm1hcmtkb3duLFxuICAgICAgc2hvcnRjdXRLZXk6ICdwJyxcbiAgICAgIGNsYXNzZXM6IG8uY2xhc3Nlcy53eXNpd3lnIHx8IFtdLFxuICAgIH0pO1xuXG4gICAgdGhpcy5wbGFjZWhvbGRlciA9IHRhZyh7IGM6ICd3ay13eXNpd3lnLXBsYWNlaG9sZGVyIHdrLWhpZGUnLCB4OiB0ZXh0YXJlYS5wbGFjZWhvbGRlciB9KTtcbiAgICB0aGlzLnBsYWNlaG9sZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5tb2Rlcy53eXNpd3lnLnN1cmZhY2UuZm9jdXMuYmluZCh0aGlzLm1vZGVzLnd5c2l3eWcuc3VyZmFjZSkpO1xuICB9XG5cbiAgYmluZENvbW1hbmRzKHRoaXMsIG8pO1xufVxuXG5FZGl0b3IucHJvdG90eXBlLmdldFN1cmZhY2UgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLm1vZGVzW3RoaXMubW9kZV0uc3VyZmFjZTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuYWRkQ29tbWFuZCA9IGZ1bmN0aW9uIChrZXksIHNoaWZ0LCBmbikge1xuICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZm4gPSBzaGlmdDtcbiAgICBzaGlmdCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIHRoaXMuc2hvcnRjdXRzLmFkZChrZXksIHNoaWZ0LCBnZXRDb21tYW5kSGFuZGxlcih0aGlzLCB0aGlzLm1vZGVzW3RoaXMubW9kZV0uaGlzdG9yeSwgZm4pKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuYWRkQ29tbWFuZEJ1dHRvbiA9IGZ1bmN0aW9uIChpZCwga2V5LCBzaGlmdCwgZm4pIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBmbiA9IGtleTtcbiAgICBrZXkgPSB1bmRlZmluZWQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMykge1xuICAgIGZuID0gc2hpZnQ7XG4gICAgc2hpZnQgPSB1bmRlZmluZWQ7XG4gIH1cblxuICB2YXIgYnV0dG9uID0gdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1jb21tYW5kJywgcDogdGhpcy5jb21wb25lbnRzLmNvbW1hbmRzIH0pO1xuICB2YXIgY3VzdG9tID0gdGhpcy5vcHRpb25zLnJlbmRlci5jb21tYW5kcztcbiAgdmFyIHJlbmRlciA9IHR5cGVvZiBjdXN0b20gPT09ICdmdW5jdGlvbicgPyBjdXN0b20gOiByZW5kZXJlcnMuY29tbWFuZHM7XG4gIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgaWYgKHRpdGxlKSB7XG4gICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICB9XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuICByZW5kZXIoYnV0dG9uLCBpZCk7XG4gIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCBmbikpO1xuICBpZiAoa2V5KSB7XG4gICAgdGhpcy5hZGRDb21tYW5kKGtleSwgc2hpZnQsIGZuKTtcbiAgfVxuICByZXR1cm4gYnV0dG9uO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5ydW5Db21tYW5kID0gZnVuY3Rpb24gKGZuKSB7XG4gIGdldENvbW1hbmRIYW5kbGVyKHRoaXMsIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LCByZWFycmFuZ2UpKG51bGwpO1xuXG4gIGZ1bmN0aW9uIHJlYXJyYW5nZSAoZSwgbW9kZSwgY2h1bmtzKSB7XG4gICAgcmV0dXJuIGZuLmNhbGwodGhpcywgY2h1bmtzLCBtb2RlKTtcbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5wYXJzZU1hcmtkb3duID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5vcHRpb25zLnBhcnNlTWFya2Rvd24uYXBwbHkodGhpcy5vcHRpb25zLnBhcnNlTWFya2Rvd24sIGFyZ3VtZW50cyk7XG59O1xuXG5FZGl0b3IucHJvdG90eXBlLnBhcnNlSFRNTCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9ucy5wYXJzZUhUTUwuYXBwbHkodGhpcy5vcHRpb25zLnBhcnNlSFRNTCwgYXJndW1lbnRzKTtcbn07XG5cbkVkaXRvci5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uICgpIHtcbiAgaWYgKHRoaXMubW9kZSAhPT0gJ21hcmtkb3duJykge1xuICAgIHRoaXMudGV4dGFyZWEudmFsdWUgPSB0aGlzLmdldE1hcmtkb3duKCk7XG4gIH1cbiAgY2xhc3Nlcy5ybSh0aGlzLnRleHRhcmVhLCAnd2staGlkZScpO1xuXG4gIHRoaXMuc2hvcnRjdXRzLmNsZWFyKCk7XG5cbiAgdmFyIHBhcmVudCA9IHRoaXMuY29tcG9uZW50cy5wYXJlbnQ7XG4gIGNsYXNzZXMucm0ocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG5cbiAgLy8gUmVtb3ZlIGNvbXBvbmVudHNcbiAgcGFyZW50LnJlbW92ZUNoaWxkKHRoaXMuY29tcG9uZW50cy5jb21tYW5kcyk7XG4gIGlmICh0aGlzLnBsYWNlaG9sZGVyKSB7IHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLnBsYWNlaG9sZGVyKTsgfVxuICBwYXJlbnQucmVtb3ZlQ2hpbGQodGhpcy5jb21wb25lbnRzLnN3aXRjaGJvYXJkKTtcblxuICAvLyBSZW1vdmUgYWxsIG1vZGVzIHRoYXQgYXJlbid0IHVzaW5nIHRoZSB0ZXh0YXJlYVxuICB2YXIgbW9kZXMgPSBPYmplY3Qua2V5cyh0aGlzLm1vZGVzKTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBtb2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChtb2RlKSB7XG4gICAgaWYoc2VsZi5tb2Rlc1ttb2RlXS5lbGVtZW50ICE9PSBzZWxmLnRleHRhcmVhKSB7XG4gICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQoc2VsZi5tb2Rlc1ttb2RlXS5lbGVtZW50KTtcbiAgICB9XG4gICAgLy8gVE9ETyBEZXRhY2ggY2hhbmdlIGV2ZW50IGxpc3RlbmVycyBmb3Igc3VyZmFjZSBlbGVtZW50c1xuICAgIHRoaXMuc2hvcnRjdXRzLmRldGFjaChzZWxmLm1vZGVzW21vZGVdLmVsZW1lbnQpO1xuICB9KTtcblxuICAvLyBUT0RPXG4gIC8vIGlmICh0aGlzLm9wdGlvbnMuaW1hZ2VzIHx8IHRoaXMub3B0aW9ucy5hdHRhY2htZW50cykge1xuICAgIC8vIHBhcmVudC5yZW1vdmVDaGlsZCh0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEpO1xuICAgIC8vIHVwbG9hZHMocGFyZW50LCB0aGlzLmNvbXBvbmVudHMuZHJvcGFyZWEsIHRoaXMsIG8sIHJlbW92ZSk7XG4gIC8vIH1cbn07XG5cbkVkaXRvci5wcm90b3R5cGUudmFsdWUgPSBmdW5jdGlvbiBnZXRPclNldFZhbHVlIChpbnB1dCkge1xuICB2YXIgbWFya2Rvd24gPSBTdHJpbmcoaW5wdXQpO1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgdmFyIHNldHMgPSBhcmd1bWVudHMubGVuZ3RoID09PSAxO1xuICBpZiAoc2V0cykge1xuICAgIGlmICh0aGlzLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgbWFya2Rvd24gPSBhc0h0bWwoKTtcbiAgICB9XG4gICAgdGhpcy5nZXRTdXJmYWNlKCkud3JpdGUobWFya2Rvd24pO1xuICAgIHRoaXMubW9kZXNbdGhpcy5tb2RlXS5oaXN0b3J5LnJlc2V0KCk7XG4gIH1cblxuICByZXR1cm4gdGhpcy5nZXRNYXJrZG93bigpO1xuXG4gIGZ1bmN0aW9uIGFzSHRtbCAoKSB7XG4gICAgcmV0dXJuIHNlbGYub3B0aW9ucy5wYXJzZU1hcmtkb3duKG1hcmtkb3duKTtcbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5yZWdpc3Rlck1vZGUgPSBmdW5jdGlvbiAobmFtZSwgTW9kZSwgb3B0aW9ucykge1xuICB2YXIgYnV0dG9uQ2xhc3NlcyA9IFsnd2stbW9kZSddO1xuICBpZihvcHRpb25zLmFjdGl2ZSkge1xuICAgIGJ1dHRvbkNsYXNzZXMucHVzaCgnd2stbW9kZS1hY3RpdmUnKTtcbiAgfSBlbHNlIHtcbiAgICBidXR0b25DbGFzc2VzLnB1c2goJ3drLW1vZGUtaW5hY3RpdmUnKTtcbiAgfVxuXG4gIHZhciBzdG9yZWQgPSB0aGlzLm1vZGVzW25hbWVdID0ge1xuICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6IGJ1dHRvbkNsYXNzZXMuam9pbignICcpIH0pLFxuICAgIHN1cmZhY2U6IG5ldyBNb2RlKHRoaXMsIG9wdGlvbnMpLFxuICB9O1xuXG4gIHN0b3JlZC5lbGVtZW50ID0gc3RvcmVkLnN1cmZhY2UuY3VycmVudCgpO1xuICBzdG9yZWQuaGlzdG9yeSA9IG5ldyBJbnB1dEhpc3Rvcnkoc3RvcmVkLnN1cmZhY2UsIG5hbWUpO1xuXG4gIGlmKHN0b3JlZC5lbGVtZW50ICE9PSB0aGlzLnRleHRhcmVhKSB7XG4gICAgLy8gV2UgbmVlZCB0byBhdHRhY2ggdGhlIGVsZW1lbnRcbiAgICB0aGlzLmNvbXBvbmVudHMucGFyZW50Lmluc2VydEJlZm9yZShzdG9yZWQuZWxlbWVudCwgdGhpcy5jb21wb25lbnRzLnN3aXRjaGJvYXJkKTtcbiAgfVxuXG4gIC8vIEF0dGFjaCBidXR0b25cbiAgdGhpcy5jb21wb25lbnRzLnN3aXRjaGJvYXJkLmFwcGVuZENoaWxkKHN0b3JlZC5idXR0b24pO1xuICBzdG9yZWQuYnV0dG9uLnRleHRDb250ZW50ID0gc3RyaW5ncy5tb2Rlc1tuYW1lXSB8fCBuYW1lO1xuICBzdG9yZWQuYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgdGhpcy5zZXRNb2RlLmJpbmQodGhpcywgbmFtZSkpO1xuICBzdG9yZWQuYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgc3RvcmVkLmJ1dHRvbi50YWJJbmRleCA9IC0xOyAvLyBUT0RPIEludmVzdGlnYXRlIGJldHRlciB3YXlzIHRvIGJ5cGFzcyBpc3N1ZXMgaGVyZSBmb3IgYWNjZXNzaWJpbGl0eVxuICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tuYW1lXTtcbiAgaWYgKHRpdGxlKSB7XG4gICAgc3RvcmVkLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgbWFjID8gbWFjaWZ5KHRpdGxlKSA6IHRpdGxlKTtcbiAgfVxuXG4gIC8vIFJlZ2lzdGVyIHNob3J0Y3V0XG4gIHRoaXMuc2hvcnRjdXRzLmF0dGFjaChzdG9yZWQuZWxlbWVudCk7XG4gIGlmKG9wdGlvbnMuc2hvcnRjdXRLZXkpIHtcbiAgICB0aGlzLnNob3J0Y3V0cy5hZGQob3B0aW9ucy5zaG9ydGN1dEtleSwgISFvcHRpb25zLnNoaWZ0LCB0aGlzLnNldE1vZGUuYmluZCh0aGlzLCBuYW1lKSk7XG4gIH1cblxuICAvLyBTZXQgTW9kZSBpZiBBY3RpdmVcbiAgaWYob3B0aW9ucy5hY3RpdmUpIHtcbiAgICB0aGlzLnNldE1vZGUobmFtZSk7XG4gICAgc3RvcmVkLmJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgdHJ1ZSk7XG4gIH1cblxuICByZXR1cm4gc3RvcmVkO1xufTtcblxuRWRpdG9yLnByb3RvdHlwZS5zZXRNb2RlID0gZnVuY3Rpb24gKGdvVG9Nb2RlLCBlKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGN1cnJlbnRNb2RlID0gdGhpcy5tb2Rlc1t0aGlzLm1vZGVdIHx8IHt9O1xuICB2YXIgbmV4dE1vZGUgPSB0aGlzLm1vZGVzW2dvVG9Nb2RlXTtcbiAgdmFyIG9sZCA9IGN1cnJlbnRNb2RlLmJ1dHRvbjtcbiAgdmFyIGJ1dHRvbiA9IG5leHRNb2RlLmJ1dHRvbjtcbiAgdmFyIGZvY3VzaW5nID0gISFlIHx8IGRvYy5hY3RpdmVFbGVtZW50ID09PSBjdXJyZW50TW9kZS5lbGVtZW50IHx8IGRvYy5hY3RpdmVFbGVtZW50ID09PSBuZXh0TW9kZS5lbGVtZW50O1xuXG4gIHN0b3AoZSk7XG5cbiAgaWYgKGN1cnJlbnRNb2RlID09PSBuZXh0TW9kZSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMudGV4dGFyZWEuYmx1cigpOyAvLyBhdmVydCBjaHJvbWUgcmVwYWludCBidWdzXG5cbiAgY3VycmVudE1vZGUuc3VyZmFjZS5vZmYoJ2NoYW5nZScsIHN0YXNoQ2hhbmdlcyk7XG4gIG5leHRNb2RlLnN1cmZhY2Uud3JpdGVNYXJrZG93bihjdXJyZW50TW9kZS5zdXJmYWNlLnRvTWFya2Rvd24oKSk7XG4gIG5leHRNb2RlLnN1cmZhY2Uub24oJ2NoYW5nZScsIHN0YXNoQ2hhbmdlcyk7XG5cbiAgY2xhc3Nlcy5hZGQoY3VycmVudE1vZGUuZWxlbWVudCwgJ3drLWhpZGUnKTtcbiAgY2xhc3Nlcy5ybShuZXh0TW9kZS5lbGVtZW50LCAnd2staGlkZScpO1xuXG4gIGlmIChnb1RvTW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgY2xhc3Nlcy5ybSh0aGlzLnBsYWNlaG9sZGVyLCAnd2staGlkZScpOyB9XG4gIH0gZWxzZSB7XG4gICAgaWYgKHRoaXMucGxhY2Vob2xkZXIpIHsgY2xhc3Nlcy5hZGQodGhpcy5wbGFjZWhvbGRlciwgJ3drLWhpZGUnKTsgfVxuICB9XG5cbiAgaWYgKGZvY3VzaW5nKSB7XG4gICAgbmV4dE1vZGUuc3VyZmFjZS5mb2N1cygpO1xuICB9XG5cbiAgY2xhc3Nlcy5hZGQoYnV0dG9uLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgY2xhc3Nlcy5ybShvbGQsICd3ay1tb2RlLWFjdGl2ZScpO1xuICBjbGFzc2VzLmFkZChvbGQsICd3ay1tb2RlLWluYWN0aXZlJyk7XG4gIGNsYXNzZXMucm0oYnV0dG9uLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICBidXR0b24uc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICBvbGQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICB0aGlzLm1vZGUgPSBnb1RvTW9kZTtcblxuICBpZiAodGhpcy5vcHRpb25zLnN0b3JhZ2UpIHtcbiAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLm9wdGlvbnMuc3RvcmFnZSwgSlNPTi5zdHJpbmdpZnkoZ29Ub01vZGUpKTtcbiAgfVxuXG4gIC8vIHRoaXMuaGlzdG9yeS5zZXRJbnB1dE1vZGUoZ29Ub01vZGUpO1xuICBmaXJlTGF0ZXIuY2FsbCh0aGlzLCAnYmFya21hcmstbW9kZS1jaGFuZ2UnKTtcblxuICBmdW5jdGlvbiBzdGFzaENoYW5nZXMgKCkge1xuICAgIGlmKG5leHRNb2RlLmVsZW1lbnQgIT09IHNlbGYudGV4dGFyZWEpIHtcbiAgICAgIHNlbGYudGV4dGFyZWEudmFsdWUgPSBuZXh0TW9kZS5zdXJmYWNlLnRvTWFya2Rvd24oKTtcbiAgICAgIHV0aWxzLmRpc3BhdGNoQnJvd3NlckV2ZW50KHNlbGYudGV4dGFyZWEsICdpbnB1dCcpO1xuICAgICAgdXRpbHMuZGlzcGF0Y2hCcm93c2VyRXZlbnQoc2VsZi50ZXh0YXJlYSwgJ2NoYW5nZScpO1xuICAgIH1cbiAgfVxufTtcblxuRWRpdG9yLnByb3RvdHlwZS5nZXRNYXJrZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZ2V0U3VyZmFjZSgpLnRvTWFya2Rvd24oKTtcbn07XG5cbi8qXG4gIHZhciBlZGl0b3IgPSB7XG4gICAgYWRkQ29tbWFuZDogYWRkQ29tbWFuZCxcbiAgICBhZGRDb21tYW5kQnV0dG9uOiBhZGRDb21tYW5kQnV0dG9uLFxuICAgIHJ1bkNvbW1hbmQ6IHJ1bkNvbW1hbmQsXG4gICAgcGFyc2VNYXJrZG93bjogby5wYXJzZU1hcmtkb3duLFxuICAgIHBhcnNlSFRNTDogby5wYXJzZUhUTUwsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICB2YWx1ZTogZ2V0T3JTZXRWYWx1ZSxcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IG8ud3lzaXd5ZyA/IGVkaXRhYmxlIDogbnVsbCxcbiAgICBzZXRNb2RlOiBwZXJzaXN0TW9kZSxcbiAgICBoaXN0b3J5OiB7XG4gICAgICB1bmRvOiBoaXN0b3J5LnVuZG8sXG4gICAgICByZWRvOiBoaXN0b3J5LnJlZG8sXG4gICAgICBjYW5VbmRvOiBoaXN0b3J5LmNhblVuZG8sXG4gICAgICBjYW5SZWRvOiBoaXN0b3J5LmNhblJlZG9cbiAgICB9LFxuICAgIG1vZGU6ICdtYXJrZG93bidcbiAgfTtcbiovXG5cbmZ1bmN0aW9uIGZpcmVMYXRlciAodHlwZSkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24gZmlyZSAoKSB7XG4gICAgdXRpbHMuZGlzcGF0Y2hDdXN0b21FdmVudChzZWxmLnRleHRhcmVhLCB0eXBlKTtcbiAgfSwgMCk7XG59XG5cbmZ1bmN0aW9uIHRhZyAob3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KG8udCB8fCAnZGl2Jyk7XG4gIGVsLmNsYXNzTmFtZSA9IG8uYyB8fCAnJztcbiAgZWwudGV4dENvbnRlbnQgPSBvLnggfHwgJyc7XG4gIGlmIChvLnApIHsgby5wLmFwcGVuZENoaWxkKGVsKTsgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgaWYgKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpOyB9XG59XG5cbmZ1bmN0aW9uIG1hY2lmeSAodGV4dCkge1xuICByZXR1cm4gdGV4dFxuICAgIC5yZXBsYWNlKC9cXGJjdHJsXFxiL2ksICdcXHUyMzE4JylcbiAgICAucmVwbGFjZSgvXFxiYWx0XFxiL2ksICdcXHUyMzI1JylcbiAgICAucmVwbGFjZSgvXFxic2hpZnRcXGIvaSwgJ1xcdTIxZTcnKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBFZGl0b3I7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OWxaR2wwYjNJdWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklqdEJRVUZCTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlIVjBhV3h6SUQwZ2NtVnhkV2x5WlNnbkxpOTFkR2xzY3ljcE8xeHVMeThnZG1GeUlIVndiRzloWkhNZ1BTQnlaWEYxYVhKbEtDY3VMM1Z3Ykc5aFpITW5LVHRjYm5aaGNpQnpkSEpwYm1keklEMGdjbVZ4ZFdseVpTZ25MaTl6ZEhKcGJtZHpKeWs3WEc1MllYSWdZbWx1WkVOdmJXMWhibVJ6SUQwZ2NtVnhkV2x5WlNnbkxpOWlhVzVrUTI5dGJXRnVaSE1uS1R0Y2JuWmhjaUJKYm5CMWRFaHBjM1J2Y25rZ1BTQnlaWEYxYVhKbEtDY3VMMGx1Y0hWMFNHbHpkRzl5ZVNjcE8xeHVkbUZ5SUZOb2IzSjBZM1YwVFdGdVlXZGxjaUE5SUhKbGNYVnBjbVVvSnk0dmMyaHZjblJqZFhSekp5azdYRzUyWVhJZ1oyVjBRMjl0YldGdVpFaGhibVJzWlhJZ1BTQnlaWEYxYVhKbEtDY3VMMmRsZEVOdmJXMWhibVJJWVc1a2JHVnlKeWs3WEc1MllYSWdWR1Y0ZEZOMWNtWmhZMlVnUFNCeVpYRjFhWEpsS0NjdUwyMXZaR1Z6TDIxaGNtdGtiM2R1TDNSbGVIUmhjbVZoVTNWeVptRmpaU2NwTzF4dWRtRnlJRmQ1YzJsM2VXZFRkWEptWVdObElEMGdjbVZ4ZFdseVpTZ25MaTl0YjJSbGN5OTNlWE5wZDNsbkwzZDVjMmwzZVdkVGRYSm1ZV05sSnlrN1hHNTJZWElnWTJ4aGMzTmxjeUE5SUhKbGNYVnBjbVVvSnk0dlkyeGhjM05sY3ljcE8xeHVkbUZ5SUhKbGJtUmxjbVZ5Y3lBOUlISmxjWFZwY21Vb0p5NHZjbVZ1WkdWeVpYSnpKeWs3WEc1MllYSWdjSEp2YlhCMElEMGdjbVZ4ZFdseVpTZ25MaTl3Y205dGNIUnpMM0J5YjIxd2RDY3BPMXh1ZG1GeUlHTnNiM05sVUhKdmJYQjBjeUE5SUhKbGNYVnBjbVVvSnk0dmNISnZiWEIwY3k5amJHOXpaU2NwTzF4dWRtRnlJRzFoWXlBOUlDOWNYR0pOWVdNZ1QxTmNYR0l2TG5SbGMzUW9aMnh2WW1Gc0xtNWhkbWxuWVhSdmNpNTFjMlZ5UVdkbGJuUXBPMXh1ZG1GeUlHUnZZeUE5SUdSdlkzVnRaVzUwTzF4dVhHNW1kVzVqZEdsdmJpQkZaR2wwYjNJZ0tIUmxlSFJoY21WaExDQnZjSFJwYjI1ektTQjdYRzRnSUhSb2FYTXVkR1Y0ZEdGeVpXRWdQU0IwWlhoMFlYSmxZVHRjYmlBZ2RtRnlJSEJoY21WdWRDQTlJSFJsZUhSaGNtVmhMbkJoY21WdWRFNXZaR1U3WEc0Z0lIWmhjaUJ2SUQwZ2RHaHBjeTV2Y0hScGIyNXpJRDBnZFhScGJITXVaR1ZtWVhWc2RITkVaV1Z3S0c5d2RHbHZibk1nZkh3Z2UzMHNJSHRjYmlBZ0lDQXZMeUJFWldaaGRXeDBJRTl3ZEdsdmJpQldZV3gxWlhOY2JpQWdJQ0J0WVhKclpHOTNiam9nZEhKMVpTeGNiaUFnSUNCM2VYTnBkM2xuT2lCMGNuVmxMRnh1SUNBZ0lHaHlPaUJtWVd4elpTeGNiaUFnSUNCemRHOXlZV2RsT2lCMGNuVmxMRnh1SUNBZ0lHWmxibU5wYm1jNklIUnlkV1VzWEc0Z0lDQWdjbVZ1WkdWeU9pQjdYRzRnSUNBZ0lDQnRiMlJsY3pvZ2UzMHNYRzRnSUNBZ0lDQmpiMjF0WVc1a2N6b2dlMzBzWEc0Z0lDQWdmU3hjYmlBZ0lDQndjbTl0Y0hSek9pQjdYRzRnSUNBZ0lDQnNhVzVyT2lCd2NtOXRjSFFzWEc0Z0lDQWdJQ0JwYldGblpUb2djSEp2YlhCMExGeHVJQ0FnSUNBZ1lYUjBZV05vYldWdWREb2djSEp2YlhCMExGeHVJQ0FnSUNBZ1kyeHZjMlU2SUdOc2IzTmxVSEp2YlhCMGN5eGNiaUFnSUNCOUxGeHVJQ0FnSUdOc1lYTnpaWE02SUh0Y2JpQWdJQ0FnSUhkNWMybDNlV2M2SUZ0ZExGeHVJQ0FnSUNBZ2NISnZiWEIwY3pvZ2UzMHNYRzRnSUNBZ0lDQnBibkIxZERvZ2UzMHNYRzRnSUNBZ2ZTeGNiaUFnZlNrN1hHNWNiaUFnYVdZZ0tDRnZMbTFoY210a2IzZHVJQ1ltSUNGdkxuZDVjMmwzZVdjcElIdGNiaUFnSUNCMGFISnZkeUJ1WlhjZ1JYSnliM0lvSjJKaGNtdHRZWEpySUdWNGNHVmpkSE1nWVhRZ2JHVmhjM1FnYjI1bElHbHVjSFYwSUcxdlpHVWdkRzhnWW1VZ1lYWmhhV3hoWW14bEp5azdYRzRnSUgxY2JseHVJQ0JwWmlBb2J5NXpkRzl5WVdkbElEMDlQU0IwY25WbEtTQjdJRzh1YzNSdmNtRm5aU0E5SUNkaVlYSnJiV0Z5YTE5cGJuQjFkRjl0YjJSbEp6c2dmVnh1WEc0Z0lIWmhjaUJ3Y21WbVpYSmxibU5sSUQwZ2J5NXpkRzl5WVdkbElDWW1JRXBUVDA0dWNHRnljMlVvYkc5allXeFRkRzl5WVdkbExtZGxkRWwwWlcwb2J5NXpkRzl5WVdkbEtTazdYRzRnSUdsbUlDaHdjbVZtWlhKbGJtTmxLU0I3WEc0Z0lDQWdieTVrWldaaGRXeDBUVzlrWlNBOUlIQnlaV1psY21WdVkyVTdYRzRnSUgxY2JseHVJQ0IwYUdsekxtTnZiWEJ2Ym1WdWRITWdQU0I3WEc0Z0lDQWdkR1Y0ZEdGeVpXRTZJSFJsZUhSaGNtVmhMRnh1SUNBZ0lIQmhjbVZ1ZERvZ2RHVjRkR0Z5WldFdWNHRnlaVzUwVG05a1pTeGNiaUFnSUNCa2NtOXdZWEpsWVRvZ2RHRm5LSHNnWXpvZ0ozZHJMV052Ym5SaGFXNWxjaTFrY205d0p5QjlLU3hjYmlBZ0lDQnpkMmwwWTJoaWIyRnlaRG9nZEdGbktIc2dZem9nSjNkckxYTjNhWFJqYUdKdllYSmtKeUI5S1N4Y2JpQWdJQ0JqYjIxdFlXNWtjem9nZEdGbktIc2dZem9nSjNkckxXTnZiVzFoYm1Sekp5QjlLU3hjYmlBZ2ZUdGNibHh1SUNCMGFHbHpMbk5vYjNKMFkzVjBjeUE5SUc1bGR5QlRhRzl5ZEdOMWRFMWhibUZuWlhJb0tUdGNiaUFnZEdocGN5NXRiMlJsY3lBOUlIdDlPMXh1SUNCMGFHbHpMbTF2WkdVZ1BTQW5iV0Z5YTJSdmQyNG5PeUF2THlCWGFHbHNaU0JwYm1sMGFXRnNhWHBwYm1jZ2QyVWdZWEpsSUdGc2QyRjVjeUJ6YUc5M2FXNW5JSFJvWlNCMFpYaDBZWEpsWVNCY0ltMWhjbXRrYjNkdVhDSWdkbWxsZDF4dVhHNGdJSFJoWnloN0lIUTZJQ2R6Y0dGdUp5d2dZem9nSjNkckxXUnliM0F0ZEdWNGRDY3NJSGc2SUhOMGNtbHVaM011Y0hKdmJYQjBjeTVrY205d0xDQndPaUIwYUdsekxtTnZiWEJ2Ym1WdWRITXVaSEp2Y0dGeVpXRWdmU2s3WEc0Z0lIUmhaeWg3SUhRNklDZHdKeXdnWXpvZ1d5ZDNheTFrY205d0xXbGpiMjRuWFM1amIyNWpZWFFvYnk1amJHRnpjMlZ6TG1SeWIzQnBZMjl1S1M1cWIybHVLQ2NnSnlrc0lIQTZJSFJvYVhNdVkyOXRjRzl1Wlc1MGN5NWtjbTl3WVhKbFlTQjlLVHRjYmx4dUlDQXZMeUJCZEhSaFkyZ2dRMjl0Y0c5dVpXNTBjMXh1SUNCamJHRnpjMlZ6TG1Ga1pDaHdZWEpsYm5Rc0lDZDNheTFqYjI1MFlXbHVaWEluS1R0Y2JpQWdjR0Z5Wlc1MExtbHVjMlZ5ZEVKbFptOXlaU2gwYUdsekxtTnZiWEJ2Ym1WdWRITXVZMjl0YldGdVpITXNJSFJvYVhNdWRHVjRkR0Z5WldFcE8xeHVJQ0JwWmlBb2RHaHBjeTV3YkdGalpXaHZiR1JsY2lrZ2V5QndZWEpsYm5RdVlYQndaVzVrUTJocGJHUW9kR2hwY3k1d2JHRmpaV2h2YkdSbGNpazdJSDFjYmlBZ2NHRnlaVzUwTG1Gd2NHVnVaRU5vYVd4a0tIUm9hWE11WTI5dGNHOXVaVzUwY3k1emQybDBZMmhpYjJGeVpDazdYRzRnSUM4dklGUlBSRTljYmlBZ0x5OGdhV1lnS0hSb2FYTXViM0IwYVc5dWN5NXBiV0ZuWlhNZ2ZId2dkR2hwY3k1dmNIUnBiMjV6TG1GMGRHRmphRzFsYm5SektTQjdYRzRnSUNBZ0x5OGdjR0Z5Wlc1MFcyMXZkbDBvZEdocGN5NWpiMjF3YjI1bGJuUnpMbVJ5YjNCaGNtVmhLVHRjYmlBZ0lDQXZMeUIxY0d4dllXUnpLSEJoY21WdWRDd2dkR2hwY3k1amIyMXdiMjVsYm5SekxtUnliM0JoY21WaExDQjBhR2x6TENCdkxDQnlaVzF2ZG1VcE8xeHVJQ0F2THlCOVhHNWNiaUFnYVdZb2J5NXRZWEpyWkc5M2Jpa2dlMXh1SUNBZ0lIUm9hWE11Y21WbmFYTjBaWEpOYjJSbEtDZHRZWEpyWkc5M2JpY3NJRlJsZUhSVGRYSm1ZV05sTENCN1hHNGdJQ0FnSUNCaFkzUnBkbVU2SUNnaGJ5NWtaV1poZFd4MFRXOWtaU0I4ZkNBaGIxdHZMbVJsWm1GMWJIUk5iMlJsWFNCOGZDQnZMbVJsWm1GMWJIUk5iMlJsSUQwOVBTQW5iV0Z5YTJSdmQyNG5LU3hjYmlBZ0lDQWdJSE5vYjNKMFkzVjBTMlY1T2lBbmJTY3NYRzRnSUNBZ2ZTazdYRzRnSUgxY2JpQWdhV1lvYnk1M2VYTnBkM2xuS1NCN1hHNGdJQ0FnZEdocGN5NXlaV2RwYzNSbGNrMXZaR1VvSjNkNWMybDNlV2NuTENCWGVYTnBkM2xuVTNWeVptRmpaU3dnZTF4dUlDQWdJQ0FnWVdOMGFYWmxPaUJ2TG1SbFptRjFiSFJOYjJSbElEMDlQU0FuZDNsemFYZDVaeWNnZkh3Z0lXOHViV0Z5YTJSdmQyNHNYRzRnSUNBZ0lDQnphRzl5ZEdOMWRFdGxlVG9nSjNBbkxGeHVJQ0FnSUNBZ1kyeGhjM05sY3pvZ2J5NWpiR0Z6YzJWekxuZDVjMmwzZVdjZ2ZId2dXMTBzWEc0Z0lDQWdmU2s3WEc1Y2JpQWdJQ0IwYUdsekxuQnNZV05sYUc5c1pHVnlJRDBnZEdGbktIc2dZem9nSjNkckxYZDVjMmwzZVdjdGNHeGhZMlZvYjJ4a1pYSWdkMnN0YUdsa1pTY3NJSGc2SUhSbGVIUmhjbVZoTG5Cc1lXTmxhRzlzWkdWeUlIMHBPMXh1SUNBZ0lIUm9hWE11Y0d4aFkyVm9iMnhrWlhJdVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnblkyeHBZMnNuTENCMGFHbHpMbTF2WkdWekxuZDVjMmwzZVdjdWMzVnlabUZqWlM1bWIyTjFjeTVpYVc1a0tIUm9hWE11Ylc5a1pYTXVkM2x6YVhkNVp5NXpkWEptWVdObEtTazdYRzRnSUgxY2JseHVJQ0JpYVc1a1EyOXRiV0Z1WkhNb2RHaHBjeXdnYnlrN1hHNTlYRzVjYmtWa2FYUnZjaTV3Y205MGIzUjVjR1V1WjJWMFUzVnlabUZqWlNBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2NtVjBkWEp1SUhSb2FYTXViVzlrWlhOYmRHaHBjeTV0YjJSbFhTNXpkWEptWVdObE8xeHVmVHRjYmx4dVJXUnBkRzl5TG5CeWIzUnZkSGx3WlM1aFpHUkRiMjF0WVc1a0lEMGdablZ1WTNScGIyNGdLR3RsZVN3Z2MyaHBablFzSUdadUtTQjdYRzRnSUdsbUtHRnlaM1Z0Wlc1MGN5NXNaVzVuZEdnZ1BUMDlJRElwSUh0Y2JpQWdJQ0JtYmlBOUlITm9hV1owTzF4dUlDQWdJSE5vYVdaMElEMGdkVzVrWldacGJtVmtPMXh1SUNCOVhHNWNiaUFnZEdocGN5NXphRzl5ZEdOMWRITXVZV1JrS0d0bGVTd2djMmhwWm5Rc0lHZGxkRU52YlcxaGJtUklZVzVrYkdWeUtIUm9hWE1zSUhSb2FYTXViVzlrWlhOYmRHaHBjeTV0YjJSbFhTNW9hWE4wYjNKNUxDQm1iaWtwTzF4dWZUdGNibHh1UldScGRHOXlMbkJ5YjNSdmRIbHdaUzVoWkdSRGIyMXRZVzVrUW5WMGRHOXVJRDBnWm5WdVkzUnBiMjRnS0dsa0xDQnJaWGtzSUhOb2FXWjBMQ0JtYmlrZ2UxeHVJQ0JwWmlBb1lYSm5kVzFsYm5SekxteGxibWQwYUNBOVBUMGdNaWtnZTF4dUlDQWdJR1p1SUQwZ2EyVjVPMXh1SUNBZ0lHdGxlU0E5SUhWdVpHVm1hVzVsWkR0Y2JpQWdJQ0J6YUdsbWRDQTlJSFZ1WkdWbWFXNWxaRHRjYmlBZ2ZTQmxiSE5sSUdsbUlDaGhjbWQxYldWdWRITXViR1Z1WjNSb0lEMDlQU0F6S1NCN1hHNGdJQ0FnWm00Z1BTQnphR2xtZER0Y2JpQWdJQ0J6YUdsbWRDQTlJSFZ1WkdWbWFXNWxaRHRjYmlBZ2ZWeHVYRzRnSUhaaGNpQmlkWFIwYjI0Z1BTQjBZV2NvZXlCME9pQW5ZblYwZEc5dUp5d2dZem9nSjNkckxXTnZiVzFoYm1RbkxDQndPaUIwYUdsekxtTnZiWEJ2Ym1WdWRITXVZMjl0YldGdVpITWdmU2s3WEc0Z0lIWmhjaUJqZFhOMGIyMGdQU0IwYUdsekxtOXdkR2x2Ym5NdWNtVnVaR1Z5TG1OdmJXMWhibVJ6TzF4dUlDQjJZWElnY21WdVpHVnlJRDBnZEhsd1pXOW1JR04xYzNSdmJTQTlQVDBnSjJaMWJtTjBhVzl1SnlBL0lHTjFjM1J2YlNBNklISmxibVJsY21WeWN5NWpiMjF0WVc1a2N6dGNiaUFnZG1GeUlIUnBkR3hsSUQwZ2MzUnlhVzVuY3k1MGFYUnNaWE5iYVdSZE8xeHVJQ0JwWmlBb2RHbDBiR1VwSUh0Y2JpQWdJQ0JpZFhSMGIyNHVjMlYwUVhSMGNtbGlkWFJsS0NkMGFYUnNaU2NzSUcxaFl5QS9JRzFoWTJsbWVTaDBhWFJzWlNrZ09pQjBhWFJzWlNrN1hHNGdJSDFjYmlBZ1luVjBkRzl1TG5SNWNHVWdQU0FuWW5WMGRHOXVKenRjYmlBZ1luVjBkRzl1TG5SaFlrbHVaR1Y0SUQwZ0xURTdYRzRnSUhKbGJtUmxjaWhpZFhSMGIyNHNJR2xrS1R0Y2JpQWdZblYwZEc5dUxtRmtaRVYyWlc1MFRHbHpkR1Z1WlhJb0oyTnNhV05ySnl3Z1oyVjBRMjl0YldGdVpFaGhibVJzWlhJb2RHaHBjeXdnZEdocGN5NXRiMlJsYzF0MGFHbHpMbTF2WkdWZExtaHBjM1J2Y25rc0lHWnVLU2s3WEc0Z0lHbG1JQ2hyWlhrcElIdGNiaUFnSUNCMGFHbHpMbUZrWkVOdmJXMWhibVFvYTJWNUxDQnphR2xtZEN3Z1ptNHBPMXh1SUNCOVhHNGdJSEpsZEhWeWJpQmlkWFIwYjI0N1hHNTlPMXh1WEc1RlpHbDBiM0l1Y0hKdmRHOTBlWEJsTG5KMWJrTnZiVzFoYm1RZ1BTQm1kVzVqZEdsdmJpQW9abTRwSUh0Y2JpQWdaMlYwUTI5dGJXRnVaRWhoYm1Sc1pYSW9kR2hwY3l3Z2RHaHBjeTV0YjJSbGMxdDBhR2x6TG0xdlpHVmRMbWhwYzNSdmNua3NJSEpsWVhKeVlXNW5aU2tvYm5Wc2JDazdYRzVjYmlBZ1puVnVZM1JwYjI0Z2NtVmhjbkpoYm1kbElDaGxMQ0J0YjJSbExDQmphSFZ1YTNNcElIdGNiaUFnSUNCeVpYUjFjbTRnWm00dVkyRnNiQ2gwYUdsekxDQmphSFZ1YTNNc0lHMXZaR1VwTzF4dUlDQjlYRzU5TzF4dVhHNUZaR2wwYjNJdWNISnZkRzkwZVhCbExuQmhjbk5sVFdGeWEyUnZkMjRnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhKbGRIVnliaUIwYUdsekxtOXdkR2x2Ym5NdWNHRnljMlZOWVhKclpHOTNiaTVoY0hCc2VTaDBhR2x6TG05d2RHbHZibk11Y0dGeWMyVk5ZWEpyWkc5M2Jpd2dZWEpuZFcxbGJuUnpLVHRjYm4wN1hHNWNia1ZrYVhSdmNpNXdjbTkwYjNSNWNHVXVjR0Z5YzJWSVZFMU1JRDBnWm5WdVkzUnBiMjRnS0NrZ2UxeHVJQ0J5WlhSMWNtNGdkR2hwY3k1dmNIUnBiMjV6TG5CaGNuTmxTRlJOVEM1aGNIQnNlU2gwYUdsekxtOXdkR2x2Ym5NdWNHRnljMlZJVkUxTUxDQmhjbWQxYldWdWRITXBPMXh1ZlR0Y2JseHVSV1JwZEc5eUxuQnliM1J2ZEhsd1pTNWtaWE4wY205NUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQnBaaUFvZEdocGN5NXRiMlJsSUNFOVBTQW5iV0Z5YTJSdmQyNG5LU0I3WEc0Z0lDQWdkR2hwY3k1MFpYaDBZWEpsWVM1MllXeDFaU0E5SUhSb2FYTXVaMlYwVFdGeWEyUnZkMjRvS1R0Y2JpQWdmVnh1SUNCamJHRnpjMlZ6TG5KdEtIUm9hWE11ZEdWNGRHRnlaV0VzSUNkM2F5MW9hV1JsSnlrN1hHNWNiaUFnZEdocGN5NXphRzl5ZEdOMWRITXVZMnhsWVhJb0tUdGNibHh1SUNCMllYSWdjR0Z5Wlc1MElEMGdkR2hwY3k1amIyMXdiMjVsYm5SekxuQmhjbVZ1ZER0Y2JpQWdZMnhoYzNObGN5NXliU2h3WVhKbGJuUXNJQ2QzYXkxamIyNTBZV2x1WlhJbktUdGNibHh1SUNBdkx5QlNaVzF2ZG1VZ1kyOXRjRzl1Wlc1MGMxeHVJQ0J3WVhKbGJuUXVjbVZ0YjNabFEyaHBiR1FvZEdocGN5NWpiMjF3YjI1bGJuUnpMbU52YlcxaGJtUnpLVHRjYmlBZ2FXWWdLSFJvYVhNdWNHeGhZMlZvYjJ4a1pYSXBJSHNnY0dGeVpXNTBMbkpsYlc5MlpVTm9hV3hrS0hSb2FYTXVjR3hoWTJWb2IyeGtaWElwT3lCOVhHNGdJSEJoY21WdWRDNXlaVzF2ZG1WRGFHbHNaQ2gwYUdsekxtTnZiWEJ2Ym1WdWRITXVjM2RwZEdOb1ltOWhjbVFwTzF4dVhHNGdJQzh2SUZKbGJXOTJaU0JoYkd3Z2JXOWtaWE1nZEdoaGRDQmhjbVZ1SjNRZ2RYTnBibWNnZEdobElIUmxlSFJoY21WaFhHNGdJSFpoY2lCdGIyUmxjeUE5SUU5aWFtVmpkQzVyWlhsektIUm9hWE11Ylc5a1pYTXBPMXh1SUNCMllYSWdjMlZzWmlBOUlIUm9hWE03WEc0Z0lHMXZaR1Z6TG1admNrVmhZMmdvWm5WdVkzUnBiMjRnS0cxdlpHVXBJSHRjYmlBZ0lDQnBaaWh6Wld4bUxtMXZaR1Z6VzIxdlpHVmRMbVZzWlcxbGJuUWdJVDA5SUhObGJHWXVkR1Y0ZEdGeVpXRXBJSHRjYmlBZ0lDQWdJSEJoY21WdWRDNXlaVzF2ZG1WRGFHbHNaQ2h6Wld4bUxtMXZaR1Z6VzIxdlpHVmRMbVZzWlcxbGJuUXBPMXh1SUNBZ0lIMWNiaUFnSUNBdkx5QlVUMFJQSUVSbGRHRmphQ0JqYUdGdVoyVWdaWFpsYm5RZ2JHbHpkR1Z1WlhKeklHWnZjaUJ6ZFhKbVlXTmxJR1ZzWlcxbGJuUnpYRzRnSUNBZ2RHaHBjeTV6YUc5eWRHTjFkSE11WkdWMFlXTm9LSE5sYkdZdWJXOWtaWE5iYlc5a1pWMHVaV3hsYldWdWRDazdYRzRnSUgwcE8xeHVYRzRnSUM4dklGUlBSRTljYmlBZ0x5OGdhV1lnS0hSb2FYTXViM0IwYVc5dWN5NXBiV0ZuWlhNZ2ZId2dkR2hwY3k1dmNIUnBiMjV6TG1GMGRHRmphRzFsYm5SektTQjdYRzRnSUNBZ0x5OGdjR0Z5Wlc1MExuSmxiVzkyWlVOb2FXeGtLSFJvYVhNdVkyOXRjRzl1Wlc1MGN5NWtjbTl3WVhKbFlTazdYRzRnSUNBZ0x5OGdkWEJzYjJGa2N5aHdZWEpsYm5Rc0lIUm9hWE11WTI5dGNHOXVaVzUwY3k1a2NtOXdZWEpsWVN3Z2RHaHBjeXdnYnl3Z2NtVnRiM1psS1R0Y2JpQWdMeThnZlZ4dWZUdGNibHh1UldScGRHOXlMbkJ5YjNSdmRIbHdaUzUyWVd4MVpTQTlJR1oxYm1OMGFXOXVJR2RsZEU5eVUyVjBWbUZzZFdVZ0tHbHVjSFYwS1NCN1hHNGdJSFpoY2lCdFlYSnJaRzkzYmlBOUlGTjBjbWx1WnlocGJuQjFkQ2s3WEc0Z0lIWmhjaUJ6Wld4bUlEMGdkR2hwY3p0Y2JseHVJQ0IyWVhJZ2MyVjBjeUE5SUdGeVozVnRaVzUwY3k1c1pXNW5kR2dnUFQwOUlERTdYRzRnSUdsbUlDaHpaWFJ6S1NCN1hHNGdJQ0FnYVdZZ0tIUm9hWE11Ylc5a1pTQTlQVDBnSjNkNWMybDNlV2NuS1NCN1hHNGdJQ0FnSUNCdFlYSnJaRzkzYmlBOUlHRnpTSFJ0YkNncE8xeHVJQ0FnSUgxY2JpQWdJQ0IwYUdsekxtZGxkRk4xY21aaFkyVW9LUzUzY21sMFpTaHRZWEpyWkc5M2JpazdYRzRnSUNBZ2RHaHBjeTV0YjJSbGMxdDBhR2x6TG0xdlpHVmRMbWhwYzNSdmNua3VjbVZ6WlhRb0tUdGNiaUFnZlZ4dVhHNGdJSEpsZEhWeWJpQjBhR2x6TG1kbGRFMWhjbXRrYjNkdUtDazdYRzVjYmlBZ1puVnVZM1JwYjI0Z1lYTklkRzFzSUNncElIdGNiaUFnSUNCeVpYUjFjbTRnYzJWc1ppNXZjSFJwYjI1ekxuQmhjbk5sVFdGeWEyUnZkMjRvYldGeWEyUnZkMjRwTzF4dUlDQjlYRzU5TzF4dVhHNUZaR2wwYjNJdWNISnZkRzkwZVhCbExuSmxaMmx6ZEdWeVRXOWtaU0E5SUdaMWJtTjBhVzl1SUNodVlXMWxMQ0JOYjJSbExDQnZjSFJwYjI1ektTQjdYRzRnSUhaaGNpQmlkWFIwYjI1RGJHRnpjMlZ6SUQwZ1d5ZDNheTF0YjJSbEoxMDdYRzRnSUdsbUtHOXdkR2x2Ym5NdVlXTjBhWFpsS1NCN1hHNGdJQ0FnWW5WMGRHOXVRMnhoYzNObGN5NXdkWE5vS0NkM2F5MXRiMlJsTFdGamRHbDJaU2NwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUdKMWRIUnZia05zWVhOelpYTXVjSFZ6YUNnbmQyc3RiVzlrWlMxcGJtRmpkR2wyWlNjcE8xeHVJQ0I5WEc1Y2JpQWdkbUZ5SUhOMGIzSmxaQ0E5SUhSb2FYTXViVzlrWlhOYmJtRnRaVjBnUFNCN1hHNGdJQ0FnWW5WMGRHOXVPaUIwWVdjb2V5QjBPaUFuWW5WMGRHOXVKeXdnWXpvZ1luVjBkRzl1UTJ4aGMzTmxjeTVxYjJsdUtDY2dKeWtnZlNrc1hHNGdJQ0FnYzNWeVptRmpaVG9nYm1WM0lFMXZaR1VvZEdocGN5d2diM0IwYVc5dWN5a3NYRzRnSUgwN1hHNWNiaUFnYzNSdmNtVmtMbVZzWlcxbGJuUWdQU0J6ZEc5eVpXUXVjM1Z5Wm1GalpTNWpkWEp5Wlc1MEtDazdYRzRnSUhOMGIzSmxaQzVvYVhOMGIzSjVJRDBnYm1WM0lFbHVjSFYwU0dsemRHOXllU2h6ZEc5eVpXUXVjM1Z5Wm1GalpTd2dibUZ0WlNrN1hHNWNiaUFnYVdZb2MzUnZjbVZrTG1Wc1pXMWxiblFnSVQwOUlIUm9hWE11ZEdWNGRHRnlaV0VwSUh0Y2JpQWdJQ0F2THlCWFpTQnVaV1ZrSUhSdklHRjBkR0ZqYUNCMGFHVWdaV3hsYldWdWRGeHVJQ0FnSUhSb2FYTXVZMjl0Y0c5dVpXNTBjeTV3WVhKbGJuUXVhVzV6WlhKMFFtVm1iM0psS0hOMGIzSmxaQzVsYkdWdFpXNTBMQ0IwYUdsekxtTnZiWEJ2Ym1WdWRITXVjM2RwZEdOb1ltOWhjbVFwTzF4dUlDQjlYRzVjYmlBZ0x5OGdRWFIwWVdOb0lHSjFkSFJ2Ymx4dUlDQjBhR2x6TG1OdmJYQnZibVZ1ZEhNdWMzZHBkR05vWW05aGNtUXVZWEJ3Wlc1a1EyaHBiR1FvYzNSdmNtVmtMbUoxZEhSdmJpazdYRzRnSUhOMGIzSmxaQzVpZFhSMGIyNHVkR1Y0ZEVOdmJuUmxiblFnUFNCemRISnBibWR6TG0xdlpHVnpXMjVoYldWZElIeDhJRzVoYldVN1hHNGdJSE4wYjNKbFpDNWlkWFIwYjI0dVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnblkyeHBZMnNuTENCMGFHbHpMbk5sZEUxdlpHVXVZbWx1WkNoMGFHbHpMQ0J1WVcxbEtTazdYRzRnSUhOMGIzSmxaQzVpZFhSMGIyNHVkSGx3WlNBOUlDZGlkWFIwYjI0bk8xeHVJQ0J6ZEc5eVpXUXVZblYwZEc5dUxuUmhZa2x1WkdWNElEMGdMVEU3SUM4dklGUlBSRThnU1c1MlpYTjBhV2RoZEdVZ1ltVjBkR1Z5SUhkaGVYTWdkRzhnWW5sd1lYTnpJR2x6YzNWbGN5Qm9aWEpsSUdadmNpQmhZMk5sYzNOcFltbHNhWFI1WEc0Z0lIWmhjaUIwYVhSc1pTQTlJSE4wY21sdVozTXVkR2wwYkdWelcyNWhiV1ZkTzF4dUlDQnBaaUFvZEdsMGJHVXBJSHRjYmlBZ0lDQnpkRzl5WldRdVluVjBkRzl1TG5ObGRFRjBkSEpwWW5WMFpTZ25kR2wwYkdVbkxDQnRZV01nUHlCdFlXTnBabmtvZEdsMGJHVXBJRG9nZEdsMGJHVXBPMXh1SUNCOVhHNWNiaUFnTHk4Z1VtVm5hWE4wWlhJZ2MyaHZjblJqZFhSY2JpQWdkR2hwY3k1emFHOXlkR04xZEhNdVlYUjBZV05vS0hOMGIzSmxaQzVsYkdWdFpXNTBLVHRjYmlBZ2FXWW9iM0IwYVc5dWN5NXphRzl5ZEdOMWRFdGxlU2tnZTF4dUlDQWdJSFJvYVhNdWMyaHZjblJqZFhSekxtRmtaQ2h2Y0hScGIyNXpMbk5vYjNKMFkzVjBTMlY1TENBaElXOXdkR2x2Ym5NdWMyaHBablFzSUhSb2FYTXVjMlYwVFc5a1pTNWlhVzVrS0hSb2FYTXNJRzVoYldVcEtUdGNiaUFnZlZ4dVhHNGdJQzh2SUZObGRDQk5iMlJsSUdsbUlFRmpkR2wyWlZ4dUlDQnBaaWh2Y0hScGIyNXpMbUZqZEdsMlpTa2dlMXh1SUNBZ0lIUm9hWE11YzJWMFRXOWtaU2h1WVcxbEtUdGNiaUFnSUNCemRHOXlaV1F1WW5WMGRHOXVMbk5sZEVGMGRISnBZblYwWlNnblpHbHpZV0pzWldRbkxDQjBjblZsS1R0Y2JpQWdmVnh1WEc0Z0lISmxkSFZ5YmlCemRHOXlaV1E3WEc1OU8xeHVYRzVGWkdsMGIzSXVjSEp2ZEc5MGVYQmxMbk5sZEUxdlpHVWdQU0JtZFc1amRHbHZiaUFvWjI5VWIwMXZaR1VzSUdVcElIdGNiaUFnZG1GeUlITmxiR1lnUFNCMGFHbHpPMXh1SUNCMllYSWdZM1Z5Y21WdWRFMXZaR1VnUFNCMGFHbHpMbTF2WkdWelczUm9hWE11Ylc5a1pWMGdmSHdnZTMwN1hHNGdJSFpoY2lCdVpYaDBUVzlrWlNBOUlIUm9hWE11Ylc5a1pYTmJaMjlVYjAxdlpHVmRPMXh1SUNCMllYSWdiMnhrSUQwZ1kzVnljbVZ1ZEUxdlpHVXVZblYwZEc5dU8xeHVJQ0IyWVhJZ1luVjBkRzl1SUQwZ2JtVjRkRTF2WkdVdVluVjBkRzl1TzF4dUlDQjJZWElnWm05amRYTnBibWNnUFNBaElXVWdmSHdnWkc5akxtRmpkR2wyWlVWc1pXMWxiblFnUFQwOUlHTjFjbkpsYm5STmIyUmxMbVZzWlcxbGJuUWdmSHdnWkc5akxtRmpkR2wyWlVWc1pXMWxiblFnUFQwOUlHNWxlSFJOYjJSbExtVnNaVzFsYm5RN1hHNWNiaUFnYzNSdmNDaGxLVHRjYmx4dUlDQnBaaUFvWTNWeWNtVnVkRTF2WkdVZ1BUMDlJRzVsZUhSTmIyUmxLU0I3WEc0Z0lDQWdjbVYwZFhKdU8xeHVJQ0I5WEc1Y2JpQWdkR2hwY3k1MFpYaDBZWEpsWVM1aWJIVnlLQ2s3SUM4dklHRjJaWEowSUdOb2NtOXRaU0J5WlhCaGFXNTBJR0oxWjNOY2JseHVJQ0JqZFhKeVpXNTBUVzlrWlM1emRYSm1ZV05sTG05bVppZ25ZMmhoYm1kbEp5d2djM1JoYzJoRGFHRnVaMlZ6S1R0Y2JpQWdibVY0ZEUxdlpHVXVjM1Z5Wm1GalpTNTNjbWwwWlUxaGNtdGtiM2R1S0dOMWNuSmxiblJOYjJSbExuTjFjbVpoWTJVdWRHOU5ZWEpyWkc5M2JpZ3BLVHRjYmlBZ2JtVjRkRTF2WkdVdWMzVnlabUZqWlM1dmJpZ25ZMmhoYm1kbEp5d2djM1JoYzJoRGFHRnVaMlZ6S1R0Y2JseHVJQ0JqYkdGemMyVnpMbUZrWkNoamRYSnlaVzUwVFc5a1pTNWxiR1Z0Wlc1MExDQW5kMnN0YUdsa1pTY3BPMXh1SUNCamJHRnpjMlZ6TG5KdEtHNWxlSFJOYjJSbExtVnNaVzFsYm5Rc0lDZDNheTFvYVdSbEp5azdYRzVjYmlBZ2FXWWdLR2R2Vkc5TmIyUmxJRDA5UFNBbmQzbHphWGQ1WnljcElIdGNiaUFnSUNCcFppQW9kR2hwY3k1d2JHRmpaV2h2YkdSbGNpa2dleUJqYkdGemMyVnpMbkp0S0hSb2FYTXVjR3hoWTJWb2IyeGtaWElzSUNkM2F5MW9hV1JsSnlrN0lIMWNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQnBaaUFvZEdocGN5NXdiR0ZqWldodmJHUmxjaWtnZXlCamJHRnpjMlZ6TG1Ga1pDaDBhR2x6TG5Cc1lXTmxhRzlzWkdWeUxDQW5kMnN0YUdsa1pTY3BPeUI5WEc0Z0lIMWNibHh1SUNCcFppQW9abTlqZFhOcGJtY3BJSHRjYmlBZ0lDQnVaWGgwVFc5a1pTNXpkWEptWVdObExtWnZZM1Z6S0NrN1hHNGdJSDFjYmx4dUlDQmpiR0Z6YzJWekxtRmtaQ2hpZFhSMGIyNHNJQ2QzYXkxdGIyUmxMV0ZqZEdsMlpTY3BPMXh1SUNCamJHRnpjMlZ6TG5KdEtHOXNaQ3dnSjNkckxXMXZaR1V0WVdOMGFYWmxKeWs3WEc0Z0lHTnNZWE56WlhNdVlXUmtLRzlzWkN3Z0ozZHJMVzF2WkdVdGFXNWhZM1JwZG1VbktUdGNiaUFnWTJ4aGMzTmxjeTV5YlNoaWRYUjBiMjRzSUNkM2F5MXRiMlJsTFdsdVlXTjBhWFpsSnlrN1hHNGdJR0oxZEhSdmJpNXpaWFJCZEhSeWFXSjFkR1VvSjJScGMyRmliR1ZrSnl3Z0oyUnBjMkZpYkdWa0p5azdYRzRnSUc5c1pDNXlaVzF2ZG1WQmRIUnlhV0oxZEdVb0oyUnBjMkZpYkdWa0p5azdYRzRnSUhSb2FYTXViVzlrWlNBOUlHZHZWRzlOYjJSbE8xeHVYRzRnSUdsbUlDaDBhR2x6TG05d2RHbHZibk11YzNSdmNtRm5aU2tnZTF4dUlDQWdJR3h2WTJGc1UzUnZjbUZuWlM1elpYUkpkR1Z0S0hSb2FYTXViM0IwYVc5dWN5NXpkRzl5WVdkbExDQktVMDlPTG5OMGNtbHVaMmxtZVNobmIxUnZUVzlrWlNrcE8xeHVJQ0I5WEc1Y2JpQWdMeThnZEdocGN5NW9hWE4wYjNKNUxuTmxkRWx1Y0hWMFRXOWtaU2huYjFSdlRXOWtaU2s3WEc0Z0lHWnBjbVZNWVhSbGNpNWpZV3hzS0hSb2FYTXNJQ2RpWVhKcmJXRnlheTF0YjJSbExXTm9ZVzVuWlNjcE8xeHVYRzRnSUdaMWJtTjBhVzl1SUhOMFlYTm9RMmhoYm1kbGN5QW9LU0I3WEc0Z0lDQWdhV1lvYm1WNGRFMXZaR1V1Wld4bGJXVnVkQ0FoUFQwZ2MyVnNaaTUwWlhoMFlYSmxZU2tnZTF4dUlDQWdJQ0FnYzJWc1ppNTBaWGgwWVhKbFlTNTJZV3gxWlNBOUlHNWxlSFJOYjJSbExuTjFjbVpoWTJVdWRHOU5ZWEpyWkc5M2JpZ3BPMXh1SUNBZ0lDQWdkWFJwYkhNdVpHbHpjR0YwWTJoQ2NtOTNjMlZ5UlhabGJuUW9jMlZzWmk1MFpYaDBZWEpsWVN3Z0oybHVjSFYwSnlrN1hHNGdJQ0FnSUNCMWRHbHNjeTVrYVhOd1lYUmphRUp5YjNkelpYSkZkbVZ1ZENoelpXeG1MblJsZUhSaGNtVmhMQ0FuWTJoaGJtZGxKeWs3WEc0Z0lDQWdmVnh1SUNCOVhHNTlPMXh1WEc1RlpHbDBiM0l1Y0hKdmRHOTBlWEJsTG1kbGRFMWhjbXRrYjNkdUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQnlaWFIxY200Z2RHaHBjeTVuWlhSVGRYSm1ZV05sS0NrdWRHOU5ZWEpyWkc5M2JpZ3BPMXh1ZlR0Y2JseHVMeXBjYmlBZ2RtRnlJR1ZrYVhSdmNpQTlJSHRjYmlBZ0lDQmhaR1JEYjIxdFlXNWtPaUJoWkdSRGIyMXRZVzVrTEZ4dUlDQWdJR0ZrWkVOdmJXMWhibVJDZFhSMGIyNDZJR0ZrWkVOdmJXMWhibVJDZFhSMGIyNHNYRzRnSUNBZ2NuVnVRMjl0YldGdVpEb2djblZ1UTI5dGJXRnVaQ3hjYmlBZ0lDQndZWEp6WlUxaGNtdGtiM2R1T2lCdkxuQmhjbk5sVFdGeWEyUnZkMjRzWEc0Z0lDQWdjR0Z5YzJWSVZFMU1PaUJ2TG5CaGNuTmxTRlJOVEN4Y2JpQWdJQ0JrWlhOMGNtOTVPaUJrWlhOMGNtOTVMRnh1SUNBZ0lIWmhiSFZsT2lCblpYUlBjbE5sZEZaaGJIVmxMRnh1SUNBZ0lIUmxlSFJoY21WaE9pQjBaWGgwWVhKbFlTeGNiaUFnSUNCbFpHbDBZV0pzWlRvZ2J5NTNlWE5wZDNsbklEOGdaV1JwZEdGaWJHVWdPaUJ1ZFd4c0xGeHVJQ0FnSUhObGRFMXZaR1U2SUhCbGNuTnBjM1JOYjJSbExGeHVJQ0FnSUdocGMzUnZjbms2SUh0Y2JpQWdJQ0FnSUhWdVpHODZJR2hwYzNSdmNua3VkVzVrYnl4Y2JpQWdJQ0FnSUhKbFpHODZJR2hwYzNSdmNua3VjbVZrYnl4Y2JpQWdJQ0FnSUdOaGJsVnVaRzg2SUdocGMzUnZjbmt1WTJGdVZXNWtieXhjYmlBZ0lDQWdJR05oYmxKbFpHODZJR2hwYzNSdmNua3VZMkZ1VW1Wa2IxeHVJQ0FnSUgwc1hHNGdJQ0FnYlc5a1pUb2dKMjFoY210a2IzZHVKMXh1SUNCOU8xeHVLaTljYmx4dVpuVnVZM1JwYjI0Z1ptbHlaVXhoZEdWeUlDaDBlWEJsS1NCN1hHNGdJSFpoY2lCelpXeG1JRDBnZEdocGN6dGNiaUFnYzJWMFZHbHRaVzkxZENobWRXNWpkR2x2YmlCbWFYSmxJQ2dwSUh0Y2JpQWdJQ0IxZEdsc2N5NWthWE53WVhSamFFTjFjM1J2YlVWMlpXNTBLSE5sYkdZdWRHVjRkR0Z5WldFc0lIUjVjR1VwTzF4dUlDQjlMQ0F3S1R0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnZEdGbklDaHZjSFJwYjI1ektTQjdYRzRnSUhaaGNpQnZJRDBnYjNCMGFXOXVjeUI4ZkNCN2ZUdGNiaUFnZG1GeUlHVnNJRDBnWkc5akxtTnlaV0YwWlVWc1pXMWxiblFvYnk1MElIeDhJQ2RrYVhZbktUdGNiaUFnWld3dVkyeGhjM05PWVcxbElEMGdieTVqSUh4OElDY25PMXh1SUNCbGJDNTBaWGgwUTI5dWRHVnVkQ0E5SUc4dWVDQjhmQ0FuSnp0Y2JpQWdhV1lnS0c4dWNDa2dleUJ2TG5BdVlYQndaVzVrUTJocGJHUW9aV3dwT3lCOVhHNGdJSEpsZEhWeWJpQmxiRHRjYm4xY2JseHVablZ1WTNScGIyNGdjM1J2Y0NBb1pTa2dlMXh1SUNCcFppQW9aU2tnZXlCbExuQnlaWFpsYm5SRVpXWmhkV3gwS0NrN0lHVXVjM1J2Y0ZCeWIzQmhaMkYwYVc5dUtDazdJSDFjYm4xY2JseHVablZ1WTNScGIyNGdiV0ZqYVdaNUlDaDBaWGgwS1NCN1hHNGdJSEpsZEhWeWJpQjBaWGgwWEc0Z0lDQWdMbkpsY0d4aFkyVW9MMXhjWW1OMGNteGNYR0l2YVN3Z0oxeGNkVEl6TVRnbktWeHVJQ0FnSUM1eVpYQnNZV05sS0M5Y1hHSmhiSFJjWEdJdmFTd2dKMXhjZFRJek1qVW5LVnh1SUNBZ0lDNXlaWEJzWVdObEtDOWNYR0p6YUdsbWRGeGNZaTlwTENBblhGeDFNakZsTnljcE8xeHVmVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUVWa2FYUnZjanRjYmlKZGZRPT0iLCIndXNlIHN0cmljdCc7XG5cbi8vIEV2ZW50IE9iamVjdFxuZnVuY3Rpb24gRXZ0KG5hbWUsIGRldGFpbHMpIHtcbiAgdGhpcy5uYW1lID0gbmFtZTtcbiAgdGhpcy5kZXRhaWxzID0gZGV0YWlscztcbiAgdGhpcy5leGVjdXRpb25TdG9wcGVkID0gZmFsc2U7XG59XG5FdnQucHJvdG90eXBlLnN0b3BQcm9wYWdhdGlvbiA9IEV2dC5wcm90b3R5cGUuc3RvcEV4ZWN1dGlvbiA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5leGVjdXRpb25TdG9wcGVkID0gdHJ1ZTtcbn07XG5cbi8vIEV4dGVuc2lvbiBGdW5jdGlvbmFsaXR5XG5mdW5jdGlvbiBvbiAoZXZlbnQsIGNhbGxiYWNrKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgaWYoIXRoaXMuX2V2ZW50c1tldmVudF0pIHtcbiAgICB0aGlzLl9ldmVudHNbZXZlbnRdID0gW107XG4gIH1cblxuICB0aGlzLl9ldmVudHNbZXZlbnRdLnB1c2goY2FsbGJhY2spO1xufVxuXG5mdW5jdGlvbiBvZmYgKGV2ZW50LCBjYWxsYmFjaykge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIGlmKCF0aGlzLl9ldmVudHNbZXZlbnRdKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbZXZlbnRdO1xuICB9IGVsc2Uge1xuICAgIHZhciBpZHggPSB0aGlzLl9ldmVudHNbZXZlbnRdLmluZGV4T2YoY2FsbGJhY2spO1xuXG4gICAgaWYoaWR4IDwgMCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgICB0aGlzLl9ldmVudHNbZXZlbnRdLnNwbGljZShpZHgsIDEpO1xuXG4gICAgaWYoIXRoaXMuX2V2ZW50c1tldmVudF0ubGVuZ3RoKSB7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW2V2ZW50XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICBpZighdGhpcy5fZXZlbnRzW2V2ZW50XSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBldnQgPSBuZXcgRXZ0KGV2ZW50LCBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICBhcmdzLnVuc2hpZnQoZXZ0KTtcbiAgZm9yKHZhciBoID0gMDsgaCA8IHRoaXMuX2V2ZW50c1tldmVudF0ubGVuZ3RoOyBoKyspIHtcbiAgICB0aGlzLl9ldmVudHNbZXZlbnRdW2hdLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgIGlmKGV2dC5leGVjdXRpb25TdG9wcGVkKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZXZ0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZXh0ZW5kOiBmdW5jdGlvbiAob2JqKSB7XG4gICAgb2JqLnByb3RvdHlwZS5vbiA9IG9uLmJpbmQob2JqKTtcbiAgICBvYmoucHJvdG90eXBlLm9mZiA9IG9mZi5iaW5kKG9iaik7XG4gICAgb2JqLnByb3RvdHlwZS50cmlnZ2VyID0gdHJpZ2dlci5iaW5kKG9iaik7XG4gIH0sXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBleHRlbmRSZWdFeHAgKHJlZ2V4LCBwcmUsIHBvc3QpIHtcbiAgdmFyIHBhdHRlcm4gPSByZWdleC50b1N0cmluZygpO1xuICB2YXIgZmxhZ3M7XG5cbiAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSgvXFwvKFtnaW1dKikkLywgY2FwdHVyZUZsYWdzKTtcbiAgcGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSgvKF5cXC98XFwvJCkvZywgJycpO1xuICBwYXR0ZXJuID0gcHJlICsgcGF0dGVybiArIHBvc3Q7XG4gIHJldHVybiBuZXcgUmVnRXhwKHBhdHRlcm4sIGZsYWdzKTtcblxuICBmdW5jdGlvbiBjYXB0dXJlRmxhZ3MgKGFsbCwgZikge1xuICAgIGZsYWdzID0gZjtcbiAgICByZXR1cm4gJyc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBleHRlbmRSZWdFeHA7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGZpeEVPTCAodGV4dCkge1xuICByZXR1cm4gdGV4dC5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpLnJlcGxhY2UoL1xcci9nLCAnXFxuJyk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZml4RU9MO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgSW5wdXRTdGF0ZSA9IHJlcXVpcmUoJy4vSW5wdXRTdGF0ZScpO1xuXG5mdW5jdGlvbiBnZXRDb21tYW5kSGFuZGxlciAoZWRpdG9yLCBoaXN0b3J5LCBmbikge1xuICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlQ29tbWFuZCAoZSkge1xuICAgIHZhciBzdXJmYWNlID0gZWRpdG9yLmdldFN1cmZhY2UoKTtcbiAgICBzdXJmYWNlLmZvY3VzKHRydWUpO1xuICAgIGhpc3Rvcnkuc2V0Q29tbWFuZE1vZGUoKTtcblxuICAgIHZhciBzdGF0ZSA9IG5ldyBJbnB1dFN0YXRlKHN1cmZhY2UsIGVkaXRvci5tb2RlKTtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gICAgdmFyIGFzeW5jSGFuZGxlciA9IHtcbiAgICAgIGFzeW5jOiBhc3luYywgaW1tZWRpYXRlOiB0cnVlXG4gICAgfTtcblxuICAgIGZuLmNhbGwoYXN5bmNIYW5kbGVyLCBlLCBlZGl0b3IubW9kZSwgY2h1bmtzKTtcblxuICAgIGlmIChhc3luY0hhbmRsZXIuaW1tZWRpYXRlKSB7XG4gICAgICBkb25lKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXN5bmMgKCkge1xuICAgICAgYXN5bmNIYW5kbGVyLmltbWVkaWF0ZSA9IGZhbHNlO1xuICAgICAgcmV0dXJuIGRvbmU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZG9uZSAoKSB7XG4gICAgICBzdXJmYWNlLmZvY3VzKCk7XG4gICAgICBzdGF0ZS5zZXRDaHVua3MoY2h1bmtzKTtcbiAgICAgIHN0YXRlLnJlc3RvcmUoKTtcbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0Q29tbWFuZEhhbmRsZXI7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0cmltQ2h1bmtzID0gcmVxdWlyZSgnLi4vY2h1bmtzL3RyaW0nKTtcblxuZnVuY3Rpb24gSHRtbENodW5rcyAoKSB7XG59XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnRyaW0gPSB0cmltQ2h1bmtzO1xuXG5IdG1sQ2h1bmtzLnByb3RvdHlwZS5maW5kVGFncyA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnNraXAgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0bWxDaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBibG9ja3F1b3RlIChjaHVua3MpIHtcbiAgd3JhcHBpbmcoJ2Jsb2NrcXVvdGUnLCBzdHJpbmdzLnBsYWNlaG9sZGVycy5xdW90ZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBibG9ja3F1b3RlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcblxuZnVuY3Rpb24gYm9sZE9ySXRhbGljIChjaHVua3MsIHR5cGUpIHtcbiAgd3JhcHBpbmcodHlwZSA9PT0gJ2JvbGQnID8gJ3N0cm9uZycgOiAnZW0nLCBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBib2xkT3JJdGFsaWM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBjb2RlYmxvY2sgKGNodW5rcykge1xuICB3cmFwcGluZygncHJlPjxjb2RlJywgc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHJsZWFkaW5nID0gLzxoKFsxLTZdKSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9oKFsxLTZdKT4vO1xuXG5mdW5jdGlvbiBoZWFkaW5nIChjaHVua3MpIHtcbiAgY2h1bmtzLnRyaW0oKTtcblxuICB2YXIgdHJhaWwgPSBydHJhaWxpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpO1xuICB2YXIgbGVhZCA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSk7XG4gIGlmIChsZWFkICYmIHRyYWlsICYmIGxlYWRbMV0gPT09IHRyYWlsWzFdKSB7XG4gICAgc3dhcCgpO1xuICB9IGVsc2Uge1xuICAgIGFkZCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc3dhcCAoKSB7XG4gICAgdmFyIGxldmVsID0gcGFyc2VJbnQobGVhZFsxXSwgMTApO1xuICAgIHZhciBuZXh0ID0gbGV2ZWwgPD0gMSA/IDQgOiBsZXZlbCAtIDE7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJzxoJyArIG5leHQgKyAnPicpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJzwvaCcgKyBuZXh0ICsgJz4nKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZCAoKSB7XG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuaGVhZGluZztcbiAgICB9XG4gICAgY2h1bmtzLmJlZm9yZSArPSAnPGgxPic7XG4gICAgY2h1bmtzLmFmdGVyID0gJzwvaDE+JyArIGNodW5rcy5hZnRlcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhlYWRpbmc7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGhyIChjaHVua3MpIHtcbiAgY2h1bmtzLmJlZm9yZSArPSAnXFxuPGhyPlxcbic7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSAnJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBocjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcbnZhciBvbmNlID0gcmVxdWlyZSgnLi4vb25jZScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcGFyc2VMaW5rSW5wdXQgPSByZXF1aXJlKCcuLi9jaHVua3MvcGFyc2VMaW5rSW5wdXQnKTtcbnZhciBybGVhZGluZyA9IC88YSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9hPi87XG52YXIgcmltYWdlID0gLzxpbWcoIFtePl0qKT9cXC8+JC87XG5cbmZ1bmN0aW9uIGxpbmtPckltYWdlT3JBdHRhY2htZW50IChjaHVua3MsIG9wdGlvbnMpIHtcbiAgdmFyIHR5cGUgPSBvcHRpb25zLnR5cGU7XG4gIHZhciBpbWFnZSA9IHR5cGUgPT09ICdpbWFnZSc7XG4gIHZhciByZXN1bWU7XG5cbiAgaWYgKHR5cGUgIT09ICdhdHRhY2htZW50Jykge1xuICAgIGNodW5rcy50cmltKCk7XG4gIH1cblxuICBpZiAocmVtb3ZhbCgpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgcmVzdW1lID0gdGhpcy5hc3luYygpO1xuXG4gIG9wdGlvbnMucHJvbXB0cy5jbG9zZSgpO1xuICAob3B0aW9ucy5wcm9tcHRzW3R5cGVdIHx8IG9wdGlvbnMucHJvbXB0cy5saW5rKShvcHRpb25zLCBvbmNlKHJlc29sdmVkKSk7XG5cbiAgZnVuY3Rpb24gcmVtb3ZhbCAoKSB7XG4gICAgaWYgKGltYWdlKSB7XG4gICAgICBpZiAocmltYWdlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9ICcnO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHJ0cmFpbGluZy5leGVjKGNodW5rcy5hZnRlcikgJiYgcmxlYWRpbmcuZXhlYyhjaHVua3MuYmVmb3JlKSkge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXNvbHZlZCAocmVzdWx0KSB7XG4gICAgdmFyIHBhcnRzO1xuICAgIHZhciBsaW5rcyA9IHJlc3VsdC5kZWZpbml0aW9ucy5tYXAocGFyc2VMaW5rSW5wdXQpLmZpbHRlcihsb25nKTtcbiAgICBpZiAobGlua3MubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXN1bWUoKTsgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgbGluayA9IGxpbmtzWzBdO1xuXG4gICAgaWYgKHR5cGUgPT09ICdhdHRhY2htZW50Jykge1xuICAgICAgcGFydHMgPSBvcHRpb25zLm1lcmdlSHRtbEFuZEF0dGFjaG1lbnQoY2h1bmtzLmJlZm9yZSArIGNodW5rcy5zZWxlY3Rpb24gKyBjaHVua3MuYWZ0ZXIsIGxpbmspO1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IHBhcnRzLmJlZm9yZTtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBwYXJ0cy5zZWxlY3Rpb247XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBwYXJ0cy5hZnRlcjtcbiAgICAgIHJlc3VtZSgpO1xuICAgICAgdXRpbHMuZGlzcGF0Y2hDdXN0b21FdmVudChvcHRpb25zLnN1cmZhY2UudGV4dGFyZWEsICd3b29mbWFyay1tb2RlLWNoYW5nZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChpbWFnZSkge1xuICAgICAgaW1hZ2VXcmFwKGxpbmssIGxpbmtzLnNsaWNlKDEpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlua1dyYXAobGluaywgbGlua3Muc2xpY2UoMSkpO1xuICAgIH1cblxuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgIH1cbiAgICByZXN1bWUoKTtcblxuICAgIGZ1bmN0aW9uIGxvbmcgKGxpbmspIHtcbiAgICAgIHJldHVybiBsaW5rLmhyZWYubGVuZ3RoID4gMDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRUaXRsZSAobGluaykge1xuICAgICAgcmV0dXJuIGxpbmsudGl0bGUgPyAnIHRpdGxlPVwiJyArIGxpbmsudGl0bGUgKyAnXCInIDogJyc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaW1hZ2VXcmFwIChsaW5rLCByZXN0KSB7XG4gICAgICB2YXIgYWZ0ZXIgPSBjaHVua3MuYWZ0ZXI7XG4gICAgICBjaHVua3MuYmVmb3JlICs9IHRhZ29wZW4obGluayk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSB0YWdjbG9zZShsaW5rKTtcbiAgICAgIGlmIChyZXN0Lmxlbmd0aCkge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgKz0gcmVzdC5tYXAodG9Bbm90aGVySW1hZ2UpLmpvaW4oJycpO1xuICAgICAgfVxuICAgICAgY2h1bmtzLmFmdGVyICs9IGFmdGVyO1xuICAgICAgZnVuY3Rpb24gdGFnb3BlbiAobGluaykgeyByZXR1cm4gJzxpbWcgc3JjPVwiJyArIGxpbmsuaHJlZiArICdcIiBhbHQ9XCInOyB9XG4gICAgICBmdW5jdGlvbiB0YWdjbG9zZSAobGluaykgeyByZXR1cm4gJ1wiJyArIGdldFRpdGxlKGxpbmspICsgJyAvPic7IH1cbiAgICAgIGZ1bmN0aW9uIHRvQW5vdGhlckltYWdlIChsaW5rKSB7IHJldHVybiAnICcgKyB0YWdvcGVuKGxpbmspICsgdGFnY2xvc2UobGluayk7IH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBsaW5rV3JhcCAobGluaywgcmVzdCkge1xuICAgICAgdmFyIGFmdGVyID0gY2h1bmtzLmFmdGVyO1xuICAgICAgdmFyIG5hbWVzID0gb3B0aW9ucy5jbGFzc2VzLmlucHV0LmxpbmtzO1xuICAgICAgdmFyIGNsYXNzZXMgPSBuYW1lcyA/ICcgY2xhc3M9XCInICsgbmFtZXMgKyAnXCInIDogJyc7XG4gICAgICBjaHVua3MuYmVmb3JlICs9IHRhZ29wZW4obGluayk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSB0YWdjbG9zZSgpO1xuICAgICAgaWYgKHJlc3QubGVuZ3RoKSB7XG4gICAgICAgIGNodW5rcy5hZnRlciArPSByZXN0Lm1hcCh0b0Fub3RoZXJMaW5rKS5qb2luKCcnKTtcbiAgICAgIH1cbiAgICAgIGNodW5rcy5hZnRlciArPSBhZnRlcjtcbiAgICAgIGZ1bmN0aW9uIHRhZ29wZW4gKGxpbmspIHsgcmV0dXJuICc8YSBocmVmPVwiJyArIGxpbmsuaHJlZiArICdcIicgKyBnZXRUaXRsZShsaW5rKSArIGNsYXNzZXMgKyAnPic7IH1cbiAgICAgIGZ1bmN0aW9uIHRhZ2Nsb3NlICgpIHsgcmV0dXJuICc8L2E+JzsgfVxuICAgICAgZnVuY3Rpb24gdG9Bbm90aGVyTGluayAobGluaykgeyByZXR1cm4gJyAnICsgdGFnb3BlbihsaW5rKSArIHRhZ2Nsb3NlKCk7IH1cbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgcmxlZnRzaW5nbGUgPSAvPCh1bHxvbCkoIFtePl0qKT8+XFxzKjxsaSggW14+XSopPz4kLztcbnZhciBycmlnaHRzaW5nbGUgPSAvXjxcXC9saT5cXHMqPFxcLyh1bHxvbCk+LztcbnZhciBybGVmdGl0ZW0gPSAvPGxpKCBbXj5dKik/PiQvO1xudmFyIHJyaWdodGl0ZW0gPSAvXjxcXC9saSggW14+XSopPz4vO1xudmFyIHJvcGVuID0gL148KHVsfG9sKSggW14+XSopPz4kLztcblxuZnVuY3Rpb24gbGlzdCAoY2h1bmtzLCBvcmRlcmVkKSB7XG4gIHZhciB0YWcgPSBvcmRlcmVkID8gJ29sJyA6ICd1bCc7XG4gIHZhciBvbGlzdCA9ICc8JyArIHRhZyArICc+JztcbiAgdmFyIGNsaXN0ID0gJzwvJyArIHRhZyArICc+JztcblxuICBjaHVua3MudHJpbSgpO1xuXG4gIGlmIChybGVmdHNpbmdsZS50ZXN0KGNodW5rcy5iZWZvcmUpICYmIHJyaWdodHNpbmdsZS50ZXN0KGNodW5rcy5hZnRlcikpIHtcbiAgICBpZiAodGFnID09PSBSZWdFeHAuJDEpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlZnRzaW5nbGUsICcnKTtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJyaWdodHNpbmdsZSwgJycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIHZhciB1bFN0YXJ0ID0gY2h1bmtzLmJlZm9yZS5sYXN0SW5kZXhPZignPHVsJyk7XG4gIHZhciBvbFN0YXJ0ID0gY2h1bmtzLmJlZm9yZS5sYXN0SW5kZXhPZignPG9sJyk7XG4gIHZhciBjbG9zZVRhZyA9IGNodW5rcy5hZnRlci5pbmRleE9mKCc8L3VsPicpO1xuICBpZiAoY2xvc2VUYWcgPT09IC0xKSB7XG4gICAgY2xvc2VUYWcgPSBjaHVua3MuYWZ0ZXIuaW5kZXhPZignPC9vbD4nKTtcbiAgfVxuICBpZiAoY2xvc2VUYWcgPT09IC0xKSB7XG4gICAgYWRkKCk7IHJldHVybjtcbiAgfVxuICB2YXIgb3BlblN0YXJ0ID0gdWxTdGFydCA+IG9sU3RhcnQgPyB1bFN0YXJ0IDogb2xTdGFydDtcbiAgaWYgKG9wZW5TdGFydCA9PT0gLTEpIHtcbiAgICBhZGQoKTsgcmV0dXJuO1xuICB9XG4gIHZhciBvcGVuRW5kID0gY2h1bmtzLmJlZm9yZS5pbmRleE9mKCc+Jywgb3BlblN0YXJ0KTtcbiAgaWYgKG9wZW5FbmQgPT09IC0xKSB7XG4gICAgYWRkKCk7IHJldHVybjtcbiAgfVxuXG4gIHZhciBvcGVuVGFnID0gY2h1bmtzLmJlZm9yZS5zdWJzdHIob3BlblN0YXJ0LCBvcGVuRW5kIC0gb3BlblN0YXJ0ICsgMSk7XG4gIGlmIChyb3Blbi50ZXN0KG9wZW5UYWcpKSB7XG4gICAgaWYgKHRhZyAhPT0gUmVnRXhwLiQxKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5zdWJzdHIoMCwgb3BlblN0YXJ0KSArICc8JyArIHRhZyArIGNodW5rcy5iZWZvcmUuc3Vic3RyKG9wZW5TdGFydCArIDMpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnN1YnN0cigwLCBjbG9zZVRhZykgKyAnPC8nICsgdGFnICsgY2h1bmtzLmFmdGVyLnN1YnN0cihjbG9zZVRhZyArIDQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocmxlZnRpdGVtLnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcnJpZ2h0aXRlbS50ZXN0KGNodW5rcy5hZnRlcikpIHtcbiAgICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVmdGl0ZW0sICcnKTtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnJpZ2h0aXRlbSwgJycpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWRkKHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZCAobGlzdCkge1xuICAgIHZhciBvcGVuID0gbGlzdCA/ICcnIDogb2xpc3Q7XG4gICAgdmFyIGNsb3NlID0gbGlzdCA/ICcnIDogY2xpc3Q7XG5cbiAgICBjaHVua3MuYmVmb3JlICs9IG9wZW4gKyAnPGxpPic7XG4gICAgY2h1bmtzLmFmdGVyID0gJzwvbGk+JyArIGNsb3NlICsgY2h1bmtzLmFmdGVyO1xuXG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMubGlzdGl0ZW07XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gd3JhcHBpbmcgKHRhZywgcGxhY2Vob2xkZXIsIGNodW5rcykge1xuICB2YXIgb3BlbiA9ICc8JyArIHRhZztcbiAgdmFyIGNsb3NlID0gJzwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpO1xuICB2YXIgcmxlYWRpbmcgPSBuZXcgUmVnRXhwKG9wZW4gKyAnKCBbXj5dKik/PiQnLCAnaScpO1xuICB2YXIgcnRyYWlsaW5nID0gbmV3IFJlZ0V4cCgnXicgKyBjbG9zZSArICc+JywgJ2knKTtcbiAgdmFyIHJvcGVuID0gbmV3IFJlZ0V4cChvcGVuICsgJyggW14+XSopPz4nLCAnaWcnKTtcbiAgdmFyIHJjbG9zZSA9IG5ldyBSZWdFeHAoY2xvc2UgKyAnKCBbXj5dKik/PicsICdpZycpO1xuXG4gIGNodW5rcy50cmltKCk7XG5cbiAgdmFyIHRyYWlsID0gcnRyYWlsaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKTtcbiAgdmFyIGxlYWQgPSBybGVhZGluZy5leGVjKGNodW5rcy5iZWZvcmUpO1xuICBpZiAobGVhZCAmJiB0cmFpbCkge1xuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlYWRpbmcsICcnKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShydHJhaWxpbmcsICcnKTtcbiAgfSBlbHNlIHtcbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBwbGFjZWhvbGRlcjtcbiAgICB9XG4gICAgdmFyIG9wZW5lZCA9IHJvcGVuLnRlc3QoY2h1bmtzLnNlbGVjdGlvbik7XG4gICAgaWYgKG9wZW5lZCkge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShyb3BlbiwgJycpO1xuICAgICAgaWYgKCFzdXJyb3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgICBjaHVua3MuYmVmb3JlICs9IG9wZW4gKyAnPic7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBjbG9zZWQgPSByY2xvc2UudGVzdChjaHVua3Muc2VsZWN0aW9uKTtcbiAgICBpZiAoY2xvc2VkKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKHJjbG9zZSwgJycpO1xuICAgICAgaWYgKCFzdXJyb3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgPSBjbG9zZSArICc+JyArIGNodW5rcy5hZnRlcjtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9wZW5lZCB8fCBjbG9zZWQpIHtcbiAgICAgIHB1c2hvdmVyKCk7IHJldHVybjtcbiAgICB9XG4gICAgaWYgKHN1cnJvdW5kZWQoY2h1bmtzLCB0YWcpKSB7XG4gICAgICBpZiAocmxlYWRpbmcudGVzdChjaHVua3MuYmVmb3JlKSkge1xuICAgICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3MuYmVmb3JlICs9IGNsb3NlICsgJz4nO1xuICAgICAgfVxuICAgICAgaWYgKHJ0cmFpbGluZy50ZXN0KGNodW5rcy5hZnRlcikpIHtcbiAgICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnRyYWlsaW5nLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgPSBvcGVuICsgJz4nICsgY2h1bmtzLmFmdGVyO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoIWNsb3NlYm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNsb3NlICsgJz4nICsgY2h1bmtzLmFmdGVyO1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSBvcGVuICsgJz4nO1xuICAgIH1cbiAgICBwdXNob3ZlcigpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaG92ZXIgKCkge1xuICAgIGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvPChcXC8pPyhbXj4gXSspKCBbXj5dKik/Pi9pZywgcHVzaG92ZXJPdGhlclRhZ3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gcHVzaG92ZXJPdGhlclRhZ3MgKGFsbCwgY2xvc2luZywgdGFnLCBhLCBpKSB7XG4gICAgdmFyIGF0dHJzID0gYSB8fCAnJztcbiAgICB2YXIgb3BlbiA9ICFjbG9zaW5nO1xuICAgIHZhciByY2xvc2VkID0gbmV3IFJlZ0V4cCgnPFxcLycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKSArICc+JywgJ2knKTtcbiAgICB2YXIgcm9wZW5lZCA9IG5ldyBSZWdFeHAoJzwnICsgdGFnICsgJyggW14+XSopPz4nLCAnaScpO1xuICAgIGlmIChvcGVuICYmICFyY2xvc2VkLnRlc3QoY2h1bmtzLnNlbGVjdGlvbi5zdWJzdHIoaSkpKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uICs9ICc8LycgKyB0YWcgKyAnPic7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZSgvXig8XFwvW14+XSs+KS8sICckMTwnICsgdGFnICsgYXR0cnMgKyAnPicpO1xuICAgIH1cblxuICAgIGlmIChjbG9zaW5nICYmICFyb3BlbmVkLnRlc3QoY2h1bmtzLnNlbGVjdGlvbi5zdWJzdHIoMCwgaSkpKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gJzwnICsgdGFnICsgYXR0cnMgKyAnPicgKyBjaHVua3Muc2VsZWN0aW9uO1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZSgvKDxbXj5dKyg/OiBbXj5dKik/PikkLywgJzwvJyArIHRhZyArICc+JDEnKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY2xvc2Vib3VuZGVkIChjaHVua3MsIHRhZykge1xuICB2YXIgcmNsb3NlbGVmdCA9IG5ldyBSZWdFeHAoJzwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpICsgJz4kJywgJ2knKTtcbiAgdmFyIHJvcGVucmlnaHQgPSBuZXcgUmVnRXhwKCdePCcgKyB0YWcgKyAnKD86IFtePl0qKT8+JywgJ2knKTtcbiAgdmFyIGJvdW5kZWQgPSByY2xvc2VsZWZ0LnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcm9wZW5yaWdodC50ZXN0KGNodW5rcy5hZnRlcik7XG4gIGlmIChib3VuZGVkKSB7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShyY2xvc2VsZWZ0LCAnJyk7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2Uocm9wZW5yaWdodCwgJycpO1xuICB9XG4gIHJldHVybiBib3VuZGVkO1xufVxuXG5mdW5jdGlvbiBzdXJyb3VuZGVkIChjaHVua3MsIHRhZykge1xuICB2YXIgcm9wZW4gPSBuZXcgUmVnRXhwKCc8JyArIHRhZyArICcoPzogW14+XSopPz4nLCAnaWcnKTtcbiAgdmFyIHJjbG9zZSA9IG5ldyBSZWdFeHAoJzxcXC8nICsgdGFnLnJlcGxhY2UoLzwvZywgJzwvJykgKyAnPicsICdpZycpO1xuICB2YXIgb3BlbnNCZWZvcmUgPSBjb3VudChjaHVua3MuYmVmb3JlLCByb3Blbik7XG4gIHZhciBvcGVuc0FmdGVyID0gY291bnQoY2h1bmtzLmFmdGVyLCByb3Blbik7XG4gIHZhciBjbG9zZXNCZWZvcmUgPSBjb3VudChjaHVua3MuYmVmb3JlLCByY2xvc2UpO1xuICB2YXIgY2xvc2VzQWZ0ZXIgPSBjb3VudChjaHVua3MuYWZ0ZXIsIHJjbG9zZSk7XG4gIHZhciBvcGVuID0gb3BlbnNCZWZvcmUgLSBjbG9zZXNCZWZvcmUgPiAwO1xuICB2YXIgY2xvc2UgPSBjbG9zZXNBZnRlciAtIG9wZW5zQWZ0ZXIgPiAwO1xuICByZXR1cm4gb3BlbiAmJiBjbG9zZTtcblxuICBmdW5jdGlvbiBjb3VudCAodGV4dCwgcmVnZXgpIHtcbiAgICB2YXIgbWF0Y2ggPSB0ZXh0Lm1hdGNoKHJlZ2V4KTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiBtYXRjaC5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiAwO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gd3JhcHBpbmc7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGlzVmlzaWJsZUVsZW1lbnQgKGVsZW0pIHtcbiAgaWYgKGdsb2JhbC5nZXRDb21wdXRlZFN0eWxlKSB7XG4gICAgcmV0dXJuIGdsb2JhbC5nZXRDb21wdXRlZFN0eWxlKGVsZW0sIG51bGwpLmdldFByb3BlcnR5VmFsdWUoJ2Rpc3BsYXknKSAhPT0gJ25vbmUnO1xuICB9IGVsc2UgaWYgKGVsZW0uY3VycmVudFN0eWxlKSB7XG4gICAgcmV0dXJuIGVsZW0uY3VycmVudFN0eWxlLmRpc3BsYXkgIT09ICdub25lJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlzaWJsZUVsZW1lbnQ7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXBjMVpwYzJsaWJHVkZiR1Z0Wlc1MExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFaUxDSm1hV3hsSWpvaVoyVnVaWEpoZEdWa0xtcHpJaXdpYzI5MWNtTmxVbTl2ZENJNklpSXNJbk52ZFhKalpYTkRiMjUwWlc1MElqcGJJaWQxYzJVZ2MzUnlhV04wSnp0Y2JseHVablZ1WTNScGIyNGdhWE5XYVhOcFlteGxSV3hsYldWdWRDQW9aV3hsYlNrZ2UxeHVJQ0JwWmlBb1oyeHZZbUZzTG1kbGRFTnZiWEIxZEdWa1UzUjViR1VwSUh0Y2JpQWdJQ0J5WlhSMWNtNGdaMnh2WW1Gc0xtZGxkRU52YlhCMWRHVmtVM1I1YkdVb1pXeGxiU3dnYm5Wc2JDa3VaMlYwVUhKdmNHVnlkSGxXWVd4MVpTZ25aR2x6Y0d4aGVTY3BJQ0U5UFNBbmJtOXVaU2M3WEc0Z0lIMGdaV3h6WlNCcFppQW9aV3hsYlM1amRYSnlaVzUwVTNSNWJHVXBJSHRjYmlBZ0lDQnlaWFIxY200Z1pXeGxiUzVqZFhKeVpXNTBVM1I1YkdVdVpHbHpjR3hoZVNBaFBUMGdKMjV2Ym1Vbk8xeHVJQ0I5WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdhWE5XYVhOcFlteGxSV3hsYldWdWREdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNhY2hlID0gW107XG52YXIgRWRpdG9yID0gcmVxdWlyZSgnLi9lZGl0b3InKTtcblxuZnVuY3Rpb24gTWFuYWdlciAoKSB7XG4gIHRoaXMuY2FjaGUgPSBbXTtcbn1cblxuTWFuYWdlci5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uICh0ZXh0YXJlYSkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuY2FjaGUubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgaWYgKHRoaXMuY2FjaGVbaV0gJiYgdGhpcy5jYWNoZVtpXS50ZXh0YXJlYSA9PT0gdGV4dGFyZWEpIHtcbiAgICAgIHJldHVybiB0aGlzLmNhY2hlW2ldO1xuICAgIH1cbiAgfVxufTtcblxuTWFuYWdlci5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKHRleHRhcmVhLCBvcHRpb25zKSB7XG4gIHZhciBlZGl0b3IgPSB0aGlzLmZpbmQodGV4dGFyZWEpO1xuICBpZihlZGl0b3IpIHtcbiAgICByZXR1cm4gZWRpdG9yLmVkaXRvcjtcbiAgfVxuXG4gIGVkaXRvciA9IG5ldyBFZGl0b3IodGV4dGFyZWEsIG9wdGlvbnMpO1xuICBjYWNoZS5wdXNoKHtcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdG9yOiBlZGl0b3IsXG4gICAgb3B0aW9uczogb3B0aW9ucyxcbiAgfSk7XG5cbiAgcmV0dXJuIGVkaXRvcjtcbn07XG5cbk1hbmFnZXIucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uICh0ZXh0YXJlYSkge1xuICB2YXIgZWRpdG9yID0gdGhpcy5maW5kKHRleHRhcmVhKTtcbiAgaWYoIWVkaXRvcikge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGVkaXRvci5lZGl0b3IuZGVzdHJveSgpO1xuICBjYWNoZS5zcGxpY2UoY2FjaGUuaW5kZXhPZihlZGl0b3IpLCAxKTtcbiAgcmV0dXJuIHRydWU7XG59O1xuXG5NYW5hZ2VyLnByb3RvdHlwZS5jbGVhciA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGNhY2hlZDtcbiAgd2hpbGUgKGNhY2hlZCA9IHRoaXMuY2FjaGUucG9wKCkpIHtcbiAgICBjYWNoZWQuZWRpdG9yLmRlc3Ryb3koKTtcbiAgfVxufTtcblxuTWFuYWdlci5wcm90b3R5cGUuZWFjaCA9IGZ1bmN0aW9uIChmbikge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHRoaXMuY2FjaGUubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdmFyIGNhY2hlZCA9IHRoaXMuY2FjaGVbaV07XG4gICAgZm4oY2FjaGVkLmVkaXRvciwgY2FjaGVkLnRleHRhcmVhLCBjYWNoZWQub3B0aW9ucyk7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gTWFuYWdlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbWFueSAodGV4dCwgdGltZXMpIHtcbiAgcmV0dXJuIG5ldyBBcnJheSh0aW1lcyArIDEpLmpvaW4odGV4dCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbWFueTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1hbnkgPSByZXF1aXJlKCcuLi9tYW55Jyk7XG52YXIgZXh0ZW5kUmVnRXhwID0gcmVxdWlyZSgnLi4vZXh0ZW5kUmVnRXhwJyk7XG52YXIgdHJpbUNodW5rcyA9IHJlcXVpcmUoJy4uL2NodW5rcy90cmltJyk7XG5cbmZ1bmN0aW9uIE1hcmtkb3duQ2h1bmtzICgpIHtcbn1cblxuTWFya2Rvd25DaHVua3MucHJvdG90eXBlLnRyaW0gPSB0cmltQ2h1bmtzO1xuXG5NYXJrZG93bkNodW5rcy5wcm90b3R5cGUuZmluZFRhZ3MgPSBmdW5jdGlvbiAoc3RhcnRSZWdleCwgZW5kUmVnZXgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgcmVnZXg7XG5cbiAgaWYgKHN0YXJ0UmVnZXgpIHtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChzdGFydFJlZ2V4LCAnJywgJyQnKTtcbiAgICB0aGlzLmJlZm9yZSA9IHRoaXMuYmVmb3JlLnJlcGxhY2UocmVnZXgsIHN0YXJ0UmVwbGFjZXIpO1xuICAgIHJlZ2V4ID0gZXh0ZW5kUmVnRXhwKHN0YXJ0UmVnZXgsICdeJywgJycpO1xuICAgIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZShyZWdleCwgc3RhcnRSZXBsYWNlcik7XG4gIH1cblxuICBpZiAoZW5kUmVnZXgpIHtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChlbmRSZWdleCwgJycsICckJyk7XG4gICAgdGhpcy5zZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbi5yZXBsYWNlKHJlZ2V4LCBlbmRSZXBsYWNlcik7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoZW5kUmVnZXgsICdeJywgJycpO1xuICAgIHRoaXMuYWZ0ZXIgPSB0aGlzLmFmdGVyLnJlcGxhY2UocmVnZXgsIGVuZFJlcGxhY2VyKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHN0YXJ0UmVwbGFjZXIgKG1hdGNoKSB7XG4gICAgc2VsZi5zdGFydFRhZyA9IHNlbGYuc3RhcnRUYWcgKyBtYXRjaDsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5kUmVwbGFjZXIgKG1hdGNoKSB7XG4gICAgc2VsZi5lbmRUYWcgPSBtYXRjaCArIHNlbGYuZW5kVGFnOyByZXR1cm4gJyc7XG4gIH1cbn07XG5cbk1hcmtkb3duQ2h1bmtzLnByb3RvdHlwZS5za2lwID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgYmVmb3JlQ291bnQgPSAnYmVmb3JlJyBpbiBvID8gby5iZWZvcmUgOiAxO1xuICB2YXIgYWZ0ZXJDb3VudCA9ICdhZnRlcicgaW4gbyA/IG8uYWZ0ZXIgOiAxO1xuXG4gIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZSgvKF5cXG4qKS8sICcnKTtcbiAgdGhpcy5zdGFydFRhZyA9IHRoaXMuc3RhcnRUYWcgKyBSZWdFeHAuJDE7XG4gIHRoaXMuc2VsZWN0aW9uID0gdGhpcy5zZWxlY3Rpb24ucmVwbGFjZSgvKFxcbiokKS8sICcnKTtcbiAgdGhpcy5lbmRUYWcgPSB0aGlzLmVuZFRhZyArIFJlZ0V4cC4kMTtcbiAgdGhpcy5zdGFydFRhZyA9IHRoaXMuc3RhcnRUYWcucmVwbGFjZSgvKF5cXG4qKS8sICcnKTtcbiAgdGhpcy5iZWZvcmUgPSB0aGlzLmJlZm9yZSArIFJlZ0V4cC4kMTtcbiAgdGhpcy5lbmRUYWcgPSB0aGlzLmVuZFRhZy5yZXBsYWNlKC8oXFxuKiQpLywgJycpO1xuICB0aGlzLmFmdGVyID0gdGhpcy5hZnRlciArIFJlZ0V4cC4kMTtcblxuICBpZiAodGhpcy5iZWZvcmUpIHtcbiAgICB0aGlzLmJlZm9yZSA9IHJlcGxhY2UodGhpcy5iZWZvcmUsICsrYmVmb3JlQ291bnQsICckJyk7XG4gIH1cblxuICBpZiAodGhpcy5hZnRlcikge1xuICAgIHRoaXMuYWZ0ZXIgPSByZXBsYWNlKHRoaXMuYWZ0ZXIsICsrYWZ0ZXJDb3VudCwgJycpO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVwbGFjZSAodGV4dCwgY291bnQsIHN1ZmZpeCkge1xuICAgIHZhciByZWdleCA9IG8uYW55ID8gJ1xcXFxuKicgOiBtYW55KCdcXFxcbj8nLCBjb3VudCk7XG4gICAgdmFyIHJlcGxhY2VtZW50ID0gbWFueSgnXFxuJywgY291bnQpO1xuICAgIHJldHVybiB0ZXh0LnJlcGxhY2UobmV3IFJlZ0V4cChyZWdleCArIHN1ZmZpeCksIHJlcGxhY2VtZW50KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYXJrZG93bkNodW5rcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgd3JhcHBpbmcgPSByZXF1aXJlKCcuL3dyYXBwaW5nJyk7XG52YXIgc2V0dGluZ3MgPSByZXF1aXJlKCcuL3NldHRpbmdzJyk7XG52YXIgcnRyYWlsYmxhbmtsaW5lID0gLyg+WyBcXHRdKikkLztcbnZhciBybGVhZGJsYW5rbGluZSA9IC9eKD5bIFxcdF0qKS87XG52YXIgcm5ld2xpbmVmZW5jaW5nID0gL14oXFxuKikoW15cXHJdKz8pKFxcbiopJC87XG52YXIgcmVuZHRhZyA9IC9eKCgoXFxufF4pKFxcblsgXFx0XSopKj4oLitcXG4pKi4qKSsoXFxuWyBcXHRdKikqKS87XG52YXIgcmxlYWRicmFja2V0ID0gL15cXG4oKD58XFxzKSopXFxuLztcbnZhciBydHJhaWxicmFja2V0ID0gL1xcbigoPnxcXHMpKilcXG4kLztcblxuZnVuY3Rpb24gYmxvY2txdW90ZSAoY2h1bmtzKSB7XG4gIHZhciBtYXRjaCA9ICcnO1xuICB2YXIgbGVmdE92ZXIgPSAnJztcbiAgdmFyIGxpbmU7XG5cbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybmV3bGluZWZlbmNpbmcsIG5ld2xpbmVyZXBsYWNlcik7XG4gIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocnRyYWlsYmxhbmtsaW5lLCB0cmFpbGJsYW5rbGluZXJlcGxhY2VyKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXihcXHN8PikrJC8sICcnKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24gfHwgc3RyaW5ncy5wbGFjZWhvbGRlcnMucXVvdGU7XG5cbiAgaWYgKGNodW5rcy5iZWZvcmUpIHtcbiAgICBiZWZvcmVQcm9jZXNzaW5nKCk7XG4gIH1cblxuICBjaHVua3Muc3RhcnRUYWcgPSBtYXRjaDtcbiAgY2h1bmtzLmJlZm9yZSA9IGxlZnRPdmVyO1xuXG4gIGlmIChjaHVua3MuYWZ0ZXIpIHtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZSgvXlxcbj8vLCAnXFxuJyk7XG4gIH1cblxuICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZW5kdGFnLCBlbmR0YWdyZXBsYWNlcik7XG5cbiAgaWYgKC9eKD8hWyBdezAsM30+KS9tLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICB3cmFwcGluZy53cmFwKGNodW5rcywgc2V0dGluZ3MubGluZUxlbmd0aCAtIDIpO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL14vZ20sICc+ICcpO1xuICAgIHJlcGxhY2VCbGFua3NJblRhZ3ModHJ1ZSk7XG4gICAgY2h1bmtzLnNraXAoKTtcbiAgfSBlbHNlIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eWyBdezAsM30+ID8vZ20sICcnKTtcbiAgICB3cmFwcGluZy51bndyYXAoY2h1bmtzKTtcbiAgICByZXBsYWNlQmxhbmtzSW5UYWdzKGZhbHNlKTtcblxuICAgIGlmICghL14oXFxufF4pWyBdezAsM30+Ly50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIGNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UoL1xcbnswLDJ9JC8sICdcXG5cXG4nKTtcbiAgICB9XG5cbiAgICBpZiAoIS8oXFxufF4pWyBdezAsM30+LiokLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIGNodW5rcy5lbmRUYWcpIHtcbiAgICAgIGNodW5rcy5lbmRUYWcgPSBjaHVua3MuZW5kVGFnLnJlcGxhY2UoL15cXG57MCwyfS8sICdcXG5cXG4nKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIS9cXG4vLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKHJsZWFkYmxhbmtsaW5lLCBsZWFkYmxhbmtsaW5lcmVwbGFjZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3bGluZXJlcGxhY2VyIChhbGwsIGJlZm9yZSwgdGV4dCwgYWZ0ZXIpIHtcbiAgICBjaHVua3MuYmVmb3JlICs9IGJlZm9yZTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBhZnRlciArIGNodW5rcy5hZnRlcjtcbiAgICByZXR1cm4gdGV4dDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYWlsYmxhbmtsaW5lcmVwbGFjZXIgKGFsbCwgYmxhbmspIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gYmxhbmsgKyBjaHVua3Muc2VsZWN0aW9uOyByZXR1cm4gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBsZWFkYmxhbmtsaW5lcmVwbGFjZXIgKGFsbCwgYmxhbmtzKSB7XG4gICAgY2h1bmtzLnN0YXJ0VGFnICs9IGJsYW5rczsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gYmVmb3JlUHJvY2Vzc2luZyAoKSB7XG4gICAgdmFyIGxpbmVzID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKC9cXG4kLywgJycpLnNwbGl0KCdcXG4nKTtcbiAgICB2YXIgY2hhaW5lZCA9IGZhbHNlO1xuICAgIHZhciBnb29kO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgZ29vZCA9IGZhbHNlO1xuICAgICAgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgY2hhaW5lZCA9IGNoYWluZWQgJiYgbGluZS5sZW5ndGggPiAwO1xuICAgICAgaWYgKC9ePi8udGVzdChsaW5lKSkge1xuICAgICAgICBnb29kID0gdHJ1ZTtcbiAgICAgICAgaWYgKCFjaGFpbmVkICYmIGxpbmUubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNoYWluZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKC9eWyBcXHRdKiQvLnRlc3QobGluZSkpIHtcbiAgICAgICAgZ29vZCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnb29kID0gY2hhaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChnb29kKSB7XG4gICAgICAgIG1hdGNoICs9IGxpbmUgKyAnXFxuJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxlZnRPdmVyICs9IG1hdGNoICsgbGluZTtcbiAgICAgICAgbWF0Y2ggPSAnXFxuJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIS8oXnxcXG4pPi8udGVzdChtYXRjaCkpIHtcbiAgICAgIGxlZnRPdmVyICs9IG1hdGNoO1xuICAgICAgbWF0Y2ggPSAnJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlbmR0YWdyZXBsYWNlciAoYWxsKSB7XG4gICAgY2h1bmtzLmVuZFRhZyA9IGFsbDsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVwbGFjZUJsYW5rc0luVGFncyAoYnJhY2tldCkge1xuICAgIHZhciByZXBsYWNlbWVudCA9IGJyYWNrZXQgPyAnPiAnIDogJyc7XG5cbiAgICBpZiAoY2h1bmtzLnN0YXJ0VGFnKSB7XG4gICAgICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3Muc3RhcnRUYWcucmVwbGFjZShydHJhaWxicmFja2V0LCByZXBsYWNlcik7XG4gICAgfVxuICAgIGlmIChjaHVua3MuZW5kVGFnKSB7XG4gICAgICBjaHVua3MuZW5kVGFnID0gY2h1bmtzLmVuZFRhZy5yZXBsYWNlKHJsZWFkYnJhY2tldCwgcmVwbGFjZXIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlcGxhY2VyIChhbGwsIG1hcmtkb3duKSB7XG4gICAgICByZXR1cm4gJ1xcbicgKyBtYXJrZG93bi5yZXBsYWNlKC9eWyBdezAsM30+P1sgXFx0XSokL2dtLCByZXBsYWNlbWVudCkgKyAnXFxuJztcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBibG9ja3F1b3RlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmxlYWRpbmcgPSAvXihcXCoqKS87XG52YXIgcnRyYWlsaW5nID0gLyhcXCoqJCkvO1xudmFyIHJ0cmFpbGluZ3NwYWNlID0gLyhcXHM/KSQvO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGJvbGRPckl0YWxpYyAoY2h1bmtzLCB0eXBlKSB7XG4gIHZhciBybmV3bGluZXMgPSAvXFxuezIsfS9nO1xuICB2YXIgc3RhckNvdW50ID0gdHlwZSA9PT0gJ2JvbGQnID8gMiA6IDE7XG5cbiAgY2h1bmtzLnRyaW0oKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybmV3bGluZXMsICdcXG4nKTtcblxuICB2YXIgbWFya3VwO1xuICB2YXIgbGVhZFN0YXJzID0gcnRyYWlsaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSlbMF07XG4gIHZhciB0cmFpbFN0YXJzID0gcmxlYWRpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpWzBdO1xuICB2YXIgc3RhcnMgPSAnXFxcXCp7JyArIHN0YXJDb3VudCArICd9JztcbiAgdmFyIGZlbmNlID0gTWF0aC5taW4obGVhZFN0YXJzLmxlbmd0aCwgdHJhaWxTdGFycy5sZW5ndGgpO1xuICBpZiAoZmVuY2UgPj0gc3RhckNvdW50ICYmIChmZW5jZSAhPT0gMiB8fCBzdGFyQ291bnQgIT09IDEpKSB7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShuZXcgUmVnRXhwKHN0YXJzICsgJyQnLCAnJyksICcnKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShuZXcgUmVnRXhwKCdeJyArIHN0YXJzLCAnJyksICcnKTtcbiAgfSBlbHNlIGlmICghY2h1bmtzLnNlbGVjdGlvbiAmJiB0cmFpbFN0YXJzKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmxlYWRpbmcsICcnKTtcbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJ0cmFpbGluZ3NwYWNlLCAnJykgKyB0cmFpbFN0YXJzICsgUmVnRXhwLiQxO1xuICB9IGVsc2Uge1xuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbiAmJiAhdHJhaWxTdGFycykge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgIH1cblxuICAgIG1hcmt1cCA9IHN0YXJDb3VudCA9PT0gMSA/ICcqJyA6ICcqKic7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUgKyBtYXJrdXA7XG4gICAgY2h1bmtzLmFmdGVyID0gbWFya3VwICsgY2h1bmtzLmFmdGVyO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYm9sZE9ySXRhbGljO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBydGV4dGJlZm9yZSA9IC9cXFNbIF0qJC87XG52YXIgcnRleHRhZnRlciA9IC9eWyBdKlxcUy87XG52YXIgcm5ld2xpbmUgPSAvXFxuLztcbnZhciByYmFja3RpY2sgPSAvYC87XG52YXIgcmZlbmNlYmVmb3JlID0gL2BgYFthLXpdKlxcbj8kLztcbnZhciByZmVuY2ViZWZvcmVpbnNpZGUgPSAvXmBgYFthLXpdKlxcbi87XG52YXIgcmZlbmNlYWZ0ZXIgPSAvXlxcbj9gYGAvO1xudmFyIHJmZW5jZWFmdGVyaW5zaWRlID0gL1xcbmBgYCQvO1xuXG5mdW5jdGlvbiBjb2RlYmxvY2sgKGNodW5rcywgb3B0aW9ucykge1xuICB2YXIgbmV3bGluZWQgPSBybmV3bGluZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pO1xuICB2YXIgdHJhaWxpbmcgPSBydGV4dGFmdGVyLnRlc3QoY2h1bmtzLmFmdGVyKTtcbiAgdmFyIGxlYWRpbmcgPSBydGV4dGJlZm9yZS50ZXN0KGNodW5rcy5iZWZvcmUpO1xuICB2YXIgb3V0ZmVuY2VkID0gcmZlbmNlYmVmb3JlLnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcmZlbmNlYWZ0ZXIudGVzdChjaHVua3MuYWZ0ZXIpO1xuICBpZiAob3V0ZmVuY2VkIHx8IG5ld2xpbmVkIHx8ICEobGVhZGluZyB8fCB0cmFpbGluZykpIHtcbiAgICBibG9jayhvdXRmZW5jZWQpO1xuICB9IGVsc2Uge1xuICAgIGlubGluZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5saW5lICgpIHtcbiAgICBjaHVua3MudHJpbSgpO1xuICAgIGNodW5rcy5maW5kVGFncyhyYmFja3RpY2ssIHJiYWNrdGljayk7XG5cbiAgICBpZiAoIWNodW5rcy5zdGFydFRhZyAmJiAhY2h1bmtzLmVuZFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICdgJztcbiAgICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNodW5rcy5lbmRUYWcgJiYgIWNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSBjaHVua3MuZW5kVGFnO1xuICAgICAgY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3MuZW5kVGFnID0gJyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmxvY2sgKG91dGZlbmNlZCkge1xuICAgIGlmIChvdXRmZW5jZWQpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmZlbmNlYmVmb3JlLCAnJyk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZmVuY2VhZnRlciwgJycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UoL1sgXXs0fXxgYGBbYS16XSpcXG4kLywgbWVyZ2VTZWxlY3Rpb24pO1xuICAgIGNodW5rcy5za2lwKHtcbiAgICAgIGJlZm9yZTogLyhcXG58XikoXFx0fFsgXXs0LH18YGBgW2Etel0qXFxuKS4qXFxuJC8udGVzdChjaHVua3MuYmVmb3JlKSA/IDAgOiAxLFxuICAgICAgYWZ0ZXI6IC9eXFxuKFxcdHxbIF17NCx9fFxcbmBgYCkvLnRlc3QoY2h1bmtzLmFmdGVyKSA/IDAgOiAxXG4gICAgfSk7XG5cbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLmZlbmNpbmcpIHtcbiAgICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gJ2BgYFxcbic7XG4gICAgICAgIGNodW5rcy5lbmRUYWcgPSAnXFxuYGBgJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNodW5rcy5zdGFydFRhZyA9ICcgICAgJztcbiAgICAgIH1cbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5jb2RlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocmZlbmNlYmVmb3JlaW5zaWRlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikgJiYgcmZlbmNlYWZ0ZXJpbnNpZGUudGVzdChjaHVua3Muc2VsZWN0aW9uKSkge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC8oXmBgYFthLXpdKlxcbil8KGBgYCQpL2csICcnKTtcbiAgICAgIH0gZWxzZSBpZiAoL15bIF17MCwzfVxcUy9tLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZmVuY2luZykge1xuICAgICAgICAgIGNodW5rcy5iZWZvcmUgKz0gJ2BgYFxcbic7XG4gICAgICAgICAgY2h1bmtzLmFmdGVyID0gJ1xcbmBgYCcgKyBjaHVua3MuYWZ0ZXI7XG4gICAgICAgIH0gZWxzZSBpZiAobmV3bGluZWQpIHtcbiAgICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eL2dtLCAnICAgICcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNodW5rcy5iZWZvcmUgKz0gJyAgICAnO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eKD86WyBdezR9fFsgXXswLDN9XFx0fGBgYFthLXpdKikvZ20sICcnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtZXJnZVNlbGVjdGlvbiAoYWxsKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gYWxsICsgY2h1bmtzLnNlbGVjdGlvbjsgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvZGVibG9jaztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1hbnkgPSByZXF1aXJlKCcuLi9tYW55Jyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcblxuZnVuY3Rpb24gaGVhZGluZyAoY2h1bmtzKSB7XG4gIHZhciBsZXZlbCA9IDA7XG5cbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb25cbiAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgLnJlcGxhY2UoLyheXFxzK3xcXHMrJCkvZywgJycpO1xuXG4gIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcjICc7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmhlYWRpbmc7XG4gICAgY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIGNodW5rcy5za2lwKHsgYmVmb3JlOiAxLCBhZnRlcjogMSB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjaHVua3MuZmluZFRhZ3MoLyMrWyBdKi8sIC9bIF0qIysvKTtcblxuICBpZiAoLyMrLy50ZXN0KGNodW5rcy5zdGFydFRhZykpIHtcbiAgICBsZXZlbCA9IFJlZ0V4cC5sYXN0TWF0Y2gubGVuZ3RoO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICBjaHVua3MuZmluZFRhZ3MobnVsbCwgL1xccz8oLSt8PSspLyk7XG5cbiAgaWYgKC89Ky8udGVzdChjaHVua3MuZW5kVGFnKSkge1xuICAgIGxldmVsID0gMTtcbiAgfVxuXG4gIGlmICgvLSsvLnRlc3QoY2h1bmtzLmVuZFRhZykpIHtcbiAgICBsZXZlbCA9IDI7XG4gIH1cblxuICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3MuZW5kVGFnID0gJyc7XG4gIGNodW5rcy5za2lwKHsgYmVmb3JlOiAxLCBhZnRlcjogMSB9KTtcblxuICB2YXIgbGV2ZWxUb0NyZWF0ZSA9IGxldmVsIDwgMiA/IDQgOiBsZXZlbCAtIDE7XG4gIGlmIChsZXZlbFRvQ3JlYXRlID4gMCkge1xuICAgIGNodW5rcy5zdGFydFRhZyA9IG1hbnkoJyMnLCBsZXZlbFRvQ3JlYXRlKSArICcgJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhlYWRpbmc7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGhyIChjaHVua3MpIHtcbiAgY2h1bmtzLnN0YXJ0VGFnID0gJy0tLS0tLS0tLS1cXG4nO1xuICBjaHVua3Muc2VsZWN0aW9uID0gJyc7XG4gIGNodW5rcy5za2lwKHsgbGVmdDogMiwgcmlnaHQ6IDEsIGFueTogdHJ1ZSB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBocjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG9uY2UgPSByZXF1aXJlKCcuLi9vbmNlJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBwYXJzZUxpbmtJbnB1dCA9IHJlcXVpcmUoJy4uL2NodW5rcy9wYXJzZUxpbmtJbnB1dCcpO1xudmFyIHJkZWZpbml0aW9ucyA9IC9eWyBdezAsM31cXFsoKD86YXR0YWNobWVudC0pP1xcZCspXFxdOlsgXFx0XSpcXG4/WyBcXHRdKjw/KFxcUys/KT4/WyBcXHRdKlxcbj9bIFxcdF0qKD86KFxcbiopW1wiKF0oLis/KVtcIildWyBcXHRdKik/KD86XFxuK3wkKS9nbTtcbnZhciByYXR0YWNobWVudCA9IC9eYXR0YWNobWVudC0oXFxkKykkL2k7XG5cbmZ1bmN0aW9uIGV4dHJhY3REZWZpbml0aW9ucyAodGV4dCwgZGVmaW5pdGlvbnMpIHtcbiAgcmRlZmluaXRpb25zLmxhc3RJbmRleCA9IDA7XG4gIHJldHVybiB0ZXh0LnJlcGxhY2UocmRlZmluaXRpb25zLCByZXBsYWNlcik7XG5cbiAgZnVuY3Rpb24gcmVwbGFjZXIgKGFsbCwgaWQsIGxpbmssIG5ld2xpbmVzLCB0aXRsZSkge1xuICAgIGRlZmluaXRpb25zW2lkXSA9IGFsbC5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbiAgICBpZiAobmV3bGluZXMpIHtcbiAgICAgIGRlZmluaXRpb25zW2lkXSA9IGFsbC5yZXBsYWNlKC9bXCIoXSguKz8pW1wiKV0kLywgJycpO1xuICAgICAgcmV0dXJuIG5ld2xpbmVzICsgdGl0bGU7XG4gICAgfVxuICAgIHJldHVybiAnJztcbiAgfVxufVxuXG5mdW5jdGlvbiBwdXNoRGVmaW5pdGlvbiAob3B0aW9ucykge1xuICB2YXIgY2h1bmtzID0gb3B0aW9ucy5jaHVua3M7XG4gIHZhciBkZWZpbml0aW9uID0gb3B0aW9ucy5kZWZpbml0aW9uO1xuICB2YXIgYXR0YWNobWVudCA9IG9wdGlvbnMuYXR0YWNobWVudDtcbiAgdmFyIHJlZ2V4ID0gLyhcXFspKCg/OlxcW1teXFxdXSpcXF18W15cXFtcXF1dKSopKFxcXVsgXT8oPzpcXG5bIF0qKT9cXFspKCg/OmF0dGFjaG1lbnQtKT9cXGQrKShcXF0pL2c7XG4gIHZhciBhbmNob3IgPSAwO1xuICB2YXIgZGVmaW5pdGlvbnMgPSB7fTtcbiAgdmFyIGZvb3Rub3RlcyA9IFtdO1xuXG4gIGNodW5rcy5iZWZvcmUgPSBleHRyYWN0RGVmaW5pdGlvbnMoY2h1bmtzLmJlZm9yZSwgZGVmaW5pdGlvbnMpO1xuICBjaHVua3Muc2VsZWN0aW9uID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5zZWxlY3Rpb24sIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLmFmdGVyID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5hZnRlciwgZGVmaW5pdGlvbnMpO1xuICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJlZ2V4LCBnZXRMaW5rKTtcblxuICBpZiAoZGVmaW5pdGlvbikge1xuICAgIGlmICghYXR0YWNobWVudCkgeyBwdXNoQW5jaG9yKGRlZmluaXRpb24pOyB9XG4gIH0gZWxzZSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG4gIH1cblxuICB2YXIgcmVzdWx0ID0gYW5jaG9yO1xuXG4gIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJlZ2V4LCBnZXRMaW5rKTtcblxuICBpZiAoY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UoL1xcbiokLywgJycpO1xuICB9XG4gIGlmICghY2h1bmtzLmFmdGVyKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXFxuKiQvLCAnJyk7XG4gIH1cblxuICBhbmNob3IgPSAwO1xuICBPYmplY3Qua2V5cyhkZWZpbml0aW9ucykuZm9yRWFjaChwdXNoQXR0YWNobWVudHMpO1xuXG4gIGlmIChhdHRhY2htZW50KSB7XG4gICAgcHVzaEFuY2hvcihkZWZpbml0aW9uKTtcbiAgfVxuICBjaHVua3MuYWZ0ZXIgKz0gJ1xcblxcbicgKyBmb290bm90ZXMuam9pbignXFxuJyk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcblxuICBmdW5jdGlvbiBwdXNoQXR0YWNobWVudHMgKGRlZmluaXRpb24pIHtcbiAgICBpZiAocmF0dGFjaG1lbnQudGVzdChkZWZpbml0aW9uKSkge1xuICAgICAgcHVzaEFuY2hvcihkZWZpbml0aW9uc1tkZWZpbml0aW9uXSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcHVzaEFuY2hvciAoZGVmaW5pdGlvbikge1xuICAgIGFuY2hvcisrO1xuICAgIGRlZmluaXRpb24gPSBkZWZpbml0aW9uLnJlcGxhY2UoL15bIF17MCwzfVxcWyhhdHRhY2htZW50LSk/KFxcZCspXFxdOi8sICcgIFskMScgKyBhbmNob3IgKyAnXTonKTtcbiAgICBmb290bm90ZXMucHVzaChkZWZpbml0aW9uKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGdldExpbmsgKGFsbCwgYmVmb3JlLCBpbm5lciwgYWZ0ZXJJbm5lciwgZGVmaW5pdGlvbiwgZW5kKSB7XG4gICAgaW5uZXIgPSBpbm5lci5yZXBsYWNlKHJlZ2V4LCBnZXRMaW5rKTtcbiAgICBpZiAoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pIHtcbiAgICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pO1xuICAgICAgcmV0dXJuIGJlZm9yZSArIGlubmVyICsgYWZ0ZXJJbm5lciArIGFuY2hvciArIGVuZDtcbiAgICB9XG4gICAgcmV0dXJuIGFsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCAoY2h1bmtzLCBvcHRpb25zKSB7XG4gIHZhciB0eXBlID0gb3B0aW9ucy50eXBlO1xuICB2YXIgaW1hZ2UgPSB0eXBlID09PSAnaW1hZ2UnO1xuICB2YXIgcmVzdW1lO1xuXG4gIGNodW5rcy50cmltKCk7XG4gIGNodW5rcy5maW5kVGFncygvXFxzKiE/XFxbLywgL1xcXVsgXT8oPzpcXG5bIF0qKT8oXFxbLio/XFxdKT8vKTtcblxuICBpZiAoY2h1bmtzLmVuZFRhZy5sZW5ndGggPiAxICYmIGNodW5rcy5zdGFydFRhZy5sZW5ndGggPiAwKSB7XG4gICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UoLyE/XFxbLywgJycpO1xuICAgIGNodW5rcy5lbmRUYWcgPSAnJztcbiAgICBwdXNoRGVmaW5pdGlvbih7IGNodW5rczogY2h1bmtzIH0pO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc3RhcnRUYWcgKyBjaHVua3Muc2VsZWN0aW9uICsgY2h1bmtzLmVuZFRhZztcbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuXG4gIGlmICgvXFxuXFxuLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pKSB7XG4gICAgcHVzaERlZmluaXRpb24oeyBjaHVua3M6IGNodW5rcyB9KTtcbiAgICByZXR1cm47XG4gIH1cbiAgcmVzdW1lID0gdGhpcy5hc3luYygpO1xuXG4gIG9wdGlvbnMucHJvbXB0cy5jbG9zZSgpO1xuICAob3B0aW9ucy5wcm9tcHRzW3R5cGVdIHx8IG9wdGlvbnMucHJvbXB0cy5saW5rKShvcHRpb25zLCBvbmNlKHJlc29sdmVkKSk7XG5cbiAgZnVuY3Rpb24gcmVzb2x2ZWQgKHJlc3VsdCkge1xuICAgIHZhciBsaW5rcyA9IHJlc3VsdFxuICAgICAgLmRlZmluaXRpb25zXG4gICAgICAubWFwKHBhcnNlTGlua0lucHV0KVxuICAgICAgLmZpbHRlcihsb25nKTtcblxuICAgIGxpbmtzLmZvckVhY2gocmVuZGVyTGluayk7XG4gICAgcmVzdW1lKCk7XG5cbiAgICBmdW5jdGlvbiByZW5kZXJMaW5rIChsaW5rLCBpKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gKCcgJyArIGNodW5rcy5zZWxlY3Rpb24pLnJlcGxhY2UoLyhbXlxcXFxdKD86XFxcXFxcXFwpKikoPz1bW1xcXV0pL2csICckMVxcXFwnKS5zdWJzdHIoMSk7XG5cbiAgICAgIHZhciBrZXkgPSByZXN1bHQuYXR0YWNobWVudCA/ICcgIFthdHRhY2htZW50LTk5OTldOiAnIDogJyBbOTk5OV06ICc7XG4gICAgICB2YXIgZGVmaW5pdGlvbiA9IGtleSArIGxpbmsuaHJlZiArIChsaW5rLnRpdGxlID8gJyBcIicgKyBsaW5rLnRpdGxlICsgJ1wiJyA6ICcnKTtcbiAgICAgIHZhciBhbmNob3IgPSBwdXNoRGVmaW5pdGlvbih7XG4gICAgICAgIGNodW5rczogY2h1bmtzLFxuICAgICAgICBkZWZpbml0aW9uOiBkZWZpbml0aW9uLFxuICAgICAgICBhdHRhY2htZW50OiByZXN1bHQuYXR0YWNobWVudFxuICAgICAgfSk7XG5cbiAgICAgIGlmICghcmVzdWx0LmF0dGFjaG1lbnQpIHtcbiAgICAgICAgYWRkKCk7XG4gICAgICB9XG5cbiAgICAgIGZ1bmN0aW9uIGFkZCAoKSB7XG4gICAgICAgIGNodW5rcy5zdGFydFRhZyA9IGltYWdlID8gJyFbJyA6ICdbJztcbiAgICAgICAgY2h1bmtzLmVuZFRhZyA9ICddWycgKyBhbmNob3IgKyAnXSc7XG5cbiAgICAgICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGkgPCBsaW5rcy5sZW5ndGggLSAxKSB7IC8vIGhhcyBtdWx0aXBsZSBsaW5rcywgbm90IHRoZSBsYXN0IG9uZVxuICAgICAgICAgIGNodW5rcy5iZWZvcmUgKz0gY2h1bmtzLnN0YXJ0VGFnICsgY2h1bmtzLnNlbGVjdGlvbiArIGNodW5rcy5lbmRUYWcgKyAnXFxuJztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxvbmcgKGxpbmspIHtcbiAgICAgIHJldHVybiBsaW5rLmhyZWYubGVuZ3RoID4gMDtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaW5rT3JJbWFnZU9yQXR0YWNobWVudDtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1hbnkgPSByZXF1aXJlKCcuLi9tYW55Jyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcbnZhciBzZXR0aW5ncyA9IHJlcXVpcmUoJy4vc2V0dGluZ3MnKTtcbnZhciBycHJldmlvdXMgPSAvKFxcbnxeKSgoWyBdezAsM30oWyorLV18XFxkK1suXSlbIFxcdF0rLiopKFxcbi4rfFxcbnsyLH0oWyorLV0uKnxcXGQrWy5dKVsgXFx0XSsuKnxcXG57Mix9WyBcXHRdK1xcUy4qKSopXFxuKiQvO1xudmFyIHJuZXh0ID0gL15cXG4qKChbIF17MCwzfShbKistXXxcXGQrWy5dKVsgXFx0XSsuKikoXFxuLit8XFxuezIsfShbKistXS4qfFxcZCtbLl0pWyBcXHRdKy4qfFxcbnsyLH1bIFxcdF0rXFxTLiopKilcXG4qLztcbnZhciByYnVsbGV0dHlwZSA9IC9eXFxzKihbKistXSkvO1xudmFyIHJza2lwcGVyID0gL1teXFxuXVxcblxcblteXFxuXS87XG5cbmZ1bmN0aW9uIHBhZCAodGV4dCkge1xuICByZXR1cm4gJyAnICsgdGV4dCArICcgJztcbn1cblxuZnVuY3Rpb24gbGlzdCAoY2h1bmtzLCBvcmRlcmVkKSB7XG4gIHZhciBidWxsZXQgPSAnLSc7XG4gIHZhciBudW0gPSAxO1xuICB2YXIgZGlnaXRhbDtcbiAgdmFyIGJlZm9yZVNraXAgPSAxO1xuICB2YXIgYWZ0ZXJTa2lwID0gMTtcblxuICBjaHVua3MuZmluZFRhZ3MoLyhcXG58XikqWyBdezAsM30oWyorLV18XFxkK1suXSlcXHMrLywgbnVsbCk7XG5cbiAgaWYgKGNodW5rcy5iZWZvcmUgJiYgIS9cXG4kLy50ZXN0KGNodW5rcy5iZWZvcmUpICYmICEvXlxcbi8udGVzdChjaHVua3Muc3RhcnRUYWcpKSB7XG4gICAgY2h1bmtzLmJlZm9yZSArPSBjaHVua3Muc3RhcnRUYWc7XG4gICAgY2h1bmtzLnN0YXJ0VGFnID0gJyc7XG4gIH1cblxuICBpZiAoY2h1bmtzLnN0YXJ0VGFnKSB7XG4gICAgZGlnaXRhbCA9IC9cXGQrWy5dLy50ZXN0KGNodW5rcy5zdGFydFRhZyk7XG4gICAgY2h1bmtzLnN0YXJ0VGFnID0gJyc7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXFxuWyBdezR9L2csICdcXG4nKTtcbiAgICB3cmFwcGluZy51bndyYXAoY2h1bmtzKTtcbiAgICBjaHVua3Muc2tpcCgpO1xuXG4gICAgaWYgKGRpZ2l0YWwpIHtcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJuZXh0LCBnZXRQcmVmaXhlZEl0ZW0pO1xuICAgIH1cbiAgICBpZiAob3JkZXJlZCA9PT0gZGlnaXRhbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfVxuXG4gIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocnByZXZpb3VzLCBiZWZvcmVSZXBsYWNlcik7XG5cbiAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmxpc3RpdGVtO1xuICB9XG5cbiAgdmFyIHByZWZpeCA9IG5leHRCdWxsZXQoKTtcbiAgdmFyIHNwYWNlcyA9IG1hbnkoJyAnLCBwcmVmaXgubGVuZ3RoKTtcblxuICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShybmV4dCwgYWZ0ZXJSZXBsYWNlcik7XG4gIGNodW5rcy50cmltKHRydWUpO1xuICBjaHVua3Muc2tpcCh7IGJlZm9yZTogYmVmb3JlU2tpcCwgYWZ0ZXI6IGFmdGVyU2tpcCwgYW55OiB0cnVlIH0pO1xuICBjaHVua3Muc3RhcnRUYWcgPSBwcmVmaXg7XG4gIHdyYXBwaW5nLndyYXAoY2h1bmtzLCBzZXR0aW5ncy5saW5lTGVuZ3RoIC0gcHJlZml4Lmxlbmd0aCk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcbi9nLCAnXFxuJyArIHNwYWNlcyk7XG5cbiAgZnVuY3Rpb24gYmVmb3JlUmVwbGFjZXIgKHRleHQpIHtcbiAgICBpZiAocmJ1bGxldHR5cGUudGVzdCh0ZXh0KSkge1xuICAgICAgYnVsbGV0ID0gUmVnRXhwLiQxO1xuICAgIH1cbiAgICBiZWZvcmVTa2lwID0gcnNraXBwZXIudGVzdCh0ZXh0KSA/IDEgOiAwO1xuICAgIHJldHVybiBnZXRQcmVmaXhlZEl0ZW0odGV4dCk7XG4gIH1cblxuICBmdW5jdGlvbiBhZnRlclJlcGxhY2VyICh0ZXh0KSB7XG4gICAgYWZ0ZXJTa2lwID0gcnNraXBwZXIudGVzdCh0ZXh0KSA/IDEgOiAwO1xuICAgIHJldHVybiBnZXRQcmVmaXhlZEl0ZW0odGV4dCk7XG4gIH1cblxuICBmdW5jdGlvbiBuZXh0QnVsbGV0ICgpIHtcbiAgICBpZiAob3JkZXJlZCkge1xuICAgICAgcmV0dXJuIHBhZCgobnVtKyspICsgJy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHBhZChidWxsZXQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0UHJlZml4ZWRJdGVtICh0ZXh0KSB7XG4gICAgdmFyIHJtYXJrZXJzID0gL15bIF17MCwzfShbKistXXxcXGQrWy5dKVxccy9nbTtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKHJtYXJrZXJzLCBuZXh0QnVsbGV0KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpc3Q7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBsaW5lTGVuZ3RoOiA3MlxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHByZWZpeGVzID0gJyg/OlxcXFxzezQsfXxcXFxccyo+fFxcXFxzKi1cXFxccyt8XFxcXHMqXFxcXGQrXFxcXC58PXxcXFxcK3wtfF98XFxcXCp8I3xcXFxccypcXFxcW1teXFxuXV0rXFxcXF06KSc7XG52YXIgcmxlYWRpbmdwcmVmaXhlcyA9IG5ldyBSZWdFeHAoJ14nICsgcHJlZml4ZXMsICcnKTtcbnZhciBydGV4dCA9IG5ldyBSZWdFeHAoJyhbXlxcXFxuXSlcXFxcbig/IShcXFxcbnwnICsgcHJlZml4ZXMgKyAnKSknLCAnZycpO1xudmFyIHJ0cmFpbGluZ3NwYWNlcyA9IC9cXHMrJC87XG5cbmZ1bmN0aW9uIHdyYXAgKGNodW5rcywgbGVuKSB7XG4gIHZhciByZWdleCA9IG5ldyBSZWdFeHAoJyguezEsJyArIGxlbiArICd9KSggK3wkXFxcXG4/KScsICdnbScpO1xuXG4gIHVud3JhcChjaHVua3MpO1xuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvblxuICAgIC5yZXBsYWNlKHJlZ2V4LCByZXBsYWNlcilcbiAgICAucmVwbGFjZShydHJhaWxpbmdzcGFjZXMsICcnKTtcblxuICBmdW5jdGlvbiByZXBsYWNlciAobGluZSwgbWFya2VkKSB7XG4gICAgcmV0dXJuIHJsZWFkaW5ncHJlZml4ZXMudGVzdChsaW5lKSA/IGxpbmUgOiBtYXJrZWQgKyAnXFxuJztcbiAgfVxufVxuXG5mdW5jdGlvbiB1bndyYXAgKGNodW5rcykge1xuICBydGV4dC5sYXN0SW5kZXggPSAwO1xuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKHJ0ZXh0LCAnJDEgJDInKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHdyYXA6IHdyYXAsXG4gIHVud3JhcDogdW53cmFwXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgRXZlbnRzID0gcmVxdWlyZSgnLi4vLi4vZXZlbnRzJyk7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi8uLi91dGlscycpO1xuXG5mdW5jdGlvbiBUZXh0U3VyZmFjZSAoZWRpdG9yKSB7XG4gIHZhciB0ZXh0YXJlYSA9IHRoaXMudGV4dGFyZWEgPSBlZGl0b3IudGV4dGFyZWE7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgX2NhY2hlZCA9IHRoaXMucmVhZCgpO1xuICB2YXIgZGVib3VuY2VkQ2hhbmdlID0gdXRpbHMuZGVib3VuY2Uoc2VuZENoYW5nZSwgMTAwKTtcblxuICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgc2VuZENoYW5nZSk7XG4gIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2N1dCcsIHNlbmRDaGFuZ2UpO1xuICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdwYXN0ZScsIHNlbmRDaGFuZ2UpO1xuICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBkZWJvdW5jZWRDaGFuZ2UpO1xuICB0ZXh0YXJlYS5hZGRFdmVudExpc3RlbmVyKCdpbnB1dCcsIGRlYm91bmNlZENoYW5nZSk7XG4gIHRleHRhcmVhLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZGVib3VuY2VkQ2hhbmdlKTtcblxuICBmdW5jdGlvbiBzZW5kQ2hhbmdlICgpIHtcbiAgICB2YXIgdXBkYXRlZCA9IHNlbGYucmVhZCgpO1xuICAgIGlmKF9jYWNoZWQgIT09IHVwZGF0ZWQpIHtcbiAgICAgIF9jYWNoZWQgPSB1cGRhdGVkO1xuICAgICAgc2VsZi50cmlnZ2VyKCdjaGFuZ2UnLCB1cGRhdGVkKTtcbiAgICB9XG4gIH1cbn1cblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLmZvY3VzID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnRleHRhcmVhLmZvY3VzKCk7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUucmVhZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMudGV4dGFyZWEudmFsdWU7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdGhpcy50ZXh0YXJlYS52YWx1ZSA9IHZhbHVlO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLmN1cnJlbnQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnRleHRhcmVhO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLndyaXRlU2VsZWN0aW9uID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHRoaXMudGV4dGFyZWEuZm9jdXMoKTtcbiAgdGhpcy50ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCA9IHN0YXRlLnN0YXJ0O1xuICB0aGlzLnRleHRhcmVhLnNlbGVjdGlvbkVuZCA9IHN0YXRlLmVuZDtcbiAgdGhpcy50ZXh0YXJlYS5zY3JvbGxUb3AgPSBzdGF0ZS5zY3JvbGxUb3A7XG59O1xuXG5UZXh0U3VyZmFjZS5wcm90b3R5cGUucmVhZFNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICBzdGF0ZS5zdGFydCA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQ7XG4gIHN0YXRlLmVuZCA9IHRoaXMudGV4dGFyZWEuc2VsZWN0aW9uRW5kO1xufTtcblxuVGV4dFN1cmZhY2UucHJvdG90eXBlLnRvTWFya2Rvd24gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLnJlYWQoKTtcbn07XG5cblRleHRTdXJmYWNlLnByb3RvdHlwZS53cml0ZU1hcmtkb3duID0gZnVuY3Rpb24gKG1hcmtkb3duKSB7XG4gIHJldHVybiB0aGlzLndyaXRlKChtYXJrZG93biB8fCAnJykudHJpbSgpKTtcbn07XG5cblRleHRTdXJmYWNlLnByb3RvdHlwZS50b0hUTUwgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVkaXRvci5wYXJzZU1hcmtkb3duKHRoaXMucmVhZCgpKTtcbn07XG5FdmVudHMuZXh0ZW5kKFRleHRTdXJmYWNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBUZXh0U3VyZmFjZTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIEV2ZW50cyA9IHJlcXVpcmUoJy4uLy4uL2V2ZW50cycpO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMnKTtcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciByb3BlbiA9IC9eKDxbXj5dKyg/OiBbXj5dKik/PikvO1xudmFyIHJjbG9zZSA9IC8oPFxcL1tePl0rPikkLztcbnZhciBycGFyYWdyYXBoID0gL148cD48XFwvcD5cXG4/JC9pO1xuXG5mdW5jdGlvbiBXeXNpd3lnU3VyZmFjZSAoZWRpdG9yLCBvcHRpb25zKSB7XG4gIHRoaXMuZWRpdG9yID0gZWRpdG9yO1xuICB2YXIgZWRpdGFibGUgPSB0aGlzLmVkaXRhYmxlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBlZGl0YWJsZS5jbGFzc05hbWUgPSBbJ3drLXd5c2l3eWcnLCAnd2staGlkZSddLmNvbmNhdChvcHRpb25zLmNsYXNzZXMpLmpvaW4oJyAnKTtcbiAgZWRpdGFibGUuY29udGVudEVkaXRhYmxlID0gdHJ1ZTtcblxuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBfY2FjaGVkID0gdGhpcy5yZWFkKCk7XG4gIHZhciBkZWJvdW5jZWRDaGFuZ2UgPSB1dGlscy5kZWJvdW5jZShzZW5kQ2hhbmdlLCAyMDApO1xuXG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCBzZW5kQ2hhbmdlKTtcbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcignY3V0Jywgc2VuZENoYW5nZSk7XG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ3Bhc3RlJywgc2VuZENoYW5nZSk7XG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ3RleHRpbnB1dCcsIGRlYm91bmNlZENoYW5nZSk7XG4gIGVkaXRhYmxlLmFkZEV2ZW50TGlzdGVuZXIoJ2lucHV0JywgZGVib3VuY2VkQ2hhbmdlKTtcbiAgZWRpdGFibGUuYWRkRXZlbnRMaXN0ZW5lcigna2V5cHJlc3MnLCBkZWJvdW5jZWRDaGFuZ2UpO1xuICBlZGl0YWJsZS5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIGRlYm91bmNlZENoYW5nZSk7XG5cbiAgZnVuY3Rpb24gc2VuZENoYW5nZSAoKSB7XG4gICAgdmFyIHVwZGF0ZWQgPSBzZWxmLnJlYWQoKTtcbiAgICBpZihfY2FjaGVkICE9PSB1cGRhdGVkKSB7XG4gICAgICBfY2FjaGVkID0gdXBkYXRlZDtcbiAgICAgIHNlbGYudHJpZ2dlcignY2hhbmdlJywgdXBkYXRlZCk7XG4gICAgfVxuICB9XG59XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5mb2N1cyA9IGZ1bmN0aW9uIChmb3JjZUltbWVkaWF0ZSkge1xuICBpZihmb3JjZUltbWVkaWF0ZSkge1xuICAgIHRoaXMuZWRpdGFibGUuZm9jdXMoKTtcbiAgfSBlbHNlIHtcbiAgICBzZXRUaW1lb3V0KHRoaXMuZWRpdGFibGUuZm9jdXMuYmluZCh0aGlzLmVkaXRhYmxlKSwgMCk7XG4gIH1cbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5yZWFkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lZGl0YWJsZS5pbm5lckhUTUw7XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgdGhpcy5lZGl0YWJsZS5pbm5lckhUTUwgPSB2YWx1ZTtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS5jdXJyZW50ID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lZGl0YWJsZTtcbn07XG5cbld5c2l3eWdTdXJmYWNlLnByb3RvdHlwZS53cml0ZVNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgY2h1bmtzID0gc3RhdGUuY2FjaGVkQ2h1bmtzIHx8IHN0YXRlLmdldENodW5rcygpO1xuICB2YXIgc3RhcnQgPSB1bmVzY2FwZVRleHQoY2h1bmtzLmJlZm9yZSkubGVuZ3RoO1xuICB2YXIgZW5kID0gc3RhcnQgKyB1bmVzY2FwZVRleHQoY2h1bmtzLnNlbGVjdGlvbikubGVuZ3RoO1xuICB2YXIgcCA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICB2YXIgc3RhcnRSYW5nZVNldCA9IGZhbHNlO1xuICB2YXIgZW5kUmFuZ2VTZXQgPSBmYWxzZTtcblxuICB3YWxrKHRoaXMuZWRpdGFibGUuZmlyc3RDaGlsZCwgcGVlayk7XG4gIHRoaXMuZWRpdGFibGUuZm9jdXMoKTtcbiAgdmFyIHNlbGVjdGlvbiA9IGRvYy5nZXRTZWxlY3Rpb24oKTtcbiAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuICBzZWxlY3Rpb24uYWRkUmFuZ2UocCk7XG5cbiAgZnVuY3Rpb24gcGVlayAoY29udGV4dCwgZWwpIHtcbiAgICB2YXIgY3Vyc29yID0gdW5lc2NhcGVUZXh0KGNvbnRleHQudGV4dCkubGVuZ3RoO1xuICAgIHZhciBjb250ZW50ID0gcmVhZE5vZGUoZWwsIGZhbHNlKS5sZW5ndGg7XG4gICAgdmFyIHN1bSA9IGN1cnNvciArIGNvbnRlbnQ7XG4gICAgaWYgKCFzdGFydFJhbmdlU2V0ICYmIHN1bSA+PSBzdGFydCkge1xuICAgICAgcC5zZXRTdGFydChlbCwgYm91bmRlZChzdGFydCAtIGN1cnNvcikpO1xuICAgICAgc3RhcnRSYW5nZVNldCA9IHRydWU7XG4gICAgfVxuICAgIGlmICghZW5kUmFuZ2VTZXQgJiYgc3VtID49IGVuZCkge1xuICAgICAgcC5zZXRFbmQoZWwsIGJvdW5kZWQoZW5kIC0gY3Vyc29yKSk7XG4gICAgICBlbmRSYW5nZVNldCA9IHRydWU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYm91bmRlZCAob2Zmc2V0KSB7XG4gICAgICByZXR1cm4gTWF0aC5tYXgoMCwgTWF0aC5taW4oY29udGVudCwgb2Zmc2V0KSk7XG4gICAgfVxuICB9XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUucmVhZFNlbGVjdGlvbiA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgc2VsID0gZG9jLmdldFNlbGVjdGlvbigpO1xuICB2YXIgZGlzdGFuY2UgPSB3YWxrKHRoaXMuZWRpdGFibGUuZmlyc3RDaGlsZCwgcGVlayk7XG4gIHZhciBzdGFydCA9IGRpc3RhbmNlLnN0YXJ0IHx8IDA7XG4gIHZhciBlbmQgPSBkaXN0YW5jZS5lbmQgfHwgMDtcblxuICBzdGF0ZS50ZXh0ID0gZGlzdGFuY2UudGV4dDtcblxuICBpZiAoZW5kID4gc3RhcnQpIHtcbiAgICBzdGF0ZS5zdGFydCA9IHN0YXJ0O1xuICAgIHN0YXRlLmVuZCA9IGVuZDtcbiAgfSBlbHNlIHtcbiAgICBzdGF0ZS5zdGFydCA9IGVuZDtcbiAgICBzdGF0ZS5lbmQgPSBzdGFydDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgdmFyIGVsVGV4dCA9IChlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJycpO1xuXG4gICAgaWYgKGVsID09PSBzZWwuYW5jaG9yTm9kZSkge1xuICAgICAgY29udGV4dC5zdGFydCA9IGNvbnRleHQudGV4dC5sZW5ndGggKyBlc2NhcGVOb2RlVGV4dChlbFRleHQuc3Vic3RyaW5nKDAsIHNlbC5hbmNob3JPZmZzZXQpKS5sZW5ndGg7XG4gICAgfVxuICAgIGlmIChlbCA9PT0gc2VsLmZvY3VzTm9kZSkge1xuICAgICAgY29udGV4dC5lbmQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgZXNjYXBlTm9kZVRleHQoZWxUZXh0LnN1YnN0cmluZygwLCBzZWwuZm9jdXNPZmZzZXQpKS5sZW5ndGg7XG4gICAgfVxuICB9XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUudG9NYXJrZG93biA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWRpdG9yLnBhcnNlSFRNTCh0aGlzLnJlYWQoKSk7XG59O1xuXG5XeXNpd3lnU3VyZmFjZS5wcm90b3R5cGUud3JpdGVNYXJrZG93biA9IGZ1bmN0aW9uIChtYXJrZG93bikge1xuICB2YXIgaHRtbCA9IHRoaXMuZWRpdG9yLnBhcnNlTWFya2Rvd24obWFya2Rvd24gfHwgJycpXG4gICAgLnJlcGxhY2UocnBhcmFncmFwaCwgJycpIC8vIFJlbW92ZSBlbXB0eSA8cD4gdGFnc1xuICAgIC50cmltKCk7XG4gIHJldHVybiB0aGlzLndyaXRlKGh0bWwpO1xufTtcblxuV3lzaXd5Z1N1cmZhY2UucHJvdG90eXBlLnRvSFRNTCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMucmVhZCgpO1xufTtcblxuZnVuY3Rpb24gd2FsayAoZWwsIHBlZWssIGN0eCwgc2libGluZ3MpIHtcbiAgdmFyIGNvbnRleHQgPSBjdHggfHwgeyB0ZXh0OiAnJyB9O1xuXG4gIGlmICghZWwpIHtcbiAgICByZXR1cm4gY29udGV4dDtcbiAgfVxuXG4gIHZhciBlbE5vZGUgPSBlbC5ub2RlVHlwZSA9PT0gMTtcbiAgdmFyIHRleHROb2RlID0gZWwubm9kZVR5cGUgPT09IDM7XG5cbiAgcGVlayhjb250ZXh0LCBlbCk7XG5cbiAgaWYgKHRleHROb2RlKSB7XG4gICAgY29udGV4dC50ZXh0ICs9IHJlYWROb2RlKGVsKTtcbiAgfVxuICBpZiAoZWxOb2RlKSB7XG4gICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyb3BlbikpIHsgY29udGV4dC50ZXh0ICs9IFJlZ0V4cC4kMTsgfVxuICAgIEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGVsLmNoaWxkTm9kZXMpLmZvckVhY2god2Fsa0NoaWxkcmVuKTtcbiAgICBpZiAoZWwub3V0ZXJIVE1MLm1hdGNoKHJjbG9zZSkpIHsgY29udGV4dC50ZXh0ICs9IFJlZ0V4cC4kMTsgfVxuICB9XG4gIGlmIChzaWJsaW5ncyAhPT0gZmFsc2UgJiYgZWwubmV4dFNpYmxpbmcpIHtcbiAgICByZXR1cm4gd2FsayhlbC5uZXh0U2libGluZywgcGVlaywgY29udGV4dCk7XG4gIH1cbiAgcmV0dXJuIGNvbnRleHQ7XG5cbiAgZnVuY3Rpb24gd2Fsa0NoaWxkcmVuIChjaGlsZCkge1xuICAgIHdhbGsoY2hpbGQsIHBlZWssIGNvbnRleHQsIGZhbHNlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkTm9kZSAoZWwsIGVzY2FwZSkge1xuICBpZihlbC5ub2RlVHlwZSA9PT0gMykge1xuICAgIGlmKGVzY2FwZSA9PT0gZmFsc2UpIHtcbiAgICAgIHJldHVybiBlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJyc7XG4gICAgfVxuXG4gICAgcmV0dXJuIGVzY2FwZU5vZGVUZXh0KGVsKTtcbiAgfVxuICByZXR1cm4gJyc7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZU5vZGVUZXh0IChlbCkge1xuICBlbCA9IGVsIHx8ICcnO1xuICBpZihlbC5ub2RlVHlwZSA9PT0gMykge1xuICAgIGVsID0gZWwuY2xvbmVOb2RlKCk7XG4gIH0gZWxzZSB7XG4gICAgZWwgPSBkb2MuY3JlYXRlVGV4dE5vZGUoZWwpO1xuICB9XG5cbiAgLy8gVXNpbmcgYnJvd3NlciBlc2NhcGluZyB0byBjbGVhbiB1cCBhbnkgc3BlY2lhbCBjaGFyYWN0ZXJzXG4gIHZhciB0b1RleHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvVGV4dC5hcHBlbmRDaGlsZChlbCk7XG4gIHJldHVybiB0b1RleHQuaW5uZXJIVE1MIHx8ICcnO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZVRleHQgKGVsKSB7XG4gIGlmKGVsLm5vZGVUeXBlKSB7XG4gICAgcmV0dXJuIGVsLnRleHRDb250ZW50IHx8IGVsLmlubmVyVGV4dCB8fCAnJztcbiAgfVxuXG4gIHZhciB0b1RleHQgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIHRvVGV4dC50ZXh0Q29udGVudCA9IGVsO1xuICByZXR1cm4gdG9UZXh0LnRleHRDb250ZW50O1xufVxuXG5FdmVudHMuZXh0ZW5kKFd5c2l3eWdTdXJmYWNlKTtcblxubW9kdWxlLmV4cG9ydHMgPSBXeXNpd3lnU3VyZmFjZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5dGIyUmxjeTkzZVhOcGQzbG5MM2Q1YzJsM2VXZFRkWEptWVdObExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRU0lzSW1acGJHVWlPaUpuWlc1bGNtRjBaV1F1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sYzBOdmJuUmxiblFpT2xzaUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdSWFpsYm5SeklEMGdjbVZ4ZFdseVpTZ25MaTR2TGk0dlpYWmxiblJ6SnlrN1hHNTJZWElnZFhScGJITWdQU0J5WlhGMWFYSmxLQ2N1TGk4dUxpOTFkR2xzY3ljcE8xeHVYRzUyWVhJZ1pHOWpJRDBnWjJ4dlltRnNMbVJ2WTNWdFpXNTBPMXh1ZG1GeUlISnZjR1Z1SUQwZ0wxNG9QRnRlUGwwcktEODZJRnRlUGwwcUtUOCtLUzg3WEc1MllYSWdjbU5zYjNObElEMGdMeWc4WEZ3dlcxNCtYU3MrS1NRdk8xeHVkbUZ5SUhKd1lYSmhaM0poY0dnZ1BTQXZYanh3UGp4Y1hDOXdQbHhjYmo4a0wyazdYRzVjYm1aMWJtTjBhVzl1SUZkNWMybDNlV2RUZFhKbVlXTmxJQ2hsWkdsMGIzSXNJRzl3ZEdsdmJuTXBJSHRjYmlBZ2RHaHBjeTVsWkdsMGIzSWdQU0JsWkdsMGIzSTdYRzRnSUhaaGNpQmxaR2wwWVdKc1pTQTlJSFJvYVhNdVpXUnBkR0ZpYkdVZ1BTQmtiMk11WTNKbFlYUmxSV3hsYldWdWRDZ25aR2wySnlrN1hHNGdJR1ZrYVhSaFlteGxMbU5zWVhOelRtRnRaU0E5SUZzbmQyc3RkM2x6YVhkNVp5Y3NJQ2QzYXkxb2FXUmxKMTB1WTI5dVkyRjBLRzl3ZEdsdmJuTXVZMnhoYzNObGN5a3VhbTlwYmlnbklDY3BPMXh1SUNCbFpHbDBZV0pzWlM1amIyNTBaVzUwUldScGRHRmliR1VnUFNCMGNuVmxPMXh1WEc0Z0lIWmhjaUJ6Wld4bUlEMGdkR2hwY3p0Y2JpQWdkbUZ5SUY5allXTm9aV1FnUFNCMGFHbHpMbkpsWVdRb0tUdGNiaUFnZG1GeUlHUmxZbTkxYm1ObFpFTm9ZVzVuWlNBOUlIVjBhV3h6TG1SbFltOTFibU5sS0hObGJtUkRhR0Z1WjJVc0lESXdNQ2s3WEc1Y2JpQWdaV1JwZEdGaWJHVXVZV1JrUlhabGJuUk1hWE4wWlc1bGNpZ25ZbXgxY2ljc0lITmxibVJEYUdGdVoyVXBPMXh1SUNCbFpHbDBZV0pzWlM1aFpHUkZkbVZ1ZEV4cGMzUmxibVZ5S0NkamRYUW5MQ0J6Wlc1a1EyaGhibWRsS1R0Y2JpQWdaV1JwZEdGaWJHVXVZV1JrUlhabGJuUk1hWE4wWlc1bGNpZ25jR0Z6ZEdVbkxDQnpaVzVrUTJoaGJtZGxLVHRjYmlBZ1pXUnBkR0ZpYkdVdVlXUmtSWFpsYm5STWFYTjBaVzVsY2lnbmRHVjRkR2x1Y0hWMEp5d2daR1ZpYjNWdVkyVmtRMmhoYm1kbEtUdGNiaUFnWldScGRHRmliR1V1WVdSa1JYWmxiblJNYVhOMFpXNWxjaWduYVc1d2RYUW5MQ0JrWldKdmRXNWpaV1JEYUdGdVoyVXBPMXh1SUNCbFpHbDBZV0pzWlM1aFpHUkZkbVZ1ZEV4cGMzUmxibVZ5S0NkclpYbHdjbVZ6Y3ljc0lHUmxZbTkxYm1ObFpFTm9ZVzVuWlNrN1hHNGdJR1ZrYVhSaFlteGxMbUZrWkVWMlpXNTBUR2x6ZEdWdVpYSW9KMnRsZVhWd0p5d2daR1ZpYjNWdVkyVmtRMmhoYm1kbEtUdGNibHh1SUNCbWRXNWpkR2x2YmlCelpXNWtRMmhoYm1kbElDZ3BJSHRjYmlBZ0lDQjJZWElnZFhCa1lYUmxaQ0E5SUhObGJHWXVjbVZoWkNncE8xeHVJQ0FnSUdsbUtGOWpZV05vWldRZ0lUMDlJSFZ3WkdGMFpXUXBJSHRjYmlBZ0lDQWdJRjlqWVdOb1pXUWdQU0IxY0dSaGRHVmtPMXh1SUNBZ0lDQWdjMlZzWmk1MGNtbG5aMlZ5S0NkamFHRnVaMlVuTENCMWNHUmhkR1ZrS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNibjFjYmx4dVYzbHphWGQ1WjFOMWNtWmhZMlV1Y0hKdmRHOTBlWEJsTG1adlkzVnpJRDBnWm5WdVkzUnBiMjRnS0dadmNtTmxTVzF0WldScFlYUmxLU0I3WEc0Z0lHbG1LR1p2Y21ObFNXMXRaV1JwWVhSbEtTQjdYRzRnSUNBZ2RHaHBjeTVsWkdsMFlXSnNaUzVtYjJOMWN5Z3BPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSE5sZEZScGJXVnZkWFFvZEdocGN5NWxaR2wwWVdKc1pTNW1iMk4xY3k1aWFXNWtLSFJvYVhNdVpXUnBkR0ZpYkdVcExDQXdLVHRjYmlBZ2ZWeHVmVHRjYmx4dVYzbHphWGQ1WjFOMWNtWmhZMlV1Y0hKdmRHOTBlWEJsTG5KbFlXUWdQU0JtZFc1amRHbHZiaUFvS1NCN1hHNGdJSEpsZEhWeWJpQjBhR2x6TG1Wa2FYUmhZbXhsTG1sdWJtVnlTRlJOVER0Y2JuMDdYRzVjYmxkNWMybDNlV2RUZFhKbVlXTmxMbkJ5YjNSdmRIbHdaUzUzY21sMFpTQTlJR1oxYm1OMGFXOXVJQ2gyWVd4MVpTa2dlMXh1SUNCMGFHbHpMbVZrYVhSaFlteGxMbWx1Ym1WeVNGUk5UQ0E5SUhaaGJIVmxPMXh1ZlR0Y2JseHVWM2x6YVhkNVoxTjFjbVpoWTJVdWNISnZkRzkwZVhCbExtTjFjbkpsYm5RZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lISmxkSFZ5YmlCMGFHbHpMbVZrYVhSaFlteGxPMXh1ZlR0Y2JseHVWM2x6YVhkNVoxTjFjbVpoWTJVdWNISnZkRzkwZVhCbExuZHlhWFJsVTJWc1pXTjBhVzl1SUQwZ1puVnVZM1JwYjI0Z0tITjBZWFJsS1NCN1hHNGdJSFpoY2lCamFIVnVhM01nUFNCemRHRjBaUzVqWVdOb1pXUkRhSFZ1YTNNZ2ZId2djM1JoZEdVdVoyVjBRMmgxYm10ektDazdYRzRnSUhaaGNpQnpkR0Z5ZENBOUlIVnVaWE5qWVhCbFZHVjRkQ2hqYUhWdWEzTXVZbVZtYjNKbEtTNXNaVzVuZEdnN1hHNGdJSFpoY2lCbGJtUWdQU0J6ZEdGeWRDQXJJSFZ1WlhOallYQmxWR1Y0ZENoamFIVnVhM011YzJWc1pXTjBhVzl1S1M1c1pXNW5kR2c3WEc0Z0lIWmhjaUJ3SUQwZ1pHOWpMbU55WldGMFpWSmhibWRsS0NrN1hHNGdJSFpoY2lCemRHRnlkRkpoYm1kbFUyVjBJRDBnWm1Gc2MyVTdYRzRnSUhaaGNpQmxibVJTWVc1blpWTmxkQ0E5SUdaaGJITmxPMXh1WEc0Z0lIZGhiR3NvZEdocGN5NWxaR2wwWVdKc1pTNW1hWEp6ZEVOb2FXeGtMQ0J3WldWcktUdGNiaUFnZEdocGN5NWxaR2wwWVdKc1pTNW1iMk4xY3lncE8xeHVJQ0IyWVhJZ2MyVnNaV04wYVc5dUlEMGdaRzlqTG1kbGRGTmxiR1ZqZEdsdmJpZ3BPMXh1SUNCelpXeGxZM1JwYjI0dWNtVnRiM1psUVd4c1VtRnVaMlZ6S0NrN1hHNGdJSE5sYkdWamRHbHZiaTVoWkdSU1lXNW5aU2h3S1R0Y2JseHVJQ0JtZFc1amRHbHZiaUJ3WldWcklDaGpiMjUwWlhoMExDQmxiQ2tnZTF4dUlDQWdJSFpoY2lCamRYSnpiM0lnUFNCMWJtVnpZMkZ3WlZSbGVIUW9ZMjl1ZEdWNGRDNTBaWGgwS1M1c1pXNW5kR2c3WEc0Z0lDQWdkbUZ5SUdOdmJuUmxiblFnUFNCeVpXRmtUbTlrWlNobGJDd2dabUZzYzJVcExteGxibWQwYUR0Y2JpQWdJQ0IyWVhJZ2MzVnRJRDBnWTNWeWMyOXlJQ3NnWTI5dWRHVnVkRHRjYmlBZ0lDQnBaaUFvSVhOMFlYSjBVbUZ1WjJWVFpYUWdKaVlnYzNWdElENDlJSE4wWVhKMEtTQjdYRzRnSUNBZ0lDQndMbk5sZEZOMFlYSjBLR1ZzTENCaWIzVnVaR1ZrS0hOMFlYSjBJQzBnWTNWeWMyOXlLU2s3WEc0Z0lDQWdJQ0J6ZEdGeWRGSmhibWRsVTJWMElEMGdkSEoxWlR0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0NGbGJtUlNZVzVuWlZObGRDQW1KaUJ6ZFcwZ1BqMGdaVzVrS1NCN1hHNGdJQ0FnSUNCd0xuTmxkRVZ1WkNobGJDd2dZbTkxYm1SbFpDaGxibVFnTFNCamRYSnpiM0lwS1R0Y2JpQWdJQ0FnSUdWdVpGSmhibWRsVTJWMElEMGdkSEoxWlR0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JtZFc1amRHbHZiaUJpYjNWdVpHVmtJQ2h2Wm1aelpYUXBJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQk5ZWFJvTG0xaGVDZ3dMQ0JOWVhSb0xtMXBiaWhqYjI1MFpXNTBMQ0J2Wm1aelpYUXBLVHRjYmlBZ0lDQjlYRzRnSUgxY2JuMDdYRzVjYmxkNWMybDNlV2RUZFhKbVlXTmxMbkJ5YjNSdmRIbHdaUzV5WldGa1UyVnNaV04wYVc5dUlEMGdablZ1WTNScGIyNGdLSE4wWVhSbEtTQjdYRzRnSUhaaGNpQnpaV3dnUFNCa2IyTXVaMlYwVTJWc1pXTjBhVzl1S0NrN1hHNGdJSFpoY2lCa2FYTjBZVzVqWlNBOUlIZGhiR3NvZEdocGN5NWxaR2wwWVdKc1pTNW1hWEp6ZEVOb2FXeGtMQ0J3WldWcktUdGNiaUFnZG1GeUlITjBZWEowSUQwZ1pHbHpkR0Z1WTJVdWMzUmhjblFnZkh3Z01EdGNiaUFnZG1GeUlHVnVaQ0E5SUdScGMzUmhibU5sTG1WdVpDQjhmQ0F3TzF4dVhHNGdJSE4wWVhSbExuUmxlSFFnUFNCa2FYTjBZVzVqWlM1MFpYaDBPMXh1WEc0Z0lHbG1JQ2hsYm1RZ1BpQnpkR0Z5ZENrZ2UxeHVJQ0FnSUhOMFlYUmxMbk4wWVhKMElEMGdjM1JoY25RN1hHNGdJQ0FnYzNSaGRHVXVaVzVrSUQwZ1pXNWtPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSE4wWVhSbExuTjBZWEowSUQwZ1pXNWtPMXh1SUNBZ0lITjBZWFJsTG1WdVpDQTlJSE4wWVhKME8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdjR1ZsYXlBb1kyOXVkR1Y0ZEN3Z1pXd3BJSHRjYmlBZ0lDQjJZWElnWld4VVpYaDBJRDBnS0dWc0xuUmxlSFJEYjI1MFpXNTBJSHg4SUdWc0xtbHVibVZ5VkdWNGRDQjhmQ0FuSnlrN1hHNWNiaUFnSUNCcFppQW9aV3dnUFQwOUlITmxiQzVoYm1Ob2IzSk9iMlJsS1NCN1hHNGdJQ0FnSUNCamIyNTBaWGgwTG5OMFlYSjBJRDBnWTI5dWRHVjRkQzUwWlhoMExteGxibWQwYUNBcklHVnpZMkZ3WlU1dlpHVlVaWGgwS0dWc1ZHVjRkQzV6ZFdKemRISnBibWNvTUN3Z2MyVnNMbUZ1WTJodmNrOW1abk5sZENrcExteGxibWQwYUR0Y2JpQWdJQ0I5WEc0Z0lDQWdhV1lnS0dWc0lEMDlQU0J6Wld3dVptOWpkWE5PYjJSbEtTQjdYRzRnSUNBZ0lDQmpiMjUwWlhoMExtVnVaQ0E5SUdOdmJuUmxlSFF1ZEdWNGRDNXNaVzVuZEdnZ0t5QmxjMk5oY0dWT2IyUmxWR1Y0ZENobGJGUmxlSFF1YzNWaWMzUnlhVzVuS0RBc0lITmxiQzVtYjJOMWMwOW1abk5sZENrcExteGxibWQwYUR0Y2JpQWdJQ0I5WEc0Z0lIMWNibjA3WEc1Y2JsZDVjMmwzZVdkVGRYSm1ZV05sTG5CeWIzUnZkSGx3WlM1MGIwMWhjbXRrYjNkdUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQnlaWFIxY200Z2RHaHBjeTVsWkdsMGIzSXVjR0Z5YzJWSVZFMU1LSFJvYVhNdWNtVmhaQ2dwS1R0Y2JuMDdYRzVjYmxkNWMybDNlV2RUZFhKbVlXTmxMbkJ5YjNSdmRIbHdaUzUzY21sMFpVMWhjbXRrYjNkdUlEMGdablZ1WTNScGIyNGdLRzFoY210a2IzZHVLU0I3WEc0Z0lIWmhjaUJvZEcxc0lEMGdkR2hwY3k1bFpHbDBiM0l1Y0dGeWMyVk5ZWEpyWkc5M2JpaHRZWEpyWkc5M2JpQjhmQ0FuSnlsY2JpQWdJQ0F1Y21Wd2JHRmpaU2h5Y0dGeVlXZHlZWEJvTENBbkp5a2dMeThnVW1WdGIzWmxJR1Z0Y0hSNUlEeHdQaUIwWVdkelhHNGdJQ0FnTG5SeWFXMG9LVHRjYmlBZ2NtVjBkWEp1SUhSb2FYTXVkM0pwZEdVb2FIUnRiQ2s3WEc1OU8xeHVYRzVYZVhOcGQzbG5VM1Z5Wm1GalpTNXdjbTkwYjNSNWNHVXVkRzlJVkUxTUlEMGdablZ1WTNScGIyNGdLQ2tnZTF4dUlDQnlaWFIxY200Z2RHaHBjeTV5WldGa0tDazdYRzU5TzF4dVhHNW1kVzVqZEdsdmJpQjNZV3hySUNobGJDd2djR1ZsYXl3Z1kzUjRMQ0J6YVdKc2FXNW5jeWtnZTF4dUlDQjJZWElnWTI5dWRHVjRkQ0E5SUdOMGVDQjhmQ0I3SUhSbGVIUTZJQ2NuSUgwN1hHNWNiaUFnYVdZZ0tDRmxiQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQmpiMjUwWlhoME8xeHVJQ0I5WEc1Y2JpQWdkbUZ5SUdWc1RtOWtaU0E5SUdWc0xtNXZaR1ZVZVhCbElEMDlQU0F4TzF4dUlDQjJZWElnZEdWNGRFNXZaR1VnUFNCbGJDNXViMlJsVkhsd1pTQTlQVDBnTXp0Y2JseHVJQ0J3WldWcktHTnZiblJsZUhRc0lHVnNLVHRjYmx4dUlDQnBaaUFvZEdWNGRFNXZaR1VwSUh0Y2JpQWdJQ0JqYjI1MFpYaDBMblJsZUhRZ0t6MGdjbVZoWkU1dlpHVW9aV3dwTzF4dUlDQjlYRzRnSUdsbUlDaGxiRTV2WkdVcElIdGNiaUFnSUNCcFppQW9aV3d1YjNWMFpYSklWRTFNTG0xaGRHTm9LSEp2Y0dWdUtTa2dleUJqYjI1MFpYaDBMblJsZUhRZ0t6MGdVbVZuUlhod0xpUXhPeUI5WEc0Z0lDQWdRWEp5WVhrdWNISnZkRzkwZVhCbExuTnNhV05sTG1OaGJHd29aV3d1WTJocGJHUk9iMlJsY3lrdVptOXlSV0ZqYUNoM1lXeHJRMmhwYkdSeVpXNHBPMXh1SUNBZ0lHbG1JQ2hsYkM1dmRYUmxja2hVVFV3dWJXRjBZMmdvY21Oc2IzTmxLU2tnZXlCamIyNTBaWGgwTG5SbGVIUWdLejBnVW1WblJYaHdMaVF4T3lCOVhHNGdJSDFjYmlBZ2FXWWdLSE5wWW14cGJtZHpJQ0U5UFNCbVlXeHpaU0FtSmlCbGJDNXVaWGgwVTJsaWJHbHVaeWtnZTF4dUlDQWdJSEpsZEhWeWJpQjNZV3hyS0dWc0xtNWxlSFJUYVdKc2FXNW5MQ0J3WldWckxDQmpiMjUwWlhoMEtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z1kyOXVkR1Y0ZER0Y2JseHVJQ0JtZFc1amRHbHZiaUIzWVd4clEyaHBiR1J5Wlc0Z0tHTm9hV3hrS1NCN1hHNGdJQ0FnZDJGc2F5aGphR2xzWkN3Z2NHVmxheXdnWTI5dWRHVjRkQ3dnWm1Gc2MyVXBPMXh1SUNCOVhHNTlYRzVjYm1aMWJtTjBhVzl1SUhKbFlXUk9iMlJsSUNobGJDd2daWE5qWVhCbEtTQjdYRzRnSUdsbUtHVnNMbTV2WkdWVWVYQmxJRDA5UFNBektTQjdYRzRnSUNBZ2FXWW9aWE5qWVhCbElEMDlQU0JtWVd4elpTa2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHVnNMblJsZUhSRGIyNTBaVzUwSUh4OElHVnNMbWx1Ym1WeVZHVjRkQ0I4ZkNBbkp6dGNiaUFnSUNCOVhHNWNiaUFnSUNCeVpYUjFjbTRnWlhOallYQmxUbTlrWlZSbGVIUW9aV3dwTzF4dUlDQjlYRzRnSUhKbGRIVnliaUFuSnp0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnWlhOallYQmxUbTlrWlZSbGVIUWdLR1ZzS1NCN1hHNGdJR1ZzSUQwZ1pXd2dmSHdnSnljN1hHNGdJR2xtS0dWc0xtNXZaR1ZVZVhCbElEMDlQU0F6S1NCN1hHNGdJQ0FnWld3Z1BTQmxiQzVqYkc5dVpVNXZaR1VvS1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCbGJDQTlJR1J2WXk1amNtVmhkR1ZVWlhoMFRtOWtaU2hsYkNrN1hHNGdJSDFjYmx4dUlDQXZMeUJWYzJsdVp5QmljbTkzYzJWeUlHVnpZMkZ3YVc1bklIUnZJR05zWldGdUlIVndJR0Z1ZVNCemNHVmphV0ZzSUdOb1lYSmhZM1JsY25OY2JpQWdkbUZ5SUhSdlZHVjRkQ0E5SUdSdll5NWpjbVZoZEdWRmJHVnRaVzUwS0Nka2FYWW5LVHRjYmlBZ2RHOVVaWGgwTG1Gd2NHVnVaRU5vYVd4a0tHVnNLVHRjYmlBZ2NtVjBkWEp1SUhSdlZHVjRkQzVwYm01bGNraFVUVXdnZkh3Z0p5YzdYRzU5WEc1Y2JtWjFibU4wYVc5dUlIVnVaWE5qWVhCbFZHVjRkQ0FvWld3cElIdGNiaUFnYVdZb1pXd3VibTlrWlZSNWNHVXBJSHRjYmlBZ0lDQnlaWFIxY200Z1pXd3VkR1Y0ZEVOdmJuUmxiblFnZkh3Z1pXd3VhVzV1WlhKVVpYaDBJSHg4SUNjbk8xeHVJQ0I5WEc1Y2JpQWdkbUZ5SUhSdlZHVjRkQ0E5SUdSdll5NWpjbVZoZEdWRmJHVnRaVzUwS0Nka2FYWW5LVHRjYmlBZ2RHOVVaWGgwTG5SbGVIUkRiMjUwWlc1MElEMGdaV3c3WEc0Z0lISmxkSFZ5YmlCMGIxUmxlSFF1ZEdWNGRFTnZiblJsYm5RN1hHNTlYRzVjYmtWMlpXNTBjeTVsZUhSbGJtUW9WM2x6YVhkNVoxTjFjbVpoWTJVcE8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRmQ1YzJsM2VXZFRkWEptWVdObE8xeHVJbDE5IiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBvbmNlIChmbikge1xuICB2YXIgZGlzcG9zZWQ7XG4gIHJldHVybiBmdW5jdGlvbiBkaXNwb3NhYmxlICgpIHtcbiAgICBpZiAoZGlzcG9zZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGlzcG9zZWQgPSB0cnVlO1xuICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IG9uY2U7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBkb2N1bWVudDtcblxuZnVuY3Rpb24gaG9tZWJyZXdRU0EgKGNsYXNzTmFtZSkge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICB2YXIgYWxsID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCcqJyk7XG4gIHZhciBpO1xuICBmb3IgKGkgaW4gYWxsKSB7XG4gICAgaWYgKHdyYXAoYWxsW2ldLmNsYXNzTmFtZSkuaW5kZXhPZih3cmFwKGNsYXNzTmFtZSkpICE9PSAtMSkge1xuICAgICAgcmVzdWx0cy5wdXNoKGFsbFtpXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiB3cmFwICh0ZXh0KSB7XG4gIHJldHVybiAnICcgKyB0ZXh0ICsgJyAnO1xufVxuXG5mdW5jdGlvbiBjbG9zZVByb21wdHMgKCkge1xuICBpZiAoZG9jLmJvZHkucXVlcnlTZWxlY3RvckFsbCkge1xuICAgIHJlbW92ZShkb2MuYm9keS5xdWVyeVNlbGVjdG9yQWxsKCcud2stcHJvbXB0JykpO1xuICB9IGVsc2Uge1xuICAgIHJlbW92ZShob21lYnJld1FTQSgnd2stcHJvbXB0JykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZSAocHJvbXB0cykge1xuICB2YXIgbGVuID0gcHJvbXB0cy5sZW5ndGg7XG4gIHZhciBpO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBwcm9tcHRzW2ldLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQocHJvbXB0c1tpXSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjbG9zZVByb21wdHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIHZhciBidXJlYXVjcmFjeSA9IHJlcXVpcmUoJ2J1cmVhdWNyYWN5Jyk7XG52YXIgcmVuZGVyID0gcmVxdWlyZSgnLi9yZW5kZXInKTtcbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi4vY2xhc3NlcycpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgdXBsb2FkcyA9IHJlcXVpcmUoJy4uL3VwbG9hZHMnKTtcbnZhciBFTlRFUl9LRVkgPSAxMztcbnZhciBFU0NBUEVfS0VZID0gMjc7XG52YXIgZHJhZ0NsYXNzID0gJ3drLWRyYWdnaW5nJztcbnZhciBkcmFnQ2xhc3NTcGVjaWZpYyA9ICd3ay1wcm9tcHQtdXBsb2FkLWRyYWdnaW5nJztcbnZhciByb290ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xuXG5mdW5jdGlvbiBjbGFzc2lmeSAoZ3JvdXAsIGNsYXNzZXMpIHtcbiAgT2JqZWN0LmtleXMoZ3JvdXApLmZvckVhY2goY3VzdG9taXplKTtcbiAgZnVuY3Rpb24gY3VzdG9taXplIChrZXkpIHtcbiAgICBpZiAoY2xhc3Nlc1trZXldKSB7XG4gICAgICBncm91cFtrZXldLmNsYXNzTmFtZSArPSAnICcgKyBjbGFzc2VzW2tleV07XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHByb21wdCAob3B0aW9ucywgZG9uZSkge1xuICB2YXIgdGV4dCA9IHN0cmluZ3MucHJvbXB0c1tvcHRpb25zLnR5cGVdO1xuICB2YXIgZG9tID0gcmVuZGVyKHtcbiAgICBpZDogJ3drLXByb21wdC0nICsgb3B0aW9ucy50eXBlLFxuICAgIHRpdGxlOiB0ZXh0LnRpdGxlLFxuICAgIGRlc2NyaXB0aW9uOiB0ZXh0LmRlc2NyaXB0aW9uLFxuICAgIHBsYWNlaG9sZGVyOiB0ZXh0LnBsYWNlaG9sZGVyXG4gIH0pO1xuICB2YXIgZG9tdXA7XG5cbiAgZG9tLmNhbmNlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHJlbW92ZSk7XG4gIGRvbS5jbG9zZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIHJlbW92ZSk7XG4gIGRvbS5vay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9rKTtcbiAgZG9tLmlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleXByZXNzJywgZW50ZXIpO1xuICBkb20uZGlhbG9nLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlc2MpO1xuICBjbGFzc2lmeShkb20sIG9wdGlvbnMuY2xhc3Nlcy5wcm9tcHRzKTtcblxuICB2YXIgdXBsb2FkID0gb3B0aW9ucy51cGxvYWQ7XG4gIGlmICh0eXBlb2YgdXBsb2FkID09PSAnc3RyaW5nJykge1xuICAgIHVwbG9hZCA9IHsgdXJsOiB1cGxvYWQgfTtcbiAgfVxuXG4gIHZhciBidXJlYXVjcmF0ID0gbnVsbDtcbiAgaWYgKHVwbG9hZCkge1xuICAgIGJ1cmVhdWNyYXQgPSBhcnJhbmdlVXBsb2FkcygpO1xuICAgIGlmIChvcHRpb25zLmF1dG9VcGxvYWQpIHtcbiAgICAgIGJ1cmVhdWNyYXQuc3VibWl0KG9wdGlvbnMuYXV0b1VwbG9hZCk7XG4gICAgfVxuICB9XG5cbiAgc2V0VGltZW91dChmb2N1c0RpYWxvZywgMCk7XG5cbiAgZnVuY3Rpb24gZm9jdXNEaWFsb2cgKCkge1xuICAgIGRvbS5pbnB1dC5mb2N1cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gZW50ZXIgKGUpIHtcbiAgICB2YXIga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKGtleSA9PT0gRU5URVJfS0VZKSB7XG4gICAgICBvaygpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVzYyAoZSkge1xuICAgIHZhciBrZXkgPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBpZiAoa2V5ID09PSBFU0NBUEVfS0VZKSB7XG4gICAgICByZW1vdmUoKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBvayAoKSB7XG4gICAgcmVtb3ZlKCk7XG4gICAgZG9uZSh7IGRlZmluaXRpb25zOiBbZG9tLmlucHV0LnZhbHVlXSB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZSAoKSB7XG4gICAgaWYgKHVwbG9hZCkgeyBiaW5kVXBsb2FkRXZlbnRzKHRydWUpOyB9XG4gICAgaWYgKGRvbS5kaWFsb2cucGFyZW50RWxlbWVudCkgeyBkb20uZGlhbG9nLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZG9tLmRpYWxvZyk7IH1cbiAgICBvcHRpb25zLnN1cmZhY2UuZm9jdXMob3B0aW9ucy5tb2RlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmRVcGxvYWRFdmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgcm9vdFtvcCArICdFdmVudExpc3RlbmVyJ10oJ2RyYWdlbnRlcicsIGRyYWdnaW5nKTtcbiAgICByb290W29wICsgJ0V2ZW50TGlzdGVuZXInXSgnZHJhZ2VuZCcsIGRyYWdzdG9wKTtcbiAgICByb290W29wICsgJ0V2ZW50TGlzdGVuZXInXSgnbW91c2VvdXQnLCBkcmFnc3RvcCk7XG4gIH1cblxuICBmdW5jdGlvbiBkcmFnZ2luZyAoKSB7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAuYXJlYSwgZHJhZ0NsYXNzKTtcbiAgICBjbGFzc2VzLmFkZChkb211cC5hcmVhLCBkcmFnQ2xhc3NTcGVjaWZpYyk7XG4gIH1cbiAgZnVuY3Rpb24gZHJhZ3N0b3AgKCkge1xuICAgIGNsYXNzZXMucm0oZG9tdXAuYXJlYSwgZHJhZ0NsYXNzKTtcbiAgICBjbGFzc2VzLnJtKGRvbXVwLmFyZWEsIGRyYWdDbGFzc1NwZWNpZmljKTtcbiAgICB1cGxvYWRzLnN0b3Aob3B0aW9ucy5zdXJmYWNlLmRyb3BhcmVhKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFycmFuZ2VVcGxvYWRzICgpIHtcbiAgICBkb211cCA9IHJlbmRlci51cGxvYWRzKGRvbSwgc3RyaW5ncy5wcm9tcHRzLnR5cGVzICsgKHVwbG9hZC5yZXN0cmljdGlvbiB8fCBvcHRpb25zLnR5cGUgKyAncycpKTtcbiAgICBiaW5kVXBsb2FkRXZlbnRzKCk7XG4gICAgZG9tdXAuYXJlYS5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIGhhbmRsZURyYWdPdmVyLCBmYWxzZSk7XG4gICAgZG9tdXAuYXJlYS5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgaGFuZGxlRmlsZVNlbGVjdCwgZmFsc2UpO1xuICAgIGNsYXNzaWZ5KGRvbXVwLCBvcHRpb25zLmNsYXNzZXMucHJvbXB0cyk7XG4vKlxuICAgIHZhciBidXJlYXVjcmF0ID0gYnVyZWF1Y3JhY3kuc2V0dXAoZG9tdXAuZmlsZWlucHV0LCB7XG4gICAgICBtZXRob2Q6IHVwbG9hZC5tZXRob2QsXG4gICAgICBmb3JtRGF0YTogdXBsb2FkLmZvcm1EYXRhLFxuICAgICAgZmllbGRLZXk6IHVwbG9hZC5maWVsZEtleSxcbiAgICAgIGVuZHBvaW50OiB1cGxvYWQudXJsLFxuICAgICAgdmFsaWRhdGU6ICdpbWFnZSdcbiAgICB9KTtcblxuICAgIGJ1cmVhdWNyYXQub24oJ3N0YXJ0ZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBjbGFzc2VzLnJtKGRvbXVwLmZhaWxlZCwgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgICBjbGFzc2VzLnJtKGRvbXVwLndhcm5pbmcsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgIH0pO1xuICAgIGJ1cmVhdWNyYXQub24oJ3ZhbGlkJywgZnVuY3Rpb24gKCkge1xuICAgICAgY2xhc3Nlcy5hZGQoZG9tdXAuYXJlYSwgJ3drLXByb21wdC11cGxvYWRpbmcnKTtcbiAgICB9KTtcbiAgICBidXJlYXVjcmF0Lm9uKCdpbnZhbGlkJywgZnVuY3Rpb24gKCkge1xuICAgICAgY2xhc3Nlcy5hZGQoZG9tdXAud2FybmluZywgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgfSk7XG4gICAgYnVyZWF1Y3JhdC5vbignZXJyb3InLCBmdW5jdGlvbiAoKSB7XG4gICAgICBjbGFzc2VzLmFkZChkb211cC5mYWlsZWQsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgIH0pO1xuICAgIGJ1cmVhdWNyYXQub24oJ3N1Y2Nlc3MnLCByZWNlaXZlZEltYWdlcyk7XG4gICAgYnVyZWF1Y3JhdC5vbignZW5kZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICBjbGFzc2VzLnJtKGRvbXVwLmFyZWEsICd3ay1wcm9tcHQtdXBsb2FkaW5nJyk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gYnVyZWF1Y3JhdDtcblxuICAgIGZ1bmN0aW9uIHJlY2VpdmVkSW1hZ2VzIChyZXN1bHRzKSB7XG4gICAgICB2YXIgYm9keSA9IHJlc3VsdHNbMF07XG4gICAgICBkb20uaW5wdXQudmFsdWUgPSBib2R5LmhyZWYgKyAnIFwiJyArIGJvZHkudGl0bGUgKyAnXCInO1xuICAgICAgcmVtb3ZlKCk7XG4gICAgICBkb25lKHtcbiAgICAgICAgZGVmaW5pdGlvbnM6IHJlc3VsdHMubWFwKHRvRGVmaW5pdGlvbiksXG4gICAgICAgIGF0dGFjaG1lbnQ6IG9wdGlvbnMudHlwZSA9PT0gJ2F0dGFjaG1lbnQnXG4gICAgICB9KTtcbiAgICAgIGZ1bmN0aW9uIHRvRGVmaW5pdGlvbiAocmVzdWx0KSB7XG4gICAgICAgIHJldHVybiByZXN1bHQuaHJlZiArICcgXCInICsgcmVzdWx0LnRpdGxlICsgJ1wiJztcbiAgICAgIH1cbiAgICB9ICovXG4gIH1cblxuICBmdW5jdGlvbiBoYW5kbGVEcmFnT3ZlciAoZSkge1xuICAgIHN0b3AoZSk7XG4gICAgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5JztcbiAgfVxuXG4gIGZ1bmN0aW9uIGhhbmRsZUZpbGVTZWxlY3QgKGUpIHtcbiAgICBkcmFnc3RvcCgpO1xuICAgIHN0b3AoZSk7XG4gICAgYnVyZWF1Y3JhdC5zdWJtaXQoZS5kYXRhVHJhbnNmZXIuZmlsZXMpO1xuICB9XG5cbiAgZnVuY3Rpb24gc3RvcCAoZSkge1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcHJvbXB0O1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4uL2NsYXNzZXMnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIGFjID0gJ2FwcGVuZENoaWxkJztcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIGUgKHR5cGUsIGNscywgdGV4dCkge1xuICB2YXIgZWwgPSBkb2MuY3JlYXRlRWxlbWVudCh0eXBlKTtcbiAgZWwuY2xhc3NOYW1lID0gY2xzO1xuICBpZiAodGV4dCkge1xuICAgIGVsLnRleHRDb250ZW50ID0gdGV4dDtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHJlbmRlciAob3B0aW9ucykge1xuICB2YXIgZG9tID0ge1xuICAgIGRpYWxvZzogZSgnYXJ0aWNsZScsICd3ay1wcm9tcHQgJyArIG9wdGlvbnMuaWQpLFxuICAgIGNsb3NlOiBlKCdhJywgJ3drLXByb21wdC1jbG9zZScpLFxuICAgIGhlYWRlcjogZSgnaGVhZGVyJywgJ3drLXByb21wdC1oZWFkZXInKSxcbiAgICBoMTogZSgnaDEnLCAnd2stcHJvbXB0LXRpdGxlJywgb3B0aW9ucy50aXRsZSksXG4gICAgc2VjdGlvbjogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtYm9keScpLFxuICAgIGRlc2M6IGUoJ3AnLCAnd2stcHJvbXB0LWRlc2NyaXB0aW9uJywgb3B0aW9ucy5kZXNjcmlwdGlvbiksXG4gICAgaW5wdXRDb250YWluZXI6IGUoJ2RpdicsICd3ay1wcm9tcHQtaW5wdXQtY29udGFpbmVyJyksXG4gICAgaW5wdXQ6IGUoJ2lucHV0JywgJ3drLXByb21wdC1pbnB1dCcpLFxuICAgIGNhbmNlbDogZSgnYnV0dG9uJywgJ3drLXByb21wdC1jYW5jZWwnLCAnQ2FuY2VsJyksXG4gICAgb2s6IGUoJ2J1dHRvbicsICd3ay1wcm9tcHQtb2snLCAnT2snKSxcbiAgICBmb290ZXI6IGUoJ2Zvb3RlcicsICd3ay1wcm9tcHQtYnV0dG9ucycpXG4gIH07XG4gIGRvbS5vay50eXBlID0gJ2J1dHRvbic7XG4gIGRvbS5oZWFkZXJbYWNdKGRvbS5oMSk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uZGVzYyk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uaW5wdXRDb250YWluZXJbYWNdKGRvbS5pbnB1dCk7XG4gIGRvbS5pbnB1dC5wbGFjZWhvbGRlciA9IG9wdGlvbnMucGxhY2Vob2xkZXI7XG4gIGRvbS5jYW5jZWwudHlwZSA9ICdidXR0b24nO1xuICBkb20uZm9vdGVyW2FjXShkb20uY2FuY2VsKTtcbiAgZG9tLmZvb3RlclthY10oZG9tLm9rKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmNsb3NlKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmhlYWRlcik7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5zZWN0aW9uKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmZvb3Rlcik7XG4gIGRvYy5ib2R5W2FjXShkb20uZGlhbG9nKTtcbiAgcmV0dXJuIGRvbTtcbn1cblxuZnVuY3Rpb24gdXBsb2FkcyAoZG9tLCB3YXJuaW5nKSB7XG4gIHZhciBmdXAgPSAnd2stcHJvbXB0LWZpbGV1cGxvYWQnO1xuICB2YXIgZG9tdXAgPSB7XG4gICAgYXJlYTogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtdXBsb2FkLWFyZWEnKSxcbiAgICB3YXJuaW5nOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay13YXJuaW5nJywgd2FybmluZyksXG4gICAgZmFpbGVkOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay1mYWlsZWQnLCBzdHJpbmdzLnByb21wdHMudXBsb2FkZmFpbGVkKSxcbiAgICB1cGxvYWQ6IGUoJ2xhYmVsJywgJ3drLXByb21wdC11cGxvYWQnKSxcbiAgICB1cGxvYWRpbmc6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LXByb2dyZXNzJywgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZGluZyksXG4gICAgZHJvcDogZSgnc3BhbicsICd3ay1wcm9tcHQtZHJvcCcsIHN0cmluZ3MucHJvbXB0cy5kcm9wKSxcbiAgICBkcm9waWNvbjogZSgncCcsICd3ay1kcm9wLWljb24gd2stcHJvbXB0LWRyb3AtaWNvbicpLFxuICAgIGJyb3dzZTogZSgnc3BhbicsICd3ay1wcm9tcHQtYnJvd3NlJywgc3RyaW5ncy5wcm9tcHRzLmJyb3dzZSksXG4gICAgZHJhZ2Ryb3A6IGUoJ3AnLCAnd2stcHJvbXB0LWRyYWdkcm9wJywgc3RyaW5ncy5wcm9tcHRzLmRyb3BoaW50KSxcbiAgICBmaWxlaW5wdXQ6IGUoJ2lucHV0JywgZnVwKVxuICB9O1xuICBkb211cC5hcmVhW2FjXShkb211cC5kcm9wKTtcbiAgZG9tdXAuYXJlYVthY10oZG9tdXAudXBsb2FkaW5nKTtcbiAgZG9tdXAuYXJlYVthY10oZG9tdXAuZHJvcGljb24pO1xuICBkb211cC51cGxvYWRbYWNdKGRvbXVwLmJyb3dzZSk7XG4gIGRvbXVwLnVwbG9hZFthY10oZG9tdXAuZmlsZWlucHV0KTtcbiAgZG9tdXAuZmlsZWlucHV0LmlkID0gZnVwO1xuICBkb211cC5maWxlaW5wdXQudHlwZSA9ICdmaWxlJztcbiAgZG9tdXAuZmlsZWlucHV0Lm11bHRpcGxlID0gJ211bHRpcGxlJztcbiAgZG9tLmRpYWxvZy5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtdXBsb2Fkcyc7XG4gIGRvbS5pbnB1dENvbnRhaW5lci5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtaW5wdXQtY29udGFpbmVyLXVwbG9hZHMnO1xuICBkb20uaW5wdXQuY2xhc3NOYW1lICs9ICcgd2stcHJvbXB0LWlucHV0LXVwbG9hZHMnO1xuICBkb20uc2VjdGlvbi5pbnNlcnRCZWZvcmUoZG9tdXAud2FybmluZywgZG9tLmlucHV0Q29udGFpbmVyKTtcbiAgZG9tLnNlY3Rpb24uaW5zZXJ0QmVmb3JlKGRvbXVwLmZhaWxlZCwgZG9tLmlucHV0Q29udGFpbmVyKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLnVwbG9hZCk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb211cC5kcmFnZHJvcCk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb211cC5hcmVhKTtcbiAgZG9tLmRlc2MudGV4dENvbnRlbnQgPSBkb20uZGVzYy50ZXh0Q29udGVudCArIHN0cmluZ3MucHJvbXB0cy51cGxvYWQ7XG4gIGRvbXVwLmZpbGVpbnB1dC5hZGRFdmVudExpc3RlbmVyKCdmb2N1cycsIGZvY3VzZWRGaWxlSW5wdXQpO1xuICBkb211cC5maWxlaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIGJsdXJyZWRGaWxlSW5wdXQpO1xuXG4gIGZ1bmN0aW9uIGZvY3VzZWRGaWxlSW5wdXQgKCkge1xuICAgIGNsYXNzZXMuYWRkKGRvbXVwLnVwbG9hZCwgJ3drLWZvY3VzZWQnKTtcbiAgfVxuICBmdW5jdGlvbiBibHVycmVkRmlsZUlucHV0ICgpIHtcbiAgICBjbGFzc2VzLnJtKGRvbXVwLnVwbG9hZCwgJ3drLWZvY3VzZWQnKTtcbiAgfVxuICByZXR1cm4gZG9tdXA7XG59XG5cbnJlbmRlci51cGxvYWRzID0gdXBsb2Fkcztcbm1vZHVsZS5leHBvcnRzID0gcmVuZGVyO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTl3Y205dGNIUnpMM0psYm1SbGNpNXFjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUVVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCamJHRnpjMlZ6SUQwZ2NtVnhkV2x5WlNnbkxpNHZZMnhoYzNObGN5Y3BPMXh1ZG1GeUlITjBjbWx1WjNNZ1BTQnlaWEYxYVhKbEtDY3VMaTl6ZEhKcGJtZHpKeWs3WEc1MllYSWdZV01nUFNBbllYQndaVzVrUTJocGJHUW5PMXh1ZG1GeUlHUnZZeUE5SUdkc2IySmhiQzVrYjJOMWJXVnVkRHRjYmx4dVpuVnVZM1JwYjI0Z1pTQW9kSGx3WlN3Z1kyeHpMQ0IwWlhoMEtTQjdYRzRnSUhaaGNpQmxiQ0E5SUdSdll5NWpjbVZoZEdWRmJHVnRaVzUwS0hSNWNHVXBPMXh1SUNCbGJDNWpiR0Z6YzA1aGJXVWdQU0JqYkhNN1hHNGdJR2xtSUNoMFpYaDBLU0I3WEc0Z0lDQWdaV3d1ZEdWNGRFTnZiblJsYm5RZ1BTQjBaWGgwTzF4dUlDQjlYRzRnSUhKbGRIVnliaUJsYkR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnY21WdVpHVnlJQ2h2Y0hScGIyNXpLU0I3WEc0Z0lIWmhjaUJrYjIwZ1BTQjdYRzRnSUNBZ1pHbGhiRzluT2lCbEtDZGhjblJwWTJ4bEp5d2dKM2RyTFhCeWIyMXdkQ0FuSUNzZ2IzQjBhVzl1Y3k1cFpDa3NYRzRnSUNBZ1kyeHZjMlU2SUdVb0oyRW5MQ0FuZDJzdGNISnZiWEIwTFdOc2IzTmxKeWtzWEc0Z0lDQWdhR1ZoWkdWeU9pQmxLQ2RvWldGa1pYSW5MQ0FuZDJzdGNISnZiWEIwTFdobFlXUmxjaWNwTEZ4dUlDQWdJR2d4T2lCbEtDZG9NU2NzSUNkM2F5MXdjbTl0Y0hRdGRHbDBiR1VuTENCdmNIUnBiMjV6TG5ScGRHeGxLU3hjYmlBZ0lDQnpaV04wYVc5dU9pQmxLQ2R6WldOMGFXOXVKeXdnSjNkckxYQnliMjF3ZEMxaWIyUjVKeWtzWEc0Z0lDQWdaR1Z6WXpvZ1pTZ25jQ2NzSUNkM2F5MXdjbTl0Y0hRdFpHVnpZM0pwY0hScGIyNG5MQ0J2Y0hScGIyNXpMbVJsYzJOeWFYQjBhVzl1S1N4Y2JpQWdJQ0JwYm5CMWRFTnZiblJoYVc1bGNqb2daU2duWkdsMkp5d2dKM2RyTFhCeWIyMXdkQzFwYm5CMWRDMWpiMjUwWVdsdVpYSW5LU3hjYmlBZ0lDQnBibkIxZERvZ1pTZ25hVzV3ZFhRbkxDQW5kMnN0Y0hKdmJYQjBMV2x1Y0hWMEp5a3NYRzRnSUNBZ1kyRnVZMlZzT2lCbEtDZGlkWFIwYjI0bkxDQW5kMnN0Y0hKdmJYQjBMV05oYm1ObGJDY3NJQ2REWVc1alpXd25LU3hjYmlBZ0lDQnZhem9nWlNnblluVjBkRzl1Snl3Z0ozZHJMWEJ5YjIxd2RDMXZheWNzSUNkUGF5Y3BMRnh1SUNBZ0lHWnZiM1JsY2pvZ1pTZ25abTl2ZEdWeUp5d2dKM2RyTFhCeWIyMXdkQzFpZFhSMGIyNXpKeWxjYmlBZ2ZUdGNiaUFnWkc5dExtOXJMblI1Y0dVZ1BTQW5ZblYwZEc5dUp6dGNiaUFnWkc5dExtaGxZV1JsY2x0aFkxMG9aRzl0TG1neEtUdGNiaUFnWkc5dExuTmxZM1JwYjI1YllXTmRLR1J2YlM1a1pYTmpLVHRjYmlBZ1pHOXRMbk5sWTNScGIyNWJZV05kS0dSdmJTNXBibkIxZEVOdmJuUmhhVzVsY2lrN1hHNGdJR1J2YlM1cGJuQjFkRU52Ym5SaGFXNWxjbHRoWTEwb1pHOXRMbWx1Y0hWMEtUdGNiaUFnWkc5dExtbHVjSFYwTG5Cc1lXTmxhRzlzWkdWeUlEMGdiM0IwYVc5dWN5NXdiR0ZqWldodmJHUmxjanRjYmlBZ1pHOXRMbU5oYm1ObGJDNTBlWEJsSUQwZ0oySjFkSFJ2YmljN1hHNGdJR1J2YlM1bWIyOTBaWEpiWVdOZEtHUnZiUzVqWVc1alpXd3BPMXh1SUNCa2IyMHVabTl2ZEdWeVcyRmpYU2hrYjIwdWIyc3BPMXh1SUNCa2IyMHVaR2xoYkc5blcyRmpYU2hrYjIwdVkyeHZjMlVwTzF4dUlDQmtiMjB1WkdsaGJHOW5XMkZqWFNoa2IyMHVhR1ZoWkdWeUtUdGNiaUFnWkc5dExtUnBZV3h2WjF0aFkxMG9aRzl0TG5ObFkzUnBiMjRwTzF4dUlDQmtiMjB1WkdsaGJHOW5XMkZqWFNoa2IyMHVabTl2ZEdWeUtUdGNiaUFnWkc5akxtSnZaSGxiWVdOZEtHUnZiUzVrYVdGc2IyY3BPMXh1SUNCeVpYUjFjbTRnWkc5dE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCMWNHeHZZV1J6SUNoa2IyMHNJSGRoY201cGJtY3BJSHRjYmlBZ2RtRnlJR1oxY0NBOUlDZDNheTF3Y205dGNIUXRabWxzWlhWd2JHOWhaQ2M3WEc0Z0lIWmhjaUJrYjIxMWNDQTlJSHRjYmlBZ0lDQmhjbVZoT2lCbEtDZHpaV04wYVc5dUp5d2dKM2RyTFhCeWIyMXdkQzExY0d4dllXUXRZWEpsWVNjcExGeHVJQ0FnSUhkaGNtNXBibWM2SUdVb0ozQW5MQ0FuZDJzdGNISnZiWEIwTFdWeWNtOXlJSGRyTFhkaGNtNXBibWNuTENCM1lYSnVhVzVuS1N4Y2JpQWdJQ0JtWVdsc1pXUTZJR1VvSjNBbkxDQW5kMnN0Y0hKdmJYQjBMV1Z5Y205eUlIZHJMV1poYVd4bFpDY3NJSE4wY21sdVozTXVjSEp2YlhCMGN5NTFjR3h2WVdSbVlXbHNaV1FwTEZ4dUlDQWdJSFZ3Ykc5aFpEb2daU2duYkdGaVpXd25MQ0FuZDJzdGNISnZiWEIwTFhWd2JHOWhaQ2NwTEZ4dUlDQWdJSFZ3Ykc5aFpHbHVaem9nWlNnbmMzQmhiaWNzSUNkM2F5MXdjbTl0Y0hRdGNISnZaM0psYzNNbkxDQnpkSEpwYm1kekxuQnliMjF3ZEhNdWRYQnNiMkZrYVc1bktTeGNiaUFnSUNCa2NtOXdPaUJsS0NkemNHRnVKeXdnSjNkckxYQnliMjF3ZEMxa2NtOXdKeXdnYzNSeWFXNW5jeTV3Y205dGNIUnpMbVJ5YjNBcExGeHVJQ0FnSUdSeWIzQnBZMjl1T2lCbEtDZHdKeXdnSjNkckxXUnliM0F0YVdOdmJpQjNheTF3Y205dGNIUXRaSEp2Y0MxcFkyOXVKeWtzWEc0Z0lDQWdZbkp2ZDNObE9pQmxLQ2R6Y0dGdUp5d2dKM2RyTFhCeWIyMXdkQzFpY205M2MyVW5MQ0J6ZEhKcGJtZHpMbkJ5YjIxd2RITXVZbkp2ZDNObEtTeGNiaUFnSUNCa2NtRm5aSEp2Y0RvZ1pTZ25jQ2NzSUNkM2F5MXdjbTl0Y0hRdFpISmhaMlJ5YjNBbkxDQnpkSEpwYm1kekxuQnliMjF3ZEhNdVpISnZjR2hwYm5RcExGeHVJQ0FnSUdacGJHVnBibkIxZERvZ1pTZ25hVzV3ZFhRbkxDQm1kWEFwWEc0Z0lIMDdYRzRnSUdSdmJYVndMbUZ5WldGYllXTmRLR1J2YlhWd0xtUnliM0FwTzF4dUlDQmtiMjExY0M1aGNtVmhXMkZqWFNoa2IyMTFjQzUxY0d4dllXUnBibWNwTzF4dUlDQmtiMjExY0M1aGNtVmhXMkZqWFNoa2IyMTFjQzVrY205d2FXTnZiaWs3WEc0Z0lHUnZiWFZ3TG5Wd2JHOWhaRnRoWTEwb1pHOXRkWEF1WW5KdmQzTmxLVHRjYmlBZ1pHOXRkWEF1ZFhCc2IyRmtXMkZqWFNoa2IyMTFjQzVtYVd4bGFXNXdkWFFwTzF4dUlDQmtiMjExY0M1bWFXeGxhVzV3ZFhRdWFXUWdQU0JtZFhBN1hHNGdJR1J2YlhWd0xtWnBiR1ZwYm5CMWRDNTBlWEJsSUQwZ0oyWnBiR1VuTzF4dUlDQmtiMjExY0M1bWFXeGxhVzV3ZFhRdWJYVnNkR2x3YkdVZ1BTQW5iWFZzZEdsd2JHVW5PMXh1SUNCa2IyMHVaR2xoYkc5bkxtTnNZWE56VG1GdFpTQXJQU0FuSUhkckxYQnliMjF3ZEMxMWNHeHZZV1J6Snp0Y2JpQWdaRzl0TG1sdWNIVjBRMjl1ZEdGcGJtVnlMbU5zWVhOelRtRnRaU0FyUFNBbklIZHJMWEJ5YjIxd2RDMXBibkIxZEMxamIyNTBZV2x1WlhJdGRYQnNiMkZrY3ljN1hHNGdJR1J2YlM1cGJuQjFkQzVqYkdGemMwNWhiV1VnS3owZ0p5QjNheTF3Y205dGNIUXRhVzV3ZFhRdGRYQnNiMkZrY3ljN1hHNGdJR1J2YlM1elpXTjBhVzl1TG1sdWMyVnlkRUpsWm05eVpTaGtiMjExY0M1M1lYSnVhVzVuTENCa2IyMHVhVzV3ZFhSRGIyNTBZV2x1WlhJcE8xeHVJQ0JrYjIwdWMyVmpkR2x2Ymk1cGJuTmxjblJDWldadmNtVW9aRzl0ZFhBdVptRnBiR1ZrTENCa2IyMHVhVzV3ZFhSRGIyNTBZV2x1WlhJcE8xeHVJQ0JrYjIwdWMyVmpkR2x2Ymx0aFkxMG9aRzl0ZFhBdWRYQnNiMkZrS1R0Y2JpQWdaRzl0TG5ObFkzUnBiMjViWVdOZEtHUnZiWFZ3TG1SeVlXZGtjbTl3S1R0Y2JpQWdaRzl0TG5ObFkzUnBiMjViWVdOZEtHUnZiWFZ3TG1GeVpXRXBPMXh1SUNCa2IyMHVaR1Z6WXk1MFpYaDBRMjl1ZEdWdWRDQTlJR1J2YlM1a1pYTmpMblJsZUhSRGIyNTBaVzUwSUNzZ2MzUnlhVzVuY3k1d2NtOXRjSFJ6TG5Wd2JHOWhaRHRjYmlBZ1pHOXRkWEF1Wm1sc1pXbHVjSFYwTG1Ga1pFVjJaVzUwVEdsemRHVnVaWElvSjJadlkzVnpKeXdnWm05amRYTmxaRVpwYkdWSmJuQjFkQ2s3WEc0Z0lHUnZiWFZ3TG1acGJHVnBibkIxZEM1aFpHUkZkbVZ1ZEV4cGMzUmxibVZ5S0NkaWJIVnlKeXdnWW14MWNuSmxaRVpwYkdWSmJuQjFkQ2s3WEc1Y2JpQWdablZ1WTNScGIyNGdabTlqZFhObFpFWnBiR1ZKYm5CMWRDQW9LU0I3WEc0Z0lDQWdZMnhoYzNObGN5NWhaR1FvWkc5dGRYQXVkWEJzYjJGa0xDQW5kMnN0Wm05amRYTmxaQ2NwTzF4dUlDQjlYRzRnSUdaMWJtTjBhVzl1SUdKc2RYSnlaV1JHYVd4bFNXNXdkWFFnS0NrZ2UxeHVJQ0FnSUdOc1lYTnpaWE11Y20wb1pHOXRkWEF1ZFhCc2IyRmtMQ0FuZDJzdFptOWpkWE5sWkNjcE8xeHVJQ0I5WEc0Z0lISmxkSFZ5YmlCa2IyMTFjRHRjYm4xY2JseHVjbVZ1WkdWeUxuVndiRzloWkhNZ1BTQjFjR3h2WVdSek8xeHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQnlaVzVrWlhJN1hHNGlYWDA9IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4vc3RyaW5ncycpO1xuXG5mdW5jdGlvbiBjb21tYW5kcyAoZWwsIGlkKSB7XG4gIGVsLnRleHRDb250ZW50ID0gc3RyaW5ncy5idXR0b25zW2lkXSB8fCBpZDtcbn1cblxuZnVuY3Rpb24gbW9kZXMgKGVsLCBpZCkge1xuICBlbC50ZXh0Q29udGVudCA9IHN0cmluZ3MubW9kZXNbaWRdIHx8IGlkO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbW9kZXM6IG1vZGVzLFxuICBjb21tYW5kczogY29tbWFuZHNcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIFNob3J0Y3V0TWFuYWdlcihlbGVtZW50KSB7XG4gIHRoaXMuYm91bmRIYW5kbGVyID0gdGhpcy5oYW5kbGVFdmVudC5iaW5kKHRoaXMpO1xuICB0aGlzLmhhbmRsZXJzID0ge307XG4gIGlmKGVsZW1lbnQpIHtcbiAgICB0aGlzLmF0dGFjaChlbGVtZW50KTtcbiAgfVxufVxuXG5TaG9ydGN1dE1hbmFnZXIucHJvdG90eXBlLmF0dGFjaCA9IGZ1bmN0aW9uIChlbCkge1xuICBlbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgdGhpcy5ib3VuZEhhbmRsZXIsIGZhbHNlKTtcbn07XG5cblNob3J0Y3V0TWFuYWdlci5wcm90b3R5cGUuZGV0YWNoID0gZnVuY3Rpb24gKGVsKSB7XG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmJvdW5kSGFuZGxlciwgZmFsc2UpO1xufTtcblxuU2hvcnRjdXRNYW5hZ2VyLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbiAoa2V5LCBzaGlmdCwgZm4pIHtcbiAgaWYoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGZuID0gc2hpZnQ7XG4gICAgc2hpZnQgPSBmYWxzZTtcbiAgfVxuXG4gIGlmKCF0aGlzLmhhbmRsZXJzW2tleV0pIHsgdGhpcy5oYW5kbGVyc1trZXldID0gW107IH1cbiAgdGhpcy5oYW5kbGVyc1trZXldLnB1c2goe1xuICAgIHNoaWZ0OiAhIXNoaWZ0LFxuICAgIGZuOiBmbixcbiAgfSk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5TaG9ydGN1dE1hbmFnZXIucHJvdG90eXBlLnJlbW92ZSA9IGZ1bmN0aW9uIChrZXksIHNoaWZ0LCBmbikge1xuICBpZihhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgZm4gPSBzaGlmdDtcbiAgICBzaGlmdCA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGlmKHRoaXMuaGFuZGxlcnNba2V5XSAmJiB0aGlzLmhhbmRsZXJzW2tleV0ubGVuZ3RoKSB7XG4gICAgdmFyIGggPSAwLFxuICAgICAgbCA9IHRoaXMuaGFuZGxlcnNba2V5XS5sZW5ndGg7XG4gICAgZm9yKDsgaCA8IGw7IGgrKykge1xuICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzLmhhbmRsZXJzW2tleV1baF07XG4gICAgICBpZihoYW5kbGVyLmZuID09PSBmbiAmJiAodHlwZW9mIHNoaWZ0ID09PSAndW5kZWZpbmVkJyB8fCBoYW5kbGVyLnNoaWZ0ID09PSBzaGlmdCkpIHtcbiAgICAgICAgLy8gTWF0Y2gsIGRvbid0IG5lZWQgdG8gcHJvY2VzcyBhbnltb3JlXG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmKGggPCBsKSB7XG4gICAgICAvLyBXZSBmb3VuZCBhIG1hdGNoLCBzcGxpY2UgaXQgb3V0XG4gICAgICB0aGlzLmhhbmxkZXJzLnNwbGljZShoLCAxKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cblNob3J0Y3V0TWFuYWdlci5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuaGFuZGxlcnMgPSB7fTtcbn07XG5cblNob3J0Y3V0TWFuYWdlci5wcm90b3R5cGUuaGFuZGxlRXZlbnQgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgaWYoZXZlbnQuY3RybEtleSB8fCBldmVudC5tZXRhS2V5KSB7XG4gICAgdmFyIGNoID0gZXZlbnQua2V5O1xuXG4gICAgaWYoY2ggJiYgdGhpcy5oYW5kbGVyc1tjaF0pIHtcbiAgICAgIGZvcih2YXIgaCA9IDAsIGwgPSB0aGlzLmhhbmRsZXJzW2NoXS5sZW5ndGg7IGggPCBsOyBoKyspIHtcbiAgICAgICAgdmFyIGhhbmRsZXIgPSB0aGlzLmhhbmRsZXJzW2NoXVtoXTtcblxuICAgICAgICBpZihldmVudC5zaGlmdEtleSA9PT0gaGFuZGxlci5zaGlmdCkge1xuICAgICAgICAgIC8vIEhhbmRsZSBldmVudFxuICAgICAgICAgIGhhbmRsZXIuZm4oZXZlbnQpO1xuICAgICAgICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgIH1cbiAgICAgIH0gLy8gRW5kIGZvciBsb29wXG4gICAgfSAvLyBFbmQgaGFuZGxlciBhcnJheSBjaGVja1xuICB9Ly8gRW5kIENUUkwvQ01EIGNoZWNrXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNob3J0Y3V0TWFuYWdlcjtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHBsYWNlaG9sZGVyczoge1xuICAgIGJvbGQ6ICdzdHJvbmcgdGV4dCcsXG4gICAgaXRhbGljOiAnZW1waGFzaXplZCB0ZXh0JyxcbiAgICBxdW90ZTogJ3F1b3RlZCB0ZXh0JyxcbiAgICBjb2RlOiAnY29kZSBnb2VzIGhlcmUnLFxuICAgIGxpc3RpdGVtOiAnbGlzdCBpdGVtJyxcbiAgICBoZWFkaW5nOiAnSGVhZGluZyBUZXh0JyxcbiAgICBsaW5rOiAnbGluayB0ZXh0JyxcbiAgICBpbWFnZTogJ2ltYWdlIGRlc2NyaXB0aW9uJyxcbiAgICBhdHRhY2htZW50OiAnYXR0YWNobWVudCBkZXNjcmlwdGlvbidcbiAgfSxcbiAgdGl0bGVzOiB7XG4gICAgYm9sZDogJ1N0cm9uZyA8c3Ryb25nPiBDdHJsK0InLFxuICAgIGl0YWxpYzogJ0VtcGhhc2lzIDxlbT4gQ3RybCtJJyxcbiAgICBxdW90ZTogJ0Jsb2NrcXVvdGUgPGJsb2NrcXVvdGU+IEN0cmwrSicsXG4gICAgY29kZTogJ0NvZGUgU2FtcGxlIDxwcmU+PGNvZGU+IEN0cmwrRScsXG4gICAgb2w6ICdOdW1iZXJlZCBMaXN0IDxvbD4gQ3RybCtPJyxcbiAgICB1bDogJ0J1bGxldGVkIExpc3QgPHVsPiBDdHJsK1UnLFxuICAgIGhlYWRpbmc6ICdIZWFkaW5nIDxoMT4sIDxoMj4sIC4uLiBDdHJsK0QnLFxuICAgIGxpbms6ICdIeXBlcmxpbmsgPGE+IEN0cmwrSycsXG4gICAgaW1hZ2U6ICdJbWFnZSA8aW1nPiBDdHJsK0cnLFxuICAgIGF0dGFjaG1lbnQ6ICdBdHRhY2htZW50IEN0cmwrU2hpZnQrSycsXG4gICAgbWFya2Rvd246ICdNYXJrZG93biBNb2RlIEN0cmwrTScsXG4gICAgaHRtbDogJ0hUTUwgTW9kZSBDdHJsK0gnLFxuICAgIHd5c2l3eWc6ICdQcmV2aWV3IE1vZGUgQ3RybCtQJ1xuICB9LFxuICBidXR0b25zOiB7XG4gICAgYm9sZDogJ0InLFxuICAgIGl0YWxpYzogJ0knLFxuICAgIHF1b3RlOiAnXFx1MjAxYycsXG4gICAgY29kZTogJzwvPicsXG4gICAgb2w6ICcxLicsXG4gICAgdWw6ICdcXHUyOUJGJyxcbiAgICBoZWFkaW5nOiAnVHQnLFxuICAgIGxpbms6ICdMaW5rJyxcbiAgICBpbWFnZTogJ0ltYWdlJyxcbiAgICBhdHRhY2htZW50OiAnQXR0YWNobWVudCcsXG4gICAgaHI6ICdcXHUyMWI1J1xuICB9LFxuICBwcm9tcHRzOiB7XG4gICAgbGluazoge1xuICAgICAgdGl0bGU6ICdJbnNlcnQgTGluaycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1R5cGUgb3IgcGFzdGUgdGhlIHVybCB0byB5b3VyIGxpbmsnLFxuICAgICAgcGxhY2Vob2xkZXI6ICdodHRwOi8vZXhhbXBsZS5jb20vIFwidGl0bGVcIidcbiAgICB9LFxuICAgIGltYWdlOiB7XG4gICAgICB0aXRsZTogJ0luc2VydCBJbWFnZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VudGVyIHRoZSB1cmwgdG8geW91ciBpbWFnZScsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS9wdWJsaWMvaW1hZ2UucG5nIFwidGl0bGVcIidcbiAgICB9LFxuICAgIGF0dGFjaG1lbnQ6IHtcbiAgICAgIHRpdGxlOiAnQXR0YWNoIEZpbGUnLFxuICAgICAgZGVzY3JpcHRpb246ICdFbnRlciB0aGUgdXJsIHRvIHlvdXIgYXR0YWNobWVudCcsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS9wdWJsaWMvcmVwb3J0LnBkZiBcInRpdGxlXCInXG4gICAgfSxcbiAgICB0eXBlczogJ1lvdSBjYW4gb25seSB1cGxvYWQgJyxcbiAgICBicm93c2U6ICdCcm93c2UuLi4nLFxuICAgIGRyb3BoaW50OiAnWW91IGNhbiBhbHNvIGRyYWcgZmlsZXMgZnJvbSB5b3VyIGNvbXB1dGVyIGFuZCBkcm9wIHRoZW0gaGVyZSEnLFxuICAgIGRyb3A6ICdEcm9wIHlvdXIgZmlsZSBoZXJlIHRvIGJlZ2luIHVwbG9hZC4uLicsXG4gICAgdXBsb2FkOiAnLCBvciB1cGxvYWQgYSBmaWxlJyxcbiAgICB1cGxvYWRpbmc6ICdVcGxvYWRpbmcgeW91ciBmaWxlLi4uJyxcbiAgICB1cGxvYWRmYWlsZWQ6ICdUaGUgdXBsb2FkIGZhaWxlZCEgVGhhdFxcJ3MgYWxsIHdlIGtub3cuJ1xuICB9LFxuICBtb2Rlczoge1xuICAgIHd5c2l3eWc6ICd3eXNpd3lnJyxcbiAgICBtYXJrZG93bjogJ21cXHUyMTkzJyxcbiAgfSxcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi9jbGFzc2VzJyk7XG52YXIgZHJhZ0NsYXNzID0gJ3drLWRyYWdnaW5nJztcbnZhciBkcmFnQ2xhc3NTcGVjaWZpYyA9ICd3ay1jb250YWluZXItZHJhZ2dpbmcnO1xudmFyIHJvb3QgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbmZ1bmN0aW9uIHVwbG9hZHMgKGNvbnRhaW5lciwgZHJvcGFyZWEsIGVkaXRvciwgb3B0aW9ucywgcmVtb3ZlKSB7XG4gIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdkcmFnZW50ZXInLCBkcmFnZ2luZyk7XG4gIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdkcmFnZW5kJywgZHJhZ3N0b3ApO1xuICByb290W29wICsgJ0V2ZW50TGlzdGVuZXInXSgnbW91c2VvdXQnLCBkcmFnc3RvcCk7XG4gIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdkcmFnb3ZlcicsIGhhbmRsZURyYWdPdmVyLCBmYWxzZSk7XG4gIHJvb3Rbb3AgKyAnRXZlbnRMaXN0ZW5lciddKCdkcm9wJywgaGFuZGxlRmlsZVNlbGVjdCwgZmFsc2UpO1xuXG4gIGZ1bmN0aW9uIGRyYWdnaW5nICgpIHtcbiAgICBjbGFzc2VzLmFkZChkcm9wYXJlYSwgZHJhZ0NsYXNzKTtcbiAgICBjbGFzc2VzLmFkZChkcm9wYXJlYSwgZHJhZ0NsYXNzU3BlY2lmaWMpO1xuICB9XG4gIGZ1bmN0aW9uIGRyYWdzdG9wICgpIHtcbiAgICBkcmFnc3RvcHBlcihkcm9wYXJlYSk7XG4gIH1cbiAgZnVuY3Rpb24gaGFuZGxlRHJhZ092ZXIgKGUpIHtcbiAgICBzdG9wKGUpO1xuICAgIGRyYWdnaW5nKCk7XG4gICAgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdjb3B5JztcbiAgfVxuICBmdW5jdGlvbiBoYW5kbGVGaWxlU2VsZWN0IChlKSB7XG4gICAgZHJhZ3N0b3AoKTtcbiAgICBzdG9wKGUpO1xuICAgIGVkaXRvci5ydW5Db21tYW5kKGZ1bmN0aW9uIHJ1bm5lciAoY2h1bmtzLCBtb2RlKSB7XG4gICAgICB2YXIgZmlsZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChlLmRhdGFUcmFuc2Zlci5maWxlcyk7XG4gICAgICB2YXIgdHlwZSA9IGluZmVyVHlwZShmaWxlcyk7XG4gICAgICBlZGl0b3IubGlua09ySW1hZ2VPckF0dGFjaG1lbnQodHlwZSwgZmlsZXMpLmNhbGwodGhpcywgbW9kZSwgY2h1bmtzKTtcbiAgICB9KTtcbiAgfVxuICBmdW5jdGlvbiBpbmZlclR5cGUgKGZpbGVzKSB7XG4gICAgaWYgKG9wdGlvbnMuaW1hZ2VzICYmICFvcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgICByZXR1cm4gJ2ltYWdlJztcbiAgICB9XG4gICAgaWYgKCFvcHRpb25zLmltYWdlcyAmJiBvcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgICByZXR1cm4gJ2F0dGFjaG1lbnQnO1xuICAgIH1cbiAgICBpZiAoZmlsZXMuZXZlcnkobWF0Y2hlcyhvcHRpb25zLmltYWdlcy52YWxpZGF0ZSB8fCBuZXZlcikpKSB7XG4gICAgICByZXR1cm4gJ2ltYWdlJztcbiAgICB9XG4gICAgcmV0dXJuICdhdHRhY2htZW50JztcbiAgfVxufVxuXG5mdW5jdGlvbiBtYXRjaGVzIChmbikge1xuICByZXR1cm4gZnVuY3Rpb24gbWF0Y2hlciAoZmlsZSkgeyByZXR1cm4gZm4oZmlsZSk7IH07XG59XG5mdW5jdGlvbiBuZXZlciAoKSB7XG4gIHJldHVybiBmYWxzZTtcbn1cbmZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgZS5wcmV2ZW50RGVmYXVsdCgpO1xufVxuZnVuY3Rpb24gZHJhZ3N0b3BwZXIgKGRyb3BhcmVhKSB7XG4gIGNsYXNzZXMucm0oZHJvcGFyZWEsIGRyYWdDbGFzcyk7XG4gIGNsYXNzZXMucm0oZHJvcGFyZWEsIGRyYWdDbGFzc1NwZWNpZmljKTtcbn1cblxudXBsb2Fkcy5zdG9wID0gZHJhZ3N0b3BwZXI7XG5tb2R1bGUuZXhwb3J0cyA9IHVwbG9hZHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIE9iamVjdC5hc3NpZ24gcG9seWZpbGxcbi8vIElnbm9yZSBQb2x5ZmlsbCBjb2RlIGZvciBsaW50aW5nIChvdmVycmlkaW5nIGdsb2JhbHMgaGVyZSBpcyBleHBlY3RlZClcbi8qIGpzaGludCBpZ25vcmU6c3RhcnQgKi9cbmlmICh0eXBlb2YgT2JqZWN0LmFzc2lnbiAhPSAnZnVuY3Rpb24nKSB7XG4gIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL09iamVjdC9hc3NpZ25cbiAgT2JqZWN0LmFzc2lnbiA9IGZ1bmN0aW9uKHRhcmdldCwgdmFyQXJncykgeyAvLyAubGVuZ3RoIG9mIGZ1bmN0aW9uIGlzIDJcbiAgICBpZiAodGFyZ2V0ID09PSBudWxsIHx8IHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7IC8vIFR5cGVFcnJvciBpZiB1bmRlZmluZWQgb3IgbnVsbFxuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNvbnZlcnQgdW5kZWZpbmVkIG9yIG51bGwgdG8gb2JqZWN0Jyk7XG4gICAgfVxuXG4gICAgdmFyIHRvID0gT2JqZWN0KHRhcmdldCk7XG5cbiAgICBmb3IgKHZhciBpbmRleCA9IDE7IGluZGV4IDwgYXJndW1lbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgdmFyIG5leHRTb3VyY2UgPSBhcmd1bWVudHNbaW5kZXhdO1xuXG4gICAgICBpZiAobmV4dFNvdXJjZSAhPT0gbnVsbCAmJiBuZXh0U291cmNlICE9PSB1bmRlZmluZWQpIHsgLy8gU2tpcCBvdmVyIGlmIHVuZGVmaW5lZCBvciBudWxsXG4gICAgICAgIGZvciAodmFyIG5leHRLZXkgaW4gbmV4dFNvdXJjZSkge1xuICAgICAgICAgIC8vIEF2b2lkIGJ1Z3Mgd2hlbiBoYXNPd25Qcm9wZXJ0eSBpcyBzaGFkb3dlZFxuICAgICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobmV4dFNvdXJjZSwgbmV4dEtleSkpIHtcbiAgICAgICAgICAgIHRvW25leHRLZXldID0gbmV4dFNvdXJjZVtuZXh0S2V5XTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRvO1xuICB9O1xufVxuXG4vLyBDdXN0b20gRXZlbnQgQ29uc3RydWN0b3IgUG9seWZpbGxcbihmdW5jdGlvbiAoKSB7XG4gIGlmICggdHlwZW9mIHdpbmRvdy5DdXN0b21FdmVudCA9PT0gXCJmdW5jdGlvblwiICkgeyByZXR1cm4gZmFsc2U7IH1cblxuICBmdW5jdGlvbiBDdXN0b21FdmVudCAoIGV2ZW50LCBwYXJhbXMgKSB7XG4gICAgcGFyYW1zID0gcGFyYW1zIHx8IHsgYnViYmxlczogZmFsc2UsIGNhbmNlbGFibGU6IGZhbHNlLCBkZXRhaWw6IHVuZGVmaW5lZCB9O1xuICAgIHZhciBldnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCggJ0N1c3RvbUV2ZW50JyApO1xuICAgIGV2dC5pbml0Q3VzdG9tRXZlbnQoIGV2ZW50LCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwgKTtcbiAgICByZXR1cm4gZXZ0O1xuICAgfVxuXG4gIEN1c3RvbUV2ZW50LnByb3RvdHlwZSA9IHdpbmRvdy5FdmVudC5wcm90b3R5cGU7XG5cbiAgd2luZG93LkN1c3RvbUV2ZW50ID0gQ3VzdG9tRXZlbnQ7XG59KSgpO1xuXG4vLyBNb3VzZSBFdmVudCBDb25zdHJ1Y3RvciBQb2x5ZmlsbFxuKGZ1bmN0aW9uICh3aW5kb3cpIHtcbiAgdHJ5IHtcbiAgICBuZXcgTW91c2VFdmVudCgndGVzdCcpO1xuICAgIHJldHVybiBmYWxzZTsgLy8gTm8gbmVlZCB0byBwb2x5ZmlsbFxuICB9IGNhdGNoIChlKSB7XG4gICAgLy8gTmVlZCB0byBwb2x5ZmlsbCAtIGZhbGwgdGhyb3VnaFxuICB9XG5cbiAgLy8gUG9seWZpbGxzIERPTTQgTW91c2VFdmVudFxuXG4gIHZhciBNb3VzZUV2ZW50ID0gZnVuY3Rpb24gKGV2ZW50VHlwZSwgcGFyYW1zKSB7XG4gICAgcGFyYW1zID0gcGFyYW1zIHx8IHsgYnViYmxlczogZmFsc2UsIGNhbmNlbGFibGU6IGZhbHNlIH07XG4gICAgdmFyIG1vdXNlRXZlbnQgPSBkb2N1bWVudC5jcmVhdGVFdmVudCgnTW91c2VFdmVudCcpO1xuICAgIG1vdXNlRXZlbnQuaW5pdE1vdXNlRXZlbnQoZXZlbnRUeXBlLCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHdpbmRvdywgMCwgMCwgMCwgMCwgMCwgZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UsIDAsIG51bGwpO1xuXG4gICAgcmV0dXJuIG1vdXNlRXZlbnQ7XG4gIH07XG5cbiAgTW91c2VFdmVudC5wcm90b3R5cGUgPSBFdmVudC5wcm90b3R5cGU7XG5cbiAgd2luZG93Lk1vdXNlRXZlbnQgPSBNb3VzZUV2ZW50O1xufSkod2luZG93KTtcbi8qIGpzaGludCBpZ25vcmU6ZW5kICovXG5cbnZhciBleGlzdHMgPSBleHBvcnRzLmV4aXN0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIG9iaiAhPT0gdW5kZWZpbmVkICYmIG9iaiAhPT0gbnVsbDtcbn07XG5cbmV4cG9ydHMuY2xvbmUgPSBmdW5jdGlvbiAob2JqKSB7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKHt9LCBvYmopO1xufTtcblxuZXhwb3J0cy5leHRlbmQgPSBPYmplY3QuYXNzaWduO1xuXG5leHBvcnRzLmRlZmF1bHRzRGVlcCA9IGZ1bmN0aW9uICh0YXJnZXQpIHtcbiAgaWYgKCFleGlzdHModGFyZ2V0KSkgeyAvLyBUeXBlRXJyb3IgaWYgdW5kZWZpbmVkIG9yIG51bGxcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY29udmVydCB1bmRlZmluZWQgb3IgbnVsbCB0byBvYmplY3QnKTtcbiAgfVxuXG4gIHZhciB0byA9IGV4cG9ydHMuY2xvbmUodGFyZ2V0KTtcblxuICBmb3IgKHZhciBpbmRleCA9IDE7IGluZGV4IDwgYXJndW1lbnRzLmxlbmd0aDsgaW5kZXgrKykge1xuICAgIHZhciBuZXh0U291cmNlID0gYXJndW1lbnRzW2luZGV4XTtcblxuICAgIGlmIChuZXh0U291cmNlICE9PSBudWxsKSB7IC8vIFNraXAgb3ZlciBpZiB1bmRlZmluZWQgb3IgbnVsbFxuICAgICAgZm9yICh2YXIgbmV4dEtleSBpbiBuZXh0U291cmNlKSB7XG4gICAgICAgIGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobmV4dFNvdXJjZSwgbmV4dEtleSkpIHtcbiAgICAgICAgICBpZihPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KHRvLCBuZXh0S2V5KSkge1xuICAgICAgICAgICAgaWYoZXhpc3RzKHRvW25leHRLZXldKSAmJiBleGlzdHMobmV4dFNvdXJjZVtuZXh0S2V5XSkgJiYgdHlwZW9mIHRvW25leHRLZXldID09PSAnb2JqZWN0JyAmJiB0eXBlb2YgbmV4dFNvdXJjZVtuZXh0S2V5XSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgdG9bbmV4dEtleV0gPSBleHBvcnRzLmRlZmF1bHRzRGVlcCh0b1tuZXh0S2V5XSwgbmV4dFNvdXJjZVtuZXh0S2V5XSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBFbHNlOiBEb24ndCBvdmVycmlkZSBleGlzdGluZyB2YWx1ZXNcbiAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBuZXh0U291cmNlW25leHRLZXldID09PSAnb2JqZWN0JyAmJiBuZXh0U291cmNlW25leHRLZXldICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0b1tuZXh0S2V5XSA9IGV4cG9ydHMuY2xvbmUobmV4dFNvdXJjZVtuZXh0S2V5XSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRvW25leHRLZXldID0gbmV4dFNvdXJjZVtuZXh0S2V5XTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gLy8gZW5kIHNvdXJjZSBpZiBjaGVja1xuICAgICAgfSAvLyBlbmQgZm9yXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRvO1xufTtcblxuZXhwb3J0cy5kaXNwYXRjaEN1c3RvbUV2ZW50ID0gZnVuY3Rpb24gKGVsZW1lbnQsIGV2ZW50LCBwYXJhbXMpIHtcbiAgdmFyIGV2ID0gbmV3IEN1c3RvbUV2ZW50KGV2ZW50LCBwYXJhbXMpO1xuICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXYpO1xufTtcblxuZXhwb3J0cy5kaXNwYXRjaEJyb3dzZXJFdmVudCA9IGZ1bmN0aW9uIChlbGVtZW50LCBldmVudCkge1xuICB2YXIgZXYgPSBuZXcgRXZlbnQoZXZlbnQpO1xuICBlbGVtZW50LmRpc3BhdGNoRXZlbnQoZXYpO1xufTtcblxuZXhwb3J0cy5kaXNwYXRjaENsaWNrRXZlbnQgPSBmdW5jdGlvbiAoZWxlbWVudCkge1xuICB2YXIgZXYgPSBuZXcgTW91c2VFdmVudCgnY2xpY2snKTtcbiAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KGV2KTtcbn07XG5cbmV4cG9ydHMuZGVib3VuY2UgPSBmdW5jdGlvbiAoY2IsIG1zKSB7XG4gIHZhciB0bXI7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLFxuICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cyk7XG5cbiAgICBjbGVhclRpbWVvdXQodG1yKTtcbiAgICB0bXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgIHRtciA9IHVuZGVmaW5lZDtcbiAgICAgIGNiLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgIH0sIG1zKTtcbiAgfTtcbn07XG4iXX0=
