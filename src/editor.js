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
