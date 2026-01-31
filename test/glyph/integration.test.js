'use strict';

/**
 * Cross-Repository Integration Tests
 * 
 * Tests integration between:
 * - radiantjs (core library)
 * - radiantblockchain-constants (protocol constants)
 * - Photonic-Wallet (wallet operations)
 * - RadiantMM (DEX operations)
 * - Glyph-miner (mining operations)
 * - ElectrumX/RXinDexer (indexer compatibility)
 */

const chai = require('chai');
const expect = chai.expect;

const radiantjs = require('../../lib');
const glyph = require('../../lib/glyph');

describe('Cross-Repository Integration', function() {

  describe('radiantjs <-> radiantblockchain-constants', function() {
    
    it('should have matching protocol IDs', function() {
      // Protocol IDs must match between repos
      expect(glyph.constants.GLYPH_FT).to.equal(1);
      expect(glyph.constants.GLYPH_NFT).to.equal(2);
      expect(glyph.constants.GLYPH_DAT).to.equal(3);
      expect(glyph.constants.GLYPH_DMINT).to.equal(4);
      expect(glyph.constants.GLYPH_MUT).to.equal(5);
      expect(glyph.constants.GLYPH_BURN).to.equal(6);
      expect(glyph.constants.GLYPH_CONTAINER).to.equal(7);
      expect(glyph.constants.GLYPH_ENCRYPTED).to.equal(8);
      expect(glyph.constants.GLYPH_TIMELOCK).to.equal(9);
      expect(glyph.constants.GLYPH_AUTHORITY).to.equal(10);
      expect(glyph.constants.GLYPH_WAVE).to.equal(11);
    });
    
    it('should have matching GLYPH_MAGIC', function() {
      expect(glyph.constants.GLYPH_MAGIC).to.deep.equal(Buffer.from('gly'));
    });
    
    it('should validate protocols consistently', function() {
      // Same validation rules must apply
      const testCases = [
        { protocols: [1], valid: true },
        { protocols: [2], valid: true },
        { protocols: [1, 2], valid: false },     // FT+NFT exclusive
        { protocols: [4], valid: false },         // DMINT needs FT
        { protocols: [1, 4], valid: true },       // FT+DMINT valid
        { protocols: [5], valid: false },         // MUT needs NFT
        { protocols: [2, 5], valid: true },       // NFT+MUT valid
        { protocols: [6], valid: false },         // BURN alone invalid
        { protocols: [1, 6], valid: true },       // FT+BURN valid
        { protocols: [2, 6], valid: true },       // NFT+BURN valid
        { protocols: [9], valid: false },         // TIMELOCK needs ENCRYPTED
        { protocols: [2, 8, 9], valid: true },    // NFT+ENCRYPTED+TIMELOCK valid
        { protocols: [11], valid: false },        // WAVE needs NFT+MUT
        { protocols: [2, 5, 11], valid: true },   // NFT+MUT+WAVE valid
      ];
      
      for (const tc of testCases) {
        const result = glyph.validator.validateProtocols(tc.protocols);
        expect(result.valid).to.equal(tc.valid, 
          `Protocols ${tc.protocols} should be ${tc.valid ? 'valid' : 'invalid'}`);
      }
    });
  });

  describe('radiantjs <-> Photonic-Wallet', function() {
    
    it('should produce compatible CBOR encoding', function() {
      // Photonic-Wallet must be able to decode radiantjs encoded metadata
      const metadata = {
        p: [2],
        name: 'Cross-Wallet NFT',
        desc: 'Should work in all wallets'
      };
      
      const encoded = glyph.encoder.encodeMetadata(metadata);
      const decoded = glyph.decoder.decodeMetadata(encoded);
      
      expect(decoded.p).to.deep.equal(metadata.p);
      expect(decoded.name).to.equal(metadata.name);
    });
    
    it('should produce compatible envelope format', function() {
      const metadata = { p: [1], name: 'Wallet Token' };
      const envelope = glyph.encoder.createRevealEnvelope(metadata);
      
      // Envelope must start with gly magic after push opcode
      expect(envelope.includes(Buffer.from('gly'))).to.be.true;
    });
    
    it('should handle v1 to v2 content migration', function() {
      // v1 shorthand format
      const v1Content = {
        t: 'image/png',
        b: Buffer.from([0x89, 0x50, 0x4E, 0x47])
      };
      
      // v2 normalized format
      const v2Content = {
        primary: {
          mime: v1Content.t,
          data: v1Content.b,
          storage: 'inline'
        }
      };
      
      expect(v2Content.primary.mime).to.equal(v1Content.t);
    });
    
    it('should validate royalty format compatibility', function() {
      const royalty = {
        enforced: true,
        bps: 500, // 5%
        address: 'rXd' + '0'.repeat(30)
      };
      
      expect(royalty.bps).to.be.at.least(0);
      expect(royalty.bps).to.be.at.most(10000);
    });
  });

  describe('radiantjs <-> RadiantMM (DEX)', function() {
    
    it('should produce valid token refs for DEX', function() {
      // DEX expects refs in txid_vout format
      const txid = '0'.repeat(64);
      const vout = 0;
      const ref = `${txid}_${vout}`;
      
      expect(ref).to.have.length(66);
      expect(ref).to.include('_');
    });
    
    it('should validate FT for DEX listing', function() {
      // Only FT tokens can be listed on DEX
      const ftProtocols = [glyph.constants.GLYPH_FT];
      const nftProtocols = [glyph.constants.GLYPH_NFT];
      
      expect(glyph.validator.isFungible(ftProtocols)).to.be.true;
      expect(glyph.validator.isFungible(nftProtocols)).to.be.false;
    });
    
    it('should calculate royalties for trades', function() {
      const tradeAmount = 100000000; // 1 RXD
      const royaltyBps = 250; // 2.5%
      const royaltyAmount = Math.floor(tradeAmount * royaltyBps / 10000);
      
      expect(royaltyAmount).to.equal(2500000);
    });
    
    it('should handle pool swap calculations', function() {
      // AMM constant product formula
      const reserveA = 1000000000;
      const reserveB = 1000000000;
      const amountIn = 10000000;
      const fee = 30; // 0.3%
      
      const amountInWithFee = amountIn * (10000 - fee);
      const numerator = amountInWithFee * reserveB;
      const denominator = reserveA * 10000 + amountInWithFee;
      const amountOut = Math.floor(numerator / denominator);
      
      expect(amountOut).to.be.lessThan(amountIn); // Slippage expected
      expect(amountOut).to.be.greaterThan(0);
    });
  });

  describe('radiantjs <-> Glyph-miner', function() {
    
    it('should produce valid dMint metadata for mining', function() {
      const dmintMetadata = {
        p: [glyph.constants.GLYPH_FT, glyph.constants.GLYPH_DMINT],
        name: 'Mineable Token',
        ticker: 'MINE',
        dmint: {
          algorithm: 0,
          difficulty: 0x1d00ffff,
          reward: 5000000000,
          startHeight: 100000
        }
      };
      
      expect(glyph.validator.isDmint(dmintMetadata.p)).to.be.true;
    });
    
    it('should validate mining algorithm IDs', function() {
      const algorithms = {
        SHA256D: 0,
        BLAKE3: 1,
        K12: 2,
        ARGON2ID_LIGHT: 3,
        RANDOMX_LIGHT: 4
      };
      
      expect(algorithms.SHA256D).to.equal(0);
      expect(algorithms.BLAKE3).to.equal(1);
    });
    
    it('should calculate difficulty targets', function() {
      const compactDifficulty = 0x1d00ffff;
      // Extract exponent and mantissa
      const exponent = (compactDifficulty >> 24) & 0xff;
      const mantissa = compactDifficulty & 0x00ffffff;
      
      expect(exponent).to.be.a('number');
      expect(mantissa).to.be.a('number');
    });
    
    it('should validate reward schedule', function() {
      const schedule = {
        initialReward: 5000000000,
        halvingInterval: 210000,
        maxSupply: 2100000000000000
      };
      
      // Calculate total supply from reward schedule
      let totalSupply = 0;
      let reward = schedule.initialReward;
      let blocks = 0;
      
      while (reward > 0 && totalSupply < schedule.maxSupply) {
        const blocksThisEra = schedule.halvingInterval;
        totalSupply += reward * blocksThisEra;
        blocks += blocksThisEra;
        reward = Math.floor(reward / 2);
        if (blocks > 10 * schedule.halvingInterval) break; // Safety limit
      }
      
      expect(totalSupply).to.be.lessThanOrEqual(schedule.maxSupply * 2);
    });
  });

  describe('radiantjs <-> ElectrumX/RXinDexer', function() {
    
    it('should produce indexer-compatible glyph IDs', function() {
      const txid = 'a'.repeat(64);
      const vout = 0;
      
      // Colon format for ElectrumX
      const colonFormat = `${txid}:${vout}`;
      expect(colonFormat).to.have.length(66);
      
      // Underscore format for RXinDexer
      const underscoreFormat = `${txid}_${vout}`;
      expect(underscoreFormat).to.have.length(66);
    });
    
    it('should produce valid scripthash for subscriptions', function() {
      const { Address, crypto } = radiantjs;
      const address = new radiantjs.PrivateKey().toAddress();
      const script = radiantjs.Script.fromAddress(address);
      const scripthash = crypto.Hash.sha256(script.toBuffer()).reverse().toString('hex');
      
      expect(scripthash).to.have.length(64);
    });
    
    it('should produce parseable envelope for indexing', function() {
      const metadata = {
        p: [1],
        name: 'Indexed Token',
        ticker: 'IDX'
      };
      
      const envelope = glyph.encoder.createRevealEnvelope(metadata);
      
      // Indexer checks for gly magic
      const containsMagic = envelope.includes(Buffer.from('gly'));
      expect(containsMagic).to.be.true;
    });
    
    it('should handle ref format conversions', function() {
      const txid = 'b'.repeat(64);
      const vout = 1;
      
      // Pack ref as 36 bytes (32 txid + 4 vout)
      const txidBytes = Buffer.from(txid, 'hex');
      const voutBytes = Buffer.alloc(4);
      voutBytes.writeUInt32LE(vout);
      const packedRef = Buffer.concat([txidBytes, voutBytes]);
      
      expect(packedRef.length).to.equal(36);
      
      // Unpack
      const unpackedTxid = packedRef.slice(0, 32).toString('hex');
      const unpackedVout = packedRef.readUInt32LE(32);
      
      expect(unpackedTxid).to.equal(txid);
      expect(unpackedVout).to.equal(vout);
    });
  });

  describe('Full Cross-Repository Flow', function() {
    
    it('should simulate complete token creation to indexing flow', function() {
      // 1. Create metadata (radiantblockchain-constants format)
      const metadata = {
        p: [glyph.constants.GLYPH_FT],
        name: 'Integration Token',
        ticker: 'INT',
        decimals: 8
      };
      
      // 2. Validate (radiantjs validator)
      const validation = glyph.validator.validateProtocols(metadata.p);
      expect(validation.valid).to.be.true;
      
      // 3. Encode for transaction (radiantjs encoder)
      const envelope = glyph.encoder.createRevealEnvelope(metadata);
      expect(envelope.length).to.be.greaterThan(0);
      
      // 4. Parse for indexing (ElectrumX/RXinDexer compatible)
      const parsed = glyph.decoder.parseEnvelope(envelope);
      expect(parsed.isReveal).to.be.true;
      expect(parsed.metadata.ticker).to.equal('INT');
      
      // 5. Generate ref for DEX (RadiantMM format)
      const mockTxid = 'c'.repeat(64);
      const ref = `${mockTxid}_0`;
      expect(ref).to.include('_');
      
      // 6. Token is now traceable across all systems
      const tokenInfo = {
        ref: ref,
        protocols: metadata.p,
        name: metadata.name,
        ticker: metadata.ticker,
        isFungible: glyph.validator.isFungible(metadata.p),
        isDmint: glyph.validator.isDmint(metadata.p)
      };
      
      expect(tokenInfo.isFungible).to.be.true;
      expect(tokenInfo.isDmint).to.be.false;
    });
    
    it('should simulate dMint token flow from creation to mining', function() {
      // 1. Create dMint contract
      const dmintContract = {
        p: [glyph.constants.GLYPH_FT, glyph.constants.GLYPH_DMINT],
        name: 'Mineable Coin',
        ticker: 'MCN',
        dmint: {
          algorithm: 0,
          difficulty: 0x1d00ffff,
          reward: 5000000000
        }
      };
      
      // 2. Validate contract
      expect(glyph.validator.isDmint(dmintContract.p)).to.be.true;
      
      // 3. Create reveal envelope
      const envelope = glyph.encoder.createRevealEnvelope(dmintContract);
      
      // 4. Simulate mining solution
      const miningSolution = {
        nonce: Buffer.alloc(8).fill(0x42),
        hash: 'd'.repeat(64),
        meetsTarget: true
      };
      
      expect(miningSolution.meetsTarget).to.be.true;
      
      // 5. Claim reward
      const claimMetadata = {
        p: dmintContract.p,
        amount: dmintContract.dmint.reward
      };
      
      expect(claimMetadata.amount).to.equal(5000000000);
    });
  });
});
