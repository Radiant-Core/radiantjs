'use strict'

/**
 * Glyph v2 Encoder
 *
 * Functions for encoding Glyph metadata and envelopes.
 *
 * Wire format: CBOR (RFC 8949). The whitepaper §B requires canonical CBOR
 * (lexicographic key order, minimal int encoding, definite-length items)
 * but the deployed reality across Photonic-Wallet, Glyph-miner, and the
 * RXinDexer indexer is bare `cbor-x.encode(payload)` with insertion-order
 * keys. Match that exactly so commit hashes interoperate with the rest of
 * the ecosystem. Callers that want canonical-CBOR-style determinism should
 * pass an already-key-sorted object (see `canonicalizeObject`).
 *
 * Legacy JSON encoding is retained behind `encoder.useJson = true` for
 * tests and tools that still consume v1 / pre-2.0.4 radiantjs output.
 */

const Buffer = require('../util/bufferUtil')
const Hash = require('../crypto/hash')
const BufferWriter = require('../encoding/bufferwriter')
const { GLYPH_MAGIC, GlyphVersion, EnvelopeFlags, ENVELOPE_FLAGS_MASK, GlyphLimits } = require('./constants')

// Flip to `true` to fall back to JSON encoding (legacy / non-interop).
let useJson = false

// Lazy-loaded cbor-x. cbor-x's package.json exports map resolves to native
// bindings in some bundler configurations; deferring the require keeps the
// browser UMD bundle from pulling those native paths in. Consumers that
// never touch Glyph metadata don't pay the load cost either.
let _cbor = null
function getCbor () {
  if (!_cbor) _cbor = require('cbor-x')
  return _cbor
}

/**
 * Encode metadata object to CBOR bytes (canonical wire format) or JSON bytes
 * (legacy fallback if `encoder.useJson` is set).
 *
 * @param {Object} metadata - Glyph metadata object
 * @returns {Buffer} Encoded metadata bytes (CBOR by default)
 */
function encodeMetadata(metadata) {
  // Shallow copy so we don't mutate the caller's object when defaulting the
  // version field; encoding twice would otherwise change the input on the
  // first call and silently no-op on the second.
  const meta = metadata.v ? metadata : Object.assign({}, metadata, { v: GlyphVersion.V2 })
  if (useJson) {
    const canonical = canonicalizeObject(meta)
    return Buffer.from(JSON.stringify(canonical), 'utf8')
  }
  // cbor-x returns a Uint8Array; wrap as Buffer for consistency with the
  // rest of the lib (downstream code uses Buffer.concat etc.).
  return Buffer.from(getCbor().encode(meta))
}

/**
 * Recursively sort object keys for canonical encoding
 * 
 * @param {*} obj - Object to canonicalize
 * @returns {*} Canonicalized object
 */
// Maximum recursion depth for canonicalizeObject. Glyph metadata is shallow
// by design (a few nested objects); 32 is far more than legitimate use needs
// and keeps an attacker from blowing V8's stack with deeply nested JSON.
const MAX_CANONICAL_DEPTH = 32

function canonicalizeObject(obj, depth) {
  if (depth === undefined) depth = 0
  if (depth > MAX_CANONICAL_DEPTH) {
    throw new Error('Glyph encoder: nested object depth exceeds ' + MAX_CANONICAL_DEPTH)
  }
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(function (v) { return canonicalizeObject(v, depth + 1) })
  }
  const sortedKeys = Object.keys(obj).sort()
  const result = {}
  for (const key of sortedKeys) {
    result[key] = canonicalizeObject(obj[key], depth + 1)
  }
  return result
}

/**
 * Compute the consensus commit hash for a Glyph metadata blob.
 *
 * Returns SHA256(SHA256(canonical_metadata_bytes)) - i.e. `OP_HASH256` of
 * the metadata. The Photonic-Wallet commit script embeds this value and
 * the Radiant-Node interpreter validates the reveal against it via
 * `OP_HASH256 <commitHash> OP_EQUALVERIFY`. A single-SHA-256 commit will
 * be rejected on broadcast.
 *
 * @param {Object|Buffer} metadata - Metadata object or pre-encoded bytes
 * @returns {Buffer} 32-byte double-SHA-256 digest
 */
function computeCommitHash(metadata) {
  const bytes = Buffer.isBuffer(metadata) ? metadata : encodeMetadata(metadata)
  return Hash.sha256sha256(bytes)
}

/**
 * Encode commit envelope (Style A - OP_RETURN)
 * 
 * @param {Object} options - Envelope options
 * @param {Buffer} options.commitHash - Commit hash
 * @param {number} [options.flags=0] - Envelope flags
 * @param {Buffer} [options.contentRoot] - Optional content merkle root
 * @param {Buffer} [options.controller] - Optional controller ref
 * @returns {Buffer} Commit envelope script
 */
