var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: './mnemonic/index.js',
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
    })
  ],
  externals: {
    '../../': 'radiantjs'
  },
  output: {
    library: 'radiantMnemonic',
    libraryTarget: 'umd',
    globalObject: 'this',
    path: path.join(__dirname, '/'),
    filename: 'radiant-mnemonic.min.js'
  },
  mode: 'production'
}
