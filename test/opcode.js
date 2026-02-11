'use strict'
const Buffer = require('../lib/util/bufferUtil');
var chai = require('chai')
var should = chai.should()
var expect = chai.expect
var bsv = require('..')
var Opcode = bsv.Opcode

describe('Opcode', function () {
  it('should create a new Opcode', function () {
    var opcode = new Opcode(5)
    should.exist(opcode)
  })

  it('should convert to a string with this handy syntax', function () {
    Opcode(0).toString().should.equal('OP_0')
    Opcode(96).toString().should.equal('OP_16')
    Opcode(97).toString().should.equal('OP_NOP')
  })

  it('should convert to a number with this handy syntax', function () {
    Opcode('OP_0').toNumber().should.equal(0)
    Opcode('OP_16').toNumber().should.equal(96)
    Opcode('OP_NOP').toNumber().should.equal(97)
  })

  describe('#fromNumber', function () {
    it('should work for 0', function () {
      Opcode.fromNumber(0).num.should.equal(0)
    })
    it('should fail for non-number', function () {
      Opcode.fromNumber.bind(null, 'a string').should.throw('Invalid Argument')
    })
  })

  describe('#set', function () {
    it('should work for object', function () {
      Opcode(42).num.should.equal(42)
    })
    it('should fail for empty-object', function () {
      expect(function () {
        Opcode()
      }).to.throw(TypeError)
    })
  })

  describe('#toNumber', function () {
    it('should work for 0', function () {
      Opcode.fromNumber(0).toNumber().should.equal(0)
    })
  })

  describe('#buffer', function () {
    it('should correctly input/output a buffer', function () {
      var buf = Buffer.from('a6', 'hex')
      Opcode.fromBuffer(buf).toBuffer().should.deep.equal(buf)
    })
  })

  describe('#fromString', function () {
    it('should work for OP_0', function () {
      Opcode.fromString('OP_0').num.should.equal(0)
    })
    it('should fail for invalid string', function () {
      Opcode.fromString.bind(null, 'OP_SATOSHI').should.throw('Invalid opcodestr')
      Opcode.fromString.bind(null, 'BANANA').should.throw('Invalid opcodestr')
    })
    it('should fail for non-string', function () {
      Opcode.fromString.bind(null, 123).should.throw('Invalid Argument')
    })
  })

  describe('#toString', function () {
    it('should work for OP_0', function () {
      Opcode.fromString('OP_0').toString().should.equal('OP_0')
    })

    it('should not work for non-opcode', function () {
      expect(function () {
        Opcode('OP_NOTACODE').toString()
      }).to.throw('Opcode does not have a string representation')
    })
  })

  describe('@map', function () {
    it('should have a map containing 172 elements', function () {
      Object.keys(Opcode.map).length.should.equal(172)
    })
  })

  describe('@reverseMap', function () {
    it('should exist and have op 185', function () {
      should.exist(Opcode.reverseMap)
      Opcode.reverseMap[185].should.equal('OP_NOP10')
    })
  })
  var smallints = [
    Opcode('OP_0'),
    Opcode('OP_1'),
    Opcode('OP_2'),
    Opcode('OP_3'),
    Opcode('OP_4'),
    Opcode('OP_5'),
    Opcode('OP_6'),
    Opcode('OP_7'),
    Opcode('OP_8'),
    Opcode('OP_9'),
    Opcode('OP_10'),
    Opcode('OP_11'),
    Opcode('OP_12'),
    Opcode('OP_13'),
    Opcode('OP_14'),
    Opcode('OP_15'),
    Opcode('OP_16')
  ]

  describe('@smallInt', function () {
    var testSmallInt = function (n, op) {
      Opcode.smallInt(n).toString().should.equal(op.toString())
    }

    for (var i = 0; i < smallints.length; i++) {
      var op = smallints[i]
      it('should work for small int ' + op, testSmallInt.bind(null, i, op))
    }

    it('with not number', function () {
      Opcode.smallInt.bind(null, '2').should.throw('Invalid Argument')
    })

    it('with n equal -1', function () {
      Opcode.smallInt.bind(null, -1).should.throw('Invalid Argument')
    })

    it('with n equal 17', function () {
      Opcode.smallInt.bind(null, 17).should.throw('Invalid Argument')
    })
  })
  describe('@isSmallIntOp', function () {
    var testIsSmallInt = function (op) {
      Opcode.isSmallIntOp(op).should.equal(true)
    }
    for (var i = 0; i < smallints.length; i++) {
      var op = smallints[i]
      it('should work for small int ' + op, testIsSmallInt.bind(null, op))
    }

    it('should work for non-small ints', function () {
      Opcode.isSmallIntOp(Opcode('OP_RETURN')).should.equal(false)
      Opcode.isSmallIntOp(Opcode('OP_CHECKSIG')).should.equal(false)
      Opcode.isSmallIntOp(Opcode('OP_IF')).should.equal(false)
      Opcode.isSmallIntOp(Opcode('OP_NOP')).should.equal(false)
    })
  })

  describe('#inspect', function () {
    it('should output opcode by name, hex, and decimal', function () {
      Opcode.fromString('OP_NOP').inspect().should.equal('<Opcode: OP_NOP, hex: 61, decimal: 97>')
    })
  })

  describe('V2 Hard Fork opcodes', function () {
    it('should have OP_BLAKE3 at 238 (0xee)', function () {
      Opcode.map.OP_BLAKE3.should.equal(238)
      Opcode('OP_BLAKE3').toNumber().should.equal(238)
    })

    it('should have OP_K12 at 239 (0xef)', function () {
      Opcode.map.OP_K12.should.equal(239)
      Opcode('OP_K12').toNumber().should.equal(239)
    })

    it('should reverse-map OP_BLAKE3 and OP_K12', function () {
      Opcode.reverseMap[238].should.equal('OP_BLAKE3')
      Opcode.reverseMap[239].should.equal('OP_K12')
    })

    it('should round-trip OP_BLAKE3 through string conversion', function () {
      Opcode.fromString('OP_BLAKE3').toString().should.equal('OP_BLAKE3')
      Opcode.fromNumber(238).toString().should.equal('OP_BLAKE3')
    })

    it('should round-trip OP_K12 through string conversion', function () {
      Opcode.fromString('OP_K12').toString().should.equal('OP_K12')
      Opcode.fromNumber(239).toString().should.equal('OP_K12')
    })

    it('should have OP_LSHIFT at 152 (0x98)', function () {
      Opcode.map.OP_LSHIFT.should.equal(152)
    })

    it('should have OP_RSHIFT at 153 (0x99)', function () {
      Opcode.map.OP_RSHIFT.should.equal(153)
    })

    it('should round-trip through buffer for V2 opcodes', function () {
      var buf238 = Buffer.from('ee', 'hex')
      Opcode.fromBuffer(buf238).toBuffer().should.deep.equal(buf238)
      Opcode.fromBuffer(buf238).toNumber().should.equal(238)

      var buf239 = Buffer.from('ef', 'hex')
      Opcode.fromBuffer(buf239).toBuffer().should.deep.equal(buf239)
      Opcode.fromBuffer(buf239).toNumber().should.equal(239)
    })
  })
})
