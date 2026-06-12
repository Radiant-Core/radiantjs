# Changelog

All notable changes to `@radiant-core/radiantjs` are documented here.

## 2.0.6 — 2026-06-12

### Fixed

- **Removed the load-order dependency in the HD-key module-load invariants.**
  `lib/hdprivatekey.js` and `lib/hdpublickey.js` ran three top-level
  `assert(...)` byte-layout sanity checks at module evaluation. Under some
  bundler emit orders — concretely, Rollup/Vite code-splitting radiantjs into
  a lazy chunk — the module-scope `assert` import is not yet initialized when
  those lines run, crashing every consumer of the chunk with
  `TypeError: e is not a function` (this white-screened Photonic Wallet's
  `/predict` build). The checks are now self-contained
  `if (!cond) throw new Error(...)` statements: the same invariants are
  enforced, with no dependency on import initialization order. No functional
  change — 3508 tests pass, HD derivation output is identical.

## 2.0.5 — 2026-05-29

### Security

- **Replaced `elliptic` with `@noble/secp256k1` for all ECDSA operations.**
  The legacy `elliptic` dependency carries the advisory
  [GHSA-848j-6mx2-7j84](https://github.com/advisories/GHSA-848j-6mx2-7j84)
  (non-constant-time scalar multiplication; private-key timing leak), with
  no patched release upstream. Public-key derivation, point arithmetic,
  ECDSA sign / verify, and signature-based public-key recovery now route
  through the audited `@noble/secp256k1` v3 implementation. `elliptic` is
  removed from `dependencies`; `npm audit --omit=dev` reports **0
  vulnerabilities**.

  Signing output is **byte-identical** to the prior implementation under
  the same RFC 6979 deterministic inputs — verified by a new
  cross-implementation regression suite at
  `test/regression/signature-vectors.js` that pins six (privkey, msgHash)
  → DER signature triples produced by the elliptic-backed predecessor.
  Existing wallets, signed transactions, and HD derivations remain
  compatible.

### Removed

- `radiantjs.deps.elliptic` is no longer exported (the dependency is
  gone). The corresponding `radiant.d.ts` type was also removed. Consumers
  inspecting elliptic's version through this surface must switch to
  reading `@noble/secp256k1` directly.

### Added

- `test/regression/signature-vectors.js` — permanent guard against ECDSA
  output drift.
- `scripts/gen-signature-vectors.js` — vector regeneration tool;
  documents the elliptic-backed reference path that produced the
  baked-in fixtures.

### Internal

- `lib/crypto/point.js` rewritten as a thin wrapper around
  `@noble/secp256k1`'s `Point` class, preserving the public surface
  (`Point(x, y)`, `Point.getG`, `Point.getN`, `Point.fromX`,
  `prototype.{mul, add, mulAdd, eq, isInfinity, getX, getY, validate,
  toBuffer, toHex}`, `pointToCompressed` / `pointFromCompressed`).
- `lib/crypto/ecdsa.js` unchanged — radiantjs's own RFC 6979
  `deterministicK` (with optional `kEntropy` hedged-ECDSA extra input)
  continues to drive the sign loop, which is the property that locks
  byte-identical signature output across the migration.
- `radiant.min.js` rebuilt; main browser bundle shrinks ~50 KB after
  removing the elliptic tree.

## 2.0.4

Full library audit + consensus / interop fixes. See commit `b695ff49`.
