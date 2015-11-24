'use strict';

var _translations = {};

/**
 * Register a set of translations, for example ('en-us', { greeting: 'Hello' })
 */
function registerTranslation(langKey, data) {
  _translations[langKey] = data;
}

function setDefaultTranslation(langKey) {
  _translations['default'] = _translations[langKey] || _translations['default'];
}

function lang(obj, langKey) {
  var lang = langKey ? _translations[langKey] || _translations['default'] : _translations['default'];
  return (lang && lang[obj]) || obj;
}

// TODO: remove
function breakLines(msg) {
  msg = msg.replace(/\//g, '/<span style="font-size:1px"> </span>');
  msg = msg.replace(/&/g, '&<span style="font-size:1px"> </span>');
  msg = msg.replace(/%/g, '%<span style="font-size:1px"> </span>');
  return msg;
}

function hashFunc(str) {
  if (!str) { return str; }
  for(var r=0, i=0; i<str.length; i++) {
    r = (r<<5) - r+str.charCodeAt(i);
    r &= r;
  }
  return r;
}

function shortenKey(str) {
  str = jQuery.trim(str);
  var lastSlash = str.lastIndexOf('/'), lastHash = str.lastIndexOf('#');
  return lastSlash > lastHash ? str.substring(lastSlash + 1) : str.substring(lastHash + 1);
}

function circleChords(radius, steps, centerX, centerY, breakAt, onlyElement) {
  var values = [];
  var i = 0;
  if (onlyElement) {
    // ottimizzo i cicli evitando di calcolare elementi che non
    // servono
    i = onlyElement;
    var radian = (2 * Math.PI) * (i / steps);
    values.push([centerX + radius * Math.cos(radian), centerY + radius * Math.sin(radian)]);
  } else {
    for (; i < steps; i++) {
      // calcolo le coodinate lungo il cerchio del box per
      // posizionare
      // strumenti ed altre risorse
      var radian = (2 * Math.PI) * (i / steps);
      values.push([centerX + radius * Math.cos(radian), centerY + radius * Math.sin(radian)]);
    }
  }
  return values;
}

/**
 * Convert arguments to an array. Returns an array if passed one
 */
function asArray() {
  if ( arguments.length === 1 && Array.isArray(arguments[0]) ) {
    return arguments[0];
  } else {
    return [].slice.call(arguments);
  }
}

/**
 * Append value to `obj[key]`, creating an array if it doesn't exist
 *
 * @param {Object} obj
 * @param {String} key
 * @param value
 */
function append(obj, key, value) {
  if (obj[key]) {
    obj[key].push(value);
  } else {
    obj[key] = [value];
  }
}

/**
 * Inverts `obj`, creating separate properties for each value in any child arrays
 *
 * @param {Object} obj
 * @return {Object} inverted obj
 */
function invert(obj) {
  return Object.keys(obj).reduce(function(inverted, key) {
    asArray(obj[key]).forEach(function(val) {
      append(inverted, val, key);
    });
    return inverted;
  }, {});
}

/**
 * Clones `obj`, converting all property values to arrays
 *
 * @param {Object} obj
 * @return {Object} converted obj
 */
function propsAsArrays(obj) {
  return Object.keys(obj).reduce(function(clone, key) {
    clone[key] = asArray(obj[key]);
    return clone;
  }, {});
}

/**
 * Merges the `merge` property of each object in `input`, by `selector`
 *
 * @param {Array<Object>} input
 * @param {String} selector - the property of each `input` object to key off of
 * @param {String} merge - the property of each object to merge
 */
function mergeBy(input, selector, merge) {
  var cache = {};

  return input.reduce(function(output, item) {
    var clone = propsAsArrays(item);
    var key = clone[selector].join(',');
    var target = output[ cache[key] ];

    if (target) {
      clone[merge].forEach(function(value) {
        if (target[merge].indexOf(value) === -1) {
          target[merge].push(value);
        }
      });
    } else {
      cache[key] = output.length;
      output.push(clone);
    }

    return output;
  }, []);
}

var LodLiveUtils = {
  registerTranslation: registerTranslation,
  setDefaultTranslation: setDefaultTranslation,
  lang: lang,
  breakLines: breakLines,
  hashFunc: hashFunc,
  shortenKey: shortenKey,
  circleChords: circleChords,
  asArray: asArray,
  append: append,
  invert: invert,
  propsAsArrays: propsAsArrays,
  mergeBy: mergeBy
};

module.exports = LodLiveUtils;

if (!window.LodLiveUtils) {
  window.LodLiveUtils = LodLiveUtils;
}
