'use strict'

var _ = require('../util/_')
var $ = require('../util/preconditions')
var JSUtil = require('../util/js')

var Script = require('../script')
var Address = require('../address')

/**
 * Represents unspent output information: its script, amount, and address,
 * with BigInt-safe satoshi precision up to 2.1e18.
 *
 * Consensus-aware: now enforces MoneyRange() consistent with C++ MAX_MONEY.
 */
function UnspentOutput (data) {
  if (!(this instanceof UnspentOutput)) {
    return new UnspentOutput(data)
  }

  $.checkArgument(_.isObject(data), 'Must provide an object from where to extract data')

  const address = data.address ? new Address(data.address) : undefined
  const txId = data.txid ? data.txid : data.txId
  if (!txId || !JSUtil.isHexaString(txId) || txId.length > 64) {
    throw new Error('Invalid TXID in object', data)
  }

  const outputIndex = _.isUndefined(data.vout) ? data.outputIndex : data.vout
  if (!_.isNumber(outputIndex)) {
    throw new Error('Invalid outputIndex, received ' + outputIndex)
  }

  $.checkArgument(!_.isUndefined(data.scriptPubKey) || !_.isUndefined(data.script),
    'Must provide the scriptPubKey for that output!')
  const script = new Script(data.scriptPubKey || data.script)

  $.checkArgument(!_.isUndefined(data.amount) || !_.isUndefined(data.satoshis),
    'Must provide an amount for the output')

  // BigInt-safe satoshi value
  let satoshis
  if (!_.isUndefined(data.amount)) {
    // Convert coin float -> satoshis BigInt
    satoshis = BigInt(Math.round(Number(data.amount) * 1e8))
  } else if (typeof data.satoshis === 'bigint') {
    satoshis = data.satoshis
  } else {
    satoshis = BigInt(data.satoshis)
  }

  if (satoshis < 0n) {
    throw new Error('Amount must be non-negative')
  }

  // --- MoneyRange() check, mirrors C++ consensus rule ---
  const MAX_MONEY = 2100000000000000000n
  function MoneyRange (value) {
    return value >= 0n && value <= MAX_MONEY
  }

  if (!MoneyRange(satoshis)) {
    throw new Error('Amount out of range: ' + satoshis.toString())
  }

  JSUtil.defineImmutable(this, {
    address: address,
    txId: txId,
    outputIndex: outputIndex,
    script: script,
    satoshis: satoshis
  })
}

/**
 * Pretty-print for console inspection
 */
UnspentOutput.prototype.inspect = function () {
  return `<UnspentOutput: ${this.txId}:${this.outputIndex}, satoshis: ${this.satoshis}, address: ${this.address}>`
}

/**
 * String representation: just "txid:index"
 */
UnspentOutput.prototype.toString = function () {
  return this.txId + ':' + this.outputIndex
}

/**
 * Deserialize an UnspentOutput from an object
 */
UnspentOutput.fromObject = function (data) {
  return new UnspentOutput(data)
}

/**
 * Returns a plain object (no prototype or methods)
 * Converts BigInt -> number safely for small values, string for large.
 */
UnspentOutput.prototype.toObject = UnspentOutput.prototype.toJSON = function toObject () {
  let satoshiValue = this.satoshis
  let numericSafe = (satoshiValue <= Number.MAX_SAFE_INTEGER && satoshiValue >= Number.MIN_SAFE_INTEGER)

  return {
    address: this.address ? this.address.toString() : undefined,
    txid: this.txId,
    vout: this.outputIndex,
    scriptPubKey: this.script.toBuffer().toString('hex'),
    amount: numericSafe
      ? Number((Number(satoshiValue) / 1e8).toFixed(8))
      : (BigInt(satoshiValue) / 100000000n).toString()
  }
}

module.exports = UnspentOutput
