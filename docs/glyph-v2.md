# Glyph v2 Token Standard Guide

This guide covers using radiantjs with the Glyph v2 Token Standard for creating, parsing, and validating tokens on the Radiant blockchain.

## Installation

```bash
npm install @radiantblockchain/radiantjs
```

## Quick Start

```javascript
const radiantjs = require('@radiantblockchain/radiantjs');
const { Glyph } = radiantjs;

// Validate metadata
const metadata = {
  v: 2,
  type: 'token',
  p: [1], // GLYPH_FT
  ticker: 'TEST',
  name: 'Test Token'
};

const validation = Glyph.validateMetadata(metadata);
console.log(validation.valid); // true
```

## Protocol IDs

Glyph v2 defines 11 protocol IDs that can be combined:

| ID | Constant | Description |
|----|----------|-------------|
| 1 | `GLYPH_FT` | Fungible Token |
| 2 | `GLYPH_NFT` | Non-Fungible Token |
| 3 | `GLYPH_DAT` | Data Storage |
| 4 | `GLYPH_DMINT` | Decentralized Minting |
| 5 | `GLYPH_MUT` | Mutable State |
| 6 | `GLYPH_BURN` | Explicit Burn |
| 7 | `GLYPH_CONTAINER` | Container/Collection |
| 8 | `GLYPH_ENCRYPTED` | Encrypted Content |
| 9 | `GLYPH_TIMELOCK` | Timelocked Reveal |
| 10 | `GLYPH_AUTHORITY` | Issuer Authority |
| 11 | `GLYPH_WAVE` | WAVE Naming |

```javascript
const { GlyphProtocol } = Glyph;

// Fungible Token
const ftProtocols = [GlyphProtocol.GLYPH_FT];

// dMint Fungible Token
const dmintProtocols = [GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_DMINT];

// Mutable NFT
const mutableNft = [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT];
```

## Protocol Rules

### Requirements
Some protocols require others:

- `GLYPH_DMINT` requires `GLYPH_FT`
- `GLYPH_MUT` requires `GLYPH_NFT`
- `GLYPH_CONTAINER` requires `GLYPH_NFT`
- `GLYPH_ENCRYPTED` requires `GLYPH_NFT`
- `GLYPH_AUTHORITY` requires `GLYPH_NFT`
- `GLYPH_WAVE` requires `GLYPH_NFT` + `GLYPH_MUT`

### Exclusions
Some protocols are mutually exclusive:

- `GLYPH_FT` and `GLYPH_NFT` cannot be combined

```javascript
// Validate protocol combination
const result = Glyph.validateProtocols([1, 2]); // FT + NFT
console.log(result.valid); // false
console.log(result.error); // "Fungible Token and Non-Fungible Token are mutually exclusive"
```

## Encoding Metadata

### Create Commit Hash

```javascript
const metadata = {
  v: 2,
  type: 'token',
  p: [2], // NFT
  name: 'My NFT',
  content: {
    primary: {
      path: '/image.png',
      mime: 'image/png',
      size: 1024,
      hash: { algo: 'sha256', hex: 'abc123...' }
    }
  }
};

// Encode and get commit hash
const commitHash = Glyph.computeCommitHash(metadata);
console.log(commitHash.toString('hex'));
```

### Create Commit Envelope

```javascript
const commitEnvelope = Glyph.encodeCommitEnvelope({
  commitHash: commitHash,
  flags: 0,
  // Optional: contentRoot, controller
});
```

### Create Reveal Envelope

```javascript
const revealChunks = Glyph.encodeRevealEnvelope({
  metadata: metadata,
  files: [] // Optional inline file buffers
});
```

## Decoding Transactions

### Check for Glyph Data

```javascript
const isGlyph = Glyph.isGlyphTransaction(tx);
```

### Parse Glyph Transaction

```javascript
const parsed = Glyph.parseGlyphTransaction(tx);

if (parsed) {
  console.log(parsed.type); // 'commit' or 'reveal'
  console.log(parsed.envelope);
  
  if (parsed.envelope.isReveal) {
    console.log(parsed.envelope.metadata);
  }
}
```

### Decode Metadata

```javascript
const metadataBytes = Buffer.from('{"v":2,"p":[1],"ticker":"TEST"}');
const decoded = Glyph.decodeMetadata(metadataBytes);
console.log(decoded.ticker); // 'TEST'
```

## Validation

### Validate Complete Metadata

```javascript
const result = Glyph.validateMetadata({
  v: 2,
  type: 'token',
  p: [2],
  name: 'Test NFT',
  content: {
    primary: {
      path: '/image.png',
      mime: 'image/png',
      size: 1024,
      hash: { algo: 'sha256', hex: 'abc...' }
    }
  }
});

if (!result.valid) {
  console.log('Errors:', result.errors);
}
```

### Quick Validation

```javascript
const isValid = Glyph.isValidGlyph(metadata);
```

## Token Type Detection

```javascript
const { getTokenType } = require('./lib/glyph/validator');

getTokenType([1]);           // 'Fungible Token'
getTokenType([1, 4]);        // 'dMint Fungible Token'
getTokenType([2]);           // 'NFT'
getTokenType([2, 5]);        // 'Mutable NFT'
getTokenType([2, 7]);        // 'Container'
getTokenType([2, 10]);       // 'Authority Token'
getTokenType([2, 5, 11]);    // 'WAVE Name'
```

## Glyph ID Format

Glyph IDs follow the format `txid:vout`:

```javascript
const glyphId = Glyph.getGlyphId('abc123...', 0);
// 'abc123...:0'

const { txid, vout } = Glyph.parseGlyphId('abc123...:0');
// { txid: 'abc123...', vout: 0 }
```

## Constants

### Size Limits

```javascript
const { GlyphLimits } = Glyph;

GlyphLimits.MAX_NAME_SIZE      // 256 bytes
GlyphLimits.MAX_DESC_SIZE      // 4096 bytes
GlyphLimits.MAX_METADATA_SIZE  // 262144 bytes (256 KB)
GlyphLimits.MAX_PROTOCOLS      // 16
```

### Algorithms (for dMint)

```javascript
const { DmintAlgorithm } = Glyph;

DmintAlgorithm.SHA256D         // 0x00
DmintAlgorithm.BLAKE3          // 0x01
DmintAlgorithm.K12             // 0x02
DmintAlgorithm.ARGON2ID_LIGHT  // 0x03
DmintAlgorithm.RANDOMX_LIGHT   // 0x04
```

### DAA Modes (for dMint)

```javascript
const { DaaMode } = Glyph;

DaaMode.FIXED     // 0x00 - Static difficulty
DaaMode.EPOCH     // 0x01 - Bitcoin-style periodic
DaaMode.ASERT     // 0x02 - Exponential moving average
DaaMode.LWMA      // 0x03 - Linear weighted moving average
DaaMode.SCHEDULE  // 0x04 - Predetermined curve
```

## Related Resources

- [Glyph v2 Token Standard Whitepaper](https://github.com/Radiant-Core/Glyph-Token-Standards)
- [REP-3001: Token Types](https://github.com/Radiant-Core/REP)
- [RadiantScript Contract Templates](https://github.com/Radiant-Core/RadiantScript)
- [@radiantblockchain/constants](https://github.com/Radiant-Core/radiantblockchain-constants)
