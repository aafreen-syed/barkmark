'use strict';

var utils = require('./utils');
// var uploads = require('./uploads');
var strings = require('./strings');
var InputHistory = require('./InputHistory');
var ShortcutManager = require('./shortcuts');
var getCommandHandler = require('./getCommandHandler');
var Markdown = require('./modes/markdown');
var Wysiwyg = require('./modes/wysiwyg');
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
    commandbar: tag({ c: 'wk-command-bar' }),
    commands: tag({ c: 'wk-commands' }),
    contexts: tag({ c: 'wk-contexts wk-hide' }),
    contextSelect: tag({ t: 'select', c: 'wk-context-selector' }),
  };

  this.commandButtons = {};
  this.contextOptions = {};
  this.shortcuts = new ShortcutManager();
  this.modes = {};

  tag({ t: 'span', c: 'wk-drop-text', x: strings.prompts.drop, p: this.components.droparea });
  tag({ t: 'p', c: ['wk-drop-icon'].concat(o.classes.dropicon).join(' '), p: this.components.droparea });

  // Attach Components
  classes.add(parent, 'wk-container');
  this.components.contexts.appendChild(this.components.contextSelect);
  this.components.commandbar.appendChild(this.components.contexts);
  this.components.commandbar.appendChild(this.components.commands);
  parent.insertBefore(this.components.commandbar, this.textarea);
  parent.appendChild(this.components.switchboard);
  // TODO
  // if (this.options.images || this.options.attachments) {
    // parent[mov](this.components.droparea);
    // uploads(parent, this.components.droparea, this, o, remove);
  // }

  if(o.markdown) {
    this.registerMode(Markdown, {
      active: (!o.defaultMode || !o[o.defaultMode] || o.defaultMode === 'markdown'),
      shortcutKey: 'm',
    });
  }
  if(o.wysiwyg) {
    this.registerMode(Wysiwyg, {
      active: o.defaultMode === 'wysiwyg' || !o.markdown,
      shortcutKey: 'p',
      classes: o.classes.wysiwyg || [],
    });
  }

  this.selectionChangeListener = (function () {
    var mode = this.getMode();
    if(mode.getContexts().length) {
      var sel = mode.getSelection();
      this.setActiveContext(mode.getSelectionContext(sel));
      var btns = Object.keys(this.commandButtons);
      btns.forEach(function (btn) {
        btn = this.commandButtons[btn];
        var btnActive = btn.command.isActive(sel),
          btnAvailable = btn.command.isAvailable(sel);

        btn.button.classList.remove('wk-active');
        btn.button.classList.remove('wk-mixed');
        btn.button.classList.remove('wk-disabled');

        if(btnActive === 'mixed') {
          btn.button.classList.add('wk-mixed');
        } else if (btnActive) {
          btn.button.classList.add('wk-active');
        }

        btn.button.disabled = !btnAvailable;
      }, this);
    }
  }).bind(this);

  this.contextChangeListener = (function () {
    var mode = this.getMode(),
      sel = mode.getSelection(),
      allCtxs = Object.keys(this.contextOptions),
      newCtx;

    for(var c = 0, l = allCtxs.length; c < l; c++) {
      var checking = this.contextOptions[allCtxs[c]];
      if(checking.option.selected) {
        newCtx = checking.context;
        break;
      }
    }

    if(newCtx) {
      mode.transformSelectionContext(sel, newCtx);
    }
  }).bind(this);

  // Setup Context Selection Checking
  doc.addEventListener('selectionchange', this.selectionChangeListener);
  this.components.contextSelect.addEventListener('change', this.contextChangeListener);
}

Editor.prototype.getSurface = function () {
  return this.modes[this.mode].surface;
};

Editor.prototype.getMode = function () {
  return this.modes[this.mode].mode;
};

Editor.prototype.addCommandButton = function (cmd) {
  var name = cmd.name,
    btn = tag({ t: 'button', c: 'wk-command', p: this.components.commands });

  if(this.commandButtons[name]) {
    // Remove any old buttons first
    this.removeCommandButton(name);
  }

  this.commandButtons[name] = {
    name: name,
    button: btn,
    command: cmd,
    boundExecution: cmd.boundExecution,
  };

  var custom = this.options.render.commands;
  var render = typeof custom === 'function' ? custom : renderers.commands;
  var title = strings.titles[name];
  if (title) {
    btn.setAttribute('title', mac ? macify(title) : title);
  }
  btn.type = 'button';
  btn.tabIndex = -1;
  render(btn, name);
  btn.addEventListener('click', this.commandButtons[name].boundExecution);

  return cmd;
};

