module.exports = function (api) {
  api.cache(true);

  return {
    presets: [
      [
        '@nx/react/babel',
        {
          runtime: 'automatic',
          useBuiltIns: 'usage',
        },
      ],
    ],
    plugins: [],
    env: {
      test: {
        presets: ['babel-preset-expo'],
      },
    },
  };
};
