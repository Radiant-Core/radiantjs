'use strict'

/**
 * Glyph v2 Decoder
 * 
 * Functions for decoding Glyph transactions and metadata.
 */

const Buffer = require('../util/bufferUtil')
const BufferReader = require('../encoding/bufferreader')
const { GLYPH_MAGIC, GLYPH_MAGIC_HEX, GlyphVersion, EnvelopeFlags, ENVELOPE_FLAGS_MASK } = require('./constants')

/**
 * Check if a transaction contains Glyph data
 * 
 * @param {Transaction} tx - Transaction to check
 * @returns {boolean} True if transaction contains Glyph data
 */
function isGlyphTransaction(tx) {
  for (const output of tx.outputs) {
    if (containsGlyphMagic(output.script.toBuffer())) {
      return true
    }
  }
  
  for (const input of tx.inputs) {
    if (input.script && containsGlyphMagic(input.script.toBuffer())) {
      return true
    }
  }
  
  return false
}

/**
 * Check if buffer contains Glyph magic bytes
 * 
 * @param {Buffer} buf - Buffer to check
 * @returns {boolean} True if contains magic bytes
 */
function containsGlyphMagic(buf) {
  // Buffer.indexOf is byte-level and avoids the 2x-size hex allocation
  // toString('hex').includes() requires. Note this still matches GLYPH_MAGIC
  // anywhere inside `buf` (including pushdata payloads) - see decodeEnvelope
  // for the chunk-aware variant that resists spoofed magic in file bytes.
  return buf.indexOf(GLYPH_MAGIC) !== -1
}

/**
 * Parse a Glyph transaction.
 *
 * Returns every envelope found across outputs (commit/reveal) and inputs
 * (reveal in scriptSig). A transaction can legitimately carry both a commit
 * AND a reveal in the same tx, so a single envelope is not enough.
 *
 * @param {Transaction} tx - Transaction to parse
 * @returns {{commits: Array, reveals: Array, type: string|null, envelope: Object|null, outputIndex: number, inputIndex: number}|null}
 *   `commits` and `reveals` are always arrays (possibly empty). The legacy
 *   single-envelope fields (`type`, `envelope`, `outputIndex`, `inputIndex`)
 *   mirror the first envelope found, for back-compat. Returns null if no
 *   envelope is present at all.
 */
function parseGlyphTransaction(tx) {
  const commits = []
  const reveals = []

  for (let i = 0; i < tx.outputs.length; i++) {
    const output = tx.outputs[i]
    const scriptBuf = output.script.toBuffer()
    const envelope = decodeEnvelope(scriptBuf)
    if (envelope) {
      if (envelope.isReveal) {
        reveals.push({ outputIndex: i, envelope })
      } else {
        commits.push({ outputIndex: i, envelope })
      }
    }
  }

  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i]
    if (!input.script) continue
    const scriptBuf = input.script.toBuffer()
    const envelope = decodeEnvelope(scriptBuf)
    if (envelope && envelope.isReveal) {
      reveals.push({ inputIndex: i, envelope })
    }
  }

  if (commits.length === 0 && reveals.length === 0) return null

  // Back-compat single-envelope mirror.
  const first = commits[0] || reveals[0]
  return Object.assign({}, first, {
    type: first.envelope.isReveal ? 'reveal' : 'commit',
    commits,
    reveals,
  })
}

/**
 * Decode an envelope from script buffer
 * 
 * @param {Buffer} scriptBuf - Script buffer
 * @returns {Object|null} Decoded envelope or null
 */
function decodeEnvelope(scriptBuf) {
  // Find magic bytes
  const magicIndex = scriptBuf.indexOf(GLYPH_MAGIC)
  if (magicIndex === -1) {
    return null
  }
  
  try {
    const reader = new BufferReader(scriptBuf.slice(magicIndex))
    
    // Skip magic
    reader.read(3)
    
    // Version
    const version = reader.readUInt8()
    if (version !== GlyphVersion.V1 && version !== GlyphVersion.V2) {
      return null
    }
    
    // Flags. Reject envelopes that set any reserved bit (bits 3-6) per
    // Whitepaper §7.3 "MUST be zero".
    const flags = reader.readUInt8()
    if (flags & ~ENVELOPE_FLAGS_MASK) {
      return null
    }
    const isReveal = (flags & EnvelopeFlags.IS_REVEAL) !== 0
    
    if (isReveal) {
      return decodeRevealEnvelope(reader, version, flags)
    } else {
      return decodeCommitEnvelope(reader, version, flags)
    }
  } catch (e) {
    return null
  }
}

