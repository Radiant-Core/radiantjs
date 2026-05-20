'use strict'
//
// KangarooTwelve (K12) hash for Radiant — delegates to @noble/hashes.
//
// The previous hand-rolled implementation was correct for inputs that fit
// inside K12's initial chunk (≤ 8191 bytes) but diverged from the
// Radiant-Core C++ implementation once K12's tree-hashing mode kicked in
// at larger inputs. To eliminate this class of subtle multi-chunk bugs in
// hand-rolled crypto, the implementation now delegates to @noble/hashes,
// which is audited and matches the C++ reference across all sizes.
//
const Buffer = require('../util/bufferUtil')
const { k12: nobleK12 } = require('@noble/hashes/sha3-addons')

function k12 (buf) {
  if (!Buffer.isBuffer(buf)) {
    buf = Buffer.from(buf)
  }
  return Buffer.from(nobleK12(buf, { dkLen: 32 }))
}

module.exports = k12
