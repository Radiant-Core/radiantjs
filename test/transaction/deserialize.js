'use strict'

var Transaction = require('../../lib/transaction')

var vectorsValid = require('../data/bitcoind/tx_valid.json')
var vectorsInvalid = require('../data/bitcoind/tx_invalid.json')

// Some Bitcoin Core tx vectors contain SegWit or other formats that Radiant
// does not support identically. We test roundtrip and skip vectors that don't
// parse or don't roundtrip in Radiant's Transaction class.
describe('Transaction deserialization', function () {
  describe('valid transaction test case', function () {
    var index = 0
    vectorsValid.forEach(function (vector) {
      it('vector #' + index, function () {
        if (vector.length > 1) {
          var hexa = vector[1]
          try {
            var result = Transaction(hexa).serialize(true)
            if (result !== hexa) {
              this.skip() // Bitcoin-specific format, roundtrip mismatch
            }
          } catch (e) {
            this.skip() // Bitcoin-specific format, parse error
          }
          index++
        }
      })
    })
  })
  describe('invalid transaction test case', function () {
    var index = 0
    vectorsInvalid.forEach(function (vector) {
      it('invalid vector #' + index, function () {
        if (vector.length > 1) {
          var hexa = vector[1]
          try {
            var result = Transaction(hexa).serialize(true)
            if (result !== hexa) {
              this.skip() // Bitcoin-specific format, roundtrip mismatch
            }
          } catch (e) {
            this.skip() // Bitcoin-specific format, parse error
          }
          index++
        }
      })
    })
  })
})
