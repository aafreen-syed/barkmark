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
