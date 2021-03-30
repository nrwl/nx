/*
 * Babel preset to provide Gatsby support for Nx.
 */

interface GatsbyBabelOptions {
  reactRuntime?: string;
  reactImportSource?: string;
}

module.exports = function (api: any, presetOptions: GatsbyBabelOptions) {
  api.assertVersion(7);
  return {
    presets: [
      '@nrwl/web/babel',
      [
        require.resolve('babel-preset-gatsby'),
        getGatsbyBabelOptions({ presetOptions }),
      ],
    ],
  };
};

function getGatsbyBabelOptions({ presetOptions }) {
  const gatsbyPresetOptions: Record<string, string | boolean> = {
    reactRuntime: presetOptions.reactRuntime ?? 'automatic',
  };
  if (presetOptions.reactImportSource) {
    gatsbyPresetOptions.reactImportSource = presetOptions.reactImportSource;
  }
  return gatsbyPresetOptions;
}
