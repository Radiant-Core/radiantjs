'use strict'

var should = require('chai').should()
var bsv = require('../')

describe('#versionGuard', function () {
  // Skipped: global._bsv version guard is BSV-specific; Radiant does not set this global
  it.skip('global._bsv should be defined [BSV-specific version guard]', function () {
  })

  it('throw an error if version is already defined', function () {
    (function () {
      bsv.versionGuard('version')
    }).should.not.throw('More than one instance of bsv')
  })
})
