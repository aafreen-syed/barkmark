'use strict';

var utils = require('./utils');
var commands = {
  markdown: {
    boldOrItalic: require('./modes/markdown/contexts/boldOrItalic'),
    linkOrImageOrAttachment: require('./modes/markdown/contexts/linkOrImageOrAttachment'),
    blockquote: require('./modes/markdown/contexts/blockquote'),
    codeblock: require('./modes/markdown/contexts/codeblock'),
    heading: require('./modes/markdown/contexts/heading'),
    list: require('./modes/markdown/contexts/list'),
    hr: require('./modes/markdown/contexts/hr')
  },
  wysiwyg: {
    boldOrItalic: require('./modes/wysiwyg/contexts/boldOrItalic'),
    linkOrImageOrAttachment: require('./modes/wysiwyg/contexts/linkOrImageOrAttachment'),
    blockquote: require('./modes/wysiwyg/contexts/blockquote'),
    codeblock: require('./modes/wysiwyg/contexts/codeblock'),
    heading: require('./modes/wysiwyg/contexts/heading'),
    list: require('./modes/wysiwyg/contexts/list'),
    hr: require('./modes/wysiwyg/contexts/hr')
  }
};

function bindCommands (editor, options) {
  bind('bold', 'b', bold);
  bind('italic', 'i', italic);
  bind('quote', 'j', router('blockquote'));
  bind('code', 'e', code);
  bind('ol', 'o', ol);
  bind('ul', 'u', ul);
  bind('heading', 'd', router('heading'));
  editor.showLinkDialog = fabricator(bind('link', 'k', linkOrImageOrAttachment('link')));
  editor.showImageDialog = fabricator(bind('image', 'g', linkOrImageOrAttachment('image')));
  editor.linkOrImageOrAttachment = linkOrImageOrAttachment;

  if (options.attachments) {
    editor.showAttachmentDialog = fabricator(bind('attachment', 'k', true, linkOrImageOrAttachment('attachment')));
  }
  if (options.hr) { bind('hr', 'cmd+n', router('hr')); }

  function fabricator (el) {
    return function open () {
      utils.dispatchClickEvent(el);
    };
  }
  function bold (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'bold');
  }
  function italic (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'italic');
  }
  function code (mode, chunks) {
    commands[mode].codeblock(chunks, { fencing: options.fencing });
  }
  function ul (mode, chunks) {
    commands[mode].list(chunks, false);
  }
  function ol (mode, chunks) {
    commands[mode].list(chunks, true);
  }
  function linkOrImageOrAttachment (type, autoUpload) {
    return function linkOrImageOrAttachmentInvoke (mode, chunks) {
      commands[mode].linkOrImageOrAttachment.call(this, chunks, {
        editor: editor,
        mode: mode,
        type: type,
        prompts: options.prompts,
        upload: options[type + 's'],
        classes: options.classes,
        mergeHtmlAndAttachment: options.mergeHtmlAndAttachment,
        autoUpload: autoUpload
      });
    };
  }
  function bind (id, key, shift, fn) {
    if(arguments.length === 3) {
      fn = shift;
      shift = undefined;
    }

    return editor.addCommandButton(id, key, shift, suppress(fn));
  }
  function router (method) {
    return function routed (mode, chunks) { commands[mode][method].call(this, chunks); };
  }
  function stop (e) {
    e.preventDefault(); e.stopPropagation();
  }
  function suppress (fn) {
    return function suppressor (e, mode, chunks) { stop(e); fn.call(this, mode, chunks); };
  }
}

module.exports = bindCommands;
