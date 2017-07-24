'use strict';

var blockquote = require('./blockquote');
var codeblock = require('./codeblock');
var heading = require('./heading');
var list = require('./list');

module.exports = {
  blockquote: blockquote,
  code: codeblock,
  heading: heading,
  list: list,
};
