const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  mode: 'development',
  entry: './dist-ts/index.js',

  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: "/",
    clean: true
  },

  plugins: [
        new CopyWebpackPlugin({
            patterns: [
                { from: 'public', to: '.' }
            ]
        })
    ],


  devtool: 'source-map',

  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public')
    },
    hot: true,
    port: 3001,
    watchFiles: ['dist-ts/**/*.js']
  }
}