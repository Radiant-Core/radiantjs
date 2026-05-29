// Generate signature regression vectors for test/regression/signature-vectors.js.
//
// This reproduces radiantjs's RFC 6979 deterministicK + low-S sign loop using
// the `elliptic` library as an independent reference implementation. The
// output vectors are baked into the test as a permanent guard against the
// active code drifting away from byte-identical ECDSA signing output.
//
// NB: requires `elliptic` and `bn.js` to be installed locally. After the
// 2.0.5 migration, elliptic is no longer a runtime dependency; install it
// with `npm install --no-save elliptic` if you need to regenerate vectors.
const EC = require('elliptic').ec
const ec = new EC('secp256k1')
const BN = require('bn.js')
const crypto = require('crypto')

function sha256hmac (data, key) {
  return crypto.createHmac('sha256', key).update(data).digest()
}

function deterministicK (privBuf, hashBuf) {
  let v = Buffer.alloc(32, 0x01)
  let k = Buffer.alloc(32, 0x00)
  k = sha256hmac(Buffer.concat([v, Buffer.from([0x00]), privBuf, hashBuf]), k)
  v = sha256hmac(v, k)
  k = sha256hmac(Buffer.concat([v, Buffer.from([0x01]), privBuf, hashBuf]), k)
  v = sha256hmac(v, k)
  v = sha256hmac(v, k)
  return new BN(v)
}

function toLowS (s, n) {
  const half = new BN('7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0', 16)
  if (s.gt(half)) s = n.sub(s)
  return s
}

function bnToBuf (bn, size) {
  let h = bn.toString(16)
  if (h.length % 2) h = '0' + h
  let buf = Buffer.from(h, 'hex')
  if (buf.length < size) buf = Buffer.concat([Buffer.alloc(size - buf.length), buf])
  return buf
}

function sigToDER (r, s) {
  function encodeInt (buf) {
    if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf])
    return Buffer.concat([Buffer.from([0x02, buf.length]), buf])
  }
  let rb = bnToBuf(r, r.byteLength())
  // strip leading zeros except keep one
  while (rb.length > 1 && rb[0] === 0 && !(rb[1] & 0x80)) rb = rb.slice(1)
  let sb = bnToBuf(s, s.byteLength())
  while (sb.length > 1 && sb[0] === 0 && !(sb[1] & 0x80)) sb = sb.slice(1)
  const r2 = encodeInt(rb)
  const s2 = encodeInt(sb)
  return Buffer.concat([Buffer.from([0x30, r2.length + s2.length]), r2, s2])
}

function sign (privBuf, hashBuf) {
  const n = ec.curve.n
  const G = ec.curve.g
  const d = new BN(privBuf)
  const e = new BN(hashBuf)
  let badrs = -1
  let r, s, k
  do {
    badrs++
    k = deterministicK(privBuf, hashBuf)
    // Note: if k is out of range, the radiantjs code increments badrs; we
    // assume it's in range for our seed vectors.
    const Q = G.mul(k)
    r = new BN(1).mul(Q.x.umod(n))
    s = k.invm(n).mul(e.add(d.mul(r))).umod(n)
  } while (r.isZero() || s.isZero())
  s = toLowS(s, n)
  return { r, s, der: sigToDER(r, s).toString('hex') }
}

const vectors = []

// Vector 1: BIP62 / bitcoinjs fixture
const v1 = {
  privkey: '0000000000000000000000000000000000000000000000000000000000000001',
  msg: 'Everything should be made as simple as possible, but not simpler.'
}
const h1 = crypto.createHash('sha256').update(v1.msg).digest()
const s1 = sign(Buffer.from(v1.privkey, 'hex'), h1)
vectors.push({ description: 'bitcoinjs vector', privkey: v1.privkey, msgHash: h1.toString('hex'), der: s1.der, r: s1.r.toString(), s: s1.s.toString() })

// Vector 2-6: synthetic but reproducible
const seeds = [
  'fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e',
  '16f243e962c59e71e54189e67e66cf2440a1334514c09c00ddcc21632bac9808',
  'b8aa34f93cf2e9ff8b3b8a6eb1a4a87e0c123d3b6b1c2f33b0e8e1e94a01c2b3',
  '4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318',
  '1184cd2cdd640ca42cfc3a091c51d549b2f016d454b2774019c2b2d2e08529fd'
]
const msgs = [
  Buffer.from('test data'),
  Buffer.from('Radiant Core'),
  Buffer.from('hello world'),
  Buffer.from('the quick brown fox jumps over the lazy dog'),
  Buffer.from('\x00\x01\x02\x03\x04\x05\x06\x07')
]
for (let i = 0; i < seeds.length; i++) {
  const h = crypto.createHash('sha256').update(msgs[i]).digest()
  const sig = sign(Buffer.from(seeds[i], 'hex'), h)
  vectors.push({ description: 'synthetic ' + i, privkey: seeds[i], msgHash: h.toString('hex'), der: sig.der, r: sig.r.toString(), s: sig.s.toString() })
}

console.log(JSON.stringify(vectors, null, 2))
