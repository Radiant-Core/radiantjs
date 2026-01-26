'use strict'

const chai = require('chai')
const expect = chai.expect

const {
  validateProtocols,
  validateMetadata,
  isValidGlyph,
  getTokenType,
} = require('../../lib/glyph/validator')

const { GlyphVersion, GlyphProtocol } = require('../../lib/glyph/constants')

describe('Glyph Validator', function () {
  describe('validateProtocols', function () {
    it('should accept valid single protocol', function () {
      const result = validateProtocols([GlyphProtocol.GLYPH_FT])
      expect(result.valid).to.be.true
    })

    it('should accept valid protocol combination', function () {
      const result = validateProtocols([
        GlyphProtocol.GLYPH_FT,
        GlyphProtocol.GLYPH_DMINT,
      ])
      expect(result.valid).to.be.true
    })

    it('should reject mutually exclusive protocols', function () {
      const result = validateProtocols([
        GlyphProtocol.GLYPH_FT,
        GlyphProtocol.GLYPH_NFT,
      ])
      expect(result.valid).to.be.false
      expect(result.error).to.include('mutually exclusive')
    })

    it('should reject missing required protocols', function () {
      // DMINT requires FT
      const result = validateProtocols([GlyphProtocol.GLYPH_DMINT])
      expect(result.valid).to.be.false
      expect(result.error).to.include('requires')
    })

    it('should reject empty array', function () {
      const result = validateProtocols([])
      expect(result.valid).to.be.false
    })

    it('should reject non-array', function () {
      const result = validateProtocols(null)
      expect(result.valid).to.be.false
    })

    it('should accept NFT with MUT (mutable NFT)', function () {
      const result = validateProtocols([
        GlyphProtocol.GLYPH_NFT,
        GlyphProtocol.GLYPH_MUT,
      ])
      expect(result.valid).to.be.true
    })

    it('should accept NFT with CONTAINER', function () {
      const result = validateProtocols([
        GlyphProtocol.GLYPH_NFT,
        GlyphProtocol.GLYPH_CONTAINER,
      ])
      expect(result.valid).to.be.true
    })

    it('should reject MUT without NFT', function () {
      const result = validateProtocols([GlyphProtocol.GLYPH_MUT])
      expect(result.valid).to.be.false
    })

    it('should accept WAVE with NFT and MUT', function () {
      const result = validateProtocols([
        GlyphProtocol.GLYPH_NFT,
        GlyphProtocol.GLYPH_MUT,
        GlyphProtocol.GLYPH_WAVE,
      ])
      expect(result.valid).to.be.true
    })
  })

  describe('validateMetadata', function () {
    it('should validate valid NFT metadata', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT',
        content: {
          primary: {
            path: '/image.png',
            mime: 'image/png',
            size: 1024,
            hash: { algo: 'sha256', hex: 'abc123' },
          },
        },
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.true
      expect(result.errors).to.be.empty
    })

    it('should validate valid FT metadata', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'TEST',
        name: 'Test Token',
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.true
    })

    it('should reject missing version', function () {
      const metadata = {
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors).to.include('Invalid or missing version (v)')
    })

    it('should reject missing type', function () {
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_NFT],
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors).to.include('Missing type field')
    })

    it('should reject missing protocols', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors).to.include('Missing protocols array (p)')
    })

    it('should reject name exceeding limit', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_FT],
        name: 'x'.repeat(300), // > 256 bytes
        ticker: 'TEST',
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors.some(e => e.includes('Name exceeds'))).to.be.true
    })

    it('should reject NFT without content', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT',
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors).to.include('NFT requires content.primary')
    })

    it('should reject container without container object', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_CONTAINER],
        name: 'Test Container',
        content: {
          primary: {
            path: '/image.png',
            mime: 'image/png',
            size: 1024,
            hash: { algo: 'sha256', hex: 'abc123' },
          },
        },
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors).to.include('Container protocol requires container object')
    })

    it('should validate royalty', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT',
        content: {
          primary: {
            path: '/image.png',
            mime: 'image/png',
            size: 1024,
            hash: { algo: 'sha256', hex: 'abc123' },
          },
        },
        royalty: {
          bps: 500,
          address: 'rxd1...',
        },
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.true
    })

    it('should reject invalid royalty bps', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT',
        content: {
          primary: {
            path: '/image.png',
            mime: 'image/png',
            size: 1024,
            hash: { algo: 'sha256', hex: 'abc123' },
          },
        },
        royalty: {
          bps: 15000, // > 10000 (100%)
          address: 'rxd1...',
        },
      }

      const result = validateMetadata(metadata)
      expect(result.valid).to.be.false
      expect(result.errors).to.include('Royalty bps must be 0-10000')
    })
  })

  describe('isValidGlyph', function () {
    it('should return true for valid metadata', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'TEST',
      }

      expect(isValidGlyph(metadata)).to.be.true
    })

    it('should return false for invalid metadata', function () {
      const metadata = {
        type: 'token',
        // missing v and p
      }

      expect(isValidGlyph(metadata)).to.be.false
    })
  })

  describe('getTokenType', function () {
    it('should identify Fungible Token', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_FT])).to.equal('Fungible Token')
    })

    it('should identify dMint Fungible Token', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_DMINT]))
        .to.equal('dMint Fungible Token')
    })

    it('should identify NFT', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_NFT])).to.equal('NFT')
    })

    it('should identify Mutable NFT', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT]))
        .to.equal('Mutable NFT')
    })

    it('should identify Container', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_CONTAINER]))
        .to.equal('Container')
    })

    it('should identify Authority Token', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_AUTHORITY]))
        .to.equal('Authority Token')
    })

    it('should identify WAVE Name', function () {
      expect(getTokenType([
        GlyphProtocol.GLYPH_NFT,
        GlyphProtocol.GLYPH_MUT,
        GlyphProtocol.GLYPH_WAVE,
      ])).to.equal('WAVE Name')
    })

    it('should identify Data Token', function () {
      expect(getTokenType([GlyphProtocol.GLYPH_DAT])).to.equal('Data Token')
    })
  })
})
