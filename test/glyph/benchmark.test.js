'use strict';

/**
 * Performance Benchmarks for Glyph Operations
 * 
 * Measures performance of:
 * - CBOR encoding/decoding
 * - Protocol validation
 * - Envelope creation/parsing
 * - Hash computations
 * - Signature operations
 */

const chai = require('chai');
const expect = chai.expect;

const radiantjs = require('../../');
const glyph = require('../../lib/glyph');
const crypto = radiantjs.crypto;

describe('Glyph Performance Benchmarks', function() {
  
  // Increase timeout for benchmarks
  this.timeout(30000);
  
  const ITERATIONS = 1000;
  const WARMUP_ITERATIONS = 100;
  
  /**
   * Run a benchmark and return stats
   */
  function benchmark(name, fn, iterations = ITERATIONS) {
    // Warmup
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      fn();
    }
    
    // Timed run
    const start = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = process.hrtime.bigint();
    
    const totalNs = Number(end - start);
    const avgNs = totalNs / iterations;
    const avgMs = avgNs / 1_000_000;
    const opsPerSec = Math.floor(1_000_000_000 / avgNs);
    
    return {
      name,
      iterations,
      totalMs: totalNs / 1_000_000,
      avgNs,
      avgMs,
      opsPerSec
    };
  }
  
  /**
   * Format benchmark result
   */
  function formatResult(result) {
    return `${result.name}: ${result.avgMs.toFixed(3)}ms avg, ${result.opsPerSec.toLocaleString()} ops/sec`;
  }

  describe('CBOR Encoding Performance', function() {
    
    it('should benchmark simple metadata encoding', function() {
      const metadata = {
        p: [1],
        name: 'Benchmark Token',
        ticker: 'BNK'
      };
      
      const result = benchmark('Simple CBOR Encode', () => {
        glyph.encoder.encodeMetadata(metadata);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(1000);
    });
    
    it('should benchmark complex metadata encoding', function() {
      const metadata = {
        p: [2, 5],
        name: 'Complex NFT with Lots of Data',
        desc: 'A very detailed description that contains a lot of text to simulate real-world NFT metadata with extended descriptions.',
        attrs: {
          rarity: 'legendary',
          power: 9001,
          element: 'fire',
          tags: ['rare', 'powerful', 'unique', 'collectible']
        },
        royalty: {
          enforced: true,
          bps: 500,
          address: 'rXd' + '0'.repeat(30)
        }
      };
      
      const result = benchmark('Complex CBOR Encode', () => {
        glyph.encoder.encodeMetadata(metadata);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(500);
    });
    
    it('should benchmark metadata with binary content', function() {
      const imageData = Buffer.alloc(1024).fill(0x42); // 1KB fake image
      const metadata = {
        p: [2],
        name: 'NFT with Image',
        main: {
          t: 'image/png',
          b: imageData
        }
      };
      
      const result = benchmark('Binary Content Encode', () => {
        glyph.encoder.encodeMetadata(metadata);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(100);
    });
  });

  describe('CBOR Decoding Performance', function() {
    
    it('should benchmark simple metadata decoding', function() {
      const metadata = { p: [1], name: 'Decode Test', ticker: 'DEC' };
      const encoded = glyph.encoder.encodeMetadata(metadata);
      
      const result = benchmark('Simple CBOR Decode', () => {
        glyph.decoder.decodeMetadata(encoded);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(1000);
    });
    
    it('should benchmark complex metadata decoding', function() {
      const metadata = {
        p: [2, 5, 7],
        name: 'Complex Decode Test',
        desc: 'Long description '.repeat(10),
        attrs: { a: 1, b: 2, c: 3, d: 4, e: 5 }
      };
      const encoded = glyph.encoder.encodeMetadata(metadata);
      
      const result = benchmark('Complex CBOR Decode', () => {
        glyph.decoder.decodeMetadata(encoded);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(500);
    });
  });

  describe('Protocol Validation Performance', function() {
    
    it('should benchmark simple protocol validation', function() {
      const protocols = [1];
      
      const result = benchmark('Simple Validation', () => {
        glyph.validator.validateProtocols(protocols);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10000);
    });
    
    it('should benchmark complex protocol validation', function() {
      const protocols = [2, 5, 8, 9]; // NFT + MUT + ENCRYPTED + TIMELOCK
      
      const result = benchmark('Complex Validation', () => {
        glyph.validator.validateProtocols(protocols);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(5000);
    });
    
    it('should benchmark invalid protocol detection', function() {
      const invalidProtocols = [1, 2]; // FT + NFT (invalid)
      
      const result = benchmark('Invalid Detection', () => {
        glyph.validator.validateProtocols(invalidProtocols);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(5000);
    });
    
    it('should benchmark token type detection', function() {
      const protocols = [1, 4]; // dMint FT
      
      const result = benchmark('Token Type Detection', () => {
        glyph.validator.getTokenType(protocols);
        glyph.validator.isFungible(protocols);
        glyph.validator.isDmint(protocols);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(5000);
    });
  });

  describe('Envelope Operations Performance', function() {
    
    it('should benchmark envelope creation', function() {
      const metadata = { p: [2], name: 'Envelope Test' };
      
      const result = benchmark('Envelope Creation', () => {
        glyph.encoder.createRevealEnvelope(metadata);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(500);
    });
    
    it('should benchmark envelope parsing', function() {
      const metadata = { p: [2], name: 'Parse Test' };
      const envelope = glyph.encoder.createRevealEnvelope(metadata);
      
      const result = benchmark('Envelope Parsing', () => {
        glyph.decoder.parseEnvelope(envelope);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(500);
    });
    
    it('should benchmark commit hash computation', function() {
      const metadata = { p: [1], name: 'Hash Test', ticker: 'HSH' };
      
      const result = benchmark('Commit Hash', () => {
        glyph.encoder.computeCommitHash(metadata);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(500);
    });
  });

  describe('Cryptographic Operations Performance', function() {
    
    it('should benchmark SHA256 hashing', function() {
      const data = Buffer.alloc(256).fill(0x42);
      
      const result = benchmark('SHA256 (256 bytes)', () => {
        crypto.Hash.sha256(data);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10000);
    });
    
    it('should benchmark SHA256D (double hash)', function() {
      const data = Buffer.alloc(256).fill(0x42);
      
      const result = benchmark('SHA256D (256 bytes)', () => {
        crypto.Hash.sha256sha256(data);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(5000);
    });
    
    it('should benchmark RIPEMD160', function() {
      const data = Buffer.alloc(256).fill(0x42);
      
      const result = benchmark('RIPEMD160 (256 bytes)', () => {
        crypto.Hash.ripemd160(data);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10000);
    });
    
    it('should benchmark key generation', function() {
      const result = benchmark('PrivateKey Generation', () => {
        new radiantjs.PrivateKey();
      }, 100); // Fewer iterations for slow op
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10);
    });
    
    it('should benchmark signature creation', function() {
      const privateKey = new radiantjs.PrivateKey();
      const message = crypto.Hash.sha256(Buffer.from('test message'));
      
      const result = benchmark('ECDSA Sign', () => {
        crypto.ECDSA.sign(message, privateKey);
      }, 100);
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10);
    });
    
    it('should benchmark signature verification', function() {
      const privateKey = new radiantjs.PrivateKey();
      const publicKey = privateKey.toPublicKey();
      const message = crypto.Hash.sha256(Buffer.from('test message'));
      const signature = crypto.ECDSA.sign(message, privateKey);
      
      const result = benchmark('ECDSA Verify', () => {
        crypto.ECDSA.verify(message, signature, publicKey);
      }, 100);
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10);
    });
  });

  describe('Script Operations Performance', function() {
    
    it('should benchmark P2PKH script creation', function() {
      const address = new radiantjs.PrivateKey().toAddress();
      
      const result = benchmark('P2PKH Script', () => {
        radiantjs.Script.fromAddress(address);
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(1000);
    });
    
    it('should benchmark scripthash computation', function() {
      const address = new radiantjs.PrivateKey().toAddress();
      const script = radiantjs.Script.fromAddress(address);
      const scriptBuffer = script.toBuffer();
      
      const result = benchmark('Scripthash', () => {
        crypto.Hash.sha256(scriptBuffer).reverse();
      });
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10000);
    });
  });

  describe('Batch Processing Performance', function() {
    
    it('should benchmark batch token validation', function() {
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        tokens.push({
          p: [i % 2 === 0 ? 1 : 2],
          name: `Token ${i}`
        });
      }
      
      const result = benchmark('Batch Validate (100)', () => {
        for (const token of tokens) {
          glyph.validator.validateProtocols(token.p);
        }
      }, 100);
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(50);
    });
    
    it('should benchmark batch encoding', function() {
      const tokens = [];
      for (let i = 0; i < 100; i++) {
        tokens.push({
          p: [1],
          name: `Token ${i}`,
          ticker: `TK${i}`
        });
      }
      
      const result = benchmark('Batch Encode (100)', () => {
        for (const token of tokens) {
          glyph.encoder.encodeMetadata(token);
        }
      }, 100);
      
      console.log(`    ${formatResult(result)}`);
      expect(result.opsPerSec).to.be.greaterThan(10);
    });
  });

  describe('Memory Usage Benchmarks', function() {
    
    it('should measure encoding memory overhead', function() {
      const baseMemory = process.memoryUsage().heapUsed;
      const encodedBuffers = [];
      
      for (let i = 0; i < 1000; i++) {
        const metadata = { p: [1], name: `Token ${i}` };
        encodedBuffers.push(glyph.encoder.encodeMetadata(metadata));
      }
      
      const afterMemory = process.memoryUsage().heapUsed;
      const memoryPerToken = (afterMemory - baseMemory) / 1000;
      
      console.log(`    Memory per encoded token: ${Math.round(memoryPerToken)} bytes`);
      expect(memoryPerToken).to.be.lessThan(10000); // Less than 10KB per token
    });
  });

  describe('Benchmark Summary', function() {
    
    it('should output summary of all benchmarks', function() {
      console.log('\n    === BENCHMARK SUMMARY ===');
      console.log('    Minimum acceptable performance thresholds:');
      console.log('    - CBOR Encode/Decode: >500 ops/sec');
      console.log('    - Protocol Validation: >5000 ops/sec');
      console.log('    - Envelope Operations: >500 ops/sec');
      console.log('    - SHA256: >10000 ops/sec');
      console.log('    - ECDSA Sign/Verify: >10 ops/sec');
      console.log('    - Batch (100 items): >10 ops/sec');
      console.log('    ===========================\n');
      
      expect(true).to.be.true;
    });
  });
});
