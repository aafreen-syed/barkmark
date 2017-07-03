# `chunks`

<sub>_Please ignore undocumented functionality in the `chunks` object._</sub>

Describes the current state of the editor. This is the context you get on command event handlers such as the method passed to `editor.runCommand`.

Modifying the values in a `chunks` object during a command will result in changes to the user input in such a way that Undo and Redo can be taken care of automatically on your behalf, basically by going back to the previous _(or next)_ chunks state in the `editor`'s internal history.

## `chunks.selection`

The currently selected piece of text in the editor, regardless of input `mode`.

## `chunks.before`

The text that comes before `chunks.selection` in the editor.

## `chunks.after`

The text that comes after `chunks.selection` in the editor.

## `chunks.scrollTop`

The current `scrollTop` for the element. Useful to restore later in action history navigation.

## `chunks.trim(remove?)`

Moves whitespace on either end of `chunks.selection` to `chunks.before` and `chunks.after` respectively. If `remove` has been set to `true`, the whitespace in the selection is discarded instead.
