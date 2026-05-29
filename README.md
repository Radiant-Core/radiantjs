RadiantJS
===

Javascript Radiant Blockchain (RXD) library.

https://radiantblockchain.org

```
npm install @radiant-core/radiantjs
```

Changelog
---------

**2.0.4** (May 2026) — Security & consensus audit

* **Consensus**: enforce `MAX_SCRIPT_SIZE = MAX_OPCODE_COUNT = 32,000,000` (previously `Number.MAX_SAFE_INTEGER`).
* **Consensus**: cap `OP_BLAKE3` at 1024 bytes and `OP_K12` at 8192 bytes; gate both behind `SCRIPT_ENHANCED_REFERENCES`. Matches Radiant-Core's single-chunk/single-block hashers.
* **Consensus**: `OP_LSHIFT`/`OP_RSHIFT` now reject shift counts `< 0` or `> 8 × vch.size()` (fixes a DoS-grade memory blow-up from unbounded `bn.ushln`).
* **Policy**: default `FEE_PER_KB` bumped 100× to `10_000_000` photons/KB (10,000 photons/byte) — the post-V2 mainnet relay floor. Old default produced txs every node refused.
* **Policy**: `DUST_AMOUNT` raised from 1 → 546 to mirror common-floor policy.
* **Network**: rewrote mainnet/testnet/regtest port + seeds + cashaddr prefix from Radiant-Core (`chainparams.cpp`). Mainnet port is **7333**, seeds `seed.radiantcore.org` et al., prefix `radaddr`.
* **Security**: backport `bn.js` 4.12.3 (GHSA-378v-28hj-76wf, infinite-loop DoS in modular reduction) into both the dep and the vendored `lib/bn.js`.
* **Security**: ECIES MAC compare is now constant-time (both bitcore-ecies and electrum-ecies).
* **Security**: `Message.verify` rejects high-S (malleable) signatures.
* **Security**: restored an explicit guard around the browser CSPRNG path so a missing Web Crypto API throws clearly instead of crashing deep inside `PrivateKey.fromRandom`.
* **Correctness**: implement `OP_REVERSEBYTES` (was a silent no-op).
* **Correctness**: `_callbackStack` listener now receives a copy of the stack (mirrors the 2.0.0 `_callbackStep` fix).
* **Correctness**: `Hash.hmac` typo `key < blocksize` → `key.length < blocksize` (latent benign bug).
* **Wallet**: `Mnemonic.RADIANT_DEFAULT_PATH = "m/44'/512'/0'/0"` and `Mnemonic.prototype.toHDPrivateKeyAtDefaultPath` so wallets don't roll their own derivation string and risk using coin type 0.
* **Wallet**: P2SH builders (`Address.payingTo`, `createMultisig`) emit a one-shot deprecation warning; set `Address.strictP2SH = true` to convert into a throw.
* **Test coverage**: 14-vector self-consistency battery for the ForkId sighash path (all six type × ANYONECANPAY combinations, sign/verify round-trip, SIGHASH_SINGLE out-of-range guard, byte-change sensitivity, 64-bit amount), plus an 8-vector **byte-exact cross-validation suite** against an independent Python reference implementation of the Radiant `SignatureHash` algorithm (sourced directly from `Radiant-Core/src/script/interpreter.cpp`). Reference impl ships at `test/data/sighash_radiant_reference.py`; fixtures at `test/data/sighash_radiant.json`. Zero divergence found.
* **Hygiene**: re-export `ECIES`/`Message`/`Mnemonic` from the main module so they match the type declarations; drop `Unit` from `radiant.d.ts` (no runtime impl); fill in missing top-level type declarations (`version`, `MerkleBlock`, `encoding.*`, `util.*`, `errors`, `deps.*`).
* **Glyph (consensus)**: `computeCommitHash` now returns **double SHA-256** (`OP_HASH256`) instead of single SHA-256. Photonic-Wallet's commit script literally executes `OP_HASH256 <commitHash> OP_EQUALVERIFY` against the reveal payload — every commit produced by pre-2.0.4 radiantjs would have been rejected on broadcast.
* **Glyph (interop)**: metadata is now encoded as **CBOR** (via `cbor-x`) to match Photonic-Wallet, Glyph-miner, and the RXinDexer indexer. Legacy JSON encoding remains available via `encoder.useJson = true`. Decoder sniffs CBOR vs JSON automatically so it can read both forms.
* **Glyph**: stricter validator (hash hex format + digest-size check, empty `royalty.splits` rejection, accept v1 `main` shorthand for NFT content). `parseGlyphTransaction` now returns every commit + reveal envelope (not just the first). `parseGlyphId` is strict (64-char hex txid, integer vout). Decoder rejects reserved-bit envelope flags; encoder masks them off. `canonicalizeObject` has a recursion depth cap.
* **Dev**: bumped mocha → 11, nyc → 17, sinon → 19, standard → 17, chai → 4.5 so `npm test` runs on Node 26. Dropped unused `brfs`. `npm audit` count: 24 → 12 (3 low, 7 moderate, 2 high; all dev-chain or upstream-open).

**2.0.3** (May 2026)

