'use strict';

// Object.assign polyfill
if (typeof Object.assign != 'function') {
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign
  Object.assign = function(target, varArgs) { // .length of function is 2
    if (target == null) { // TypeError if undefined or null
      throw new TypeError('Cannot convert undefined or null to object');
    }

    var to = Object(target);

    for (var index = 1; index < arguments.length; index++) {
      var nextSource = arguments[index];

      if (nextSource != null) { // Skip over if undefined or null
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
  if ( typeof window.CustomEvent === "function" ) return false;

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
  }

  MouseEvent.prototype = Event.prototype;

  window.MouseEvent = MouseEvent;
})(window);

exports.clone = function (obj) {
  return Object.assign({}, obj);
};

exports.deepClone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

exports.extend = Object.assign;

exports.defaultsDeep = function (target) {
  if (target == null) { // TypeError if undefined or null
    throw new TypeError('Cannot convert undefined or null to object');
  }

  var to = Object(exports.deepClone(target));

  for (var index = 1; index < arguments.length; index++) {
    var nextSource = arguments[index];

    if (nextSource !== null) { // Skip over if undefined or null
      for (var nextKey in nextSource) {
        if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
          if(Object.prototype.hasOwnProperty(to, nextKey)) {
            if(to[nextKey] != null && nextSource[nextKey] != null && typeof to[nextKey] == 'object' && typeof nextSource[nextKey] == 'object') {
              to[nextKey] = exports.defaultsDeep(to[nextKey], nextSource[nextKey]);
            }
            // Else: Don't override existing values
          } else {
            to[nextKey] = exports.deepClone(nextSource[nextKey]);
          }
        } // end source if check
      } // end for
    }
  }
};

exports.dispatchCustomEvent = function (element, event, params) {
  var ev = new CustomEvent(event, params);
  element.dispatchEvent(ev);
};

exports.dispatchClickEvent = function (element) {
  var ev = new MouseEvent('click');
  element.dispatchEvent(ev);
};
