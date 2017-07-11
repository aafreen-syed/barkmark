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
