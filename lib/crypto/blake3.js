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
// across all input sizes verified to date (empty through 8192+ bytes).
//
const Buffer = require('../util/bufferUtil')
const { blake3: nobleBlake3 } = require('@noble/hashes/blake3')

function blake3 (buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf)
  }
  // @noble returns a Uint8Array; wrap as Buffer to preserve the previous
  // return type (existing callers index/compare bytes either way).
  return Buffer.from(nobleBlake3(buf))
}

module.exports = blake3
