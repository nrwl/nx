const { join } = require('path');
// nx-ignore-next-line
const { NxWebpackPlugin } = require('@nx/webpack');
// nx-ignore-next-line
const { NxReactWebpackPlugin } = require('@nx/react');

module.exports = {
  output: {
    path: join(__dirname, '../../build/apps/graph'),
  },
  devServer: { port: 4201 },
  plugins: [
    new NxWebpackPlugin({
      maxWorkers: 8,
      index: './src/index.html',
      main: './src/main.tsx',
      polyfills: './src/polyfills.ts',
      tsConfig: './tsconfig.app.json',
      styles: ['./src/styles.css'],
      scripts: [],
      assets: [
        './src/favicon.ico',
        './src/assets/project-graphs/',
        './src/assets/task-graphs/',
        './src/assets/generated-project-graphs/',
        './src/assets/generated-task-graphs/',
        './src/assets/generated-task-inputs/',
        './src/assets/generated-source-maps/',
        {
          input: 'graph/client/src/assets/dev',
          output: '/',
          glob: 'environment.js',
        },
      ],
      webpackConfig: './webpack.config.js',
      optimization: false,
      outputHashing: 'none',
      sourceMap: true,
      extractCss: true,
      namedChunks: false,
      extractLicenses: false,
      vendorChunk: true,
      budgets: [
        {
          type: 'initial',
          maximumWarning: '2mb',
          maximumError: '5mb',
        },
      ],
      babelUpwardRootMode: true,
    }),
    new NxReactWebpackPlugin(),
  ],
};
//   return {
//     ...config,
//     resolve: {
//       ...config.resolve,
//       alias: {
//         ...config.resolve.alias,
//         react: 'preact/compat',
//         'react-dom/test-utils': 'preact/test-utils',
//         'react-dom': 'preact/compat', // Must be below test-utils
//         'react/jsx-runtime': 'preact/jsx-runtime',
//       },
//     },
//   };
// });
