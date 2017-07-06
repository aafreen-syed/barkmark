'use strict';

var md = markdownit();
var rimage = /^image\/(gif|png|p?jpe?g)$/i;

barkmark(document.querySelector('#ta'), {
  parseMarkdown: function (value, options) {
    return md.render(value);
  },
  parseHTML: parseHTML,
  fencing: true,
  defaultMode: 'wysiwyg',
  images: {
    url: '/uploads/images',
    validate: imageValidator
  },
  attachments: {
    url: '/uploads/attachments'
  }
});

function parseHTML (value, options) {
  return toMarkdown(value, {
    gfm: true,
  });
}

function imageValidator (file) {
  return rimage.test(file.type);
}
