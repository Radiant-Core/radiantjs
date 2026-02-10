'use strict'
const Buffer = require('../util/bufferUtil')

// BLAKE3 hash function — pure JavaScript implementation
// Reference: https://github.com/BLAKE3-team/BLAKE3/blob/master/reference_impl/reference_impl.rs
// Single-chunk mode only (inputs < 1024 bytes), sufficient for all Radiant script use cases.

var IV = new Uint32Array([
  0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A,
  0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19
])

var MSG_SCHEDULE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8],
  [3, 4, 10, 12, 13, 2, 7, 14, 6, 5, 9, 0, 11, 15, 8, 1],
  [10, 7, 12, 9, 14, 3, 13, 15, 4, 0, 11, 2, 5, 8, 1, 6],
  [12, 13, 9, 11, 15, 10, 14, 8, 7, 2, 5, 3, 0, 1, 6, 4],
  [9, 14, 11, 5, 8, 12, 15, 1, 13, 3, 0, 10, 2, 6, 4, 7],
  [11, 15, 5, 0, 1, 9, 8, 6, 14, 10, 2, 12, 3, 4, 7, 13]
]

var CHUNK_START = 1
var CHUNK_END = 2
var ROOT = 8
var BLOCK_LEN = 64

function rotr32 (x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0
}

function g (state, a, b, c, d, mx, my) {
  state[a] = (state[a] + state[b] + mx) >>> 0
  state[d] = rotr32(state[d] ^ state[a], 16)
  state[c] = (state[c] + state[d]) >>> 0
  state[b] = rotr32(state[b] ^ state[c], 12)
  state[a] = (state[a] + state[b] + my) >>> 0
  state[d] = rotr32(state[d] ^ state[a], 8)
  state[c] = (state[c] + state[d]) >>> 0
  state[b] = rotr32(state[b] ^ state[c], 7)
}

function round (state, msg) {
  g(state, 0, 4, 8, 12, msg[0], msg[1])
  g(state, 1, 5, 9, 13, msg[2], msg[3])
  g(state, 2, 6, 10, 14, msg[4], msg[5])
  g(state, 3, 7, 11, 15, msg[6], msg[7])
  g(state, 0, 5, 10, 15, msg[8], msg[9])
  g(state, 1, 6, 11, 12, msg[10], msg[11])
  g(state, 2, 7, 8, 13, msg[12], msg[13])
  g(state, 3, 4, 9, 14, msg[14], msg[15])
}

function compress (cv, block, blockLen, counter, flags) {
  var msg = new Uint32Array(16)
  for (var i = 0; i < 16; i++) {
    msg[i] = block[4 * i] | (block[4 * i + 1] << 8) | (block[4 * i + 2] << 16) | (block[4 * i + 3] << 24)
    msg[i] = msg[i] >>> 0
  }

  var state = new Uint32Array([
    cv[0], cv[1], cv[2], cv[3],
    cv[4], cv[5], cv[6], cv[7],
    IV[0], IV[1], IV[2], IV[3],
    counter >>> 0, 0, blockLen >>> 0, flags >>> 0
  ])

  for (var r = 0; r < 7; r++) {
    var scheduled = new Uint32Array(16)
    for (var j = 0; j < 16; j++) {
      scheduled[j] = msg[MSG_SCHEDULE[r][j]]
    }
    round(state, scheduled)
  }

  var out = new Uint32Array(16)
  for (var k = 0; k < 8; k++) {
    out[k] = (state[k] ^ state[k + 8]) >>> 0
  }
  for (var m = 8; m < 16; m++) {
    out[m] = (state[m] ^ cv[m - 8]) >>> 0
  }
  return out
}

function blake3 (buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf)
  }

  var cv = new Uint32Array(IV)
  var block = new Uint8Array(BLOCK_LEN)
  var blockLen = 0
  var counter = 0
  var flags = CHUNK_START
  var bytesConsumed = 0

  var data = buf
  var offset = 0
  var remaining = data.length

  while (remaining > 0) {
    if (blockLen === BLOCK_LEN) {
      var out = compress(cv, block, BLOCK_LEN, counter, flags)
      cv = new Uint32Array(out.buffer, 0, 8)
      counter++
      blockLen = 0
      block = new Uint8Array(BLOCK_LEN)
      flags &= ~CHUNK_START
    }
    var want = BLOCK_LEN - blockLen
    var take = remaining < want ? remaining : want
    for (var i = 0; i < take; i++) {
      block[blockLen + i] = data[offset + i]
    }
    blockLen += take
    offset += take
    remaining -= take
    bytesConsumed += take
  }

  var finalFlags = flags | CHUNK_END | ROOT
  var finalOut = compress(cv, block, blockLen, counter, finalFlags)

  var result = Buffer.alloc(32)
  for (var w = 0; w < 8; w++) {
    result[4 * w] = finalOut[w] & 0xff
    result[4 * w + 1] = (finalOut[w] >>> 8) & 0xff
    result[4 * w + 2] = (finalOut[w] >>> 16) & 0xff
    result[4 * w + 3] = (finalOut[w] >>> 24) & 0xff
  }
  return result
}

module.exports = blake3
