'use strict';

// Event Object
function Evt(name, details) {
  this.name = name;
  this.details = details;
  this.executionStopped = false;
}
Evt.prototype.stopPropagation = Evt.prototype.stopExecution = function () {
  this.executionStopped = true;
};

// Extension Functionality
function on (event, callback) {
  this._events = this._events || {};
  if(!this._events[event]) {
    this._events[event] = [];
  }

  this._events[event].push(callback);
}

function off (event, callback) {
  this._events = this._events || {};
  if(!this._events[event]) {
    return false;
  }

  if(arguments.length === 1) {
    delete this._events[event];
  } else {
    var idx = this._events[event].indexOf(callback);

    if(idx < 0) { return false; }
    this._events[event].splice(idx, 1);

    if(!this._events[event].length) {
      delete this._events[event];
    }
  }

  return true;
}

function trigger (event) {
  this._events = this._events || {};
  if(!this._events[event]) {
    return;
  }

  var evt = new Evt(event, Array.prototype.slice.call(arguments, 1));
  var args = Array.prototype.slice.call(arguments, 1);
  args.unshift(evt);
  for(var h = 0; h < this._events[event].length; h++) {
    this._events[event][h].apply(this, args);
    if(evt.executionStopped) {
      break;
    }
  }

  return evt;
}

module.exports = {
  extend: function (obj) {
    obj.prototype.on = on.bind(obj);
    obj.prototype.off = off.bind(obj);
    obj.prototype.trigger = trigger.bind(obj);
  },
};
