'use strict'

const chai = require('chai')
const expect = chai.expect

const {
  encodeMetadata,
  canonicalizeObject,
  computeCommitHash,
  encodeCommitEnvelope,
  encodeRevealEnvelope,
} = require('../../lib/glyph/encoder')

const { GlyphVersion, GlyphProtocol, GLYPH_MAGIC } = require('../../lib/glyph/constants')

describe('Glyph Encoder', function () {
  describe('encodeMetadata', function () {
    it('should encode metadata to JSON bytes', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT',
      }

      const encoded = encodeMetadata(metadata)
      expect(encoded).to.be.instanceof(Buffer)

      const decoded = JSON.parse(encoded.toString('utf8'))
      expect(decoded.v).to.equal(GlyphVersion.V2)
      expect(decoded.type).to.equal('token')
      expect(decoded.name).to.equal('Test NFT')
    })

    it('should add version if missing', function () {
      const metadata = {
        type: 'token',
        p: [GlyphProtocol.GLYPH_FT],
      }

      const encoded = encodeMetadata(metadata)
      const decoded = JSON.parse(encoded.toString('utf8'))
      expect(decoded.v).to.equal(GlyphVersion.V2)
    })

    it('should produce canonical JSON (sorted keys)', function () {
      const metadata = {
        z: 'last',
        a: 'first',
        m: 'middle',
        v: GlyphVersion.V2,
      }

      const encoded = encodeMetadata(metadata)
      const jsonStr = encoded.toString('utf8')

      // Keys should be sorted alphabetically
      const aIndex = jsonStr.indexOf('"a"')
      const mIndex = jsonStr.indexOf('"m"')
      const vIndex = jsonStr.indexOf('"v"')
      const zIndex = jsonStr.indexOf('"z"')

      expect(aIndex).to.be.lessThan(mIndex)
      expect(mIndex).to.be.lessThan(vIndex)
      expect(vIndex).to.be.lessThan(zIndex)
    })
  })

  describe('canonicalizeObject', function () {
    it('should sort object keys', function () {
      const obj = { c: 3, a: 1, b: 2 }
      const canonical = canonicalizeObject(obj)
      const keys = Object.keys(canonical)
      expect(keys).to.deep.equal(['a', 'b', 'c'])
    })

    it('should handle nested objects', function () {
      const obj = {
        z: { c: 3, a: 1 },
        a: { z: 26, b: 2 },
      }
      const canonical = canonicalizeObject(obj)
      const outerKeys = Object.keys(canonical)
      expect(outerKeys).to.deep.equal(['a', 'z'])

      const innerKeysA = Object.keys(canonical.a)
      expect(innerKeysA).to.deep.equal(['b', 'z'])
    })

    it('should handle arrays', function () {
      const obj = { arr: [{ b: 2, a: 1 }, { d: 4, c: 3 }] }
      const canonical = canonicalizeObject(obj)

      expect(Object.keys(canonical.arr[0])).to.deep.equal(['a', 'b'])
      expect(Object.keys(canonical.arr[1])).to.deep.equal(['c', 'd'])
    })

    it('should preserve primitives', function () {
      expect(canonicalizeObject(null)).to.equal(null)
      expect(canonicalizeObject(42)).to.equal(42)
      expect(canonicalizeObject('string')).to.equal('string')
      expect(canonicalizeObject(true)).to.equal(true)
    })
  })

  describe('computeCommitHash', function () {
    it('should compute SHA256 hash of metadata', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
      }

      const hash = computeCommitHash(metadata)
      expect(hash).to.be.instanceof(Buffer)
      expect(hash.length).to.equal(32)
    })

    it('should produce consistent hashes', function () {
      const metadata = { v: 2, type: 'test', p: [1] }

      const hash1 = computeCommitHash(metadata)
      const hash2 = computeCommitHash(metadata)

      expect(hash1.toString('hex')).to.equal(hash2.toString('hex'))
    })

    it('should accept Buffer input', function () {
      const metadataBytes = Buffer.from('{"p":[1],"type":"test","v":2}', 'utf8')
      const hash = computeCommitHash(metadataBytes)

      expect(hash).to.be.instanceof(Buffer)
      expect(hash.length).to.equal(32)
    })
  })

  describe('encodeCommitEnvelope', function () {
    it('should encode basic commit envelope', function () {
      const commitHash = Buffer.alloc(32, 0xab)

      const envelope = encodeCommitEnvelope({ commitHash })

      // Should start with magic bytes
      expect(envelope.slice(0, 3).toString('ascii')).to.equal('gly')

      // Version byte
      expect(envelope[3]).to.equal(GlyphVersion.V2)

      // Flags byte (should be 0 for basic envelope)
      expect(envelope[4]).to.equal(0)

      // Commit hash
      expect(envelope.slice(5, 37).toString('hex')).to.equal(commitHash.toString('hex'))
    })

    it('should include content root when provided', function () {
      const commitHash = Buffer.alloc(32, 0xab)
      const contentRoot = Buffer.alloc(32, 0xcd)

      const envelope = encodeCommitEnvelope({ commitHash, contentRoot })

      // Flags should indicate content root present
      expect(envelope[4] & 1).to.equal(1)

      // Content root should follow commit hash
      expect(envelope.slice(37, 69).toString('hex')).to.equal(contentRoot.toString('hex'))
    })

    it('should reject invalid commit hash', function () {
      expect(() => {
        encodeCommitEnvelope({ commitHash: Buffer.alloc(16) })
      }).to.throw('Invalid commit hash')

      expect(() => {
        encodeCommitEnvelope({ commitHash: null })
      }).to.throw('Invalid commit hash')
    })
  })

  describe('encodeRevealEnvelope', function () {
    it('should encode reveal envelope with metadata', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test Token',
      }

      const chunks = encodeRevealEnvelope({ metadata })

      expect(chunks).to.be.an('array')
      expect(chunks.length).to.be.at.least(2)

      // First chunk is header
      const header = chunks[0]
      expect(header.slice(0, 3).toString('ascii')).to.equal('gly')
      expect(header[3]).to.equal(GlyphVersion.V2)
      expect(header[4] & 0x80).to.equal(0x80) // IS_REVEAL flag

      // Second chunk is metadata
      const metadataChunk = chunks[1]
      const decoded = JSON.parse(metadataChunk.toString('utf8'))
      expect(decoded.name).to.equal('Test Token')
    })

    it('should include file chunks', function () {
      const metadata = { v: 2, type: 'token', p: [2] }
      const files = [
        Buffer.from('file1 content'),
        Buffer.from('file2 content'),
      ]

      const chunks = encodeRevealEnvelope({ metadata, files })

      expect(chunks.length).to.equal(4) // header + metadata + 2 files
      expect(chunks[2].toString()).to.equal('file1 content')
      expect(chunks[3].toString()).to.equal('file2 content')
    })

    it('should reject oversized metadata', function () {
      const metadata = {
        v: 2,
        type: 'token',
        p: [1],
        data: 'x'.repeat(300000), // > MAX_METADATA_SIZE
      }

      expect(() => {
        encodeRevealEnvelope({ metadata })
      }).to.throw(/exceeds maximum size/)
    })
  })
})
