const { join } = require('node:path');
// nx-ignore-next-line
const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
// nx-ignore-next-line
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');

module.exports = {
  output: {
    path: join(__dirname, '../../build/apps/graph'),
  },
  devServer: {
    port: getPort(process.env.NX_TASK_TARGET_CONFIGURATION),
    historyApiFallback: {
      disableDotRule: true,
    },
  },
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat', // Must be below test-utils
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
  },
  plugins: [
    new NxAppWebpackPlugin({
      index: './src/index.html',
      compiler: 'babel',
      main: './src/main.tsx',
      tsConfig: './tsconfig.app.json',
      styles: ['./src/styles.css'],
      scripts: [],
      assets: getAssets(process.env.NX_TASK_TARGET_CONFIGURATION),
      webpackConfig: './webpack.config.js',
      outputHashing: 'none',
    }),
    new NxReactWebpackPlugin({
      svgr: false,
    }),
  ],
};

function getPort(nxConfiguration) {
  switch (nxConfiguration) {
    case 'nx-console':
      return 4202;
    case 'release':
      return 4203;
    case 'watch':
      return 4204;
    case 'release-static':
      return 4205;
    case 'dev-e2e':
      return 4206;
    default: // dev
      return 4201;
  }
}

function getAssets(nxConfiguration) {
  switch (nxConfiguration) {
    case 'nx-console':
      return [
        './src/favicon.ico',
        {
          input: './src/assets/project-graphs',
          output: '/assets/project-graphs',
          glob: 'e2e.json',
        },
        {
          input: './src/assets/nx-console',
          output: '/',
          glob: 'environment.js',
        },
      ];
    case 'release':
      return [
        './src/favicon.ico',
        {
          input: './src/assets/project-graphs',
          output: '/assets/project-graphs',
          glob: 'e2e.json',
        },
        {
          input: './src/assets/task-graphs',
          output: '/assets/task-graphs',
          glob: 'e2e.json',
        },
        {
          input: './src/assets/source-maps',
          output: '/assets/source-maps',
          glob: 'e2e.json',
        },
        {
          input: './src/assets/release',
          output: '/',
          glob: 'environment.js',
        },
      ];
    case 'watch':
      return [
        './src/favicon.ico',
        {
          input: './src/assets/watch',
          output: '/',
          glob: 'environment.js',
        },
      ];
    case 'release-static':
      return [
        './src/favicon.ico',
        {
          input: './src/assets/project-graphs',
          output: '/assets/project-graphs',
          glob: 'e2e.json',
        },
        {
          input: './src/assets/task-graphs',
          output: '/assets/task-graphs',
          glob: 'e2e.json',
        },
        {
          input: './src/assets/release-static',
          output: '/',
          glob: 'environment.js',
        },
      ];
    case 'dev-e2e':
      return [
        './src/favicon.ico',
        './src/assets/project-graphs/',
        './src/assets/task-graphs/',
        './src/assets/task-inputs/',
        './src/assets/source-maps/',
        {
          input: './src/assets/dev-e2e',
          output: '/',
          glob: 'environment.js',
        },
      ];
    default: // dev
      return [
        './src/favicon.ico',
        './src/assets/project-graphs/',
        './src/assets/task-graphs/',
        './src/assets/generated-project-graphs/',
        './src/assets/generated-task-graphs/',
        './src/assets/generated-task-inputs/',
        './src/assets/generated-source-maps/',
        {
          input: './src/assets/dev',
          output: '/',
          glob: 'environment.js',
        },
      ];
  }
}
