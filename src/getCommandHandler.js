'use strict';

var InputState = require('./InputState');

function getCommandHandler (editor, history, fn) {
  return function handleCommand (e) {
    var surface = editor.getSurface();
    surface.focus(true);
    history.setCommandMode();

    var state = new InputState(surface, editor.mode);
    var chunks = state.getChunks();
    var asyncHandler = {
      async: async, immediate: true
    };

    fn.call(asyncHandler, e, editor.mode, chunks);

    if (asyncHandler.immediate) {
      done();
    }

    function async () {
      asyncHandler.immediate = false;
      return done;
    }

    function done () {
      surface.focus();
      state.setChunks(chunks);
      state.restore();
    }
  };
}

module.exports = getCommandHandler;
