import webpack from 'webpack'
import path from 'path'

const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const isProd = nodeEnv === 'production'

export default {
  entry: './client/root.js',
  output: {
    filename: 'client.js',
    path: path.resolve(__dirname, 'public'),
    publicPath: '/',
  },

  devtool: isProd ? false : 'cheap-module-eval-source-map',

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              cacheDirectory: true,
              presets: [
                'react',
                ['env', {
                  targets: { browsers: 'last 2 versions' },
                  modules: false,
                  useBuiltIns: true,
                }],
                'stage-0',
              ],
            },
          },
        ],
      },

      {
        test: /\.html?$/,
        exclude: /node_modules/,
        use: [
          { loader: 'html-loader' },
        ],
      },
    ],
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(nodeEnv)
    }),
  ].concat(isProd ? [
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      compress: { warnings: false },
      output: { comments: false },
      sourceMap: false,
    })
  ] : []),
}
