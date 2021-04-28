(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({"/Users/phx/GitHub/pigeon-optics/library/workers/environment.js/index.js":[function(require,module,exports){
(function (global){(function (){
// Environment script, establishes any APIs available inside of the javascript lens virtual machine
// This script is run through browserify to embed libraries like css-select
Math.random = function () {
  throw new Error('Math.random() is unavailable. Lenses must be deterministic, not random')
}

global.Markup = require('./markup')

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./markup":"/Users/phx/GitHub/pigeon-optics/library/workers/environment.js/markup.js"}],"/Users/phx/GitHub/pigeon-optics/library/workers/environment.js/markup.js":[function(require,module,exports){
const treeSelector = require('tree-selector')
const treeAdapter = require('pigeonmark-utils/library/tree-selector-adapter')
const utils = require('pigeonmark-utils')

const querySelector = treeSelector.createQuerySelector(treeAdapter)
/**
 * Query a JsonML xml document using a css selector string, get an array of results
 * @param {JsonMLElement} root - root element of the document, or an object with a JsonML property containing such
 * @param {*} selector - basic CSS selector to query the document with
 * @returns {JsonMLElement[]}
 */
exports.select = function select (root, selector) {
  // get treeAdapter to learn the child -> parent mapping, necessary for css selecting
  treeAdapter.scan(root)
  return querySelector(selector, root)
}

exports.get = utils.get
exports.set = utils.set
exports.isPigeonMark = utils.isPigeonMark

/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {string|Array} element
 * @returns {string}
 */
exports.toHTML = require('pigeonmark-html/library/encode')

/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {string|Array} element
 * @returns {string}
 */
exports.toXML = require('pigeonmark-xml/library/encode')

},{"pigeonmark-html/library/encode":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-html/library/encode.js","pigeonmark-utils":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/index.js","pigeonmark-utils/library/tree-selector-adapter":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/tree-selector-adapter.js","pigeonmark-xml/library/encode":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-xml/library/encode.js","tree-selector":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/index.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/assert/assert.js":[function(require,module,exports){
(function (global){(function (){
'use strict';

var objectAssign = require('object-assign');

// compare and isBuffer taken from https://github.com/feross/buffer/blob/680e9e5e488f22aac27599a57dc844a6315928dd/index.js
// original notice:

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
function isBuffer(b) {
  if (global.Buffer && typeof global.Buffer.isBuffer === 'function') {
    return global.Buffer.isBuffer(b);
  }
  return !!(b != null && b._isBuffer);
}

// based on node assert, original notice:
// NB: The URL to the CommonJS spec is kept just for tradition.
//     node-assert has evolved a lot since then, both in API and behavior.

// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

var util = require('util/');
var hasOwn = Object.prototype.hasOwnProperty;
var pSlice = Array.prototype.slice;
var functionsHaveNames = (function () {
  return function foo() {}.name === 'foo';
}());
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer(arrbuf)) {
    return false;
  }
  if (typeof global.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!util.isFunction(func)) {
    return;
  }
  if (functionsHaveNames) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames || !util.isFunction(something)) {
    return util.inspect(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

assert.deepStrictEqual = function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', assert.deepStrictEqual);
  }
};

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer(actual) && isBuffer(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer(actual) !== isBuffer(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (util.isPrimitive(a) || util.isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && util.isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
};

assert.ifError = function(err) { if (err) throw err; };

// Expose a strict only variant of assert
function strict(value, message) {
  if (!value) fail(value, true, message, '==', strict);
}
assert.strict = objectAssign(strict, assert, {
  equal: assert.strictEqual,
  deepEqual: assert.deepStrictEqual,
  notEqual: assert.notStrictEqual,
  notDeepEqual: assert.notDeepStrictEqual
});
assert.strict.strict = assert.strict;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"object-assign":"/Users/phx/GitHub/pigeon-optics/node_modules/object-assign/index.js","util/":"/Users/phx/GitHub/pigeon-optics/node_modules/assert/node_modules/util/util.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/assert/node_modules/inherits/inherits_browser.js":[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/assert/node_modules/util/support/isBufferBrowser.js":[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/assert/node_modules/util/util.js":[function(require,module,exports){
(function (process,global){(function (){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this)}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":"/Users/phx/GitHub/pigeon-optics/node_modules/assert/node_modules/util/support/isBufferBrowser.js","_process":"/Users/phx/GitHub/pigeon-optics/node_modules/process/browser.js","inherits":"/Users/phx/GitHub/pigeon-optics/node_modules/assert/node_modules/inherits/inherits_browser.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/html-tags/html-tags-void.json":[function(require,module,exports){
module.exports=[
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"link",
	"menuitem",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
]

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/html-tags/void.js":[function(require,module,exports){
'use strict';
module.exports = require('./html-tags-void.json');

},{"./html-tags-void.json":"/Users/phx/GitHub/pigeon-optics/node_modules/html-tags/html-tags-void.json"}],"/Users/phx/GitHub/pigeon-optics/node_modules/object-assign/index.js":[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-html/library/build-html.js":[function(require,module,exports){
const assert = require('assert')
const selfClosingTags = new Set(require('html-tags/void'))
const esc = require('./escape')
const utils = require('pigeonmark-utils')

function frequency (string, chars) {
  const frequencies = Object.fromEntries([...chars].map(x => [x, 0]))
  for (const char of `${string}`) {
    if (typeof frequencies[char] === 'number') frequencies[char] += 1
  }
  return frequencies
}

const build = module.exports = {
  * any (element) {
    const type = utils.get.type(element)
    const builder = build[type]
    if (!builder) throw new Error(`Cannot encode type ${JSON.stringify(type)} for element ${JSON.stringify(element)}`)
    yield * builder(element)
  },

  * tag (element) {
    const tag = utils.get.name(element)
    const hasAttribs = element[1] && typeof element[1] === 'object' && !Array.isArray(element[1])
    const attribs = hasAttribs ? element[1] : undefined
    assert(typeof tag === 'string', 'tag name must be a string')
    assert(tag.match(/^[a-zA-Z0-9]+$/), 'tag name must be alphanumeric')

    const isSelfClosing = selfClosingTags.has(tag.toLowerCase())
    if (isSelfClosing) {
      if (element.length > (hasAttribs ? 2 : 1)) throw new Error(`<${tag}> html element cannot contain child nodes`)
      yield `<${tag}${[...build.attributes(attribs)].join('')}>`
    } else {
      yield `<${tag}${[...build.attributes(attribs)].join('')}>`
      for (const child of element.slice(hasAttribs ? 2 : 1)) {
        yield * build.any(child)
      }
      yield `</${tag}>`
    }
  },

  * text (element) {
    yield esc(element, '&<')
  },

  * attributes (element) {
    for (const name in element) {
      const value = `${element[name]}`
      assert(!`${name}`.match(/[ "'>/=\0\cA-\cZ\u007F-\u009F]/), 'invalid attribute name')

      if (value === true || value === '') {
        yield ` ${name}`
      } else if (!value) {
        continue
      } else if (typeof value === 'string') {
        if (value.match(/[ "'`=<>]/)) {
          const counts = frequency(value, '\'"')
          if (counts['"'] > counts["'"]) {
            yield ` ${name}='${esc(value, "&'")}'`
          } else {
            yield ` ${name}="${esc(value, '&"')}"`
          }
        } else {
          // no quotes needed
          yield ` ${name}=${esc(value, '"\'&<>')}`
        }
      }
    }
  },

  * comment (element) {
    yield `<!--${utils.get.text(element).replace('--', ' - -')}-->`
  },

  * fragment (element) {
    for (const child of utils.get.childNodes(element)) {
      yield * build.any(child)
    }
  },

  * document (element) {
    const doctype = utils.get.attribute(element, 'doctype')
    if (typeof doctype === 'string') yield `<!DOCTYPE ${doctype}>\n`
    for (const child of utils.get.childNodes(element)) {
      yield * build.any(child)
    }
  },

  * cdata (element) {
    const text = utils.get.text(element)
    assert(!text.includes(']]>'), 'CDATA cannot contain the literal text ]]>')
    yield `<![CDATA[${text}]]>`
  }
}

},{"./escape":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-html/library/escape.js","assert":"/Users/phx/GitHub/pigeon-optics/node_modules/assert/assert.js","html-tags/void":"/Users/phx/GitHub/pigeon-optics/node_modules/html-tags/void.js","pigeonmark-utils":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/index.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-html/library/encode.js":[function(require,module,exports){
const build = require('./build-html')

/**
 * Given a JsonML element, or a string, render it to a HTML string, suitably escaped and structured
 * @param {string|Array} element
 * @returns {string}
 */
module.exports = function encode (element) {
  return [...build.any(element)].join('')
}

},{"./build-html":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-html/library/build-html.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-html/library/escape.js":[function(require,module,exports){
// legacy entities are ones which do not require a semicolon to be ambiguous
const legacyEntities = [
  'AElig', 'AMP', 'Aacute', 'Acirc', 'Agrave', 'Aring', 'Atilde', 'Auml', 'COPY', 'Ccedil', 'ETH',
  'Eacute', 'Ecirc', 'Egrave', 'Euml', 'GT', 'Iacute', 'Icirc', 'Igrave', 'Iuml', 'LT', 'Ntilde',
  'Oacute', 'Ocirc', 'Ograve', 'Oslash', 'Otilde', 'Ouml', 'QUOT', 'REG', 'THORN', 'Uacute',
  'Ucir', 'Ugrave', 'Uuml', 'Yacute', 'aacute', 'acirc', 'acute', 'aelig', 'agrave', 'amp', 'aring',
  'atilde', 'auml', 'brvbar', 'ccedil', 'cedil', 'cent', 'copy', 'curren', 'deg', 'divide', 'eacute',
  'ecirc', 'egrave', 'eth', 'euml', 'frac12', 'frac14', 'frac34', 'gt', 'iacute', 'icirc', 'iexcl',
  'igrave', 'iquest', 'iuml', 'laquo', 'lt', 'macr', 'micro', 'middot', 'nbsp', 'not', 'ntilde',
  'oacute', 'ocirc', 'ograve', 'ordf', 'ordm', 'oslash', 'otilde', 'ouml', 'para', 'plusmn', 'pound',
  'quot', 'raquo', 'reg', 'sect', 'shy', 'sup1', 'sup2', 'sup3', 'szlig', 'thorn', 'times', 'uacute',
  'ucirc', 'ugrave', 'uml', 'uuml', 'yacute', 'yen', 'yuml'
]

// build a pattern which matches all ambiguous entities, as well as < > " ' chars
const pattern = `([<>"']|&[#a-zA-Z0-9][a-zA-Z0-9]*;|&(${legacyEntities.join('|')}))`
const regexp = new RegExp(pattern, 'g')

// does html encoding escaping to strings in the most minimally invasive way possible, including ambiguous ampersand logic
module.exports = function esc (string, replaceList) {
  const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' }
  return string.replace(regexp, match => {
    const char = match[0]
    return (replaceList.includes(char) ? table[char] : char) + match.slice(1)
  })
}

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/index.js":[function(require,module,exports){
/**
 * @typedef {Object} PMAttributes - xml tag attributes
 * @typedef {[tag: string, ...children: PMChildNode[]]} PMTagWithoutAttributes - xml tag, without attributes
 * @typedef {[tag: string, attrs: PMAttributes, ...children: PMChildNode[]]} PMTagWithAttributes - xml tag, with attributes
 * @typedef {PMTagWithAttributes|PMTagWithoutAttributes} PMTag - xml tag, with or without attributes
 * @typedef {string} PMText - xml text node
 * @typedef {['#cdata-section', ...text: string[]]} PMCData - xml CDATA block
 * @typedef {['#comment', ...text: string[]]} PMComment - xml comment
 * @typedef {PMTag|PMCData|PMComment|PMText} PMChildNode - any type which can be a child of a tag, document, or fragment
 * @typedef {[name: string, attrs: PMAttributes]} PMXMLPI - xml processing instruction
 * @typedef {['#document', { doctype: string|undefined }, ...children: PMChildNode[]]} PMHTMLDocument - html root document container
 * @typedef {['#document', { doctype: string|undefined, pi: PMXMLPI[]|undefined }, ...children: PMChildNode[]]} PMXMLDocument - html root document container
 * @typedef {PMXMLDocument|PMHTMLDocument} PMDocument - either a html or xml document root
 * @typedef {['#document-fragment', ...children: PMChildNode[]]} PMFragment - XML document fragment container, used to group several root level tags and texts together
 * @typedef {PMTag|PMText|PMFragment|PMDocument} PMRootNode
 * @typedef {PMTag|PMAttributes|PMText|PMCData|PMComment|PMXMLPI|PMHTMLDocument|PMFragment} PMNode
 */

const typeLabels = {
  '#document': 'document',
  '#cdata-section': 'cdata',
  '#comment': 'comment',
  '#document-fragment': 'fragment'
}

/**
 * Check if an object is strictly plausibly an attributes object
 * @param {PMAttributes|*} obj
 * @returns {boolean}
 */
function isAttrs (obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false

  for (const key in obj) {
    if (typeof key !== 'string' || key.includes(' ')) return false
    if (typeof obj[key] !== 'string') return false
  }

  return true
}

exports.get = {
  /**
   * given a node, returns type string, one of 'tag', 'cdata', 'comment', 'doctype', 'pi', 'text', 'document' or 'fragment'
   * or returns undefined if the node doesn't seem to be interperable as PigeonMark
   * @param {PMNode} node
   * @returns {'tag'|'text'|'attributes'|'comment'|'cdata'|'pi'|'document'|'fragment'|undefined}
   */
  type (node) {
    if (Array.isArray(node)) {
      if (node.length > 0) {
        if (typeof node[0] === 'string' && node[0].length > 0 && !node[0].includes(' ')) {
          const name = node[0]
          // handle special node types
          if (name.startsWith('#')) return typeLabels[name] // it's a dom type
          if (name.startsWith('?')) return 'pi' // it's one of those <?xml...?> sort of PIs

          if (node.every((v, i) => Array.isArray(v) || typeof v === 'string' || (i === 1 && isAttrs(v)))) {
            return 'tag'
          }
        }
      }
    } else if (typeof node === 'string') {
      return 'text'
    } else if (node && typeof node === 'object' && isAttrs(node)) {
      return 'attributes'
    }
  },

  /**
   * returns the tag name of the node passed in, returns string if input type is supported, or undefined if it isn't
   * @param {PMTag|PMXMLPI} node
   * @returns {string|undefined}
   */
  name (node) {
    const type = exports.get.type(node)
    if (type === 'tag') {
      return node[0]
    } else if (type === 'pi') {
      return node[0].slice(1)
    }
  },

  /**
   * get attribute value from tag node, or undefined if the attribute isn't set or the tag doesn't have attributes
   * @param {PMTag|PMXMLPI} node - tag node
   * @param {string} attributeName - string attribute name
   * @returns {string|undefined}
   */
  attribute (node, attributeName) {
    return exports.get.attributes(node)[attributeName]
  },

  /**
   * get all the attributes of a tag or xmlpi, or an empty object if it doesn't have any
   * @param {PMTag|PMXMLPI} node - tag node
   * @returns {object}
   */
  attributes (node) {
    if (Array.isArray(node) && typeof node[0] === 'string' && typeof node[1] === 'object' && !Array.isArray(node[1])) {
      return node[1]
    }
    return {}
  },

  /**
   * returns child elements or undefined if the input isn't a tag
   * @param {PMRootNode} node
   * @returns {PMTag[]|undefined}
   */
  children (node) {
    if (['tag', 'document', 'fragment'].includes(exports.get.type(node))) {
      return node.filter((value, index) => index > 0 && exports.get.type(value) === 'tag')
    }
  },

  /**
   * returns all child nodes of a tag, document, or fragment, or undefined if the input isn't a tag
   * @param {PMTag|PMDocument|PMFragment} node
   * @returns {PMChildNode[]}
   */
  childNodes (node) {
    if (['tag', 'document', 'fragment'].includes(exports.get.type(node))) {
      if (isAttrs(node[1])) return node.slice(2)
      else return node.slice(1)
    }
  },

  /**
   * shortcut to read id attribute, always returns a string, empty if no id is set
   * @param {PMTag} node
   * @returns {string|undefined}
   */
  id (node) {
    return exports.get.attribute(node, 'id')
  },

  /**
   * shortcut to read class attribute, always returns a string, empty if no id is set
   * @param {PMTag} node
   * @returns {string}
   */
  classList (node) {
    const string = exports.get.attribute(node, 'class') || ''
    if (string.trim() === '') {
      return []
    } else {
      return string.split(/ +/)
    }
  },

  /**
   * like WebAPI Element.textContent, returns a concatinated string of all the text and cdata nodes within this node
   * @param {PMNode} node
   * @returns {string}
   */
  text (node) {
    const type = exports.get.type(node)

    if (type === 'text') {
      return node
    } else if (type === 'cdata') {
      return node.slice(1).join('')
    } else if (type === 'comment') {
      return node.slice(1).join('')
    } else if (type === 'pi') {
      return node.slice(1).join('')
    } else {
      function * iter (input) {
        const kids = exports.get.childNodes(input)
        for (const kid of (kids || [])) {
          const kidType = exports.get.type(kid)
          if (kidType === 'text') {
            yield kid
          } else if (kidType === 'cdata') {
            yield * kid.slice(1)
          } else {
            yield * iter(kid)
          }
        }
      }
      return [...iter(node)].join('')
    }
  }
}

exports.set = {
  /**
   * sets the name of a tag or xmlpi
   * @param {PMTag|PMXMLPI} node
   * @returns {PMTag|PMXMLPI} - returns the same node for chaining
   */
  name (node, name) {
    const type = exports.get.type(node)
    if (type === 'tag') {
      node[0] = name
    } else if (type === 'pi') {
      node[0] = `?${name}`
    }
    return node
  },

  /**
   * sets attribute value from tag node, or undefined if the attribute isn't set or the tag doesn't have attributes
   * @param {PMTag|PMXMLPI} node - tag node
   * @param {string} attributeName - string attribute name
   * @param {string} attributeValue - string value to set attribute to
   * @returns {string|undefined}
   */
  attribute (node, attributeName, attributeValue) {
    if (Array.isArray(node) && typeof node[0] === 'string') {
      if (typeof node[1] === 'object' && !Array.isArray(node[1])) {
        node[1][attributeName] = attributeValue
      } else {
        const name = node.shift()
        const attrs = { [attributeName]: attributeValue }
        node.unshift(name, attrs)
      }
    }
    return node
  },

  /**
   * sets all the attributes of a tag or xmlpi, or an empty object if it doesn't have any
   * @param {PMTag|PMXMLPI} node - tag node
   * @param {object} attributes - object of key-value pairs for attributes
   * @returns {PMTag|PMXMLPI} - returns input node for chaining
   */
  attributes (node, object) {
    if (Array.isArray(node) && typeof node[0] === 'string') {
      if (typeof node[1] === 'object' && !Array.isArray(node[1])) {
        node[1] = object
      } else {
        const name = node.shift()
        node.unshift(name, object)
      }
    }
    return node
  },

  /**
   * replaces child nodes of tag with specified children
   * @param {PMRootNode} node
   * @param {PMChildNode[]} children
   * @returns {PMRootNode} - same node, for chaining
   */
  children (node, children) {
    return exports.set.childNodes(node, children)
  },

  /**
   * replaces child nodes of tag with specified children
   * @param {PMRootNode} node
   * @param {PMChildNode[]} children
   * @returns {PMRootNode} - same node, for chaining
   */
  childNodes (node, children) {
    const type = exports.get.type(node)
    if (!['tag', 'document', 'fragment'].includes(type)) throw new Error('can only set children on tag, document, and fragment nodes')

    if (node[1] && typeof node[1] === 'object' && !Array.isArray(node[1])) {
      // has attrs
      node.length = 2
      node.push(...children)
    } else {
      node.length = 1
      node.push(...children)
    }

    return node
  },

  /**
   * shortcut to set id attribute of a tag
   * @param {PMTag} node
   * @param {string} value
   * @returns {string|undefined}
   */
  id (node, value) {
    return exports.set.attribute(node, 'id', `${value}`)
  },

  /**
   * shortcut to read class attribute, always returns a string, empty if no id is set
   * @param {PMTag} node
   * @param {string[]|string} classList - string or array of strings to form class list
   * @returns {string}
   */
  classList (node, classList) {
    if (Array.isArray(classList)) classList = classList.join(' ')
    return exports.set.attribute(node, 'class', `${classList}`)
  },

  /**
   * like WebAPI Element.textContent, replaces children of tag with a text node when set
   * @param {PMNode} node
   * @param {string} text
   * @returns {string}
   */
  text (node, text) {
    return exports.set.children(node, [`${text}`])
  }
}

/**
 * Test if an object is a valid PigeonMark or JsonML document
 * @param {PMNode} node - node to test if it's a
 * @returns {boolean}
 */
exports.isPigeonMark = function isPigeonMark (node) {
  if (typeof node === 'string') {
    return true
  } else if (Array.isArray(node)) {
    const name = node[0]
    if (typeof name === 'string' && name.length > 0 && !name.includes(' ')) {
      if (node.length === 1) return true
      if (typeof node[1] === 'object' && !Array.isArray(node[1])) {
        // has attribs, check attribute name validity
        if (Object.keys(node[1]).some(attr => typeof attr !== 'string' || attr.match(/[ =]/))) return false // not a valid attribute name
        // check all the child nodes
        return node.every((child, index) => index <= 1 || isPigeonMark(child))
      } else {
        // no attributes object, so just check the children
        return node.every((child, index) => index === 0 || isPigeonMark(child))
      }
    }
  }
  return false
}

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/tree-selector-adapter.js":[function(require,module,exports){
/**
 * Module providing interfaces necessary to use tree-selector
 * package to navigate JsonML/PigeonMark structures
 */
const util = require('./index')

/**
 * Check if a node is a <tag>
 * @param {util.PMNode} node
 * @returns {boolean}
 */
exports.isTag = (node) => util.get.type(node) === 'tag'

/**
 * Get the string name of a tag like <img> returns 'img'
 * @param {util.PMTag} node
 * @returns {string|undefined}
 */
exports.tag = (node) => util.get.name(node) || ''

/**
 * Get the string id value of a tag, or an empty string if it
 * doesn't have one
 * @param {util.PMTag} node
 * @returns {string}
 */
exports.id = (node) => util.get.id(node) || ''

/**
 * Get the space seperated string class list of a tag, or an empty
 * string if it doesn't have one
 * @param {util.PMTag} node
 * @returns {string}
 */
exports.className = (node) => exports.attr(node, 'class') || ''

/**
 * Get the string value of a tag's attribute, or undefined if it
 * isn't set
 * @param {util.PMTag} node
 * @param {string} attributeName
 * @returns {string|undefined}
 */
exports.attr = (node, attributeName) => util.get.attribute(node, attributeName)

/**
 * Get the child tags of an input tag
 * @param {util.PMRootNode} tag
 * @returns {util.PMTag[]}
 */
exports.children = (tag) => util.get.children(tag)

/**
 * Get the text contents of a node, like WebAPI DOM's textContent property
 * @param {util.PMNode} node
 * @returns {string}
 */
exports.contents = (node) => util.get.text(node)

const nodeParents = new WeakMap()

/**
 * Get the parent of a JsonML node. This only works if scan()
 * has been called on an ancestoral parent of this node
 * @param {util.PMNode} node
 * @returns {util.PMNode|undefined}
 */
exports.parent = (node) => nodeParents.get(node)

/**
 * Map out the structure of a JsonML/PigeonMark document,
 * allowing parent() to work correctly after
 * @param {util.PMNode} node
 */
exports.scan = (node) => {
  const kids = util.get.children(node)
  if (kids && kids.length > 0) {
    for (const kid of kids) {
      if (!nodeParents.has(kid)) {
        nodeParents.set(kid, node)
        exports.scan(kid)
      }
    }
  }
}

},{"./index":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/index.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-xml/library/encode.js":[function(require,module,exports){
const utils = require('pigeonmark-utils')
const esc = require('./escape')
const assert = require('assert')

function frequency (string, chars) {
  const frequencies = Object.fromEntries([...chars].map(x => [x, 0]))
  for (const char of `${string}`) {
    if (typeof frequencies[char] === 'number') frequencies[char] += 1
  }
  return frequencies
}

const builders = {
  * text (element) {
    yield esc(element, '<&')
  },

  * tag (element) {
    const tag = utils.get.name(element)
    const attrs = utils.get.attributes(element)
    const kids = utils.get.childNodes(element)
    assert(tag.match(/^[^\r\n\t. ?!#][^\r\n\t ?!#]*$/), 'tag name must not be empty, and cannot contain whitespace, ?, !, #, and cannot start with a period')

    if (kids.length > 0) {
      yield `<${tag}${[...builders.attributes(attrs)].join('')}>`
      for (const kid of kids) yield * build(kid)
      yield `</${tag}>`
    } else {
      yield `<${tag}${[...builders.attributes(attrs)].join('')}/>`
    }
  },

  * attributes (attrs) {
    for (const [name, value] of Object.entries(attrs)) {
      assert(name.match(/^[^\r\n\t ?!=]+$/gm), 'attribute name cannot contain whitespace, question marks, explanation marks, and must not be empty')
      const freq = frequency(value, '\'"')
      if (freq['"'] <= freq["'"]) {
        yield ` ${name}="${esc(value, '&>"')}"`
      } else {
        yield ` ${name}='${esc(value, "&>'")}'`
      }
    }
  },

  * comment (element) {
    yield `<!--${utils.get.text(element)}-->`
  },

  * cdata (element) {
    const text = utils.get.text(element)
    if (text.includes(']]>')) throw new Error('Cannot encode cdata block containing string "]]>" safely.')
    yield `<![CDATA[${text}]]>`
  },

  * document (element) {
    const attrs = utils.get.attributes(element)
    for (const pi of (attrs.xmlpi || [])) {
      yield * builders.pi(pi)
    }
    if (attrs.doctype) yield `<!DOCTYPE ${attrs.doctype}>\n`
    const children = utils.get.children(element)
    if (children.length === 1) {
      yield * builders.tag(children[0])
    } else if (children.length > 1) {
      throw new Error('XML documents cannot have multiple root tags')
    }
  },

  * fragment (element) {
    for (const childNode of utils.get.childNodes(element)) {
      yield * build(childNode)
    }
  },

  * pi (element) {
    const name = utils.get.name(element)
    const attrs = utils.get.attributes(element)
    yield `<?${name}${[...builders.attributes(attrs)].join('')}?>\n`
  }
}

function * build (element) {
  const type = utils.get.type(element)
  yield * builders[type](element)
}

module.exports = function encode (obj) {
  return [...build(obj)].join('')
}

},{"./escape":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-xml/library/escape.js","assert":"/Users/phx/GitHub/pigeon-optics/node_modules/assert/assert.js","pigeonmark-utils":"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-utils/library/index.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/pigeonmark-xml/library/escape.js":[function(require,module,exports){
// does html encoding escaping to strings
module.exports = function esc (string, replaceList) {
  const table = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }
  return string.replace(/[&<>"']/g, char => replaceList.includes(char) ? table[char] : char)
}

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/index.js":[function(require,module,exports){
"use strict";
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
__export(require("./selectorParser"));
var matches_1 = require("./matches");
exports.createMatches = matches_1.createMatches;
var querySelector_1 = require("./querySelector");
exports.createQuerySelector = querySelector_1.createQuerySelector;

},{"./matches":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/matches.js","./querySelector":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/querySelector.js","./selectorParser":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/selectorParser.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/matches.js":[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var selectorParser_1 = require("./selectorParser");
function createMatches(opts) {
    return function matches(selector, node) {
        var _a = typeof selector === 'object' ? selector : selectorParser_1.parseSelector(selector), tag = _a.tag, id = _a.id, classList = _a.classList, attributes = _a.attributes, nextSelector = _a.nextSelector, pseudos = _a.pseudos;
        if (nextSelector !== undefined) {
            throw new Error('matches can only process selectors that target a single element');
        }
        if (!node) {
            return false;
        }
        if (tag && tag.toLowerCase() !== opts.tag(node).toLowerCase()) {
            return false;
        }
        if (id && id !== opts.id(node)) {
            return false;
        }
        var classes = opts.className(node).split(' ');
        for (var i = 0; i < classList.length; i++) {
            if (classes.indexOf(classList[i]) === -1) {
                return false;
            }
        }
        for (var key in attributes) {
            var attr = opts.attr(node, key);
            var t = attributes[key][0];
            var v = attributes[key][1];
            if (attr === undefined) {
                return false;
            }
            if (t === 'has') {
                return true;
            }
            if (t === 'exact' && attr !== v) {
                return false;
            }
            else if (t !== 'exact') {
                if (typeof v !== 'string') {
                    throw new Error('All non-string values have to be an exact match');
                }
                if (t === 'startsWith' && !attr.startsWith(v)) {
                    return false;
                }
                if (t === 'endsWith' && !attr.endsWith(v)) {
                    return false;
                }
                if (t === 'contains' && attr.indexOf(v) === -1) {
                    return false;
                }
                if (t === 'whitespace' && attr.split(' ').indexOf(v) === -1) {
                    return false;
                }
                if (t === 'dash' && attr.split('-').indexOf(v) === -1) {
                    return false;
                }
            }
        }
        for (var i = 0; i < pseudos.length; i++) {
            var _b = pseudos[i], t = _b[0], data = _b[1];
            if (t === 'contains' && data !== opts.contents(node)) {
                return false;
            }
            if (t === 'empty' &&
                (opts.contents(node) || opts.children(node).length !== 0)) {
                return false;
            }
            if (t === 'root' && opts.parent(node) !== undefined) {
                return false;
            }
            if (t.indexOf('child') !== -1) {
                if (!opts.parent(node)) {
                    return false;
                }
                var siblings = opts.children(opts.parent(node));
                if (t === 'first-child' && siblings.indexOf(node) !== 0) {
                    return false;
                }
                if (t === 'last-child' &&
                    siblings.indexOf(node) !== siblings.length - 1) {
                    return false;
                }
                if (t === 'nth-child') {
                    var regex = /([\+-]?)(\d*)(n?)(\+\d+)?/;
                    var parseResult = regex.exec(data).slice(1);
                    var index = siblings.indexOf(node);
                    if (!parseResult[0]) {
                        parseResult[0] = '+';
                    }
                    var factor = parseResult[1]
                        ? parseInt(parseResult[0] + parseResult[1])
                        : undefined;
                    var add = parseInt(parseResult[3] || '0');
                    if (factor &&
                        parseResult[2] === 'n' &&
                        index % factor !== add) {
                        return false;
                    }
                    else if (!factor &&
                        parseResult[2] &&
                        ((parseResult[0] === '+' && index - add < 0) ||
                            (parseResult[0] === '-' && index - add >= 0))) {
                        return false;
                    }
                    else if (!parseResult[2] && factor &&
                        index !== factor - 1) {
                        return false;
                    }
                }
            }
        }
        return true;
    };
}
exports.createMatches = createMatches;

},{"./selectorParser":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/selectorParser.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/querySelector.js":[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var selectorParser_1 = require("./selectorParser");
var matches_1 = require("./matches");
function createQuerySelector(options, matches) {
    var _matches = matches || matches_1.createMatches(options);
    function findSubtree(selector, depth, node) {
        if (!node) {
            return [];
        }
        var n = _matches(selector, node);
        var matched = n ? (typeof n === 'object' ? [n] : [node]) : [];
        if (depth === 0) {
            return matched;
        }
        var childMatched = options
            .children(node)
            .filter(function (c) { return typeof c !== 'string'; })
            .map(function (c) { return findSubtree(selector, depth - 1, c); })
            .reduce(function (acc, curr) { return acc.concat(curr); }, []);
        return matched.concat(childMatched);
    }
    function findSibling(selector, next, node) {
        if (!node || options.parent(node) === undefined) {
            return [];
        }
        var results = [];
        var siblings = options.children(options.parent(node));
        for (var i = siblings.indexOf(node) + 1; i < siblings.length; i++) {
            if (typeof siblings[i] === 'string') {
                continue;
            }
            var n = _matches(selector, siblings[i]);
            if (n) {
                if (typeof n === 'object') {
                    results.push(n);
                }
                else {
                    results.push(siblings[i]);
                }
            }
            if (next) {
                break;
            }
        }
        return results;
    }
    return function querySelector(selector, node) {
        if (!node) {
            return [];
        }
        var sel = typeof selector === 'object' ? selector : selectorParser_1.parseSelector(selector);
        var results = [node];
        var currentSelector = sel;
        var currentCombinator = 'subtree';
        var tail = undefined;
        var _loop_1 = function () {
            tail = currentSelector.nextSelector;
            currentSelector.nextSelector = undefined;
            if (currentCombinator === 'subtree' ||
                currentCombinator === 'child') {
                var depth_1 = currentCombinator === 'subtree' ? Infinity : 1;
                results = results
                    .map(function (n) { return findSubtree(currentSelector, depth_1, n); })
                    .reduce(function (acc, curr) { return acc.concat(curr); }, []);
            }
            else {
                var next_1 = currentCombinator === 'nextSibling';
                results = results
                    .map(function (n) { return findSibling(currentSelector, next_1, n); })
                    .reduce(function (acc, curr) { return acc.concat(curr); }, []);
            }
            if (tail) {
                currentSelector = tail[1];
                currentCombinator = tail[0];
            }
        };
        do {
            _loop_1();
        } while (tail !== undefined);
        return results;
    };
}
exports.createQuerySelector = createQuerySelector;

},{"./matches":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/matches.js","./selectorParser":"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/selectorParser.js"}],"/Users/phx/GitHub/pigeon-optics/node_modules/tree-selector/lib/cjs/selectorParser.js":[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
var IDENT = '[\\w-]+';
var SPACE = '[ \t]*';
var VALUE = "[^\\]]+";
var CLASS = "(?:\\." + IDENT + ")";
var ID = "(?:#" + IDENT + ")";
var OP = "(?:=|\\$=|\\^=|\\*=|~=|\\|=)";
var ATTR = "(?:\\[" + SPACE + IDENT + SPACE + "(?:" + OP + SPACE + VALUE + SPACE + ")?\\])";
var SUBTREE = "(?:[ \t]+)";
var CHILD = "(?:" + SPACE + "(>)" + SPACE + ")";
var NEXT_SIBLING = "(?:" + SPACE + "(\\+)" + SPACE + ")";
var SIBLING = "(?:" + SPACE + "(~)" + SPACE + ")";
var COMBINATOR = "(?:" + SUBTREE + "|" + CHILD + "|" + NEXT_SIBLING + "|" + SIBLING + ")";
var CONTAINS = "contains\\(\"[^\"]*\"\\)";
var FORMULA = "(?:even|odd|\\d*(?:-?n(?:\\+\\d+)?)?)";
var NTH_CHILD = "nth-child\\(" + FORMULA + "\\)";
var PSEUDO = ":(?:first-child|last-child|" + NTH_CHILD + "|empty|root|" + CONTAINS + ")";
var TAG = "(:?" + IDENT + ")?";
var TOKENS = CLASS + "|" + ID + "|" + ATTR + "|" + PSEUDO + "|" + COMBINATOR;
var combinatorRegex = new RegExp("^" + COMBINATOR + "$");
/**
 * Parses a css selector into a normalized object.
 * Expects a selector for a single element only, no `>` or the like!
 */
function parseSelector(selector) {
    var sel = selector.trim();
    var tagRegex = new RegExp(TAG, 'y');
    var tag = tagRegex.exec(sel)[0];
    var regex = new RegExp(TOKENS, 'y');
    regex.lastIndex = tagRegex.lastIndex;
    var matches = [];
    var nextSelector = undefined;
    var lastCombinator = undefined;
    var index = -1;
    while (regex.lastIndex < sel.length) {
        var match = regex.exec(sel);
        if (!match && lastCombinator === undefined) {
            throw new Error('Parse error, invalid selector');
        }
        else if (match && combinatorRegex.test(match[0])) {
            var comb = combinatorRegex.exec(match[0])[0];
            lastCombinator = comb;
            index = regex.lastIndex;
        }
        else {
            if (lastCombinator !== undefined) {
                nextSelector = [
                    getCombinator(lastCombinator),
                    parseSelector(sel.substring(index))
                ];
                break;
            }
            matches.push(match[0]);
        }
    }
    var classList = matches
        .filter(function (s) { return s.startsWith('.'); })
        .map(function (s) { return s.substring(1); });
    var ids = matches.filter(function (s) { return s.startsWith('#'); }).map(function (s) { return s.substring(1); });
    if (ids.length > 1) {
        throw new Error('Invalid selector, only one id is allowed');
    }
    var postprocessRegex = new RegExp("(" + IDENT + ")" + SPACE + "(" + OP + ")?" + SPACE + "(" + VALUE + ")?");
    var attrs = matches
        .filter(function (s) { return s.startsWith('['); })
        .map(function (s) { return postprocessRegex.exec(s).slice(1, 4); })
        .map(function (_a) {
        var attr = _a[0], op = _a[1], val = _a[2];
        return (_b = {},
            _b[attr] = [getOp(op), val ? parseAttrValue(val) : val],
            _b);
        var _b;
    })
        .reduce(function (acc, curr) { return (__assign({}, acc, curr)); }, {});
    var pseudos = matches
        .filter(function (s) { return s.startsWith(':'); })
        .map(function (s) { return postProcessPseudos(s.substring(1)); });
    return {
        id: ids[0] || '',
        tag: tag,
        classList: classList,
        attributes: attrs,
        nextSelector: nextSelector,
        pseudos: pseudos
    };
}
exports.parseSelector = parseSelector;
function parseAttrValue(v) {
    if (v.startsWith('"')) {
        return v.slice(1, -1);
    }
    if (v === "true") {
        return true;
    }
    if (v === "false") {
        return false;
    }
    var f = parseFloat(v);
    if (isNaN(f)) {
        return v;
    }
    return f;
}
function postProcessPseudos(sel) {
    if (sel === 'first-child' ||
        sel === 'last-child' ||
        sel === 'root' ||
        sel === 'empty') {
        return [sel, undefined];
    }
    if (sel.startsWith('contains')) {
        var text = sel.slice(10, -2);
        return ['contains', text];
    }
    var content = sel.slice(10, -1);
    if (content === 'even') {
        content = '2n';
    }
    if (content === 'odd') {
        content = '2n+1';
    }
    return ['nth-child', content];
}
function getOp(op) {
    switch (op) {
        case '=':
            return 'exact';
        case '^=':
            return 'startsWith';
        case '$=':
            return 'endsWith';
        case '*=':
            return 'contains';
        case '~=':
            return 'whitespace';
        case '|=':
            return 'dash';
        default:
            return 'has';
    }
}
function getCombinator(comb) {
    switch (comb.trim()) {
        case '>':
            return 'child';
        case '+':
            return 'nextSibling';
        case '~':
            return 'sibling';
        default:
            return 'subtree';
    }
}

},{}]},{},["/Users/phx/GitHub/pigeon-optics/library/workers/environment.js/index.js"]);
