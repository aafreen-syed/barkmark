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
