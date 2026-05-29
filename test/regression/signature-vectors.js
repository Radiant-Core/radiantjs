'use strict'

// Cross-implementation signature regression vectors.
//
// These DER signatures were produced by the pre-@noble/secp256k1 codepath
// (radiantjs <= 2.0.4, backed by `elliptic`) using the same RFC 6979
// deterministic-k logic this codebase ships today (no `kEntropy`). They
// pin byte-for-byte signing output across the elliptic → @noble migration.
//
// Adding a new vector? Run scripts/gen-signature-vectors.js — never
// produce vectors from the same code under test.

const chai = require('chai')
const expect = chai.expect

const Buffer = require('../../lib/util/bufferUtil')
const BN = require('../../lib/crypto/bn')
const ECDSA = require('../../lib/crypto/ecdsa')
const PrivateKey = require('../../lib/privatekey')

const VECTORS = [
  {
    description: 'bitcoinjs-lib fixture (privkey=1, sha256("Everything should be made..."))',
    privkey: '0000000000000000000000000000000000000000000000000000000000000001',
    msgHash: '06ef2b193b83b3d701f765f1db34672ab84897e1252343cc2197829af3a30456',
    der: '3044022033a69cd2065432a30f3d1ce4eb0d59b8ab58c74f27c41a7fdb5696ad4e6108c902206f807982866f785d3f6418d24163ddae117b7db4d5fdf0071de069fa54342262',
    r: '23362334225185207751494092901091441011938859014081160902781146257181456271561',
    s: '50433721247292933944369538617440297985091596895097604618403996029256432099938'
  },
  {
    description: 'synthetic 0 (existing ecdsa.js fixture privkey, sha256("test data"))',
    privkey: 'fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e',
    msgHash: '916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf2335f9',
    der: '304402205eee711af131ccce598836f0d900fa4ad8e1a5f1f57813eca560970a4b12aab20220214b6a06bad4e6648342a3a6d044d9e3b29d40432fd76d5a5a4c4eecfd616c69',
    r: '42938697991940845490746684161784612304942808543877113239296044549725698042546',
    s: '15059569299654277662272258630533378639270910927949520954193093947201327033449'
  },
  {
    description: 'synthetic 1 (existing ecdsa.js fixture privkey, sha256("Radiant Core"))',
    privkey: '16f243e962c59e71e54189e67e66cf2440a1334514c09c00ddcc21632bac9808',
    msgHash: 'c67de7277b641ac4e9ee0af81f198b0001d08417f64c5f3775e52a04c8d9146e',
    der: '304402201e19ad9c0b2a74d2a1f954bfbd356acc15dd2bebab69814e0e3ba50dfafe155402201d682e9ff6e8e2878992457b4b672f53620f54bc3f047e8e34f3f575b137a1a7',
    r: '13614754843163026835656431298720830905930455673343689859260017033928570180948',
    s: '13301146496617776709558687867103281015819761051944167560172055987381010407847'
  },
  {
    description: 'synthetic 2 (random privkey, sha256("hello world"))',
    privkey: 'b8aa34f93cf2e9ff8b3b8a6eb1a4a87e0c123d3b6b1c2f33b0e8e1e94a01c2b3',
    msgHash: 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    der: '30440220326a6cb3478fce4c37e30efd263a4b407ae70177cd9c21430cf7b9f6dcb866310220132934204e2f9b596637e97b3ddc045ac5dab6289584cd6bcd842b9286e6a3e5',
    r: '22803678440002065962514590321008693750143810781102610412270381290097028392497',
    s: '8666744614500244660004781636015937538307666010377967125730143506068039705573'
  },
  {
    description: 'synthetic 3 (random privkey, sha256(pangram))',
    privkey: '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318',
    msgHash: '05c6e08f1d9fdafa03147fcb8f82f124c76d2f70e3d989dc8aadb5e7d7450bec',
    der: '3045022100d532b09055594b2938dff276cebb11a37f27d32496cf647cc010dfedac977a0b02203c343710b255f3469ad12c359e60d524123ae174323554f98385ea97e4a34f36',
    r: '96432197700052293196252744101318005172869367111978180924259144083304468675083',
    s: '27231027008553625260940561756438659457319660968546690728791815364218624102198'
  },
  {
    description: 'synthetic 4 (random privkey, sha256(low bytes))',
    privkey: '1184cd2cdd640ca42cfc3a091c51d549b2f016d454b2774019c2b2d2e08529fd',
    msgHash: '8a851ff82ee7048ad09ec3847f1ddf44944104d2cbd17ef4e3db22c6785a0d45',
    der: '3045022100f4eadf04aa70ed46f5b890edb885b4fb564b2ac03ce70ded2c617555232b546d02202d9204672a72c87d9b80b71aa7d21384386acd45b99b7bbcdb8d0a4c7f4a1b4a',
    r: '110779316482699806661539130639534138714107774815064903303615696337691264898157',
    s: '20612068246034860773712339581357234176760309476414297021743183215292316261194'
  }
]

describe('Signature regression vectors (cross-implementation parity)', function () {
  VECTORS.forEach(function (v) {
    it('produces byte-identical DER for: ' + v.description, function () {
      const privkey = new PrivateKey(BN.fromBuffer(Buffer.from(v.privkey, 'hex')))
      const hashbuf = Buffer.from(v.msgHash, 'hex')
      // kEntropy = null disables the hedged-ECDSA extra entropy so the
      // signature is purely RFC 6979 deterministic.
      const ecdsa = new ECDSA().set({
        privkey,
        hashbuf,
        kEntropy: null
      }).sign()

      expect(ecdsa.sig.r.toString()).to.equal(v.r)
      expect(ecdsa.sig.s.toString()).to.equal(v.s)
      expect(ecdsa.sig.toDER().toString('hex')).to.equal(v.der)

      // And the resulting signature verifies under the matching pubkey.
      expect(ecdsa.verify().verified).to.equal(true)
    })
  })
})