Editor.prototype.removeCommandButton = function (command) {
  var name = typeof command === 'string' ? command : command.name,
    cmd = this.commandButtons[name];

  if(!cmd || (typeof command !== 'string' && cmd.command !== command)) {
    return false;
  }

  delete this.commandButtons[name];
  cmd.button.removeEventListener('click', cmd.boundExecution);
  this.components.commands.removeChild(cmd.button);
};

Editor.prototype.addContextOption = function (context) {
  var name = context.name,
    option = tag({ t: 'option', c: 'wk-context', p: this.components.contextSelect });

  if(this.contextOptions[name]) {
    // Remove any old buttons first
    this.removeContextOption(name);
  }

  this.contextOptions[name] = {
    name: name,
    option: option,
    context: context,
  };

  var custom = this.options.render.context;
  var render = typeof custom === 'function' ? custom : renderers.contexts;
  render(option, name);
  option.classList.add('wk-context-' + name);

  if(Object.keys(this.contextOptions).length > 0) {
    this.components.contexts.classList.remove('wk-hide');
  }

  return context;
};

Editor.prototype.removeContextOption = function (context) {
  var name = typeof context === 'string' ? context : context.name,
    ctx = this.contextOptions[name];

  if(!ctx || (typeof context !== 'string' && ctx.context !== context)) {
    return false;
  }

  delete this.contextOptions[name];
  this.components.contextSelect.removeChild(ctx.option);

  if(Object.keys(this.contextOptions).length === 0) {
    this.components.contexts.classList.add('wk-hide');
  }
};

Editor.prototype.setActiveContext = function (context) {
  if(!context) {
    return this.components.contextSelect.selectedIndex = -1;
  }

  var name = typeof context === 'string' ? context : context.name,
    ctx = this.contextOptions[name];

  if(!ctx || (typeof context !== 'string' && ctx.context !== context)) {
    return this.components.contextSelect.selectedIndex = -1;
  }

  ctx.option.selected = true;
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

  // Remove Context Selection Listener
  doc.removeEventListener('selectionchange', this.selectionChangeListener);
  this.components.contextSelect.removeEventListener('change', this.contextChangeListener);

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

Editor.prototype.registerMode = function (Mode, options) {
  var buttonClasses = ['wk-mode'];
  if(options.active) {
    buttonClasses.push('wk-mode-active');
  } else {
    buttonClasses.push('wk-mode-inactive');
  }

  var mode = new Mode(this, options);
  var name = mode.name;

  var stored = this.modes[name] = {
    mode: mode,
    button: tag({ t: 'button', c: buttonClasses.join(' ') }),
    surface: mode.surface,
    element: mode.surface.current(),
    history: new InputHistory(mode.surface, name),
  };

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

  // Register global shortcuts
  this.shortcuts.attach(stored.element);
  if(options.shortcutKey) {
    this.shortcuts.add(options.shortcutKey, !!options.shift, this.setMode.bind(this, name));
  }

  // Set Mode if Active
  if(options.active) {
    this.setMode(name);
    stored.button.setAttribute('disabled', true);
  } else {
    stored.mode.hide();
  }

  return stored;
};

Editor.prototype.setMode = function (goToMode, e) {
  var self = this;
  var currentMode = this.modes[this.mode];
  var nextMode = this.modes[goToMode];
  var button = nextMode.button;
  var focusing = !!e || doc.activeElement === nextMode.element;

  stop(e);

  // Change current mode to inactive
  if(currentMode) {
    focusing = focusing || doc.activeElement === currentMode.element;

    currentMode.surface.off('change', stashChanges);
    currentMode.mode.hide();
    nextMode.surface.writeMarkdown(currentMode.surface.toMarkdown());

    classes.rm(currentMode.button, 'wk-mode-active');
    classes.add(currentMode.button, 'wk-mode-inactive');
    currentMode.button.removeAttribute('disabled');
  }

  this.textarea.blur(); // avert chrome repaint bugs

  nextMode.surface.on('change', stashChanges);

  nextMode.mode.show();

  if (focusing) {
    nextMode.surface.focus();
  }

  classes.add(button, 'wk-mode-active');
  classes.rm(button, 'wk-mode-inactive');
  button.setAttribute('disabled', 'disabled');
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
