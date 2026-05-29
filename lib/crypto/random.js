'use strict'
const Buffer = require('../util/bufferUtil');
function Random () {
}

/* secure random bytes that sometimes throws an error due to lack of entropy */
Random.getRandomBuffer = function (size) {
  if (process.browser) { return Random.getRandomBufferBrowser(size) } else { return Random.getRandomBufferNode(size) }
}

Random.getRandomBufferNode = function (size) {
  var crypto = require('crypto')
  return Buffer.from(crypto.randomBytes(size))
}

Random.getRandomBufferBrowser = function (size) {
  // Resolve the Web Crypto API across browser, web-worker, and legacy IE.
  // We require an explicit `getRandomValues`; throw loudly if absent so the
  // caller cannot silently fall back to a non-CSPRNG.
  var g = typeof globalThis !== 'undefined' ? globalThis
    : typeof self !== 'undefined' ? self
      : typeof window !== 'undefined' ? window
        : null
  var c = g && (g.crypto || g.msCrypto)
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('No secure RNG: crypto.getRandomValues is not available')
  }

  var bbuf = new Uint8Array(size)
  c.getRandomValues(bbuf)
  return Buffer.from(bbuf)
}

module.exports = Random
