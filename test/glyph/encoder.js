'use strict'

const chai = require('chai')
const expect = chai.expect
const cbor = require('cbor-x')

const encoder = require('../../lib/glyph/encoder')
const {
  encodeMetadata,
  canonicalizeObject,
  computeCommitHash,
  encodeCommitEnvelope,
  encodeRevealEnvelope
} = encoder

const { GlyphVersion, GlyphProtocol, GLYPH_MAGIC } = require('../../lib/glyph/constants')

describe('Glyph Encoder', function () {
  describe('encodeMetadata', function () {
    it('should encode metadata to CBOR bytes (default wire format)', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT'
      }

      const encoded = encodeMetadata(metadata)
      expect(encoded).to.be.instanceof(Buffer)

      const decoded = cbor.decode(encoded)
      expect(decoded.v).to.equal(GlyphVersion.V2)
      expect(decoded.type).to.equal('token')
      expect(decoded.name).to.equal('Test NFT')
    })

    it('should add version if missing', function () {
      const metadata = {
        type: 'token',
        p: [GlyphProtocol.GLYPH_FT]
      }

      const encoded = encodeMetadata(metadata)
      const decoded = cbor.decode(encoded)
      expect(decoded.v).to.equal(GlyphVersion.V2)
    })

    it('should match cbor-x.encode byte-for-byte (interop with Photonic-Wallet)', function () {
      // Photonic-Wallet uses bare `cbor-x.encode(payload)` with no
      // canonicalization. radiantjs must produce identical bytes so that
      // commit hashes (OP_HASH256 of these bytes) match cross-implementation.
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT'
      }
      const ours = encodeMetadata(metadata)
      const reference = Buffer.from(cbor.encode(metadata))
      expect(ours.equals(reference)).to.equal(true)
    })

    it('legacy JSON encoder still works when encoder.useJson = true', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_FT],
        name: 'JSON Token'
      }
      encoder.useJson = true
      try {
        const encoded = encodeMetadata(metadata)
        const decoded = JSON.parse(encoded.toString('utf8'))
        expect(decoded.name).to.equal('JSON Token')
      } finally {
        encoder.useJson = false
      }
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

  describe('computeCommitHash (consensus: OP_HASH256 = SHA256(SHA256(x)))', function () {
    const Hash = require('../../lib/crypto/hash')

    it('should compute double-SHA256 (OP_HASH256) of metadata bytes', function () {
      const metadata = {
        v: GlyphVersion.V2,
        type: 'token',
        p: [GlyphProtocol.GLYPH_NFT]
      }
      const hash = computeCommitHash(metadata)
      expect(hash).to.be.instanceof(Buffer)
      expect(hash.length).to.equal(32)

      // Must match SHA256(SHA256(encoded)) exactly - Photonic-Wallet's
      // commit script literally executes OP_HASH256 against the reveal
      // payload and OP_EQUALVERIFYs against this value.
      const encoded = encodeMetadata(metadata)
      expect(hash.equals(Hash.sha256sha256(encoded))).to.equal(true)

      // Must NOT be single-SHA256 (the pre-2.0.4 bug).
      expect(hash.equals(Hash.sha256(encoded))).to.equal(false)
    })

    it('should produce consistent hashes', function () {
      const metadata = { v: 2, type: 'test', p: [1] }
      const hash1 = computeCommitHash(metadata)
      const hash2 = computeCommitHash(metadata)
      expect(hash1.toString('hex')).to.equal(hash2.toString('hex'))
    })

    it('should accept Buffer input (raw pre-encoded bytes)', function () {
      // Use CBOR bytes directly - this is what a real reveal scriptSig
      // pushes on the stack for OP_HASH256.
      const metadataBytes = Buffer.from(cbor.encode({ p: [1], type: 'test', v: 2 }))
      const hash = computeCommitHash(metadataBytes)
      expect(hash).to.be.instanceof(Buffer)
      expect(hash.length).to.equal(32)
      expect(hash.equals(Hash.sha256sha256(metadataBytes))).to.equal(true)
    })

    it('end-to-end interop: commit hash matches Photonic-Wallet-style construction', function () {
      // Reproduce Photonic-Wallet's `encodeGlyph` from
      // packages/lib/src/token.ts:130-141:
      //
      //   encodedPayload = cbor-x.encode(payload)
      //   revealScriptSig = OP_PUSH "gly" OP_PUSH <encodedPayload>
      //   payloadHash = SHA256(SHA256(encodedPayload))
      //
      // and verify radiantjs produces the same payloadHash. Payload must
      // include `v` because radiantjs auto-injects it otherwise (deliberate
      // convenience for v2-only consumers).
      const payload = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_NFT],
        attrs: { artist: 'satoshi', year: 2026 },
        name: 'Genesis Glyph'
      }
      const encodedPayload = Buffer.from(cbor.encode(payload))
      const wallet_payloadHash = Hash.sha256sha256(encodedPayload)
      const radiantjs_commitHash = computeCommitHash(payload)
      expect(radiantjs_commitHash.equals(wallet_payloadHash)).to.equal(true)
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

      // Second chunk is metadata (CBOR-encoded)
      const metadataChunk = chunks[1]
      const decoded = cbor.decode(metadataChunk)
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
