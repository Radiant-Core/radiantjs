'use strict'

/**
 * Glyph v2 Constants
 * 
 * Protocol constants for the Glyph v2 token standard.
 */

/**
 * Magic bytes identifying Glyph transactions
 */
const GLYPH_MAGIC = Buffer.from('gly', 'ascii')
const GLYPH_MAGIC_HEX = '676c79'

/**
 * Glyph protocol versions
 */
const GlyphVersion = {
  V1: 0x01,
  V2: 0x02,
}

/**
 * Glyph Protocol IDs
 */
const GlyphProtocol = {
  GLYPH_FT: 1,           // Fungible Token
  GLYPH_NFT: 2,          // Non-Fungible Token
  GLYPH_DAT: 3,          // Data Storage
  GLYPH_DMINT: 4,        // Decentralized Minting
  GLYPH_MUT: 5,          // Mutable State
  GLYPH_BURN: 6,         // Explicit Burn
  GLYPH_CONTAINER: 7,    // Container/Collection
  GLYPH_ENCRYPTED: 8,    // Encrypted Content
  GLYPH_TIMELOCK: 9,     // Timelocked Reveal
  GLYPH_AUTHORITY: 10,   // Issuer Authority
  GLYPH_WAVE: 11,        // WAVE Naming
}

/**
 * Protocol names for display
 */
const ProtocolNames = {
  1: 'Fungible Token',
  2: 'Non-Fungible Token',
  3: 'Data Storage',
  4: 'Decentralized Minting',
  5: 'Mutable State',
  6: 'Burn',
  7: 'Container',
  8: 'Encrypted',
  9: 'Timelock',
  10: 'Authority',
  11: 'WAVE Name',
}

/**
 * dMint POW Algorithm IDs
 */
const DmintAlgorithm = {
  SHA256D: 0x00,
  BLAKE3: 0x01,
  K12: 0x02,
  ARGON2ID_LIGHT: 0x03,
  RANDOMX_LIGHT: 0x04,
}

/**
 * DAA Mode IDs
 */
const DaaMode = {
  FIXED: 0x00,
  EPOCH: 0x01,
  ASERT: 0x02,
  LWMA: 0x03,
  SCHEDULE: 0x04,
}

/**
 * Envelope flags
 */
const EnvelopeFlags = {
  HAS_CONTENT_ROOT: 1 << 0,
  HAS_CONTROLLER: 1 << 1,
  HAS_PROFILE_HINT: 1 << 2,
  IS_REVEAL: 1 << 7,
}

/**
 * Size limits
 */
const GlyphLimits = {
  MAX_NAME_SIZE: 256,
  MAX_DESC_SIZE: 4096,
  MAX_PATH_SIZE: 512,
  MAX_MIME_SIZE: 128,
  MAX_METADATA_SIZE: 262144,
  MAX_COMMIT_ENVELOPE_SIZE: 102400,
  MAX_REVEAL_ENVELOPE_A_SIZE: 102400,
  MAX_REVEAL_ENVELOPE_B_SIZE: 12582912,
  MAX_UPDATE_ENVELOPE_SIZE: 65536,
  MAX_INLINE_FILE_SIZE: 1048576,
  MAX_TOTAL_INLINE_SIZE: 10485760,
  MAX_PROTOCOLS: 16,
}

/**
 * Container types
 */
const ContainerType = {
  COLLECTION: 'collection',
  ALBUM: 'album',
  BUNDLE: 'bundle',
  SERIES: 'series',
}

/**
 * Authority types
 */
const AuthorityType = {
  ISSUER: 'issuer',
  MANAGER: 'manager',
  DELEGATE: 'delegate',
  BADGE: 'badge',
}

/**
 * Storage types
 */
const StorageType = {
  INLINE: 'inline',
  REF: 'ref',
  IPFS: 'ipfs',
}

/**
 * Update operations
 */
const UpdateOperation = {
  REPLACE: 'replace',
  MERGE: 'merge',
  APPEND: 'append',
  REMOVE: 'remove',
}

/**
 * Default values
 */
const GlyphDefaults = {
  FT_DECIMALS: 8,
  BURN_CONFIRMATIONS: 6,
  ASERT_HALFLIFE: 3600,
  TARGET_MINT_TIME: 60,
  MAX_SUBDOMAIN_DEPTH: 5,
}

module.exports = {
  GLYPH_MAGIC,
  GLYPH_MAGIC_HEX,
  GlyphVersion,
  GlyphProtocol,
  ProtocolNames,
  DmintAlgorithm,
  DaaMode,
  EnvelopeFlags,
  GlyphLimits,
  ContainerType,
  AuthorityType,
  StorageType,
  UpdateOperation,
  GlyphDefaults,
  // Individual protocol IDs (convenience aliases)
  ...GlyphProtocol,
}
