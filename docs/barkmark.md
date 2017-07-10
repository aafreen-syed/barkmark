# `barkmark.find(textarea)`

Returns an [editor](#editor) object associated with a `barkmark` instance, or `null` if none exists for the `textarea` yet. When `barkmark(textarea, options?)` is called, `barkmark.find` will be used to look up an existing instance, which gets immediately returned.

# `barkmark(textarea, options?)`

Adds rich editing capabilities to a `textarea` element. Returns an [editor](#editor) object.

### `options.parseMarkdown`

A method that's called by `barkmark` whenever it needs to parse Markdown into HTML. This way, editing user input is decoupled from a Markdown parser. We suggest you use [megamark][1] to parse Markdown. This parser is used whenever the editor switches from Markdown mode into HTML or WYSIWYG mode.

```js
barkmark(textarea, {
  parseMarkdown: require('megamark')
});
```

For optimal consistency, your `parseMarkdown` method should match whatever Markdown parsing you do on the server-side.

### `options.parseHTML`

A method that's called by `barkmark` whenever it needs to parse HTML or a DOM tree into Markdown. This way, editing user input is decoupled from a DOM parser. We suggest you use [domador][2] to parse HTML and DOM. This parser is used whenever the editor switches to Markdown mode, and also when [.value()](#editorvalue) is called while in the HTML or WYSIWYG modes.

```js
barkmark(textarea, {
  parseHTML: require('domador')
});
```

If you're implementing your own `parseHTML` method, note that `barkmark` will call `parseHTML` with either a DOM element or a Markdown string.

While the `parseHTML` method will never map HTML back to the original Markdown in 100% cases, _(because you can't really know if the original source was plain HTML or Markdown)_, it should strive to detokenize whatever special tokens you may allow in `parseMarkdown`, so that the user isn't met with inconsistent output when switching between the different editing modes.

A test of _sufficiently good-citizen_ behavior can be found below. This is code for _"Once an input Markdown string is parsed into HTML and back into Markdown, any further back-and-forth conversions should return the same output."_ Ensuring consistent back-and-forth is ensuring humans aren't confused when switching modes in the editor.

```js
var parsed = parseHTML(parseMarkdown(original));
assert.equal(parseHTML(parseMarkdown(parsed)), parsed);
```

As an example, consider the following piece of Markdown:

```markdown
Hey @bevacqua I _love_ [barkmark](https://github.com/bevacqua/barkmark)!
```

Without any custom Markdown hooks, it would translate to HTML similar to the following:

```html
<p>Hey @bevacqua I <em>love</em> <a href="https://github.com/bevacqua/barkmark">barkmark</a>!</p>
```

However, suppose we were to add a tokenizer in our `megamark` configuration, like below:

```js
barkmark(textarea, {
  parseMarkdown: function (input) {
    return require('megamark')(input, {
      tokenizers: [{
        token: /(^|\s)@([A-z]+)\b/g,
        transform: function (all, separator, id) {
          return separator + '<a href="/users/' + id + '">@' + id + '</a>';
        }
      }]
    });
  },
  parseHTML: require('domador')
});
```

Our HTML output would now look slightly different.

```html
<p>Hey <a href="/users/bevacqua">@bevacqua</a> I <em>love</em> <a href="https://github.com/bevacqua/barkmark">barkmark</a>!</p>
```

The problem is that `parseHTML` doesn't know about the tokenizer, so if you were to convert the HTML back into Markdown, you'd get:

```markdown
Hey [@bevacqua](/users/bevacqua) I _love_ [barkmark](https://github.com/bevacqua/barkmark)!
```

The solution is to let `parseHTML` _"know"_ about the tokenizer, so to speak. In the example below, `domador` is now aware that links that start with `@` should be converted back into something like `@bevacqua`.

```js
barkmark(textarea, {
  parseMarkdown: function (input) {
    return require('megamark')(input, {
      tokenizers: [{
        token: /(^|\s)@([A-z]+)\b/g,
        transform: function (all, separator, id) {
          return separator + '<a href="/users/' + id + '">@' + id + '</a>';
        }
      }]
    });
  },
  parseHTML: function (input) {
    return require('domador')(input, {
      transform: function (el) {
        if (el.tagName === 'A' && el.innerHTML[0] === '@') {
          return el.innerHTML;
        }
      }
    });
  }
});
```

This kind of nudge to the Markdown compiler is particularly useful in simpler use cases where you'd want to preserve HTML elements entirely when they have CSS classes, as well.

### Preserving Selection Across Input Modes

Note that both `megamark` and `domador` support a special option called `markers`, needed to preserve selection across input modes. Unless your `parseHTML` function supports this option, you'll lose that functionality when providing your own custom parsing functions. That's one of the reasons we strongly recommend using `megamark` and `domador`.

### `options.fencing`

Prefers to wrap code blocks in "fences" _(GitHub style)_ instead of indenting code blocks using four spaces. Defaults to `true`.

### `options.markdown`

Enables Markdown user input mode. Defaults to `true`.

### `options.html`

Enables HTML user input mode. Defaults to `true`.

### `options.wysiwyg`

Enables WYSIWYG user input mode. Defaults to `true`.

### `options.defaultMode`

Sets the default `mode` for the editor.

### `options.storage`

Enables this particular instance `barkmark` to remember the user's preferred input mode. If enabled, the type of input mode will be persisted across browser refreshes using `localStorage`. You can pass in `true` if you'd like all instances to share the same `localStorage` property name, but you can also pass in the property name you want to use, directly. Useful for grouping preferences as you see fit.

<sub>Note that the mode saved by storage is always preferred over the default mode.</sub>

### `options.render.modes`

This option can be set to a method that determines how to fill the Markdown, HTML, and WYSIWYG mode buttons. The method will be called once for each of them.

###### Example

```js
barkmark(textarea, {
  render: {
    modes: function (button, id) {
      button.className = 'barkmark-mode-' + id;
    }
  }
});
```

### `options.render.commands`

Same as `options.render.modes` but for command buttons. Called once on each button.

### `options.images`

If you wish to set up file uploads, _in addition to letting the user just paste a link to an image (which is always enabled)_, you can configure `options.images` like below.

```js
{
  // http method to use, defaults to PUT
  method: 'PUT',

  // endpoint where the images will be uploaded to, required
  url: '/uploads',

  // image field key, passed to bureaucracy, which defaults to 'uploads'
  fieldKey: 'uploads',

  // optional additional form submission data, passed to bureaucracy
  formData: { description: 'A new image' },

  // optional text describing the kind of files that can be uploaded
  restriction: 'GIF, JPG, and PNG images',

  // should return whether `e.dataTransfer.files[i]` is valid, defaults to a `true` operation
  validate: function isItAnImageFile (file) {
    return /^image\/(gif|png|p?jpe?g)$/i.test(file.type);
  }
}
```

`barkmark` expects a JSON response including a `results` property that's an array describing the success of each file upload. Each file's entry should include an `href` and a `title`:

```js
{
  results: [
    { href: '/images/new.jpg', title: 'New image' }
  ]
}
```

For more information on file uploads, see [`bureaucracy`](https://github.com/bevacqua/bureaucracy).

### `options.attachments`

Virtually the same as `images`, except an anchor `<a>` tag will be used instead of an image `<img>` tag.

# `barkmark.strings`

To enable localization, `barkmark.strings` exposes all user-facing messages used in barkmark. Make sure not to replace `barkmark.strings` with a new object, as a reference to it is cached during module load.

[1]: https://github.com/bevacqua/megamark
[2]: https://github.com/bevacqua/domador
