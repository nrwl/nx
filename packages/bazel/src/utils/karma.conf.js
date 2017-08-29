/**
 * Warning: the testing rule will change.
 *
 * Instead of running karma outside of bazel against the bin_dir directory, we will run it as part of the bazel process.
 */
const path = require("path");
const fs = require("fs");

module.exports = function(config) {
  const binDir = config.opts.bin_dir.startsWith('/') ? config.opts.bin_dir : path.join(process.cwd(), config.opts.bin_dir);
  const apps = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.angular-cli.json'), 'UTF-8')).apps;
  const alias = apps.reduce((acc, curr) => {
    acc[curr.name] = path.join(binDir, path.dirname(curr.root));
    return acc;
  }, {});

  const webpackConfig = {
    resolve: {
      alias
    },
    resolveLoader: {
      alias: {
        "template-loader": '@nrwl/bazel/src/utils/template-loader'
      }
    },
    module: {
      rules: [
        {
          test: /\.component\.js$/,
          use: [
            {loader: 'template-loader' }
          ]
        },
        {
          test: /\.html$/,
          use: [
            {loader: 'raw-loader' }
          ]
        },
        {
          test: /\.css$/,
          use: [
            {loader: 'raw-loader' }
          ]
        }
      ]
    }
  };

  config.set({
    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: `${config.opts.bin_dir}/${config.opts.app}`,

    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],

    // list of files / patterns to load in the browser
    files: [
      { pattern: 'test.js', watched: false}
    ],

    // list of files to exclude
    exclude: [],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'test.js': ['webpack']
    },

    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: config.opts.reporters ? config.opts.reporters : (config.opts.progress ? ['progress'] : ['dots']),

    webpack: webpackConfig,

    webpackMiddleware: {
      stats: 'errors-only'
    },

    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage-istanbul-reporter'),
      require('karma-webpack')
    ],

    coverageIstanbulReporter: {
      reports: [ 'html', 'lcovonly' ],
      fixWebpackSourcePaths: true
    },

    client: {
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },

    // web server port
    port: config.opts.port ? config.opts.port : 9876,

    // enable / disable colors in the output (reporters and logs)
    colors: config.opts.colors,

    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.opts.log ? config.opts.log: config.LOG_INFO,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    // browsers: ['PhantomJS'],
    browsers: ['Chrome'],

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  });
};
