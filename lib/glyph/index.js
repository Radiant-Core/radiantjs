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
  // Constants
  ...constants,
  
  // Encoding
  encodeMetadata: encoder.encodeMetadata,
  encodeCommitEnvelope: encoder.encodeCommitEnvelope,
  encodeRevealEnvelope: encoder.encodeRevealEnvelope,
  
  // Decoding
  decodeMetadata: decoder.decodeMetadata,
  decodeEnvelope: decoder.decodeEnvelope,
  parseGlyphTransaction: decoder.parseGlyphTransaction,
  
  // Validation
  validateMetadata: validator.validateMetadata,
  validateProtocols: validator.validateProtocols,
  isValidGlyph: validator.isValidGlyph,
  
  // Utilities
  computeCommitHash: encoder.computeCommitHash,
  isGlyphTransaction: decoder.isGlyphTransaction,
}
