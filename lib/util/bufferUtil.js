// bufferUtil.js
//
// Selects the appropriate Buffer implementation for the current runtime.
// Prefer Node's native Buffer whenever a Node process is present; only fall
// back to the `buffer` polyfill in pure-browser environments. This avoids
// false positives in test runners (e.g. vitest + jsdom) where `window` is
// defined but Node's native Buffer is still the correct choice — a polyfill
// Buffer would not satisfy `Buffer.isBuffer()` against a Buffer created in
// user code, producing confusing precondition failures.
let Buffer;
if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Node.js (including jsdom test environments running on Node)
    Buffer = global.Buffer;
} else {
    // Pure browser
    Buffer = require('buffer/').Buffer;
}

module.exports = Buffer;
