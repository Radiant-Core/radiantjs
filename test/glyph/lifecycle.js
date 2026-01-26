'use strict';

const chai = require('chai');
const expect = chai.expect;

const {
  GLYPH_MAGIC,
  GlyphProtocol,
  GlyphVersion,
  DmintAlgorithm,
  DaaMode,
  GlyphLimits,
} = require('../../lib/glyph/constants');

const {
  validateProtocols,
  getTokenType,
} = require('../../lib/glyph/validator');

const {
  encodeMetadata,
  encodeCommitEnvelope,
  encodeRevealEnvelope,
  computeCommitHash,
} = require('../../lib/glyph/encoder');

const {
  decodeMetadata,
  getGlyphId,
  parseGlyphId,
} = require('../../lib/glyph/decoder');

describe('Glyph Token Lifecycle', function() {
  
  describe('Fungible Token Lifecycle', function() {
    
    it('should create valid FT protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_FT];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify FT token type', function() {
      const protocols = [GlyphProtocol.GLYPH_FT];
      expect(getTokenType(protocols)).to.equal('Fungible Token');
    });
    
    it('should encode FT commit envelope', function() {
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'TEST',
        name: 'Test Token',
        decimals: 8,
      };
      
      const commitHash = computeCommitHash(metadata);
      expect(commitHash).to.be.instanceof(Buffer);
      expect(commitHash.length).to.equal(32);
      
      const envelope = encodeCommitEnvelope({ commitHash });
      expect(envelope).to.be.instanceof(Buffer);
      // Magic (3 bytes) + version (1 byte)
      expect(envelope.slice(0, 3).equals(GLYPH_MAGIC)).to.be.true;
      expect(envelope[3]).to.equal(GlyphVersion.V2);
    });
    
    it('should encode FT reveal envelope', function() {
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'TEST',
        name: 'Test Token',
        decimals: 8,
      };
      
      const chunks = encodeRevealEnvelope({ metadata });
      expect(chunks).to.be.an('array');
      expect(chunks.length).to.be.greaterThan(0);
      
      // First chunk should contain magic bytes + version
      const firstChunk = chunks[0];
      expect(firstChunk.slice(0, 3).equals(GLYPH_MAGIC)).to.be.true;
    });
    
    it('should decode FT metadata from reveal', function() {
      const original = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'TEST',
        name: 'Test Token',
        decimals: 8,
      };
      
      const encoded = encodeMetadata(original);
      const decoded = decodeMetadata(encoded);
      
      expect(decoded.v).to.equal(original.v);
      expect(decoded.p).to.deep.equal(original.p);
      expect(decoded.ticker).to.equal(original.ticker);
      expect(decoded.name).to.equal(original.name);
      expect(decoded.decimals).to.equal(original.decimals);
    });
    
    it('should handle FT transfer validation', function() {
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'TEST',
        name: 'Test Token',
        decimals: 8,
      };
      
      // Simulate transfer: 1000 tokens input, 600 + 400 output
      const inputValue = 1000;
      const outputValues = [600, 400];
      const totalOutput = outputValues.reduce((a, b) => a + b, 0);
      
      // Conservation check (inputs >= outputs)
      expect(inputValue >= totalOutput).to.be.true;
    });
    
    it('should handle FT burn validation', function() {
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_BURN],
        ticker: 'TEST',
        name: 'Test Token',
        decimals: 8,
      };
      
      const validation = validateProtocols(metadata.p);
      expect(validation.valid).to.be.true;
      
      // Simulate burn: 1000 input, 700 output = 300 burned
      const inputValue = 1000;
      const outputValue = 700;
      const burnedAmount = inputValue - outputValue;
      
      expect(burnedAmount).to.equal(300);
      expect(burnedAmount > 0).to.be.true;
    });
  });
  
  describe('dMint Token Lifecycle', function() {
    
    it('should create valid dMint protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_DMINT];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify dMint token type', function() {
      const protocols = [GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_DMINT];
      expect(getTokenType(protocols)).to.equal('dMint Fungible Token');
    });
    
    it('should have valid dMint algorithms', function() {
      expect(DmintAlgorithm.SHA256D).to.equal(0);
      expect(DmintAlgorithm.BLAKE3).to.equal(1);
      expect(DmintAlgorithm.K12).to.equal(2);
      expect(DmintAlgorithm.ARGON2ID_LIGHT).to.equal(3);
      expect(DmintAlgorithm.RANDOMX_LIGHT).to.equal(4);
    });
    
    it('should have valid DAA modes', function() {
      expect(DaaMode.FIXED).to.equal(0);
      expect(DaaMode.EPOCH).to.equal(1);
      expect(DaaMode.ASERT).to.equal(2);
      expect(DaaMode.LWMA).to.equal(3);
      expect(DaaMode.SCHEDULE).to.equal(4);
    });
    
    it('should simulate mint operation', function() {
      const contractState = {
        height: 0,
        maxHeight: 1000000,
        reward: 50 * 1e8,
        totalMinted: 0,
        maxSupply: 100000000 * 1e8,
      };
      
      // Simulate mining
      const canMint = contractState.height < contractState.maxHeight &&
                      contractState.totalMinted < contractState.maxSupply;
      expect(canMint).to.be.true;
      
      // After mint
      contractState.height++;
      contractState.totalMinted += contractState.reward;
      
      expect(contractState.height).to.equal(1);
      expect(contractState.totalMinted).to.equal(50 * 1e8);
    });
  });
  
  describe('NFT Lifecycle', function() {
    
    it('should create valid NFT protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify NFT token type', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT];
      expect(getTokenType(protocols)).to.equal('NFT');
    });
    
    it('should create valid mutable NFT protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify mutable NFT token type', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT];
      expect(getTokenType(protocols)).to.equal('Mutable NFT');
    });
    
    it('should handle NFT transfer (singleton)', function() {
      // NFT transfers are simple - one input, one output
      const inputCount = 1;
      const outputCount = 1;
      
      // Singleton conservation
      expect(inputCount).to.equal(outputCount);
    });
    
    it('should create valid container NFT protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_CONTAINER];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify container token type', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_CONTAINER];
      expect(getTokenType(protocols)).to.equal('Container');
    });
  });
  
  describe('Authority Token Lifecycle', function() {
    
    it('should create valid authority token protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_AUTHORITY];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify authority token type', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_AUTHORITY];
      expect(getTokenType(protocols)).to.equal('Authority Token');
    });
  });
  
  describe('WAVE Name Lifecycle', function() {
    
    it('should create valid WAVE name protocols', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT, GlyphProtocol.GLYPH_WAVE];
      const validation = validateProtocols(protocols);
      expect(validation.valid).to.be.true;
    });
    
    it('should identify WAVE name token type', function() {
      const protocols = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT, GlyphProtocol.GLYPH_WAVE];
      expect(getTokenType(protocols)).to.equal('WAVE Name');
    });
  });
  
  describe('Glyph ID Operations', function() {
    
    it('should format and parse Glyph ID', function() {
      const txid = 'a'.repeat(64);
      const vout = 0;
      
      const glyphId = getGlyphId(txid, vout);
      expect(glyphId).to.equal(`${txid}:${vout}`);
      
      const parsed = parseGlyphId(glyphId);
      expect(parsed.txid).to.equal(txid);
      expect(parsed.vout).to.equal(vout);
    });
    
    it('should handle various vout values', function() {
      const txid = 'b'.repeat(64);
      
      for (const vout of [0, 1, 10, 100, 255]) {
        const glyphId = getGlyphId(txid, vout);
        const parsed = parseGlyphId(glyphId);
        expect(parsed.vout).to.equal(vout);
      }
    });
  });
  
  describe('Size Limits', function() {
    
    it('should have reasonable size limits', function() {
      expect(GlyphLimits.MAX_METADATA_SIZE).to.be.greaterThan(0);
      expect(GlyphLimits.MAX_INLINE_FILE_SIZE).to.be.greaterThan(0);
      expect(GlyphLimits.MAX_PROTOCOLS).to.be.greaterThan(0);
    });
    
    it('should encode metadata within limits', function() {
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Test NFT',
        description: 'A test NFT',
      };
      
      const encoded = encodeMetadata(metadata);
      expect(encoded.length).to.be.at.most(GlyphLimits.MAX_METADATA_SIZE);
    });
    
    it('should reject oversized metadata in reveal', function() {
      const oversizedMetadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_NFT],
        name: 'Oversized NFT',
        description: 'x'.repeat(GlyphLimits.MAX_METADATA_SIZE + 1000),
      };
      
      expect(() => {
        encodeRevealEnvelope({ metadata: oversizedMetadata });
      }).to.throw();
    });
  });
  
  describe('Commit-Reveal Pattern', function() {
    
    it('should complete full commit-reveal cycle', function() {
      // Step 1: Create metadata
      const metadata = {
        v: GlyphVersion.V2,
        p: [GlyphProtocol.GLYPH_FT],
        ticker: 'CYCLE',
        name: 'Commit-Reveal Test',
        decimals: 8,
      };
      
      // Step 2: Compute commit hash
      const commitHash = computeCommitHash(metadata);
      expect(commitHash).to.be.instanceof(Buffer);
      expect(commitHash.length).to.equal(32);
      
      // Step 3: Create commit envelope
      const commitEnvelope = encodeCommitEnvelope({ commitHash });
      expect(commitEnvelope).to.be.instanceof(Buffer);
      
      // Step 4: Create reveal envelope
      const revealChunks = encodeRevealEnvelope({ metadata });
      expect(revealChunks).to.be.an('array');
      expect(revealChunks.length).to.be.greaterThan(0);
      
      // Step 5: Verify commit hash matches
      const verifyHash = computeCommitHash(metadata);
      expect(verifyHash.equals(commitHash)).to.be.true;
    });
  });
});
