'use strict';

var boldOrItalic = require('./boldOrItalic');
var linkOrImageOrAttachment = require('./linkOrImageOrAttachment');
var blockquote = require('./blockquote');
var codeblock = require('./codeblock');
var heading = require('./heading');
var list = require('./list');
var hr = require('./hr');

module.exports = {
  attachment: linkOrImageOrAttachment,
  blockquote: blockquote,
  bold: boldOrItalic,
  code: codeblock,
  heading: heading,
  hr: hr,
  image: linkOrImageOrAttachment,
  italic: boldOrItalic,
  link: linkOrImageOrAttachment,
  list: list,
};
