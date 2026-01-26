'use strict'

/**
 * Glyph v2 Decoder
 * 
 * Functions for decoding Glyph transactions and metadata.
 */

const BufferReader = require('../encoding/bufferreader')
const { GLYPH_MAGIC, GLYPH_MAGIC_HEX, GlyphVersion, EnvelopeFlags } = require('./constants')

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
  const hex = buf.toString('hex')
  return hex.includes(GLYPH_MAGIC_HEX)
}

/**
 * Parse a Glyph transaction
 * 
 * @param {Transaction} tx - Transaction to parse
 * @returns {Object|null} Parsed Glyph data or null
 */
function parseGlyphTransaction(tx) {
  // Check outputs for commit or reveal (Style A)
  for (let i = 0; i < tx.outputs.length; i++) {
    const output = tx.outputs[i]
    const scriptBuf = output.script.toBuffer()
    
    const envelope = decodeEnvelope(scriptBuf)
    if (envelope) {
      return {
        type: envelope.isReveal ? 'reveal' : 'commit',
        outputIndex: i,
        envelope,
      }
    }
  }
  
  // Check inputs for reveal data (Style A/B in scriptSig)
  for (let i = 0; i < tx.inputs.length; i++) {
    const input = tx.inputs[i]
    if (!input.script) continue
    
    const scriptBuf = input.script.toBuffer()
    const envelope = decodeEnvelope(scriptBuf)
    if (envelope && envelope.isReveal) {
      return {
        type: 'reveal',
        inputIndex: i,
        envelope,
      }
    }
  }
  
  return null
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
    
    // Flags
    const flags = reader.readUInt8()
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
    files: [],
  }
  
  // Remaining buffer should contain pushdata chunks
  // The first is metadata, rest are files
  const remaining = reader.readAll()
  
  if (remaining.length > 0) {
    // Try to parse as JSON metadata
    try {
      const metadataJson = remaining.toString('utf8')
      result.metadata = JSON.parse(metadataJson)
    } catch (e) {
      // If JSON parse fails, store raw bytes
      result.rawMetadata = remaining
    }
  }
  
  return result
}

/**
 * Decode metadata from bytes
 * 
 * @param {Buffer} buf - Metadata bytes (JSON)
 * @returns {Object} Parsed metadata object
 */
function decodeMetadata(buf) {
  const jsonStr = buf.toString('utf8')
  return JSON.parse(jsonStr)
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
  const [txid, voutStr] = glyphId.split(':')
  return {
    txid,
    vout: parseInt(voutStr, 10),
  }
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
}
