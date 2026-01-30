'use strict'

/**
 * Glyph v2 Validator
 * 
 * Functions for validating Glyph metadata and protocol combinations.
 */

const { 
  GlyphVersion,
  GlyphProtocol, 
  GlyphLimits,
  ProtocolNames,
} = require('./constants')

/**
 * Protocol requirements - which protocols require others
 */
const PROTOCOL_REQUIREMENTS = {
  [GlyphProtocol.GLYPH_DMINT]: [GlyphProtocol.GLYPH_FT],
  [GlyphProtocol.GLYPH_MUT]: [GlyphProtocol.GLYPH_NFT],
  [GlyphProtocol.GLYPH_CONTAINER]: [GlyphProtocol.GLYPH_NFT],
  [GlyphProtocol.GLYPH_ENCRYPTED]: [GlyphProtocol.GLYPH_NFT],
  [GlyphProtocol.GLYPH_TIMELOCK]: [GlyphProtocol.GLYPH_ENCRYPTED], // Timelock requires Encrypted (v2 spec Section 3.5)
  [GlyphProtocol.GLYPH_AUTHORITY]: [GlyphProtocol.GLYPH_NFT],
  [GlyphProtocol.GLYPH_WAVE]: [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT],
}

/**
 * Mutually exclusive protocols
 */
const PROTOCOL_EXCLUSIONS = [
  [GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_NFT],
]

/**
 * Protocols that cannot exist alone
 */
const PROTOCOLS_REQUIRE_BASE = [
  GlyphProtocol.GLYPH_DMINT,
  GlyphProtocol.GLYPH_MUT,
  GlyphProtocol.GLYPH_BURN, // BURN is an action marker
  GlyphProtocol.GLYPH_CONTAINER,
  GlyphProtocol.GLYPH_ENCRYPTED,
  GlyphProtocol.GLYPH_TIMELOCK,
  GlyphProtocol.GLYPH_AUTHORITY,
  GlyphProtocol.GLYPH_WAVE,
]

/**
 * Validate protocol combination
 * 
 * @param {number[]} protocols - Array of protocol IDs
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateProtocols(protocols) {
  if (!Array.isArray(protocols) || protocols.length === 0) {
    return { valid: false, error: 'Protocols array is required' }
  }
  
  if (protocols.length > GlyphLimits.MAX_PROTOCOLS) {
    return { valid: false, error: `Too many protocols (max ${GlyphLimits.MAX_PROTOCOLS})` }
  }
  
  // Check for mutually exclusive protocols
  for (const [a, b] of PROTOCOL_EXCLUSIONS) {
    if (protocols.includes(a) && protocols.includes(b)) {
      return {
        valid: false,
        error: `${ProtocolNames[a]} and ${ProtocolNames[b]} are mutually exclusive`,
      }
    }
  }
  
  // Check for required base protocols
  for (const protocol of protocols) {
    const requirements = PROTOCOL_REQUIREMENTS[protocol]
    if (requirements) {
      for (const required of requirements) {
        if (!protocols.includes(required)) {
          return {
            valid: false,
            error: `${ProtocolNames[protocol]} requires ${ProtocolNames[required]}`,
          }
        }
      }
    }
  }
  
  // Check for protocols that can't exist alone
  if (protocols.length === 1 && PROTOCOLS_REQUIRE_BASE.includes(protocols[0])) {
    return {
      valid: false,
      error: `${ProtocolNames[protocols[0]]} cannot exist alone`,
    }
  }
  
  // BURN must accompany FT or NFT (it's an action marker, not a token type)
  if (protocols.includes(GlyphProtocol.GLYPH_BURN)) {
    if (!protocols.includes(GlyphProtocol.GLYPH_FT) && !protocols.includes(GlyphProtocol.GLYPH_NFT)) {
      return {
        valid: false,
        error: 'Burn must accompany Fungible Token or Non-Fungible Token',
      }
    }
  }
  
  return { valid: true }
}

/**
 * Validate Glyph metadata object
 * 
 * @param {Object} metadata - Metadata object
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateMetadata(metadata) {
  const errors = []
  
  // Required fields
  if (!metadata.v || (metadata.v !== GlyphVersion.V1 && metadata.v !== GlyphVersion.V2)) {
    errors.push('Invalid or missing version (v)')
  }
  
  if (!metadata.type || typeof metadata.type !== 'string') {
    errors.push('Missing type field')
  }
  
  if (!metadata.p || !Array.isArray(metadata.p)) {
    errors.push('Missing protocols array (p)')
  } else {
    const protocolValidation = validateProtocols(metadata.p)
    if (!protocolValidation.valid) {
      errors.push(protocolValidation.error)
    }
  }
  
  // Size limits
  if (metadata.name && Buffer.byteLength(metadata.name, 'utf8') > GlyphLimits.MAX_NAME_SIZE) {
    errors.push(`Name exceeds ${GlyphLimits.MAX_NAME_SIZE} bytes`)
  }
  
  if (metadata.desc && Buffer.byteLength(metadata.desc, 'utf8') > GlyphLimits.MAX_DESC_SIZE) {
    errors.push(`Description exceeds ${GlyphLimits.MAX_DESC_SIZE} bytes`)
  }
  
  // Type-specific validation
  if (metadata.p) {
    const protocols = metadata.p
    
    // NFT requires content with primary
    if (protocols.includes(GlyphProtocol.GLYPH_NFT)) {
      if (!metadata.content || !metadata.content.primary) {
        errors.push('NFT requires content.primary')
      }
    }
    
    // FT requires ticker if no content
    if (protocols.includes(GlyphProtocol.GLYPH_FT)) {
      if (!metadata.content && !metadata.ticker) {
        errors.push('FT requires ticker if no content')
      }
    }
    
    // Container requires container object
    if (protocols.includes(GlyphProtocol.GLYPH_CONTAINER)) {
      if (!metadata.container) {
        errors.push('Container protocol requires container object')
      }
    }
    
    // dMint requires dmint config
    if (protocols.includes(GlyphProtocol.GLYPH_DMINT)) {
      if (!metadata.dmint) {
        errors.push('dMint protocol requires dmint configuration')
      }
    }
    
    // Authority requires authority object
    if (protocols.includes(GlyphProtocol.GLYPH_AUTHORITY)) {
      if (!metadata.authority) {
        errors.push('Authority protocol requires authority object')
      }
    }
    
    // Encrypted requires crypto object
    if (protocols.includes(GlyphProtocol.GLYPH_ENCRYPTED)) {
      if (!metadata.crypto) {
        errors.push('Encrypted protocol requires crypto object')
      }
    }
  }
  
  // Content validation
  if (metadata.content) {
    validateContent(metadata.content, errors)
  }
  
  // Royalty validation
  if (metadata.royalty) {
    validateRoyalty(metadata.royalty, errors)
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate content object
 * 
 * @param {Object} content - Content object
 * @param {string[]} errors - Errors array to append to
 */