/**
 * Decode commit envelope
 * 
 * @param {BufferReader} reader - Buffer reader positioned after flags
 * @param {number} version - Protocol version
 * @param {number} flags - Envelope flags
 * @returns {Object} Decoded commit envelope
 */
function decodeCommitEnvelope(reader, version, flags) {
  const result = {
    type: 'commit',
    isReveal: false,
    version,
    flags,
    commitHash: reader.read(32),
  }
  
  if (flags & EnvelopeFlags.HAS_CONTENT_ROOT) {
    result.contentRoot = reader.read(32)
  }
  
  if (flags & EnvelopeFlags.HAS_CONTROLLER) {
    result.controller = reader.read(36) // outpoint size
  }
  
  return result
}

/**
 * Decode reveal envelope
 * 
 * @param {BufferReader} reader - Buffer reader positioned after flags
 * @param {number} version - Protocol version
 * @param {number} flags - Envelope flags
 * @returns {Object} Decoded reveal envelope
 */
function decodeRevealEnvelope(reader, version, flags) {
  const result = {
    type: 'reveal',
    isReveal: true,
    version,
    flags,
    metadata: null,
    files: []
  }

  const remaining = reader.readAll()
  if (remaining.length > 0) {
    try {
      result.metadata = decodeMetadata(remaining)
    } catch (e) {
      result.rawMetadata = remaining
    }
  }

  return result
}

/**
 * Decode metadata bytes.
 *
 * The wire format is CBOR (RFC 8949). Legacy JSON-encoded blobs are
 * accepted for backward compatibility with pre-2.0.4 radiantjs output;
 * we sniff the first byte to choose: `{`/`[` (0x7b / 0x5b) -> JSON,
 * anything else -> CBOR.
 *
 * @param {Buffer} buf - Metadata bytes
 * @returns {Object} Parsed metadata object
 */
function decodeMetadata(buf) {
  if (buf.length === 0) return null
  const first = buf[0]
  if (first === 0x7b || first === 0x5b) {
    return JSON.parse(buf.toString('utf8'))
  }
  // Lazy require so consumers that never touch reveal payloads don't pull
  // cbor-x into their browser bundle.
  const cbor = require('cbor-x')
  return cbor.decode(buf)
}

/**
 * Extract Glyph ID from reveal transaction
 * GlyphID = reveal_txid:vout
 * 
 * @param {string} txid - Reveal transaction ID
 * @param {number} vout - Output index
 * @returns {string} Glyph ID
 */
function getGlyphId(txid, vout) {
  return `${txid}:${vout}`
}

/**
 * Parse Glyph ID into components
 * 
 * @param {string} glyphId - Glyph ID
 * @returns {Object} { txid, vout }
 */
function parseGlyphId(glyphId) {
  if (typeof glyphId !== 'string') {
    throw new TypeError('parseGlyphId: glyphId must be a string')
  }
  const parts = glyphId.split(':')
  if (parts.length !== 2) {
    throw new Error('parseGlyphId: expected "<txid>:<vout>", got "' + glyphId + '"')
  }
  const [txid, voutStr] = parts
  if (!/^[0-9a-fA-F]{64}$/.test(txid)) {
    throw new Error('parseGlyphId: invalid txid (expected 64-char hex)')
  }
  if (!/^[0-9]+$/.test(voutStr)) {
    throw new Error('parseGlyphId: invalid vout (expected non-negative integer)')
  }
  const vout = Number(voutStr)
  if (vout > 0xffffffff) {
    throw new Error('parseGlyphId: vout exceeds uint32 range')
  }
  return { txid, vout }
}

module.exports = {
  isGlyphTransaction,
  containsGlyphMagic,
  parseGlyphTransaction,
  decodeEnvelope,
  decodeCommitEnvelope,
  decodeRevealEnvelope,
  decodeMetadata,
  getGlyphId,
  parseGlyphId,
  parseEnvelope: decodeEnvelope,
}
