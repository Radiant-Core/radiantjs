'use strict'

/**
 * Glyph v2 Token Standard Module
 * 
 * Provides encoding/decoding functionality for Glyph v2 tokens
 * on the Radiant blockchain.
 * 
 * @see https://github.com/Radiant-Core/Glyph-Token-Standards
 */

const constants = require('./constants')
const encoder = require('./encoder')
const decoder = require('./decoder')
const validator = require('./validator')

module.exports = {
  // Constants (flat)
  ...constants,
  
  // Encoding (flat)
  encodeMetadata: encoder.encodeMetadata,
  encodeCommitEnvelope: encoder.encodeCommitEnvelope,
  encodeRevealEnvelope: encoder.encodeRevealEnvelope,
  createRevealEnvelope: encoder.encodeRevealEnvelope,
  
  // Decoding (flat)
  decodeMetadata: decoder.decodeMetadata,
  decodeEnvelope: decoder.decodeEnvelope,
  parseEnvelope: decoder.decodeEnvelope,
  parseGlyphTransaction: decoder.parseGlyphTransaction,
  
  // Validation (flat)
  validateMetadata: validator.validateMetadata,
  validateProtocols: validator.validateProtocols,
  isValidGlyph: validator.isValidGlyph,
  getTokenType: validator.getTokenType,
  isFungible: validator.isFungible,
  isDmint: validator.isDmint,
  isMutable: validator.isMutable,
  isContainer: validator.isContainer,
  isEncrypted: validator.isEncrypted,
  
  // Utilities (flat)
  computeCommitHash: encoder.computeCommitHash,
  isGlyphTransaction: decoder.isGlyphTransaction,

  // Sub-modules (nested access)
  constants,
  encoder,
  decoder,
  validator,
}
