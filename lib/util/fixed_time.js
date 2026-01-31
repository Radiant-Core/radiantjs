'use strict'

var FixedTime = function () {}

/**
 * Constant-time comparison of two buffers.
 * Returns true if the buffers are equal, false otherwise.
 * This function leaks length information.
 *
 * @param {Buffer} a
 * @param {Buffer} b
 * @returns {boolean}
 */
FixedTime.areEqual = function (a, b) {
  if (a.length !== b.length) {
    return false
  }
  var res = 0
  for (var i = 0; i < a.length; i++) {
    res |= a[i] ^ b[i]
  }
  return res === 0
}

module.exports = FixedTime
