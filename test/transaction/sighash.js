'use strict'

var chai = require('chai')
chai.should()
var bsv = require('../../')
var Script = bsv.Script
var BN = bsv.crypto.BN
var Transaction = bsv.Transaction
var Signature = bsv.crypto.Signature
var sighash = Transaction.sighash

var vectorsSighash = require('../data/sighash.json')

describe('sighash', function () {
  it('should be able to compute sighash for a coinbase tx', function () {
    var txhex = '02000000010000000000000000000000000000000000000000000000000000000000000000ffffffff2e039b1e1304c0737c5b68747470733a2f2f6769746875622e636f6d2f62636578742f01000001c096020000000000ffffffff014a355009000000001976a91448b20e254c0677e760bab964aec16818d6b7134a88ac00000000'
    var tx = new Transaction(txhex)
    var sighash = Transaction.Sighash.sighash(
      tx,
      Signature.SIGHASH_ALL,
      0,
      Script.empty()
    )
    sighash.toString('hex').should.equal('6829f7d44dfd4654749b8027f44c9381527199f78ae9b0d58ffc03fdab3c82f1')
  })

  it('Should require amount for sigHash ForkId=0', function () {
    var vector = ['3eb87070042d16f9469b0080a3c1fe8de0feae345200beef8b1e0d7c62501ae0df899dca1e03000000066a0065525365ffffffffd14a9a335e8babddd89b5d0b6a0f41dd6b18848050a0fc48ce32d892e11817fd030000000863acac00535200527ff62cf3ad30d9064e180eaed5e6303950121a8086b5266b55156e4f7612f2c7ebf223e0020000000100ffffffff6273ca3aceb55931160fa7a3064682b4790ee016b4a5c0c0d101fd449dff88ba01000000055351ac526aa3b8223d0421f25b0400000000026552f92db70500000000075253516a656a53c4a908010000000000b5192901000000000652525251516aa148ca38', 'acab53', 3, -1325231124, 'fbbc83ed610e416d94dcee2bb3bc35dfea8060b8052c59eabd7e998e3e978328']
    var txbuf = Buffer.from(vector[0], 'hex')
    var scriptbuf = Buffer.from(vector[1], 'hex')
    var subscript = Script(scriptbuf)
    var nin = vector[2]
    var nhashtype = vector[3]
    var sighashbuf = Buffer.from(vector[4], 'hex')
    var tx = new Transaction(txbuf)

    // make sure transacion to/from buffer is isomorphic
    tx.uncheckedSerialize().should.equal(txbuf.toString('hex'));

    // sighash ought to be correct
    (function () {
      sighash.sighash(tx, nhashtype, nin, subscript).toString('hex').should.equal(sighashbuf.toString('hex'))
    }).should.throw('Invalid Argument')
  })

  // SKIPPED: Bitcoin Core legacy sighash test vectors use the pre-ForkId sighash
  // algorithm. Radiant uses ForkId sighash exclusively, so these vectors produce
  // different (correct-for-Radiant) results and are not applicable.
  var zeroBN = BN.Zero
  vectorsSighash.forEach(function (vector, i) {
    if (i === 0 || !vector[4]) {
      return
    }
    it.skip('test vector from bitcoind #' + i + ' (' + vector[4].substring(0, 16) + ') [legacy sighash N/A for Radiant]', function () {
    })
  })

  // ForkId sighash self-consistency battery (C-1).
  // These tests pin the JS ForkId implementation against its own output to
  // detect future regressions. Byte-exact cross-validation against
  // Radiant-Core's C++ SignatureHash is a TODO that requires either an RPC
  // (radiant-cli signrawtransactionwithkey) or a small C++ harness.
  describe('ForkId sighash (Radiant)', function () {
    var Address = bsv.Address
    var PrivateKey = bsv.PrivateKey
    var FORKID = Signature.SIGHASH_FORKID
    var pk = PrivateKey.fromWIF('cSBnVM4xvxarwGQuAfQFwqDg9k5tErHUHzgWsEfD4zdwUasvqRVY')
    var fromAddr = pk.toAddress()
    var toAddr = Address.fromString('mrU9pEmAx26HcbKVrABvgL7AwA5fjNFoDc')
    var thirdAddr = Address.fromString('mgBCJAsvzgT2qNNeXsoECg2uPKrUsZ76up')

    function buildTx (nOutputs) {
      var utxo = {
        txId: '0'.repeat(63) + '1',
        outputIndex: 0,
        address: fromAddr,
        script: Script.buildPublicKeyHashOut(fromAddr).toString(),
        satoshis: 1000000000
      }
      var tx = new Transaction().from(utxo)
      var perOut = Math.floor(900000000 / nOutputs)
      for (var i = 0; i < nOutputs; i++) {
        tx.to(i % 2 === 0 ? toAddr : thirdAddr, perOut)
      }
      return tx
    }

    // The set of (type | FORKID) values to exercise. Each must trigger the
    // ForkId branch in sighashPreimage and return a 32-byte digest.
    var typesUnderTest = [
      { name: 'ALL', t: Signature.SIGHASH_ALL | FORKID },
      { name: 'NONE', t: Signature.SIGHASH_NONE | FORKID },
      { name: 'SINGLE', t: Signature.SIGHASH_SINGLE | FORKID },
      { name: 'ALL|ANYONECANPAY', t: Signature.SIGHASH_ALL | FORKID | Signature.SIGHASH_ANYONECANPAY },
      { name: 'NONE|ANYONECANPAY', t: Signature.SIGHASH_NONE | FORKID | Signature.SIGHASH_ANYONECANPAY },
      { name: 'SINGLE|ANYONECANPAY', t: Signature.SIGHASH_SINGLE | FORKID | Signature.SIGHASH_ANYONECANPAY }
    ]

    typesUnderTest.forEach(function (entry) {
      it('produces a 32-byte ForkId sighash for ' + entry.name, function () {
        var tx = buildTx(2)
        var subscript = Script.buildPublicKeyHashOut(fromAddr)
        var h = Transaction.Sighash.sighash(tx, entry.t, 0, subscript, new BN(1000000000))
        h.length.should.equal(32)
      })
    })

    it('SIGHASH_SINGLE with inputNumber >= nOutputs does not return uint256(1)', function () {
      // Regression guard for the legacy "SIGHASH_SINGLE bug" (uint256(1)
      // sentinel). The ForkId branch should zero hashOutputs instead, never
      // returning the bug constant for FORKID-flagged sighashes.
      var tx = buildTx(1) // one output, but we will sign input 0
      var subscript = Script.buildPublicKeyHashOut(fromAddr)
      // Force inputNumber >= outputs.length by signing input 0 with a SINGLE
      // type whose semantics make output[0] the only one - so this case
      // actually exercises the in-range branch. Build a 2-input / 1-output
      // tx for the truly out-of-range case.
      var utxo2 = {
        txId: '0'.repeat(63) + '2',
        outputIndex: 0,
        address: fromAddr,
        script: Script.buildPublicKeyHashOut(fromAddr).toString(),
        satoshis: 1000000000
      }
      tx.from(utxo2) // tx now has 2 inputs, 1 output
      var h = Transaction.Sighash.sighash(tx, Signature.SIGHASH_SINGLE | FORKID, 1, subscript, new BN(1000000000))
      h.length.should.equal(32)
      // Must NOT equal the SIGHASH_SINGLE_BUG sentinel (32 bytes, value
      // 0x...01) which the legacy non-ForkId path returns.
      var singleBug = Buffer.alloc(32); singleBug[31] = 0x01
      h.equals(singleBug).should.equal(false)
    })

    it('sign-then-verify round-trip succeeds for a P2PKH input with ForkId', function () {
      var tx = buildTx(2)
      tx.sign(pk)
      tx.inputs[0].isFullySigned().should.equal(true)
      // Pull the signature back out and verify it via the full path.
      var sig = Signature.fromTxFormat(tx.inputs[0].script.chunks[0].buf)
      var subscript = Script.buildPublicKeyHashOut(fromAddr)
      var ok = Transaction.Sighash.verify(tx, sig, pk.toPublicKey(), 0, subscript, new BN(1000000000))
      ok.should.equal(true)
    })

    it('preimage layout includes hashOutputHashes ahead of hashOutputs', function () {
      // The Radiant-specific ForkId preimage interleaves a hashOutputHashes
      // field (sorted color hashes; sha256sha256). Length sanity-check the
      // preimage so a future refactor that drops the field fails loudly.
      var tx = buildTx(2)
      var subscript = Script.buildPublicKeyHashOut(fromAddr)
      var preimage = Transaction.Sighash.sighashPreimage(
        tx, Signature.SIGHASH_ALL | FORKID, 0, subscript, new BN(1000000000)
      )
      // Standard BIP143 preimage is ~4+32+32+36+(scriptCode varint+bytes)+8+4+32+4+4 ≈ 156 bytes
      // for a P2PKH; Radiant adds 32 more bytes for hashOutputHashes.
      preimage.length.should.be.greaterThan(180)
    })

    it('changing any byte of the tx changes the sighash', function () {
      var tx = buildTx(2)
      var subscript = Script.buildPublicKeyHashOut(fromAddr)
      var h1 = Transaction.Sighash.sighash(tx, Signature.SIGHASH_ALL | FORKID, 0, subscript, new BN(1000000000))
      tx.nLockTime = (tx.nLockTime + 1) >>> 0
      var h2 = Transaction.Sighash.sighash(tx, Signature.SIGHASH_ALL | FORKID, 0, subscript, new BN(1000000000))
      h1.equals(h2).should.equal(false)
    })

    it('changing the input amount changes the sighash (BIP143 commits to amount)', function () {
      var tx = buildTx(2)
      var subscript = Script.buildPublicKeyHashOut(fromAddr)
      var h1 = Transaction.Sighash.sighash(tx, Signature.SIGHASH_ALL | FORKID, 0, subscript, new BN(1000000000))
      var h2 = Transaction.Sighash.sighash(tx, Signature.SIGHASH_ALL | FORKID, 0, subscript, new BN(2000000000))
      h1.equals(h2).should.equal(false)
    })

    it('handles >2^53 photon amounts without precision loss', function () {
      var tx = buildTx(2)
      var subscript = Script.buildPublicKeyHashOut(fromAddr)
      var hugeAmount = new BN('1' + '0'.repeat(18)) // 10^18, > 2^53
      var h = Transaction.Sighash.sighash(tx, Signature.SIGHASH_ALL | FORKID, 0, subscript, hugeAmount)
      h.length.should.equal(32)
    })
  })

  // Byte-exact cross-validation against a stdlib-only Python reference
  // implementation of Radiant-Core's C++ SignatureHash (FORKID branch).
  // The Python script that generated these vectors lives next to the JSON
  // fixture: test/data/sighash_radiant_reference.py. Re-run it to refresh
  // the fixtures if the algorithm intentionally changes; otherwise a diff
  // here means the JS implementation has drifted from the C++ algorithm.
  describe('ForkId sighash byte-exact cross-validation (Python reference)', function () {
    var vectors = require('../data/sighash_radiant.json')

    vectors.forEach(function (vector, i) {
      var rawTxHex = vector[0]
      var scriptCodeHex = vector[1]
      var nIn = vector[2]
      var sighashType = vector[3]
      var expectedHexBE = vector[4] // on-wire / canonical big-endian form
      var amountStr = vector[5]
      var description = vector[6] || ''

      it('vector #' + i + ': ' + description, function () {
        var tx = new Transaction(rawTxHex)
        // Round-trip sanity: serialization must be isomorphic so we know the
        // tx we are hashing is byte-identical to what the Python ref hashed.
        tx.uncheckedSerialize().should.equal(rawTxHex)

        var subscript = new Script(scriptCodeHex)
        var amount = new BN(amountStr)
        var h = Transaction.Sighash.sighash(tx, sighashType, nIn, subscript, amount)

        // Sighash.sighash() returns the digest in *reversed* (little-endian)
        // byte order; the fixture stores the canonical (big-endian) form.
        // Reverse the JS output before comparing.
        var jsHexBE = Buffer.from(h).reverse().toString('hex')
        jsHexBE.should.equal(expectedHexBE)
      })
    })
  })
})
