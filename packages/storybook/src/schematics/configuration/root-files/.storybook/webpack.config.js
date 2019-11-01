// Export a function. Accept the base config as the only param.
module.exports = async ({ config, mode }) => {
  // `mode` has a value of 'DEVELOPMENT' or 'PRODUCTION'
  // You can change the configuration based on that.
  // 'PRODUCTION' is used when building the static version of storybook.

  r = config.module.rules.filter(rule => rule.test != '/\\.css$/');

  // Make whatever fine-grained changes you need
  r.push({
    test: /\.css$/,
    use: [
      'to-string-loader',
      {
        loader: 'style-loader'
      },
      {
        loader: 'css-loader',
        options: {
          sourceMap: true
        }
      }
    ]
  });

  config.module.rules = r;
  config.resolve.extensions.push('.tsx');

  let scssLoader = config.module.rules.find(i => !!'a.scss'.match(i.test));
  if (scssLoader && scssLoader.use) {
    scssLoader.use = ['to-string-loader', ...scssLoader.use];
  }

  let htmlLoader = config.module.rules.find(i => !!'a.html'.match(i.test));
  if (htmlLoader) {
    htmlLoader.loader = 'html-loader';
  }

  // Return the altered config
  return config;
};