* Normalize input to a plain `Uint8Array` view before delegating to `@noble/hashes` in `Hash.blake3` / `Hash.k12`. Newer @noble releases tighten `isBytes()` and reject Buffer instances from foreign realms (e.g. a `buffer/` polyfill Buffer originating in a jsdom test runner). The view conversion sidesteps this without copying.

**2.0.2** (May 2026)

* Fix `Hash.blake3` and `Hash.k12` to match Radiant-Core C++ consensus across all input sizes. Previous hand-rolled implementations were correct for inputs of one BLAKE3 block (≤ 64 bytes) or one K12 chunk (≤ 8191 bytes) respectively, but diverged for longer inputs — notably the 72-byte dMint preimage. Now delegate to `@noble/hashes`, which is audited and matches the C++ reference across all sizes verified.
* Added `@noble/hashes` as a runtime dependency.

**2.0.1** (May 2026)

* Fix `lib/util/bufferUtil.js` runtime detection. Previously used `typeof window !== 'undefined'` to choose between Node's native `Buffer` and the `buffer` polyfill, which broke in jsdom-based test environments (e.g. vitest + jsdom). Now uses `process.versions.node` so Node-on-jsdom resolves to native `Buffer`.

**2.0.0** (May 2026)

* **V2 Hard Fork Support** — Full interpreter support for all 6 fork-gated opcodes:
  * `OP_BLAKE3` (0xee) — Blake3 hash opcode (pure JS implementation)
  * `OP_K12` (0xef) — KangarooTwelve hash opcode (pure JS implementation)
  * `OP_LSHIFT` (0x98) — Bitwise left shift (re-enabled)
  * `OP_RSHIFT` (0x99) — Bitwise right shift (re-enabled)
  * `OP_2MUL` (0x8d) — Multiply by 2 (re-enabled, fork-gated behind SCRIPT_ENHANCED_REFERENCES)
  * `OP_2DIV` (0x8e) — Divide by 2 with truncation toward zero (re-enabled)
* All new opcodes gated behind `SCRIPT_ENHANCED_REFERENCES` flag
* Fixed `stepListener` callback to provide copies of stack/altstack (prevents external modification)
* Fixed 560 pre-existing test failures (3299 passing, 0 failing)
* Added Glyph v2 module: `lib/glyph/` (encoder, decoder, validator, constants)
* Added TypeScript declarations for Glyph v2 in `radiant.d.ts`

**1.9.4**

* Add support for Radiant Node 1.2.0 

**1.7.5**

* Critical parsing bug fixes

**1.6.0**
* Radiant Blockchain Fork

**1.5.0**
* Add build files into repo.

**1.4.0**
* Change default fee to 0.5 sat/byte

**1.3.0**
* Remove limit on OP_RETURN size

**1.1.0**
* Refactor code related to buffers and get rid of bufferUtil
* Deprecate p2sh
* Add .Mnemonic to bsv object

**1.0.0**
* Bump to 1.0 release as per the suggestion of @mathiasrw

**0.30.2**
* Added addSafeData to Transaction.

**0.30.1**
* Enforce buffer check for Electrum ECIES decryption.
* Clean up script folder (no API breaking changes).
* Documentation improvements.

**0.30.0**
* Fix transaction size calculation.

**0.29.2**
* Throw error on invalid hex strings in script

**0.29.1**
* Add support for new OP_RETURN style: buildSafeDataOut and isSafeDataOut (and getData)

**0.27.2**
* Add support for Stress Test Network (STN).

**v0.27.1**
* Replace lodash methods with inline pure javascript methods.

**v0.27.0**
* Remove version guard. This should fix the "two versions of bsv" error that
  people often get. Note that it is poor practice to use incompatible versions
  of bsv. To send objects from one version of the library to another, always
  serialize to a string or buffer first. Do not send objects from one version to
  another. This due to frequent use of "instanceof" inside the library.

**v0.26.5**
* lodash optimization and overall size optimization of bsv.min.js
* fix isFinal
* fix non-dust amount example
* minor ECIES API issue

**v0.26.4**
* Use ECDSA.signWithCalcI(...) convenience method inside Message.

**v0.26.3**
* Add ECDSA.signWithCalcI(...) convenience method.

**v0.26.2**
* Add Mnemonic.fromString(string).
* Add convenience method for ECDSA.signRandomK (mostly for demo purposes).
* Add convenience methods Message.sign and message.verify.
* Move large portions of the documentation to [docs.moneybutton.com](https://docs.moneybutton.com).

**v0.26.1**
* Add .fromRandom() method for Mnemonic.

**v0.26.0**
* Remove the (already deprecated) .derive() method from HDPrivateKey and HDPublicKey. If you rely on this, please switch to .deriveNonCompliantChild(). If you do not already rely on this, you should use .deriveChild() instead.
* Move large portions of the documentation to [docs.moneybutton.com](https://docs.moneybutton.com).
* HDPrivateKey / HDPublicKey toHex() and fromHex()
* HDPrivateKey.fromRandom()
* Remove Base32 (this was only used for cashaddr and is now obsolete).

**v0.25.0**
* Remove support for cashaddr completely. This saves size in the bundle.
* Private key .toString() method now returns WIF, which makes it compatible with the corresponding .fromString(wif) method.
* Private key and public key classes now have toHex() and fromHex(hex) methods.
* Move large portions of the documentation to [docs.moneybutton.com](https://docs.moneybutton.com).
