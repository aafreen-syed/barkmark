# `editor`

The `editor` API allows you to interact with `barkmark` editor instances. This is what you get back from `barkmark(textarea, options)` or `barkmark.find(textarea)`.

### `editor.addCommand(combo, fn)`

Binds a keyboard key combination such as `cmd+shift+b` to a method _using [kanye][1]_. Please note that you should always use `cmd` rather than `ctrl`. In non-OSX environments it'll be properly mapped to `ctrl`. When the combo is entered, `fn(e, mode, chunks)` will be called.

- `e` is the original event object
- `mode` can be `markdown`, `html`, or `wysiwyg`
- `chunks` is a [chunks](#chunks) object, describing the current state of the editor

In addition, `fn` is given a `this` context similar to that of Grunt tasks, where you can choose to do nothing and the command is assumed to be synchronous, or you can call `this.async()` and get back a `done` callback like in the example below.

```js
editor.addCommand('cmd+j', function jump (e, mode, chunks) {
  var done = this.async();
  // TODO: async operation
  done();
});
```

When the command finishes, the editor will recover focus, and whatever changes where made to the `chunks` object will be applied to the editor. All commands performed by `barkmark` work this way, so please take a look [at the source code][2] if you want to implement your own commands.

### `editor.addCommandButton(id, combo?, fn)`

Adds a button to the editor using an `id` and an event handler. When the button is pressed, `fn(e, mode, chunks)` will be called with the same arguments as the ones passed if using [`editor.addCommand(combo, fn)`](#editoraddcommandcombo-fn).

You can optionally pass in a `combo`, in which case `editor.addCommand(combo, fn)` will be called, in addition to creating the command button.

### `editor.runCommand(fn)`

If you just want to run a command without setting up a keyboard shortcut or a button, you can use this method. Note that there won't be any `e` event argument in this case, you'll only get `chunks, mode` passed to `fn`. You can still run the command asynchronously using `this.async()`. Note that the argument order `chunks, mode` is the reverse of that passed to addCommand (`mode, chunks`).

### `editor.parseMarkdown()`

This is the same method passed as an option.

### `editor.parseHTML()`

This is the same method passed as an option.

### `editor.destroy()`

Destroys the `editor` instance, removing all event handlers. The editor is reverted to `markdown` mode, and assigned the proper Markdown source code if needed. Then we go back to being a plain old and dull `<textarea>` element.

### `editor.value(text)`

If optional Markdown string `text` is provided, it is used to overwrite the current editor content, parsing into HTML if necessary. Regardless of whether `text` is provided, `value()` returns the current Markdown value for the `editor`. 

### `editor.editable`

If `options.wysiwyg` then this will be the `contentEditable` `<div>`. Otherwise it'll be set to `null`.

### `editor.mode`

The current `mode` for the editor. Can be `markdown`, `html`, or `wysiwyg`.

### `editor.setMode(mode)`

Sets the current `mode` of the editor.

### `editor.showLinkDialog()`

Shows the insert link dialog as if the button to insert a link had been clicked.

### `editor.showImageDialog()`

Shows the insert image dialog as if the button to insert a image had been clicked.

### `editor.showAttachmentDialog()`

Shows the insert attachment dialog as if the button to insert a attachment had been clicked.

### `editor.history`

Exposes a few methods to gain insight into the operation history for the `editor` instance.

#### `editor.history.undo()`

Undo the last operation.

#### `editor.history.redo()`

Re-applies the most recently undone operation.

#### `editor.history.canUndo()`

Returns a boolean value indicating whether there are any operations left to undo.

#### `editor.history.canRedo()`

Returns a boolean value indicating whether there are any operations left to redo.

[1]: https://github.com/bevacqua/kanye#kanyeoncombo-options-listener
[2]: https://github.com/bevacqua/barkmark/blob/master/src/html/hr.js
