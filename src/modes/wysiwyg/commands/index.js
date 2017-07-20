'use strict';

var boldOrItalic = require('./boldOrItalic');
var linkOrImageOrAttachment = require('./linkOrImageOrAttachment');
var hr = require('./hr');

module.exports = {
  attachment: linkOrImageOrAttachment,
  bold: boldOrItalic,
  hr: hr,
  image: linkOrImageOrAttachment,
  italic: boldOrItalic,
  link: linkOrImageOrAttachment,
};