function encodeCommitEnvelope(options) {
  const { commitHash, flags = 0, contentRoot, controller } = options
  
  if (!commitHash || commitHash.length !== 32) {
    throw new Error('Invalid commit hash')
  }
  
  const writer = new BufferWriter()
  
  // Magic bytes
  writer.write(GLYPH_MAGIC)
  
  // Version
  writer.writeUInt8(GlyphVersion.V2)
  
  // Flags. Bits 3-6 are reserved per Whitepaper §7.3 and must be zero;
  // mask any caller-supplied values that wander into the reserved range.
  let actualFlags = flags & ENVELOPE_FLAGS_MASK
  if (contentRoot) actualFlags |= EnvelopeFlags.HAS_CONTENT_ROOT
  if (controller) actualFlags |= EnvelopeFlags.HAS_CONTROLLER
  writer.writeUInt8(actualFlags)
  
  // Commit hash
  writer.write(commitHash)
  
  // Optional content root
  if (contentRoot) {
    writer.write(contentRoot)
  }
  
  // Optional controller
  if (controller) {
    writer.write(controller)
  }
  
  return writer.toBuffer()
}

/**
 * Encode reveal envelope (Style A - OP_RETURN)
 * 
 * @param {Object} options - Envelope options
 * @param {Object|Buffer} options.metadata - Metadata object or bytes
 * @param {Buffer[]} [options.files] - Optional inline file chunks
 * @returns {Buffer[]} Array of pushdata buffers for OP_RETURN
 */
function encodeRevealEnvelope(options) {
  const { metadata, files = [] } = options
  
  const metadataBytes = Buffer.isBuffer(metadata) ? metadata : encodeMetadata(metadata)
  
  if (metadataBytes.length > GlyphLimits.MAX_METADATA_SIZE) {
    throw new Error(`Metadata exceeds maximum size of ${GlyphLimits.MAX_METADATA_SIZE} bytes`)
  }
  
  const chunks = []
  
  // Header chunk: magic + version + reveal flag
  const header = Buffer.concat([
    GLYPH_MAGIC,
    Buffer.from([GlyphVersion.V2, EnvelopeFlags.IS_REVEAL])
  ])
  chunks.push(header)
  
  // Metadata chunk
  chunks.push(metadataBytes)
  
  // File chunks
  for (const file of files) {
    if (file.length > GlyphLimits.MAX_INLINE_FILE_SIZE) {
      throw new Error(`File exceeds maximum inline size of ${GlyphLimits.MAX_INLINE_FILE_SIZE} bytes`)
    }
    chunks.push(file)
  }
  
  return chunks
}

/**
 * Build OP_RETURN script from reveal envelope chunks
 * 
 * @param {Buffer[]} chunks - Envelope chunks
 * @returns {Buffer} Complete OP_RETURN script
 */
function buildRevealScript(chunks) {
  const Script = require('../script')
  const script = new Script()
  
  script.add('OP_FALSE')
  script.add('OP_RETURN')
  
  for (const chunk of chunks) {
    script.add(chunk)
  }
  
  return script.toBuffer()
}

/**
 * Encode reveal envelope Style B (OP_3 chunked for large payloads)
 * 
 * @param {Object} options - Envelope options
 * @param {Object|Buffer} options.metadata - Metadata object or bytes
 * @param {Buffer[]} [options.files] - Optional inline file chunks
 * @returns {Buffer[]} Array of pushdata buffers for OP_3 script
 */
function encodeRevealEnvelopeB(options) {
  const { metadata, files = [] } = options
  
  const metadataBytes = Buffer.isBuffer(metadata) ? metadata : encodeMetadata(metadata)
  
  const chunks = []
  
  // Magic as separate push
  chunks.push(GLYPH_MAGIC)
  
  // Metadata
  chunks.push(metadataBytes)
  
  // Files
  for (const file of files) {
    chunks.push(file)
  }
  
  return chunks
}

module.exports = {
  encodeMetadata,
  canonicalizeObject,
  computeCommitHash,
  encodeCommitEnvelope,
  encodeRevealEnvelope,
  encodeRevealEnvelopeB,
  buildRevealScript,
  createRevealEnvelope: function (metadata) {
    return encodeRevealEnvelope({ metadata })
  },
  // Toggle between CBOR (default, interop with Photonic-Wallet and indexers)
  // and legacy JSON encoding. Production code should leave this false.
  get useJson () { return useJson },
  set useJson (v) { useJson = !!v }
}
