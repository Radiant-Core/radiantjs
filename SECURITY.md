# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in radiantjs, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email: info@radiantfoundation.org
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release

## Security Best Practices

When using radiantjs in your application:

### Key Management

```javascript
// ✅ DO: Generate keys securely
const key = radiant.PrivateKey.fromRandom();

// ✅ DO: Use environment variables
const key = new radiant.PrivateKey(process.env.PRIVATE_KEY);

// ❌ DON'T: Hardcode private keys
const key = new radiant.PrivateKey('WIF_HERE'); // NEVER!
```

### Transaction Signing

```javascript
// ✅ DO: Verify transaction before signing
const tx = new radiant.Transaction();
// ... build transaction
console.log('Outputs:', tx.outputs);
console.log('Fee:', tx.getFee());
// Review before signing
tx.sign(privateKey);

// ✅ DO: Validate addresses
if (!radiant.Address.isValid(recipientAddress)) {
  throw new Error('Invalid address');
}
```

### Browser Security

- Use Content Security Policy (CSP) headers
- Never store keys in localStorage without encryption
- Use Web Crypto API for key derivation when possible
- Validate all user inputs

## Known Limitations

1. **No Hardware Security Module (HSM) support**: Keys are managed in memory
2. **Browser environment**: Subject to browser security model
3. **Timing attacks**: `elliptic` has an open low-severity timing advisory (GHSA-848j-6mx2-7j84) with no upstream fix; ECIES MAC compares and the ECDSA `r==x` check use constant-time paths inside this library, but the underlying scalar arithmetic still depends on `elliptic`.
4. **Some opcodes are JS-no-ops**: CHECKDATASIG/CHECKDATASIGVERIFY and the dMint introspection family are implemented in Radiant-Core but not yet in the JS interpreter; they emit a one-shot runtime warning and may silently disagree with consensus when simulating scripts that use them.
5. **Legacy non-ForkId sighash**: only present for parsing historical fixtures; computing one emits a runtime warning. Set `Sighash.strict = true` to convert into a throw.

## Dependency Security

This package monitors dependencies for vulnerabilities:

- `elliptic`: ^6.5.7 (open low-severity timing advisory; track upstream)
- `bn.js`: ^4.12.3 (GHSA-378v-28hj-76wf patched; the vendored copy in `lib/bn.js` has the same backport)
- `@noble/hashes`: ^1.5.0 (audited Blake3/K12 used for OP_BLAKE3/OP_K12 consensus)
- Regular `npm audit` checks recommended

## Changelog

### Security Updates

- **2026-05-28** (v2.0.4): Consensus / safety hardening from a full library audit:
  - **Glyph commit hash is double SHA-256** (`OP_HASH256`) - matches Photonic-Wallet, Glyph-miner, and the indexer. Pre-2.0.4 used single SHA-256; commits produced by it would be rejected on broadcast.
  - **Glyph metadata encoded as CBOR** (was JSON). Interoperates with the rest of the Glyph ecosystem.
  - Enforce script/opcode caps (32 M) matching Radiant-Core; previously unbounded.
  - Enforce OP_BLAKE3 ≤1024 byte and OP_K12 ≤8192 byte input caps; gate behind `SCRIPT_ENHANCED_REFERENCES`.
  - Enforce OP_LSHIFT/OP_RSHIFT shift-count bounds (fixes DoS-grade memory blow-up).
  - Bump default fee floor to 10,000 photons/byte (mainnet post-V2 relay floor).
  - Backport `bn.js` 4.12.3 patch (GHSA-378v-28hj-76wf) into the vendored copy.
  - Restore explicit guard around the browser CSPRNG path.
  - ECIES MAC compare now constant-time on both bitcore-ecies and electrum-ecies.
  - `Message.verify` now rejects high-S (malleable) signatures.
  - Fixed HMAC `key.length` comparison typo in `Hash.hmac` (latent benign bug).
  - Copy stack in `_callbackStack` (mirror existing `_callbackStep` fix).
  - Add `Mnemonic.RADIANT_DEFAULT_PATH = m/44'/512'/0'/0` and `toHDPrivateKeyAtDefaultPath`.
  - P2SH builders now emit a one-shot deprecation warning (strict-mode throw available).
  - 14-vector self-consistency battery for ForkId sighash (every type × ANYONECANPAY) plus an 8-vector byte-exact cross-validation suite against an independent Python re-implementation of the Radiant `SignatureHash` algorithm. Zero divergence between the JS and Python implementations.
  - Updated mainnet/testnet/regtest network constants from Radiant-Core (ports, seeds, prefixes).
- **2026-01-27** (v1.x → 2.0.x): Updated elliptic to ^6.5.7, bn.js to ^4.12.0, webpack to ^5.90.0
