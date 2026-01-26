# Glyph v2 Token Deployment Guide

This guide covers deploying Glyph v2 tokens on the Radiant blockchain using `radiantjs`.

## Prerequisites

```bash
npm install @radiantblockchain/radiantjs @radiantblockchain/constants
```

## Quick Start

### 1. Create Token Metadata

```javascript
const { Glyph } = require('@radiantblockchain/radiantjs');
const { GlyphProtocol, GlyphVersion } = require('@radiantblockchain/constants');

// Fungible Token
const ftMetadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_FT],
  ticker: 'TEST',
  name: 'Test Token',
  decimals: 8,
  max: '2100000000000000', // 21M with 8 decimals
};

// NFT
const nftMetadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_NFT],
  name: 'My NFT',
  content: {
    type: 'image/png',
    hash: '<sha256-of-content>',
  },
};
```

### 2. Commit-Reveal Pattern

Glyph v2 uses a two-step commit-reveal pattern:

```javascript
// Step 1: Create commit transaction
const commitHash = Glyph.Encoder.computeCommitHash(metadata);
const commitEnvelope = Glyph.Encoder.encodeCommitEnvelope({ commitHash });

// Build commit TX with OP_RETURN containing commitEnvelope
// Wait for confirmation...

// Step 2: Create reveal transaction
const revealChunks = Glyph.Encoder.encodeRevealEnvelope({ metadata });

// Build reveal TX with OP_RETURN containing revealChunks
// Reference the commit TX output
```

## Token Types

### Fungible Token (FT)

```javascript
const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_FT],
  ticker: 'MYTOKEN',
  name: 'My Token',
  decimals: 8,
  max: '100000000000000000', // Optional max supply
  description: 'A fungible token on Radiant',
};
```

### dMint Fungible Token

For proof-of-work distributed minting:

```javascript
const { DmintAlgorithm, DaaMode } = require('@radiantblockchain/constants');

const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_FT, GlyphProtocol.GLYPH_DMINT],
  ticker: 'MINE',
  name: 'Mineable Token',
  decimals: 8,
  dmint: {
    max: '10000000000000000',
    reward: '5000000000',
    algo: DmintAlgorithm.BLAKE3,
    daa: DaaMode.ASERT,
    diff: '00000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  },
};
```

**Supported Algorithms:**
- `SHA256D` (0) - Double SHA256
- `BLAKE3` (1) - Blake3 hash
- `K12` (2) - KangarooTwelve
- `ARGON2ID_LIGHT` (3) - Memory-hard
- `RANDOMX_LIGHT` (4) - CPU-optimized

**DAA Modes:**
- `FIXED` (0) - Constant difficulty
- `EPOCH` (1) - Epoch-based adjustment
- `ASERT` (2) - ASERT algorithm
- `LWMA` (3) - LWMA algorithm
- `SCHEDULE` (4) - Creator-defined schedule

### Non-Fungible Token (NFT)

```javascript
const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_NFT],
  name: 'Unique Art #1',
  content: {
    type: 'image/png',
    hash: '<sha256>',
    size: 1024000,
  },
  attributes: [
    { trait_type: 'Background', value: 'Blue' },
    { trait_type: 'Rarity', value: 'Legendary' },
  ],
};
```

### Mutable NFT

For NFTs with updateable state:

```javascript
const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT],
  name: 'Game Character',
  content: { type: 'application/json', hash: '<hash>' },
  state: {
    level: 1,
    xp: 0,
    inventory: [],
  },
};
```

### Container (Collection)

```javascript
const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_CONTAINER],
  name: 'My NFT Collection',
  container: {
    type: 'collection',
    max: 10000,
  },
  content: { type: 'application/json', hash: '<hash>' },
};
```

### Authority Token

For delegated minting rights:

```javascript
const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_AUTHORITY],
  name: 'Mint Authority',
  authority: {
    type: 'issuer',
    target: '<token-ref-72-hex>',
  },
  content: { type: 'application/json', hash: '<hash>' },
};
```

### WAVE Name

