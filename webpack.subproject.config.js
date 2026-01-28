module.exports = {
  externals: {
    '../../': 'radiantjs'
  },
  output: {
    library: {
      type: 'umd'
    },
    globalObject: 'this'
  },
  mode: 'production'
}