function validateContent(content, errors) {
  if (content.primary) {
    validateContentFile(content.primary, 'content.primary', errors)
  }
  
  if (content.files && Array.isArray(content.files)) {
    content.files.forEach((file, i) => {
      validateContentFile(file, `content.files[${i}]`, errors)
    })
  }
  
  if (content.refs && Array.isArray(content.refs)) {
    content.refs.forEach((ref, i) => {
      validateContentFile(ref, `content.refs[${i}]`, errors)
      if (!ref.uri) {
        errors.push(`${`content.refs[${i}]`} requires uri for external reference`)
      }
    })
  }
}

/**
 * Validate content file object
 * 
 * @param {Object} file - File object
 * @param {string} path - Path for error messages
 * @param {string[]} errors - Errors array
 */
function validateContentFile(file, path, errors) {
  if (!file.path) {
    errors.push(`${path} requires path`)
  } else if (Buffer.byteLength(file.path, 'utf8') > GlyphLimits.MAX_PATH_SIZE) {
    errors.push(`${path}.path exceeds ${GlyphLimits.MAX_PATH_SIZE} bytes`)
  }
  
  if (!file.mime) {
    errors.push(`${path} requires mime type`)
  } else if (Buffer.byteLength(file.mime, 'utf8') > GlyphLimits.MAX_MIME_SIZE) {
    errors.push(`${path}.mime exceeds ${GlyphLimits.MAX_MIME_SIZE} bytes`)
  }
  
  if (typeof file.size !== 'number') {
    errors.push(`${path} requires size`)
  }
  
  if (!file.hash || !file.hash.algo || !file.hash.hex) {
    errors.push(`${path} requires hash with algo and hex`)
  }
}

/**
 * Validate royalty object
 * 
 * @param {Object} royalty - Royalty object
 * @param {string[]} errors - Errors array
 */
function validateRoyalty(royalty, errors) {
  if (typeof royalty.bps !== 'number' || royalty.bps < 0 || royalty.bps > 10000) {
    errors.push('Royalty bps must be 0-10000')
  }
  
  if (!royalty.address) {
    errors.push('Royalty requires address')
  }
  
  if (royalty.splits && Array.isArray(royalty.splits)) {
    let totalBps = 0
    royalty.splits.forEach((split, i) => {
      if (!split.address) {
        errors.push(`royalty.splits[${i}] requires address`)
      }
      if (typeof split.bps !== 'number') {
        errors.push(`royalty.splits[${i}] requires bps`)
      } else {
        totalBps += split.bps
      }
    })
    
    if (totalBps !== royalty.bps) {
      errors.push('Royalty splits must sum to total bps')
    }
  }
}

/**
 * Check if metadata represents a valid Glyph
 * 
 * @param {Object} metadata - Metadata object
 * @returns {boolean} True if valid
 */
function isValidGlyph(metadata) {
  return validateMetadata(metadata).valid
}

/**
 * Get token type from protocols
 * 
 * @param {number[]} protocols - Protocol array
 * @returns {string} Token type name
 */
function getTokenType(protocols) {
  if (protocols.includes(GlyphProtocol.GLYPH_FT)) {
    if (protocols.includes(GlyphProtocol.GLYPH_DMINT)) {
      return 'dMint Fungible Token'
    }
    return 'Fungible Token'
  }
  
  if (protocols.includes(GlyphProtocol.GLYPH_NFT)) {
    if (protocols.includes(GlyphProtocol.GLYPH_WAVE)) {
      return 'WAVE Name'
    }
    if (protocols.includes(GlyphProtocol.GLYPH_AUTHORITY)) {
      return 'Authority Token'
    }
    if (protocols.includes(GlyphProtocol.GLYPH_CONTAINER)) {
      return 'Container'
    }
    if (protocols.includes(GlyphProtocol.GLYPH_ENCRYPTED)) {
      return 'Encrypted NFT'
    }
    if (protocols.includes(GlyphProtocol.GLYPH_MUT)) {
      return 'Mutable NFT'
    }
    return 'NFT'
  }
  
  if (protocols.includes(GlyphProtocol.GLYPH_DAT)) {
    return 'Data Token'
  }
  
  return 'Unknown'
}

module.exports = {
  validateProtocols,
  validateMetadata,
  validateContent,
  validateContentFile,
  validateRoyalty,
  isValidGlyph,
  getTokenType,
  PROTOCOL_REQUIREMENTS,
  PROTOCOL_EXCLUSIONS,
  PROTOCOLS_REQUIRE_BASE,
}
