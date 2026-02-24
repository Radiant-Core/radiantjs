# Developer's Guide: Glyph v2 Tokens with radiantjs

This guide provides a practical walkthrough for using `radiantjs` to create, parse, and manage Glyph v2 tokens on the Radiant blockchain.

## Installation

```bash
npm install @radiant-core/radiantjs
```

## Quick Start: Creating an NFT

This example demonstrates the complete end-to-end process of creating a new NFT, from defining metadata to building the commit and reveal transactions.

```javascript
import { Transaction, PrivateKey, Glyph, Script } from '@radiant-core/radiantjs';

// --- 1. Setup ---
const privateKey = new PrivateKey('your-private-key-in-WIF-format');
const address = privateKey.toAddress();
console.log(`Creator address: ${address.toString()}`);

// You need UTXOs to fund the transactions. Get these from an indexer.
const utxos = [
    {
        txId: '...',
        outputIndex: 0,
        script: Script.fromAddress(address).toHex(),
        satoshis: 100000 
    }
];

// --- 2. Define NFT Metadata ---
const metadata = {
  v: 2,
  p: [Glyph.Protocol.GLYPH_NFT], // Use the constant for clarity
  name: 'My Radiant NFT',
  desc: 'A unique digital asset, created with radiantjs.',
  content: {
    primary: {
      path: 'image.jpg',
      mime: 'image/jpeg',
      storage: 'inline' // Indicates the image data will be in the transaction
    }
  }
};

// --- 3. Prepare Image Content ---
// In a real app, you would load a file here.
const imageBuffer = Buffer.from('This is a placeholder for the actual image data');

// --- 4. Create the Glyph Object ---
const glyph = new Glyph(metadata, imageBuffer);

// --- 5. Build the Commit Transaction ---
// This transaction creates the reference and commits to the metadata hash.
const commitTx = new Transaction()
    .from(utxos)
    .addGlyph(glyph.commit(address, 1)) // Commit to your own address, 1 photon backing
    .change(address)
    .sign(privateKey);

const serializedCommitTx = commitTx.serialize();
console.log(`Commit Transaction ID: ${commitTx.id}`);
// You would broadcast this transaction and wait for it to be mined.

// --- 6. Build the Reveal Transaction ---
// This transaction spends the commit output and reveals the full metadata.
const commitUtxo = {
    txId: commitTx.id,
    outputIndex: 0, // The commit output is usually the first one
    script: Script.fromAddress(address).toHex(),
    satoshis: 1
};

// You may need a separate UTXO to pay for the reveal transaction's fee
const fundingUtxo = utxos[0]; 

const revealTx = new Transaction()
    .from([commitUtxo, fundingUtxo])
    .addGlyph(glyph.reveal(address, 1)) // Reveal and create the final token
    .change(address)
    .sign(privateKey);

const serializedRevealTx = revealTx.serialize();
console.log(`Reveal Transaction (GlyphID): ${revealTx.id}:0`);
// Broadcast this transaction to finalize the NFT creation.
```

## Protocol IDs

Glyph v2 features are enabled by combining Protocol IDs. `radiantjs` provides constants for these.

| ID | Constant | Description |
|----|----------|-------------|
| 1 | `GLYPH_FT` | Fungible Token |
| 2 | `GLYPH_NFT` | Non-Fungible Token |
| ... | ... | (and so on for all 11 protocols) |

```javascript
import { Glyph } from '@radiant-core/radiantjs';

// Simple Fungible Token
const ftProtocols = [Glyph.Protocol.GLYPH_FT];

// A dMint (mineable) Fungible Token
const dmintProtocols = [Glyph.Protocol.GLYPH_FT, Glyph.Protocol.GLYPH_DMINT];

// A Mutable NFT
const mutableNft = [Glyph.Protocol.GLYPH_NFT, Glyph.Protocol.GLYPH_MUT];
```

## Validation

You can validate metadata and protocol rules before creating transactions.

### Validate Metadata

This checks for correct types, size limits, and required fields.

```javascript
const result = Glyph.validateMetadata(metadata);
if (!result.valid) {
  console.error('Metadata validation errors:', result.errors);
}
```

### Validate Protocol Combinations

This checks for dependencies (e.g., `GLYPH_DMINT` requires `GLYPH_FT`) and exclusions (e.g., `GLYPH_FT` and `GLYPH_NFT` are mutually exclusive).

```javascript
const result = Glyph.validateProtocols([1, 2]); // FT + NFT
console.log(result.valid); // false
console.log(result.error); // "Fungible Token and Non-Fungible Token are mutually exclusive"
```

## Parsing Glyph Transactions

You can parse any raw transaction to see if it contains Glyph data.

```javascript
import { Transaction, Glyph } from '@radiant-core/radiantjs';

const tx = new Transaction('...raw-tx-hex...');

if (Glyph.isGlyphTransaction(tx)) {
    const parsed = Glyph.parseGlyphTransaction(tx);
    
    if (parsed) {
        console.log(`Glyph Type: ${parsed.type}`); // 'commit' or 'reveal'
      
        if (parsed.envelope.isReveal) {
            console.log('Metadata:', parsed.envelope.metadata);
            console.log('Files:', parsed.envelope.files);
        } else {
            console.log('Commit Hash:', parsed.envelope.commitHash.toString('hex'));
        }
    }
}
```

## Related Resources

- **Whitepaper**: [Glyph v2 Token Standard](https://github.com/Radiant-Core/Glyph-Token-Standards/blob/main/Glyph_v2_Token_Standard_Whitepaper.md)
- **Technical Reference**: [RXinDexer Documentation](https://github.com/Radiant-Core/RXinDexer/tree/main/docs)
- **Smart Contracts**: [RadiantScript Contract Templates](https://github.com/Radiant-Core/RadiantScript)
