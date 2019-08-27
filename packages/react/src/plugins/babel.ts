import { Configuration } from 'webpack';

export function getBabelWebpackConfig(config: Configuration) {
  const idx = config.module.rules.findIndex(r => r.loader === 'ts-loader');

  config.module.rules.splice(idx, 1, {
    use: {
      loader: 'babel-loader',
      options: {
        presets: [
          [
            require('@babel/preset-env').default,
            {
              // Include any project files, e.g. browserlist, by setting the context as config path
              configPath: config.context,
              // Allow importing core-js in entrypoint and use browserlist to select polyfills
              useBuiltIns: 'entry',
              corejs: 3,
              modules: false,
              // Exclude transforms that make all code slower
              exclude: ['transform-typeof-symbol']
            }
          ],
          [
            require('@babel/preset-react').default,
            {
              useBuiltIns: true
            }
          ],
          [require('@babel/preset-typescript').default]
        ],
        plugins: [
          require('babel-plugin-macros'),
          [require('@babel/plugin-proposal-decorators').default, false]
        ]
      }
    },
    test: /\.tsx?|jsx?$/,
    exclude: /node_modules/
  });

  return config;
}
