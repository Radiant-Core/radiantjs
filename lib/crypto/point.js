'use strict'
const Buffer = require('../util/bufferUtil')
const BN = require('./bn')
const noble = require('@noble/secp256k1')
const { sha256 } = require('@noble/hashes/sha2')
const { hmac } = require('@noble/hashes/hmac')

// @noble/secp256k1 v3 ships without bundled hash primitives; callers must wire
// them up before sign/verify/recover. Idempotent and safe even if another
// module beat us to it.
if (!noble.hashes.sha256) {
  noble.hashes.sha256 = sha256
  noble.hashes.hmacSha256 = (key, msg) => hmac(sha256, key, msg)
}

const NoblePoint = noble.Point

const N_HEX = 'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141'
const N_BIG = BigInt('0x' + N_HEX)

function toBig (input) {
  if (input === null || input === undefined) {
    throw new Error('Invalid Point')
  }
  if (typeof input === 'bigint') return input
  if (typeof input === 'number') return BigInt(input)
  if (typeof input === 'string') {
    return BigInt('0x' + input)
  }
  if (input instanceof BN || (input && typeof input.toString === 'function')) {
    return BigInt('0x' + input.toString(16))
  }
  throw new Error('Invalid Point')
}

function bigToBN (big) {
  if (big === 0n) return new BN(0)
  return new BN(big.toString(16), 16)
}

function fromNoble (np) {
  const wrapper = Object.create(Point.prototype)
  wrapper._np = np
  return wrapper
}

function xRecoverableOnCurve (xBig) {
  // Returns true iff some y exists such that (xBig, y) lies on secp256k1.
  // We probe by attempting to parse a compressed point with even-y prefix —
  // noble throws when no on-curve solution exists.
  if (xBig < 0n) return false
  const xHex = xBig.toString(16)
  if (xHex.length > 64) return false
  const padded = xHex.padStart(64, '0')
  try {
    NoblePoint.fromHex('02' + padded)
    return true
  } catch (e) {
    return false
  }
}

/**
 * Instantiate a valid secp256k1 Point from the X and Y coordinates.
 *
 * Historically this class extended `elliptic.curve.point`; the implementation
 * has been ported onto `@noble/secp256k1` while keeping the public surface
 * intact. The third `isRed` argument is accepted for backwards compatibility
 * and ignored — noble points carry no Montgomery-form flag.
 *
 * @param {BN|String|bigint|number} x - The X coordinate
 * @param {BN|String|bigint|number} y - The Y coordinate
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of Point
 * @constructor
 */
function Point (x, y, isRed) { // eslint-disable-line no-unused-vars
  if (!(this instanceof Point)) {
    return new Point(x, y, isRed)
  }
  let xBig, yBig
  try {
    xBig = toBig(x)
    yBig = toBig(y)
  } catch (e) {
    throw new Error('Invalid Point')
  }
  let np
  try {
    np = NoblePoint.fromAffine({ x: xBig, y: yBig })
    np.assertValidity()
  } catch (e) {
    // The legacy implementation distinguished between two failure modes:
    //   - x is itself off-curve  → 'Point does not lie on the curve'
    //   - x is on-curve but the supplied y is wrong → 'Invalid y value for curve.'
    // Preserve that contract so call-sites that switch on error.message keep
    // working.
    if (xRecoverableOnCurve(xBig)) {
      throw new Error('Invalid y value for curve.')
    }
    throw new Error('Point does not lie on the curve')
  }
  this._np = np
  return this
}

/**
 * Instantiate a valid secp256k1 Point from only the X coordinate. This is
 * useful to rederive a full point from the compressed form of a point.
 *
 * @param {boolean} odd - If the Y coordinate is odd
 * @param {BN|String|bigint|number} x - The X coordinate
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of Point
 */
Point.fromX = function fromX (odd, x) {
  let xBig
  try {
    xBig = toBig(x)
  } catch (e) {
    throw new Error('Invalid X')
  }
  if (xBig < 0n) {
    throw new Error('Invalid X')
  }
  const xHex = xBig.toString(16)
  if (xHex.length > 64) {
    throw new Error('Invalid X')
  }
  const padded = xHex.padStart(64, '0')
  const prefix = odd ? '03' : '02'
  let np
  try {
    np = NoblePoint.fromHex(prefix + padded)
  } catch (e) {
    throw new Error('Invalid X')
  }
  return fromNoble(np)
}

/**
 * Will return a secp256k1 ECDSA base point.
 *
 * @returns {Point} An instance of the base point.
 */
Point.getG = function getG () {
  return fromNoble(NoblePoint.BASE)
}

/**
 * Will return the max of range of valid private keys as governed by the
 * secp256k1 ECDSA standard.
 *
 * @returns {BN} A BN instance of the curve order
 */
Point.getN = function getN () {
  return new BN(N_HEX, 16)
}

/**
 * Will return the X coordinate of the Point as a BN. Returns null for the
 * point at infinity.
 *
 * @returns {BN}
 */
Point.prototype.getX = function getX () {
  if (this._np.is0()) return null
  return bigToBN(this._np.toAffine().x)
}

/**
 * Will return the Y coordinate of the Point as a BN. Returns null for the
 * point at infinity.
 *
 * @returns {BN}
 */
Point.prototype.getY = function getY () {
  if (this._np.is0()) return null
  return bigToBN(this._np.toAffine().y)
}