Human-readable naming:

```javascript
const metadata = {
  v: GlyphVersion.V2,
  p: [GlyphProtocol.GLYPH_NFT, GlyphProtocol.GLYPH_MUT, GlyphProtocol.GLYPH_WAVE],
  name: 'myname.rxd',
  wave: {
    name: 'myname',
    tld: 'rxd',
  },
  content: { type: 'application/json', hash: '<hash>' },
};
```

## Validation

Always validate before deployment:

```javascript
const { validateProtocols, validateMetadata } = require('@radiantblockchain/radiantjs').Glyph.Validator;

// Validate protocol combination
const protocolResult = validateProtocols(metadata.p);
if (!protocolResult.valid) {
  console.error('Invalid protocols:', protocolResult.error);
}

// Validate full metadata
const metadataResult = validateMetadata(metadata);
if (!metadataResult.valid) {
  console.error('Invalid metadata:', metadataResult.errors);
}
```

## Size Limits

| Limit | Value |
|-------|-------|
| Max metadata size | 65,536 bytes |
| Max inline file size | 1,048,576 bytes |
| Max total inline size | 10,485,760 bytes |
| Max protocols | 16 |

## Glyph ID Format

Tokens are identified by `txid:vout`:

```javascript
const { getGlyphId, parseGlyphId } = require('@radiantblockchain/radiantjs').Glyph.Decoder;

const glyphId = getGlyphId(txid, vout);
// "abc123...def:0"

const { txid, vout } = parseGlyphId(glyphId);
```

## Best Practices

1. **Always validate** metadata before creating transactions
2. **Use canonical JSON** - keys are automatically sorted
3. **Include content hashes** for off-chain content
4. **Test on testnet** before mainnet deployment
5. **Store content** on reliable infrastructure (IPFS, etc.)

## Example: Complete FT Deployment

```javascript
const radiantjs = require('@radiantblockchain/radiantjs');
const { GlyphProtocol, GlyphVersion } = require('@radiantblockchain/constants');

async function deployFungibleToken(privateKey, utxos) {
  const { Glyph, Transaction, PrivateKey } = radiantjs;
  
  // 1. Create metadata
  const metadata = {
    v: GlyphVersion.V2,
    p: [GlyphProtocol.GLYPH_FT],
    ticker: 'MYFT',
    name: 'My Fungible Token',
    decimals: 8,
  };
  
  // 2. Validate
  const validation = Glyph.Validator.validateMetadata(metadata);
  if (!validation.valid) {
    throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
  }
  
  // 3. Create commit hash
  const commitHash = Glyph.Encoder.computeCommitHash(metadata);
  
  // 4. Build commit transaction
  const commitTx = new Transaction()
    .from(utxos[0])
    .addData(Glyph.Encoder.encodeCommitEnvelope({ commitHash }))
    .change(privateKey.toAddress())
    .sign(privateKey);
  
  // 5. Broadcast commit TX and wait for confirmation
  // const commitTxid = await broadcast(commitTx);
  
  // 6. Build reveal transaction
  const revealChunks = Glyph.Encoder.encodeRevealEnvelope({ metadata });
  const revealTx = new Transaction()
    .from(/* commit output */)
    .addData(revealChunks)
    .change(privateKey.toAddress())
    .sign(privateKey);
  
  // 7. Broadcast reveal TX
  // const revealTxid = await broadcast(revealTx);
  
  return { commitTx, revealTx, metadata };
}
```

## Resources

- [Glyph v2 Whitepaper](https://github.com/Radiant-Core/Glyph-Token-Standards)
- [REP-3001: Glyph Token Standard](https://github.com/Radiant-Core/REP/blob/master/REP-3001.md)
- [radiantjs Documentation](https://github.com/Radiant-Core/radiantjs)
- [Radiant Explorer](https://explorer.radiant.network)

## Support

- GitHub Issues: [Radiant-Core/radiantjs](https://github.com/Radiant-Core/radiantjs/issues)
- Discord: [Radiant Community](https://discord.gg/radiant)
