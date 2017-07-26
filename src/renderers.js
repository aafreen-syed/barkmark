'use strict';

var strings = require('./strings');

function contexts (el, id) {
  el.textContent = strings.contexts[id] || id;
}

function commands (el, id) {
  el.textContent = strings.buttons[id] || id;
}

function modes (el, id) {
  el.textContent = strings.modes[id] || id;
}

module.exports = {
  modes: modes,
  contexts: contexts,
  commands: commands
};
