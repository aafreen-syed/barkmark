'use strict';

// Object.assign polyfill
// Ignore Polyfill code for linting (overriding globals here is expected)
/* jshint ignore:start */
if (typeof Object.assign != 'function') {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
  Object.assign = function(target, varArgs) { // .length of function is 2
    if (target === null || target === undefined) { // TypeError if undefined or null
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);

    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];

      if (nextSource !== null && nextSource !== undefined) { // Skip over if undefined or null
        for (var nextKey in nextSource) {
          // Avoid bugs when hasOwnProperty is shadowed
          if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
    }
    return to;
  };
}

// Custom Event Constructor Polyfill
(function () {
  if ( typeof window.CustomEvent === "function" ) { return false; }

  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }

  CustomEvent.prototype = window.Event.prototype;

  window.CustomEvent = CustomEvent;
})();

// Mouse Event Constructor Polyfill
(function (window) {
  try {
    new MouseEvent('test');
    return false; // No need to polyfill
  } catch (e) {
    // Need to polyfill - fall through
  }

  // Polyfills DOM4 MouseEvent

  var MouseEvent = function (eventType, params) {
    params = params || { bubbles: false, cancelable: false };
    var mouseEvent = document.createEvent('MouseEvent');
    mouseEvent.initMouseEvent(eventType, params.bubbles, params.cancelable, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

    return mouseEvent;
  };

  MouseEvent.prototype = Event.prototype;

  window.MouseEvent = MouseEvent;
})(window);
/* jshint ignore:end */

var exists = exports.exists = function (obj) {
  return obj !== undefined && obj !== null;
};

exports.clone = function (obj) {
  return Object.assign({}, obj);
};

exports.extend = Object.assign;

exports.defaultsDeep = function (target) {
  if (!exists(target)) { // TypeError if undefined or null
    throw new TypeError('Cannot convert undefined or null to object');
  }

  var to = exports.clone(target);

  for (var index = 1; index < arguments.length; index++) {
    var nextSource = arguments[index];

    if (nextSource !== null) { // Skip over if undefined or null
      for (var nextKey in nextSource) {
        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
          if(Object.prototype.hasOwnProperty.call(to, nextKey)) {
            if(exists(to[nextKey]) && exists(nextSource[nextKey]) && typeof to[nextKey] === 'object' && typeof nextSource[nextKey] === 'object') {
              to[nextKey] = exports.defaultsDeep(to[nextKey], nextSource[nextKey]);
            }
            // Else: Don't override existing values
          } else if (typeof nextSource[nextKey] === 'object' && nextSource[nextKey] !== null) {
            to[nextKey] = exports.clone(nextSource[nextKey]);
          } else {
            to[nextKey] = nextSource[nextKey];
          }
        } // end source if check
      } // end for
    }
  }

  return to;
};

exports.inherit = function (SubClass, SuperClass) {
  SubClass.prototype = Object.create(SuperClass.prototype);
  SubClass.prototype.constructor = SubClass;
};

exports.dispatchCustomEvent = function (element, event, params) {
  var ev = new CustomEvent(event, params);
  element.dispatchEvent(ev);
};

exports.dispatchBrowserEvent = function (element, event) {
  var ev = new Event(event);
  element.dispatchEvent(ev);
};

exports.dispatchClickEvent = function (element) {
  var ev = new MouseEvent('click');
  element.dispatchEvent(ev);
};

exports.debounce = function (cb, ms) {
  var tmr;
  return function () {
    var self = this,
      args = Array.prototype.slice.call(arguments);

    clearTimeout(tmr);
    tmr = setTimeout(function () {
      tmr = undefined;
      cb.apply(self, args);
    }, ms);
  };
};
