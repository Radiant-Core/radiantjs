'use strict'

const chai = require('chai')
const expect = chai.expect

const {
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
} = require('../../lib/glyph/constants')

describe('Glyph Constants', function () {
  describe('Magic Bytes', function () {
    it('should have correct magic bytes', function () {
      expect(GLYPH_MAGIC).to.be.instanceof(Buffer)
      expect(GLYPH_MAGIC.toString('ascii')).to.equal('gly')
      expect(GLYPH_MAGIC.length).to.equal(3)
    })

    it('should have correct hex representation', function () {
      expect(GLYPH_MAGIC_HEX).to.equal('676c79')
      expect(GLYPH_MAGIC.toString('hex')).to.equal(GLYPH_MAGIC_HEX)
    })
  })

  describe('GlyphVersion', function () {
    it('should have V1 and V2 versions', function () {
      expect(GlyphVersion.V1).to.equal(0x01)
      expect(GlyphVersion.V2).to.equal(0x02)
    })
  })

  describe('GlyphProtocol', function () {
    it('should have all 11 protocol IDs', function () {
      expect(GlyphProtocol.GLYPH_FT).to.equal(1)
      expect(GlyphProtocol.GLYPH_NFT).to.equal(2)
      expect(GlyphProtocol.GLYPH_DAT).to.equal(3)
      expect(GlyphProtocol.GLYPH_DMINT).to.equal(4)
      expect(GlyphProtocol.GLYPH_MUT).to.equal(5)
      expect(GlyphProtocol.GLYPH_BURN).to.equal(6)
      expect(GlyphProtocol.GLYPH_CONTAINER).to.equal(7)
      expect(GlyphProtocol.GLYPH_ENCRYPTED).to.equal(8)
      expect(GlyphProtocol.GLYPH_TIMELOCK).to.equal(9)
      expect(GlyphProtocol.GLYPH_AUTHORITY).to.equal(10)
      expect(GlyphProtocol.GLYPH_WAVE).to.equal(11)
    })

    it('should have protocol names for all IDs', function () {
      for (let i = 1; i <= 11; i++) {
        expect(ProtocolNames[i]).to.be.a('string')
        expect(ProtocolNames[i].length).to.be.greaterThan(0)
      }
    })
  })

  describe('DmintAlgorithm', function () {
    it('should have all algorithm IDs', function () {
      expect(DmintAlgorithm.SHA256D).to.equal(0x00)
      expect(DmintAlgorithm.BLAKE3).to.equal(0x01)
      expect(DmintAlgorithm.K12).to.equal(0x02)
      expect(DmintAlgorithm.ARGON2ID_LIGHT).to.equal(0x03)
      expect(DmintAlgorithm.RANDOMX_LIGHT).to.equal(0x04)
    })
  })

  describe('DaaMode', function () {
    it('should have all DAA mode IDs', function () {
      expect(DaaMode.FIXED).to.equal(0x00)
      expect(DaaMode.EPOCH).to.equal(0x01)
      expect(DaaMode.ASERT).to.equal(0x02)
      expect(DaaMode.LWMA).to.equal(0x03)
      expect(DaaMode.SCHEDULE).to.equal(0x04)
    })
  })

  describe('EnvelopeFlags', function () {
    it('should have correct flag values', function () {
      expect(EnvelopeFlags.HAS_CONTENT_ROOT).to.equal(1)
      expect(EnvelopeFlags.HAS_CONTROLLER).to.equal(2)
      expect(EnvelopeFlags.HAS_PROFILE_HINT).to.equal(4)
      expect(EnvelopeFlags.IS_REVEAL).to.equal(128)
    })

    it('should allow combining flags', function () {
      const combined = EnvelopeFlags.HAS_CONTENT_ROOT | EnvelopeFlags.IS_REVEAL
      expect(combined).to.equal(129)
    })
  })

  describe('GlyphLimits', function () {
    it('should have reasonable size limits', function () {
      expect(GlyphLimits.MAX_NAME_SIZE).to.equal(256)
      expect(GlyphLimits.MAX_DESC_SIZE).to.equal(4096)
      expect(GlyphLimits.MAX_METADATA_SIZE).to.equal(262144)
      expect(GlyphLimits.MAX_PROTOCOLS).to.equal(16)
    })
  })

  describe('ContainerType', function () {
    it('should have all container types', function () {
      expect(ContainerType.COLLECTION).to.equal('collection')
      expect(ContainerType.ALBUM).to.equal('album')
      expect(ContainerType.BUNDLE).to.equal('bundle')
      expect(ContainerType.SERIES).to.equal('series')
    })
  })

  describe('AuthorityType', function () {
    it('should have all authority types', function () {
      expect(AuthorityType.ISSUER).to.equal('issuer')
      expect(AuthorityType.MANAGER).to.equal('manager')
      expect(AuthorityType.DELEGATE).to.equal('delegate')
      expect(AuthorityType.BADGE).to.equal('badge')
    })
  })

  describe('StorageType', function () {
    it('should have all storage types', function () {
      expect(StorageType.INLINE).to.equal('inline')
      expect(StorageType.REF).to.equal('ref')
      expect(StorageType.IPFS).to.equal('ipfs')
    })
  })

  describe('GlyphDefaults', function () {
    it('should have sensible defaults', function () {
      expect(GlyphDefaults.FT_DECIMALS).to.equal(8)
      expect(GlyphDefaults.BURN_CONFIRMATIONS).to.equal(6)
      expect(GlyphDefaults.ASERT_HALFLIFE).to.equal(3600)
      expect(GlyphDefaults.TARGET_MINT_TIME).to.equal(60)
    })
  })
})
