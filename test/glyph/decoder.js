'use strict'

const chai = require('chai')
const expect = chai.expect

const {
  containsGlyphMagic,
  decodeMetadata,
  getGlyphId,
  parseGlyphId,
} = require('../../lib/glyph/decoder')

const { GLYPH_MAGIC, GlyphVersion } = require('../../lib/glyph/constants')

describe('Glyph Decoder', function () {
  describe('containsGlyphMagic', function () {
    it('should detect magic bytes in buffer', function () {
      const buf = Buffer.concat([
        Buffer.from([0x00, 0x6a]), // OP_FALSE OP_RETURN
        GLYPH_MAGIC,
        Buffer.from([0x02, 0x00]), // version, flags
      ])

      expect(containsGlyphMagic(buf)).to.be.true
    })

    it('should return false when magic not present', function () {
      const buf = Buffer.from([0x00, 0x6a, 0x01, 0x02, 0x03])
      expect(containsGlyphMagic(buf)).to.be.false
    })

    it('should handle empty buffer', function () {
      expect(containsGlyphMagic(Buffer.alloc(0))).to.be.false
    })
  })

  describe('decodeMetadata', function () {
    it('should decode JSON metadata', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [1],
        name: 'Test Token',
      }

      const buf = Buffer.from(JSON.stringify(metadata), 'utf8')
      const decoded = decodeMetadata(buf)

      expect(decoded.v).to.equal(GlyphVersion.V2)
      expect(decoded.type).to.equal('token')
      expect(decoded.p).to.deep.equal([1])
      expect(decoded.name).to.equal('Test Token')
    })

    it('should handle UTF-8 characters', function () {
      const metadata = {
        v: 2,
        type: 'token',
        p: [2],
        name: '测试 NFT 🎨',
        desc: 'Ümläüts änd émojis 🚀',
      }

      const buf = Buffer.from(JSON.stringify(metadata), 'utf8')
      const decoded = decodeMetadata(buf)

      expect(decoded.name).to.equal('测试 NFT 🎨')
      expect(decoded.desc).to.equal('Ümläüts änd émojis 🚀')
    })

    it('should throw on invalid JSON', function () {
      const buf = Buffer.from('not valid json', 'utf8')
      expect(() => decodeMetadata(buf)).to.throw()
    })
  })

  describe('getGlyphId', function () {
    it('should format Glyph ID correctly', function () {
      const txid = 'abc123def456'
      const vout = 0

      const glyphId = getGlyphId(txid, vout)
      expect(glyphId).to.equal('abc123def456:0')
    })

    it('should handle different vout values', function () {
      expect(getGlyphId('txid', 0)).to.equal('txid:0')
      expect(getGlyphId('txid', 1)).to.equal('txid:1')
      expect(getGlyphId('txid', 255)).to.equal('txid:255')
    })
  })

  describe('parseGlyphId', function () {
    it('should parse Glyph ID correctly', function () {
      const { txid, vout } = parseGlyphId('abc123def456:0')
      expect(txid).to.equal('abc123def456')
      expect(vout).to.equal(0)
    })

    it('should handle different vout values', function () {
      expect(parseGlyphId('txid:0').vout).to.equal(0)
      expect(parseGlyphId('txid:1').vout).to.equal(1)
      expect(parseGlyphId('txid:255').vout).to.equal(255)
    })

    it('should be inverse of getGlyphId', function () {
      const originalTxid = 'a1b2c3d4e5f6'
      const originalVout = 3

      const glyphId = getGlyphId(originalTxid, originalVout)
      const { txid, vout } = parseGlyphId(glyphId)

      expect(txid).to.equal(originalTxid)
      expect(vout).to.equal(originalVout)
    })
  })
})
