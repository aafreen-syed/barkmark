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
    parent[mov](self.components.editable);
    if (self.placeholder) { parent[mov](self.placeholder); }
    parent[mov](self.components.commands);
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

  var sets = arguments.length === 1;
  if (sets) {
    if (this.mode === 'wysiwyg') {
      markdown = asHtml();
    }
    this.getSurface().write(markdown);
    history.reset();
  }

  return this.getMarkdown();

  function asHtml () {
    return this.options.parseMarkdown(markdown);
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
