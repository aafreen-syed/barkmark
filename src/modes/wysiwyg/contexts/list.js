'use strict';

var doc = global.document;

function List (ordered, editor, el) {
  this.ordered = !!ordered;
  this.editor = editor;
  this.el = el;
}

List.prototype.wrap = function (contents) {
  var list = doc.createElement(this.ordered ? 'ol' : 'ul');

  var currLI = doc.createElement('li');
  var brCount = 0;
  list.appendChild(currLI);

  for(var c = 0, l = contents.length; c < l; c++) {
    var item = contents[c];

    if(item.tagName === 'BR') {
      if(brCount++ !== 1) {
        currLI = doc.createElement('li');
        list.appendChild(currLI);
      }
      continue;
    }

    currLI.appendChild(item);
    brCount = 0;
  }

  return list;
};

List.prototype.unwrap = function (el) {
  var children = [];
  for(var e = 0, l = el.children.length; e < l; e++) {
    children.push.apply(children, el.children[e].childNodes);
    children.push(doc.createElement('br'));
  }

  // Remove the last <br>
  children.pop();

  return children;
};

module.exports = List;
