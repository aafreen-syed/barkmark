'use strict';

var md = markdownit();
var rimage = /^image\/(gif|png|p?jpe?g)$/i;

woofmark(document.querySelector('#ta'), {
  parseMarkdown: md,
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
