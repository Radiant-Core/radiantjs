'use strict'

var _ = require('../util/_')
var $ = require('../util/preconditions')
var BN = require('../crypto/bn')
const Buffer = require('../util/bufferUtil');
var BufferReader = function BufferReader (buf) {
  if (!(this instanceof BufferReader)) {
    return new BufferReader(buf)
  }
  if (_.isUndefined(buf)) {
    return
  }
  if (Buffer.isBuffer(buf)) {
    this.set({
      buf: buf
    })
  } else if (_.isString(buf)) {
    var b = Buffer.from(buf, 'hex')
    if (b.length * 2 !== buf.length) { throw new TypeError('Invalid hex string') }

    this.set({
      buf: b
    })
  } else if (_.isObject(buf)) {
    var obj = buf
    this.set(obj)
  } else {
    throw new TypeError('Unrecognized argument for BufferReader')
  }
}

BufferReader.prototype.set = function (obj) {
  this.buf = obj.buf || this.buf || undefined
  // Use explicit null/undefined check so obj.pos === 0 is not lost to ||.
  this.pos = obj.pos != null ? obj.pos : (this.pos || 0)
  return this
}

BufferReader.prototype.eof = function () {
  return this.pos >= this.buf.length
}

BufferReader.prototype.finished = BufferReader.prototype.eof

/**
 * Read `len` bytes from the current position.
 *
 * If `len` extends past end-of-buffer, returns a SHORT buffer (whatever
 * remains) and advances `pos` past the buffer end. Callers MUST verify
 * `result.length === len` if the size matters - several internal callers
 * (script parsing, readVarLengthBuffer) rely on this short-read behaviour
 * to produce meaningful errors at the protocol layer. Use `readStrict()`
 * when you want a hard failure instead.
 */
BufferReader.prototype.read = function (len) {
  $.checkArgument(!_.isUndefined(len), 'Must specify a length')
  var buf = this.buf.slice(this.pos, this.pos + len)
  this.pos = this.pos + len
  return buf
}

/**
 * Strict variant of read(): throws if the request extends past end-of-buffer.
 * Use this when a short read would propagate as silently-corrupt data
 * (e.g. a hostile peer sending a one-byte-short tx whose decode/re-encode
 * would diverge and break malleability invariants).
 */
BufferReader.prototype.readStrict = function (len) {
  $.checkArgument(!_.isUndefined(len), 'Must specify a length')
  $.checkState(this.pos + len <= this.buf.length,
    'BufferReader.readStrict: requested ' + len + ' bytes at pos ' + this.pos +
    ' but only ' + (this.buf.length - this.pos) + ' bytes remain')
  var buf = this.buf.slice(this.pos, this.pos + len)
  this.pos = this.pos + len
  return buf
}

BufferReader.prototype.readAll = function () {
  var buf = this.buf.slice(this.pos, this.buf.length)
  this.pos = this.buf.length
  return buf
}

BufferReader.prototype.readUInt8 = function () {
  var val = this.buf.readUInt8(this.pos)
  this.pos = this.pos + 1
  return val
}

BufferReader.prototype.readUInt16BE = function () {
  var val = this.buf.readUInt16BE(this.pos)
  this.pos = this.pos + 2
  return val
}

BufferReader.prototype.readUInt16LE = function () {
  var val = this.buf.readUInt16LE(this.pos)
  this.pos = this.pos + 2
  return val
}

BufferReader.prototype.readUInt32BE = function () {
  var val = this.buf.readUInt32BE(this.pos)
  this.pos = this.pos + 4
  return val
}

BufferReader.prototype.readUInt32LE = function () {
  var val = this.buf.readUInt32LE(this.pos)
  this.pos = this.pos + 4
  return val
}

BufferReader.prototype.readInt32LE = function () {
  var val = this.buf.readInt32LE(this.pos)
  this.pos = this.pos + 4
  return val
}

BufferReader.prototype.readUInt64BEBN = function () {
  var buf = this.buf.slice(this.pos, this.pos + 8)
  var bn = BN.fromBuffer(buf)
  this.pos = this.pos + 8
  return bn
}

BufferReader.prototype.readUInt64LEBN = function () {
  var second = this.buf.readUInt32LE(this.pos)
  var first = this.buf.readUInt32LE(this.pos + 4)
  var combined = (first * 0x100000000) + second
  // Instantiating an instance of BN with a number is faster than with an
  // array or string. However, the maximum safe number for a double precision
  // floating point is 2 ^ 52 - 1 (0x1fffffffffffff), thus we can safely use
  // non-floating point numbers less than this amount (52 bits). And in the case
  // that the number is larger, we can instatiate an instance of BN by passing
  // an array from the buffer (slower) and specifying the endianness.
  var bn
  if (combined <= 0x1fffffffffffff) {
    bn = new BN(combined)
  } else {
    var data = Array.prototype.slice.call(this.buf, this.pos, this.pos + 8)
    bn = new BN(data, 10, 'le')
  }
  this.pos = this.pos + 8
  return bn
}

BufferReader.prototype.readVarintNum = function () {
  var first = this.readUInt8()
  switch (first) {
    case 0xFD:
      return this.readUInt16LE()
    case 0xFE:
      return this.readUInt32LE()
    case 0xFF:
      var bn = this.readUInt64LEBN()
      var n = bn.toNumber()
      // 2^53 is exactly representable in IEEE-754 (it is a power of two);
      // aliasing begins at 2^53 + 1 = MAX_SAFE_INTEGER + 2. Anything up to
      // and including 2^53 round-trips without precision loss.
      if (n <= Math.pow(2, 53)) {
        return n
      } else {
        throw new Error('number too large to retain precision - use readVarintBN')
      }
      // break // unreachable
    default:
      return first
  }
}

/**
 * reads a length prepended buffer
 */
BufferReader.prototype.readVarLengthBuffer = function () {
  var len = this.readVarintNum()
  var buf = this.read(len)
  $.checkState(buf.length === len, 'Invalid length while reading varlength buffer. ' +
    'Expected to read: ' + len + ' and read ' + buf.length)
  return buf
}

BufferReader.prototype.readVarintBuf = function () {
  var first = this.buf.readUInt8(this.pos)
  switch (first) {
    case 0xFD:
      return this.read(1 + 2)
    case 0xFE:
      return this.read(1 + 4)
    case 0xFF:
      return this.read(1 + 8)
    default:
      return this.read(1)
  }
}

BufferReader.prototype.readVarintBN = function () {
  var first = this.readUInt8()
  switch (first) {
    case 0xFD:
      return new BN(this.readUInt16LE())
    case 0xFE:
      return new BN(this.readUInt32LE())
    case 0xFF:
      return this.readUInt64LEBN()
    default:
      return new BN(first)
  }
}

BufferReader.prototype.reverse = function () {
  var buf = Buffer.alloc(this.buf.length)
  for (var i = 0; i < buf.length; i++) {
    buf[i] = this.buf[this.buf.length - 1 - i]
  }
  this.buf = buf
  return this
}

BufferReader.prototype.readReverse = function (len) {
  if (_.isUndefined(len)) {
    len = this.buf.length
  }
  var buf = this.buf.slice(this.pos, this.pos + len)
  this.pos = this.pos + len
  return Buffer.from(buf).reverse()
}

BufferReader.prototype.remaining = function () {
  return this.buf.length - this.pos
}

module.exports = BufferReader
