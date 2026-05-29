var path = require('path')
var webpack = require('webpack')

module.exports = {
  entry: './ecies/index.js',
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
    new webpack.DefinePlugin({
      'process.browser': JSON.stringify(true)
    })
  ],
  externals: {
    '../../': 'radiantjs'
  },
  output: {
    library: 'radiantEcies',
    libraryTarget: 'umd',
    globalObject: 'this',
    path: path.join(__dirname, '/'),
    filename: 'radiant-ecies.min.js'
  },
  mode: 'production'
}
