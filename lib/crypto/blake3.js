'use strict'
//
// BLAKE3 hash for Radiant — delegates to @noble/hashes/blake3.
//
// The previous hand-rolled implementation in this file was correct only for
// inputs of one BLAKE3 block (≤ 64 bytes). For longer inputs it incremented
// the BLAKE3 counter per-block instead of per-chunk, producing hashes that
// disagreed with the Radiant-Core C++ consensus implementation. The 72-byte
// dMint preimage was directly affected, which would have caused the JS
// script interpreter (used for simulation / verification in wallets and
// miners) to compute hashes that the consensus engine rejects.
//
// @noble/hashes is audited, widely used, and matches the C++ implementation
// across all input sizes verified to date.
//
const Buffer = require('../util/bufferUtil')
const { blake3: nobleBlake3 } = require('@noble/hashes/blake3')

function blake3 (buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf)
  }
  // Normalize to a plain Uint8Array view. @noble's `isBytes()` rejects some
  // Buffer subclasses in mixed-context environments (e.g. when caller passes
  // a `buffer/` polyfill Buffer from a jsdom test runner). A plain
  // Uint8Array view over the same memory always passes the check.
  const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  return Buffer.from(nobleBlake3(u8))
}

module.exports = blake3
