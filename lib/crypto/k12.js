'use strict'
const Buffer = require('../util/bufferUtil')

// KangarooTwelve (K12) hash function — pure JavaScript implementation
// Reference: https://keccak.team/kangarootwelve.html
// K12 uses Keccak-p[1600,12] (reduced-round Keccak with 12 rounds).
// Single-block mode only (inputs < 8192 bytes), sufficient for all Radiant script use cases.

var RATE = 168

// Round constants for Keccak-f[1600]. K12 uses rounds 12-23 (the last 12).
// Stored as [low32, high32] pairs since JS doesn't have native uint64.
var RNDC = [
  [0x8000808b, 0x00000000], [0x0000008b, 0x80000000],
  [0x00008089, 0x80000000], [0x00008003, 0x80000000],
  [0x00008002, 0x80000000], [0x00000080, 0x80000000],
  [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
  [0x80008081, 0x80000000], [0x00008080, 0x80000000],
  [0x80000001, 0x00000000], [0x80008008, 0x80000000]
]

// 64-bit operations using [lo, hi] pairs
function xor64 (a, b) {
  return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0]
}

function and64 (a, b) {
  return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0]
}

function not64 (a) {
  return [(~a[0]) >>> 0, (~a[1]) >>> 0]
}

function rotl64 (a, n) {
  if (n === 0) return [a[0], a[1]]
  if (n < 32) {
    return [
      ((a[0] << n) | (a[1] >>> (32 - n))) >>> 0,
      ((a[1] << n) | (a[0] >>> (32 - n))) >>> 0
    ]
  }
  if (n === 32) return [a[1], a[0]]
  n -= 32
  return [
    ((a[1] << n) | (a[0] >>> (32 - n))) >>> 0,
    ((a[0] << n) | (a[1] >>> (32 - n))) >>> 0
  ]
}

function keccakP12 (st) {
  for (var round = 0; round < 12; round++) {
    var bc0, bc1, bc2, bc3, bc4, t

    // Theta
    bc0 = xor64(xor64(xor64(xor64(st[0], st[5]), st[10]), st[15]), st[20])
    bc1 = xor64(xor64(xor64(xor64(st[1], st[6]), st[11]), st[16]), st[21])
    bc2 = xor64(xor64(xor64(xor64(st[2], st[7]), st[12]), st[17]), st[22])
    bc3 = xor64(xor64(xor64(xor64(st[3], st[8]), st[13]), st[18]), st[23])
    bc4 = xor64(xor64(xor64(xor64(st[4], st[9]), st[14]), st[19]), st[24])

    t = xor64(bc4, rotl64(bc1, 1)); st[0] = xor64(st[0], t); st[5] = xor64(st[5], t); st[10] = xor64(st[10], t); st[15] = xor64(st[15], t); st[20] = xor64(st[20], t)
    t = xor64(bc0, rotl64(bc2, 1)); st[1] = xor64(st[1], t); st[6] = xor64(st[6], t); st[11] = xor64(st[11], t); st[16] = xor64(st[16], t); st[21] = xor64(st[21], t)
    t = xor64(bc1, rotl64(bc3, 1)); st[2] = xor64(st[2], t); st[7] = xor64(st[7], t); st[12] = xor64(st[12], t); st[17] = xor64(st[17], t); st[22] = xor64(st[22], t)
    t = xor64(bc2, rotl64(bc4, 1)); st[3] = xor64(st[3], t); st[8] = xor64(st[8], t); st[13] = xor64(st[13], t); st[18] = xor64(st[18], t); st[23] = xor64(st[23], t)
    t = xor64(bc3, rotl64(bc0, 1)); st[4] = xor64(st[4], t); st[9] = xor64(st[9], t); st[14] = xor64(st[14], t); st[19] = xor64(st[19], t); st[24] = xor64(st[24], t)

    // Rho Pi (sequential chain — mirrors C++ implementation exactly)
    t = st[1]
    bc0 = st[10]; st[10] = rotl64(t, 1); t = bc0
    bc0 = st[7]; st[7] = rotl64(t, 3); t = bc0
    bc0 = st[11]; st[11] = rotl64(t, 6); t = bc0
    bc0 = st[17]; st[17] = rotl64(t, 10); t = bc0
    bc0 = st[18]; st[18] = rotl64(t, 15); t = bc0
    bc0 = st[3]; st[3] = rotl64(t, 21); t = bc0
    bc0 = st[5]; st[5] = rotl64(t, 28); t = bc0
    bc0 = st[16]; st[16] = rotl64(t, 36); t = bc0
    bc0 = st[8]; st[8] = rotl64(t, 45); t = bc0
    bc0 = st[21]; st[21] = rotl64(t, 55); t = bc0
    bc0 = st[24]; st[24] = rotl64(t, 2); t = bc0
    bc0 = st[4]; st[4] = rotl64(t, 14); t = bc0
    bc0 = st[15]; st[15] = rotl64(t, 27); t = bc0
    bc0 = st[23]; st[23] = rotl64(t, 41); t = bc0
    bc0 = st[19]; st[19] = rotl64(t, 56); t = bc0
    bc0 = st[13]; st[13] = rotl64(t, 8); t = bc0
    bc0 = st[12]; st[12] = rotl64(t, 25); t = bc0
    bc0 = st[2]; st[2] = rotl64(t, 43); t = bc0
    bc0 = st[20]; st[20] = rotl64(t, 62); t = bc0
    bc0 = st[14]; st[14] = rotl64(t, 18); t = bc0
    bc0 = st[22]; st[22] = rotl64(t, 39); t = bc0
    bc0 = st[9]; st[9] = rotl64(t, 61); t = bc0
    bc0 = st[6]; st[6] = rotl64(t, 20); t = bc0
    st[1] = rotl64(t, 44)

    // Chi Iota
    bc0 = st[0]; bc1 = st[1]; bc2 = st[2]; bc3 = st[3]; bc4 = st[4]
    st[0] = xor64(xor64(bc0, and64(not64(bc1), bc2)), RNDC[round])
    st[1] = xor64(bc1, and64(not64(bc2), bc3))
    st[2] = xor64(bc2, and64(not64(bc3), bc4))
    st[3] = xor64(bc3, and64(not64(bc4), bc0))
    st[4] = xor64(bc4, and64(not64(bc0), bc1))
    bc0 = st[5]; bc1 = st[6]; bc2 = st[7]; bc3 = st[8]; bc4 = st[9]
    st[5] = xor64(bc0, and64(not64(bc1), bc2))
    st[6] = xor64(bc1, and64(not64(bc2), bc3))
    st[7] = xor64(bc2, and64(not64(bc3), bc4))
    st[8] = xor64(bc3, and64(not64(bc4), bc0))
    st[9] = xor64(bc4, and64(not64(bc0), bc1))
    bc0 = st[10]; bc1 = st[11]; bc2 = st[12]; bc3 = st[13]; bc4 = st[14]
    st[10] = xor64(bc0, and64(not64(bc1), bc2))
    st[11] = xor64(bc1, and64(not64(bc2), bc3))
    st[12] = xor64(bc2, and64(not64(bc3), bc4))
    st[13] = xor64(bc3, and64(not64(bc4), bc0))
    st[14] = xor64(bc4, and64(not64(bc0), bc1))
    bc0 = st[15]; bc1 = st[16]; bc2 = st[17]; bc3 = st[18]; bc4 = st[19]
    st[15] = xor64(bc0, and64(not64(bc1), bc2))
    st[16] = xor64(bc1, and64(not64(bc2), bc3))
    st[17] = xor64(bc2, and64(not64(bc3), bc4))
    st[18] = xor64(bc3, and64(not64(bc4), bc0))
    st[19] = xor64(bc4, and64(not64(bc0), bc1))
    bc0 = st[20]; bc1 = st[21]; bc2 = st[22]; bc3 = st[23]; bc4 = st[24]
    st[20] = xor64(bc0, and64(not64(bc1), bc2))
    st[21] = xor64(bc1, and64(not64(bc2), bc3))
    st[22] = xor64(bc2, and64(not64(bc3), bc4))
    st[23] = xor64(bc3, and64(not64(bc4), bc0))
    st[24] = xor64(bc4, and64(not64(bc0), bc1))
  }
}

