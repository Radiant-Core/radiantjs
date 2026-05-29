// Choose the Node or browser hash implementation. We prefer hash.node when
// the Node `crypto` module is genuinely usable (createHash is a function);
// otherwise (webpack bundles where the `crypto` fallback is `false`, plus
// genuinely-browser environments) we fall through to the pure-JS variant.
//
// `process.browser === true` short-circuits to the browser path so callers
// who explicitly mark their bundle as browser-targeted get the expected
// behaviour even before any runtime feature detection.
function pickImpl () {
  try {
    if (typeof process !== 'undefined' && process && process.browser) {
      return require('./hash.browser')
    }
    var nodeCrypto = require('crypto')
    if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
      return require('./hash.node')
    }
  } catch (e) {
    // require('crypto') threw - likely browser w/o the polyfill.
  }
  return require('./hash.browser')
}

module.exports = pickImpl()
