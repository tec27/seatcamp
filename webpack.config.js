import webpack from 'webpack'
import path from 'path'

const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const isProd = nodeEnv === 'production'

export default {
  mode: isProd ? 'production' : 'development',

  entry: './client/index.js',
  output: {
    filename: 'client.js',
    path: path.resolve(__dirname, 'public'),
    publicPath: '/',
  },

  devtool: isProd ? false : 'cheap-module-eval-source-map',

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              babelrc: false,
              cacheDirectory: true,
              presets: [
                [
                  '@babel/preset-env',
                  {
                    targets: 'last 2 versions, not dead, not ie 11, not ie_mob 11, not op_mini all',
                    modules: false,
                    useBuiltIns: 'usage',
                    corejs: 3,
                  },
                ],
              ],
            },
          },
        ],
      },

      {
        test: /\.html?$/,
        exclude: /node_modules/,
        use: [{ loader: 'html-loader' }],
      },
    ],
  },

  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    }),
  ],
}