function readLE64 (buf, offset) {
  var lo = (buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16) | (buf[offset + 3] << 24)) >>> 0
  var hi = (buf[offset + 4] | (buf[offset + 5] << 8) | (buf[offset + 6] << 16) | (buf[offset + 7] << 24)) >>> 0
  return [lo, hi]
}

function writeLE64 (buf, offset, val) {
  buf[offset] = val[0] & 0xff
  buf[offset + 1] = (val[0] >>> 8) & 0xff
  buf[offset + 2] = (val[0] >>> 16) & 0xff
  buf[offset + 3] = (val[0] >>> 24) & 0xff
  buf[offset + 4] = val[1] & 0xff
  buf[offset + 5] = (val[1] >>> 8) & 0xff
  buf[offset + 6] = (val[1] >>> 16) & 0xff
  buf[offset + 7] = (val[1] >>> 24) & 0xff
}

function k12 (buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf)
  }

  // Initialize state
  var st = new Array(25)
  for (var i = 0; i < 25; i++) {
    st[i] = [0, 0]
  }
  var buffer = new Uint8Array(RATE)
  var bufPos = 0

  // Absorb input
  var offset = 0
  var remaining = buf.length

  while (remaining > 0) {
    var space = RATE - bufPos
    var take = remaining < space ? remaining : space
    for (var j = 0; j < take; j++) {
      buffer[bufPos + j] = buf[offset + j]
    }
    bufPos += take
    offset += take
    remaining -= take

    if (bufPos === RATE) {
      for (var k = 0; k < RATE / 8; k++) {
        st[k] = xor64(st[k], readLE64(buffer, 8 * k))
      }
      keccakP12(st)
      bufPos = 0
      buffer = new Uint8Array(RATE)
    }
  }

  // Append K12 length_encode(0) = {0x00} for empty custom string
  buffer[bufPos] = 0x00
  bufPos++

  if (bufPos === RATE) {
    for (var k2 = 0; k2 < RATE / 8; k2++) {
      st[k2] = xor64(st[k2], readLE64(buffer, 8 * k2))
    }
    keccakP12(st)
    bufPos = 0
    buffer = new Uint8Array(RATE)
  }

  // Pad with K12 domain separator
  buffer[bufPos] = 0x07
  buffer[RATE - 1] |= 0x80

  // XOR padded buffer into state
  for (var k3 = 0; k3 < RATE / 8; k3++) {
    st[k3] = xor64(st[k3], readLE64(buffer, 8 * k3))
  }

  // Final permutation
  keccakP12(st)

  // Squeeze 32 bytes
  var result = Buffer.alloc(32)
  for (var w = 0; w < 4; w++) {
    writeLE64(result, 8 * w, st[w])
  }
  return result
}

module.exports = k12
