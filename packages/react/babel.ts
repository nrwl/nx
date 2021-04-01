/*
 * Babel preset to provide React support for Nx.
 */

interface ReactBabelOptions {
  runtime?: string;
  importSource?: string;
}

module.exports = function (api: any, options: ReactBabelOptions) {
  api.assertVersion(7);
  const env = api.env();

  return {
    presets: [
      '@nrwl/web/babel',
      [
        require.resolve('@babel/preset-react'),
        getReactPresetOptions({
          presetOptions: options,
          env,
        }),
      ],
    ],
  };
};

function getReactPresetOptions({ presetOptions, env }) {
  const reactPresetOptions: Record<string, string | boolean> = {
    runtime: presetOptions.runtime ?? 'automatic',
    development: env !== 'production',
  };

  // JSX spread is transformed into object spread in `@babel/plugin-transform-react-jsx`
  // `useBuiltIns` will be removed in Babel 8.
  if (reactPresetOptions.runtime === 'automatic') {
    reactPresetOptions.useBuiltIns = true;
  }

  if (presetOptions.importSource) {
    reactPresetOptions.importSource = presetOptions.importSource;
  }

  return reactPresetOptions;
}
