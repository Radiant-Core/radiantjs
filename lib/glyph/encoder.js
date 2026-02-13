'use strict'

/**
 * Glyph v2 Encoder
 * 
 * Functions for encoding Glyph metadata and envelopes.
 */

const Hash = require('../crypto/hash')
const BufferWriter = require('../encoding/bufferwriter')
const { GLYPH_MAGIC, GlyphVersion, EnvelopeFlags, GlyphLimits } = require('./constants')

/**
 * Encode metadata object to canonical JSON bytes
 * 
 * @param {Object} metadata - Glyph metadata object
 * @returns {Buffer} Canonical JSON bytes
 */
function encodeMetadata(metadata) {
  // Ensure version is set
  if (!metadata.v) {
    metadata.v = GlyphVersion.V2
  }
  
  // Sort keys for canonical encoding
  const canonical = canonicalizeObject(metadata)
  const jsonStr = JSON.stringify(canonical)
  return Buffer.from(jsonStr, 'utf8')
}

/**
 * Recursively sort object keys for canonical encoding
 * 
 * @param {*} obj - Object to canonicalize
 * @returns {*} Canonicalized object
 */
function canonicalizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeObject)
  }
  
  const sortedKeys = Object.keys(obj).sort()
  const result = {}
  for (const key of sortedKeys) {
    result[key] = canonicalizeObject(obj[key])
  }
  return result
}

/**
 * Compute commit hash from metadata
 * 
 * @param {Object|Buffer} metadata - Metadata object or canonical bytes
 * @returns {Buffer} SHA256 hash
 */
function computeCommitHash(metadata) {
  const bytes = Buffer.isBuffer(metadata) ? metadata : encodeMetadata(metadata)
  return Hash.sha256(bytes)
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
  
  // Flags
  let actualFlags = flags
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
  createRevealEnvelope: function(metadata) {
    return encodeRevealEnvelope({ metadata })
  },
}
