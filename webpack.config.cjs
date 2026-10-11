const path = require('path')

module.exports = {
  entry: './src/index.ts',
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/',
    clean: true
  },
  resolve: { extensions: ['.ts', '.js'] },
  module: {
    rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }]
  },
  devServer: {
    static: { directory: path.resolve(__dirname, 'public') },
    devMiddleware: { writeToDisk: true },
    hot: true,
    port: 3001
  },
  plugins: [
    new (require('webpack')).ProgressPlugin()
  ]
}
