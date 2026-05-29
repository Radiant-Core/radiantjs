var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: './' + 'index.js',
  resolve: {
    fallback: {
      'assert': require.resolve('assert/'),
      'buffer': require.resolve('buffer/'),
      'crypto': false,
      'stream': false
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    // Make hash.js dispatcher choose the browser variant unconditionally
    // (the Node `crypto` module is unavailable in browsers, and even where
    // a polyfill exists it lacks createHash).
    new webpack.DefinePlugin({
      'process.browser': JSON.stringify(true)
    })
  ],
  output: {
    library: 'radiantjs',
    libraryTarget: 'umd',
    globalObject: 'this',
    path: path.join(__dirname, '/'),
    filename: 'radiant.min.js'
  },
  mode: 'production'
}
