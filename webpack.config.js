import webpack from 'webpack'
import WorkboxPlugin from 'workbox-webpack-plugin'
import path from 'path'

const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const isProd = nodeEnv === 'production'

export default {
  mode: isProd ? 'production' : 'development',

  entry: {
    client: './client/index.js',
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'public'),
    publicPath: '/',
  },

  devtool: isProd ? false : 'eval-cheap-module-source-map',

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
              assumptions: {
                setPublicClassFields: true,
              },
              plugins: ['@babel/plugin-transform-class-properties'],
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
    ...(isProd
      ? [
          new WorkboxPlugin.InjectManifest({
            swSrc: './serviceworker/index.js',
            swDest: 'serviceworker.js',
          }),
        ]
      : []),
  ],
}
