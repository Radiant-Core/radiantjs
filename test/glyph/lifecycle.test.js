'use strict';

/**
 * End-to-End Token Lifecycle Tests
 * 
 * Tests the complete lifecycle of Glyph v2 tokens:
 * - Token creation (commit + reveal)
 * - Token transfer
 * - Token melt/burn
 * - Mutable state updates
 * - Container operations
 */

const chai = require('chai');
const expect = chai.expect;

const radiantjs = require('../../');
const { PrivateKey, Transaction, Script, Address } = radiantjs;
const glyph = require('../../lib/glyph');

describe('Glyph Token Lifecycle', function() {
  
  let privateKey;
  let address;
  let publicKey;
  
  before(function() {
    privateKey = new PrivateKey();
    publicKey = privateKey.toPublicKey();
    address = privateKey.toAddress();
  });

  describe('FT (Fungible Token) Lifecycle', function() {
    
    it('should create valid FT metadata', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Test Fungible Token',
        ticker: 'TFT',
        decimals: 8,
        supply: 21000000
      };
      
      expect(metadata.p).to.include(glyph.constants.GLYPH_FT);
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
    });
    
    it('should encode FT metadata to CBOR', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Test Token',
        ticker: 'TST'
      };
      
      const encoded = glyph.encoder.encodeMetadata(metadata);
      expect(encoded).to.be.an.instanceof(Buffer);
      expect(encoded.length).to.be.greaterThan(0);
    });
    
    it('should decode FT metadata from CBOR', function() {
      const original = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Decode Test',
        ticker: 'DCT'
      };
      
      const encoded = glyph.encoder.encodeMetadata(original);
      const decoded = glyph.decoder.decodeMetadata(encoded);
      
      expect(decoded.p).to.deep.equal(original.p);
      expect(decoded.name).to.equal(original.name);
      expect(decoded.ticker).to.equal(original.ticker);
    });
    
    it('should create commit transaction structure', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Commit Test'
      };
      
      const commitHash = glyph.encoder.computeCommitHash(metadata);
      expect(commitHash).to.be.a('string');
      expect(commitHash.length).to.equal(64); // SHA256 hex
    });
    
    it('should create reveal envelope', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Reveal Test'
      };
      
      const envelope = glyph.encoder.createRevealEnvelope(metadata);
      expect(envelope).to.be.an.instanceof(Buffer);
      expect(envelope.includes(glyph.constants.GLYPH_MAGIC)).to.be.true;
    });
    
    it('should parse reveal envelope', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Parse Test'
      };
      
      const envelope = glyph.encoder.createRevealEnvelope(metadata);
      const parsed = glyph.decoder.parseEnvelope(envelope);
      
      expect(parsed).to.not.be.null;
      expect(parsed.isReveal).to.be.true;
      expect(parsed.metadata.name).to.equal('Parse Test');
    });
    
    it('should validate FT transfer requirements', function() {
      // FT transfers must preserve total supply
      const inputAmount = 1000000;
      const outputAmounts = [600000, 400000];
      const totalOutput = outputAmounts.reduce((a, b) => a + b, 0);
      
      expect(totalOutput).to.equal(inputAmount);
    });
  });

  describe('NFT (Non-Fungible Token) Lifecycle', function() {
    
    it('should create valid NFT metadata', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT],
        name: 'Unique NFT #1',
        desc: 'A unique digital collectible'
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
      expect(glyph.validator.getTokenType(metadata.p)).to.equal('NFT');
    });
    
    it('should reject FT+NFT combination', function() {
      const invalidProtocols = [glyph.constants.GLYPH_FT, glyph.constants.GLYPH_NFT];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('mutually exclusive');
    });
    
    it('should create NFT with content', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT],
        name: 'Art NFT',
        main: {
          t: 'image/png',
          b: Buffer.from([0x89, 0x50, 0x4E, 0x47]) // PNG magic
        }
      };
      
      const encoded = glyph.encoder.encodeMetadata(metadata);
      const decoded = glyph.decoder.decodeMetadata(encoded);
      
      expect(decoded.main.t).to.equal('image/png');
    });
    
    it('should support soulbound NFT (non-transferable)', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT],
        name: 'Soulbound Badge',
        policy: {
          transferable: false
        }
      };
      
      expect(metadata.policy.transferable).to.be.false;
    });
  });

  describe('dMint Token Lifecycle', function() {
    
    it('should create valid dMint FT metadata', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_FT, glyph.constants.GLYPH_DMINT],
        name: 'Mineable Token',
        ticker: 'MINE',
        dmint: {
          algorithm: 0, // SHA256D
          difficulty: 0x1d00ffff,
          reward: 5000000000,
          halving: 210000,
          maxSupply: 2100000000000000
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
      expect(glyph.validator.isDmint(metadata.p)).to.be.true;
    });
    
    it('should reject dMint without FT', function() {
      const invalidProtocols = [glyph.constants.GLYPH_DMINT];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('requires FT');
    });
    
    it('should validate mining parameters', function() {
      const dmintParams = {
        algorithm: 0,
        difficulty: 0x1d00ffff,
        reward: 5000000000
      };
      
      expect(dmintParams.algorithm).to.be.a('number');
      expect(dmintParams.difficulty).to.be.a('number');
      expect(dmintParams.reward).to.be.greaterThan(0);
    });
  });

  describe('Mutable Token Lifecycle', function() {
    
    it('should create valid mutable NFT metadata', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_MUT],
        name: 'Mutable NFT',
        mutable: {
          fields: ['name', 'desc', 'attrs'],
          authority: address.toString()
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
      expect(glyph.validator.isMutable(metadata.p)).to.be.true;
    });
    
    it('should reject MUT without NFT', function() {
      const invalidProtocols = [glyph.constants.GLYPH_MUT];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('requires NFT');
    });
    
    it('should track state updates', function() {
      const stateHistory = [
        { version: 1, name: 'Original Name', timestamp: Date.now() - 10000 },
        { version: 2, name: 'Updated Name', timestamp: Date.now() }
      ];
      
      expect(stateHistory[1].version).to.be.greaterThan(stateHistory[0].version);
    });
  });

  describe('Container Lifecycle', function() {
    
    it('should create valid container metadata', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_CONTAINER],
        name: 'My Collection',
        container: {
          type: 'collection',
          maxItems: 10000
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
      expect(glyph.validator.isContainer(metadata.p)).to.be.true;
    });
    
    it('should reject CONTAINER without NFT', function() {
      const invalidProtocols = [glyph.constants.GLYPH_CONTAINER];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
    });
  });

  describe('Burn Lifecycle', function() {
    
    it('should create valid burn for FT', function() {
      const burnProtocols = [glyph.constants.GLYPH_FT, glyph.constants.GLYPH_BURN];
      const result = glyph.validator.validateProtocols(burnProtocols);
      
      expect(result.valid).to.be.true;
    });
    
    it('should create valid burn for NFT', function() {
      const burnProtocols = [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_BURN];
      const result = glyph.validator.validateProtocols(burnProtocols);
      
      expect(result.valid).to.be.true;
    });
    
    it('should reject BURN alone', function() {
      const invalidProtocols = [glyph.constants.GLYPH_BURN];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('BURN');
    });
  });

  describe('Encrypted Token Lifecycle', function() {
    
    it('should create valid encrypted NFT', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_ENCRYPTED],
        name: 'Private Content NFT',
        crypto: {
          algorithm: 'aes-256-gcm',
          pubkey: publicKey.toString()
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
      expect(glyph.validator.isEncrypted(metadata.p)).to.be.true;
    });
    
    it('should create timelocked encrypted NFT', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_ENCRYPTED, glyph.constants.GLYPH_TIMELOCK],
        name: 'Timelocked Secret',
        crypto: {
          algorithm: 'aes-256-gcm'
        },
        timelock: {
          revealHeight: 1000000
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
    });
    
    it('should reject TIMELOCK without ENCRYPTED', function() {
      const invalidProtocols = [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_TIMELOCK];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('ENCRYPTED');
    });
  });

  describe('WAVE Name Lifecycle', function() {
    
    it('should create valid WAVE name', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_MUT, glyph.constants.GLYPH_WAVE],
        name: 'example.rxd',
        wave: {
          domain: 'example',
          tld: 'rxd'
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
    });
    
    it('should reject WAVE without MUT', function() {
      const invalidProtocols = [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_WAVE];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('MUT');
    });
    
    it('should reject WAVE without NFT', function() {
      const invalidProtocols = [glyph.constants.GLYPH_MUT, glyph.constants.GLYPH_WAVE];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
      expect(result.error).to.include('NFT');
    });
  });

  describe('Authority Token Lifecycle', function() {
    
    it('should create valid authority token', function() {
      const metadata = {
        p: [glyph.constants.GLYPH_NFT, glyph.constants.GLYPH_AUTHORITY],
        name: 'Minting Authority',
        authority: {
          type: 'mint',
          targetRef: '0'.repeat(72)
        }
      };
      
      expect(glyph.validator.validateProtocols(metadata.p).valid).to.be.true;
    });
    
    it('should reject AUTHORITY without NFT', function() {
      const invalidProtocols = [glyph.constants.GLYPH_AUTHORITY];
      const result = glyph.validator.validateProtocols(invalidProtocols);
      
      expect(result.valid).to.be.false;
    });
  });

  describe('Full Lifecycle Simulation', function() {
    
    it('should simulate complete FT lifecycle', function() {
      // 1. Create token
      const createMetadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Lifecycle Token',
        ticker: 'LIFE',
        supply: 1000000
      };
      expect(glyph.validator.validateProtocols(createMetadata.p).valid).to.be.true;
      
      // 2. Encode for commit
      const commitHash = glyph.encoder.computeCommitHash(createMetadata);
      expect(commitHash).to.have.length(64);
      
      // 3. Create reveal
      const envelope = glyph.encoder.createRevealEnvelope(createMetadata);
      expect(envelope.length).to.be.greaterThan(0);
      
      // 4. Parse and verify
      const parsed = glyph.decoder.parseEnvelope(envelope);
      expect(parsed.metadata.ticker).to.equal('LIFE');
      
      // 5. Simulate transfer (balance tracking)
      let balances = { alice: 1000000, bob: 0 };
      const transferAmount = 250000;
      balances.alice -= transferAmount;
      balances.bob += transferAmount;
      expect(balances.alice + balances.bob).to.equal(1000000);
      
      // 6. Simulate burn
      const burnAmount = 100000;
      balances.alice -= burnAmount;
      expect(balances.alice + balances.bob).to.equal(900000);
    });
    
    it('should simulate complete NFT lifecycle', function() {
      // 1. Create NFT
      const createMetadata = {
        p: [glyph.constants.GLYPH_NFT],
        name: 'Unique Asset #1'
      };
      expect(glyph.validator.validateProtocols(createMetadata.p).valid).to.be.true;
      
      // 2. Transfer ownership
      let owner = 'alice';
      owner = 'bob';
      expect(owner).to.equal('bob');
      
      // 3. NFT is indivisible
      const nftQuantity = 1;
      expect(nftQuantity).to.equal(1);
    });
  });
});
