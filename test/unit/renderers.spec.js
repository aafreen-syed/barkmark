'use strict';

var proxyquire = require('proxyquireify')(require);

var renderers = proxyquire('../../src/renderers', {
  '@noCallThru': true,
  './strings': {
    buttons: {
      'foo': 'bar',
    },
    modes: {
      'baz': 'bin',
    },
  },
  './setText': function (el, text) { el.text = text; },
});

describe('renderers', function () {

  describe('#modes', function () {
    it('should set the text from any localizable strings if the ID is a match', function () {
      var el = {};
      renderers.modes(el, 'baz');
      expect(el.textContent).toBe('bin');
    });

    it('should use the ID as fallback text if localized text is not available', function () {
      var el = {};
      renderers.modes(el, 'quux');
      expect(el.textContent).toBe('quux');
    });
  });

  describe('#commands', function () {

    it('should set the text from any localizable strings if the ID is a match', function () {
      var el = {};
      renderers.commands(el, 'foo');
      expect(el.textContent).toBe('bar');
    });

    it('should use the ID as fallback text if localized text is not available', function () {
      var el = {};
      renderers.commands(el, 'quux');
      expect(el.textContent).toBe('quux');
    });
  });
});
