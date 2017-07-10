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