// Expose .x / .y as BN — legacy callers such as ECDSA._findSignature do
// `Q.x.umod(N)` directly without going through getX().
Object.defineProperty(Point.prototype, 'x', {
  enumerable: true,
  configurable: true,
  get: function () {
    if (this._np.is0()) return null
    return bigToBN(this._np.toAffine().x)
  }
})

Object.defineProperty(Point.prototype, 'y', {
  enumerable: true,
  configurable: true,
  get: function () {
    if (this._np.is0()) return null
    return bigToBN(this._np.toAffine().y)
  }
})

/**
 * Will determine if the point is the point at infinity.
 *
 * @returns {boolean}
 */
Point.prototype.isInfinity = function isInfinity () {
  return this._np.is0()
}

/**
 * Will determine if the supplied point is equal to this one.
 *
 * @param {Point} other
 * @returns {boolean}
 */
Point.prototype.eq = function eq (other) {
  if (!other) return false
  const otherNp = other._np || other
  if (!otherNp || typeof otherNp.equals !== 'function') return false
  return this._np.equals(otherNp)
}

/**
 * Will determine if the point is valid.
 *
 * @throws {Error} A validation error if exists
 * @returns {Point} An instance of the same Point
 */
Point.prototype.validate = function validate () {
  if (this.isInfinity()) {
    throw new Error('Point cannot be equal to Infinity')
  }
  // noble's fromAffine has already enforced curve membership; any Point we
  // hold is on the curve and in the prime-order subgroup (secp256k1 has
  // cofactor 1).
  return this
}

/**
 * Scalar multiplication: returns scalar * this.
 *
 * @param {BN|bigint|number} scalar
 * @returns {Point}
 */
Point.prototype.mul = function mul (scalar) {
  let big = toBig(scalar)
  // Reduce mod n so callers can pass values outside [1, n-1] without surprise.
  // The historic API allowed `g.mul(n.add(BN.One))`; preserve that.
  big = ((big % N_BIG) + N_BIG) % N_BIG
  if (big === 0n) {
    return fromNoble(NoblePoint.ZERO)
  }
  return fromNoble(this._np.multiply(big))
}

/**
 * Point addition: returns this + other.
 *
 * @param {Point} other
 * @returns {Point}
 */
Point.prototype.add = function add (other) {
  const otherNp = other && other._np
  if (!otherNp) throw new Error('Invalid Point in add')
  return fromNoble(this._np.add(otherNp))
}

/**
 * Computes k1*this + k2*p2 — the linear combination used by ECDSA
 * verification.  Uses noble's `multiplyUnsafe` since the scalars are public
 * (the message hash and signature values), and a variable-time path is
 * acceptable on the verify side.
 *
 * @param {BN|bigint} k1
 * @param {Point} p2
 * @param {BN|bigint} k2
 * @returns {Point}
 */
Point.prototype.mulAdd = function mulAdd (k1, p2, k2) {
  const p2Np = p2 && p2._np
  if (!p2Np) throw new Error('Invalid Point in mulAdd')
  let b1 = toBig(k1)
  let b2 = toBig(k2)
  b1 = ((b1 % N_BIG) + N_BIG) % N_BIG
  b2 = ((b2 % N_BIG) + N_BIG) % N_BIG
  const a = b1 === 0n ? NoblePoint.ZERO : this._np.multiplyUnsafe(b1)
  const b = b2 === 0n ? NoblePoint.ZERO : p2Np.multiplyUnsafe(b2)
  return fromNoble(a.add(b))
}

/**
 * A "compressed" format point is the X part of the (X, Y) point plus an extra
 * bit (which takes an entire byte) to indicate whether the Y value is odd or
 * not.
 *
 * @param {Point} point
 * @returns {Buffer}
 */
Point.pointToCompressed = function pointToCompressed (point) {
  const xbuf = point.getX().toBuffer({ size: 32 })
  const ybuf = point.getY().toBuffer({ size: 32 })

  let prefix
  const odd = ybuf[ybuf.length - 1] % 2
  if (odd) {
    prefix = Buffer.from([0x03])
  } else {
    prefix = Buffer.from([0x02])
  }
  return Buffer.concat([prefix, xbuf])
}

/**
 * Converts a compressed buffer into a point.
 *
 * @param {Buffer} buf
 * @returns {Point}
 */
Point.pointFromCompressed = function (buf) {
  if (buf.length !== 33) {
    throw new Error('invalid buffer length')
  }
  const prefix = buf[0]
  let odd
  if (prefix === 0x03) {
    odd = true
  } else if (prefix === 0x02) {
    odd = false
  } else {
    throw new Error('invalid value of compressed prefix')
  }

  const xbuf = buf.slice(1, 33)
  const x = BN.fromBuffer(xbuf)
  return Point.fromX(odd, x)
}

/**
 * Convert point to a compressed buffer.
 *
 * @returns {Buffer}
 */
Point.prototype.toBuffer = function () {
  return Point.pointToCompressed(this)
}

/**
 * Convert point to a compressed hex string.
 *
 * @returns {string}
 */
Point.prototype.toHex = function () {
  return this.toBuffer().toString('hex')
}

/**
 * Converts a compressed buffer into a point.
 *
 * @param {Buffer} buf
 * @returns {Point}
 */
Point.fromBuffer = function (buf) {
  return Point.pointFromCompressed(buf)
}

/**
 * Converts a compressed hex string into a point.
 *
 * @param {string} hex
 * @returns {Point}
 */
Point.fromHex = function (hex) {
  return Point.fromBuffer(Buffer.from(hex, 'hex'))
}

module.exports = Point
