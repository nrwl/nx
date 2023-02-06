// nx-ignore-next-line
const { withNx, composePlugins } = require('@nrwl/webpack');
// nx-ignore-next-line
const { withReact } = require('@nrwl/react');

module.exports = composePlugins(withNx(), withReact(), (config, context) => {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      alias: {
        ...config.resolve.alias,
        react: 'preact/compat',
        'react-dom/test-utils': 'preact/test-utils',
        'react-dom': 'preact/compat', // Must be below test-utils
        'react/jsx-runtime': 'preact/jsx-runtime',
      },
    },
  };
});
