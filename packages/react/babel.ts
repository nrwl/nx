import type { NxWebBabelPresetOptions } from '@nrwl/web';

/*
 * Babel preset to provide React support for Nx.
 */

interface NxReactBabelOptions extends NxWebBabelPresetOptions {
  runtime?: string;
  importSource?: string;
}

module.exports = function (api: any, options: NxReactBabelOptions) {
  api.assertVersion(7);
  const env = api.env();
  /**
   * pagesDir is set when being transpiled by Next.js
   */
  const isNextJs = api.caller((caller) => caller?.pagesDir);

  const presets: any[] = [['@nrwl/web/babel', options]];

  /**
   * Next.js already includes the preset-react, and including it
   * the second time here results in having two instances of this preset.
   *
   * The plugin is duplicated as opposed to being merged because Next.js uses
   * their own compiled version of the plugin, rather than one from node_modules.
   * That affectively changes the "identity" of the plugin, and babel treats it as
   * two separate instances.
   *
   * More on babel merging: https://babeljs.io/docs/en/options#merging
   */
  if (!isNextJs) {
    presets.push([
      require.resolve('@babel/preset-react'),
      getReactPresetOptions({
        presetOptions: options,
        env,
      }),
    ]);
  }

  return {
    presets,
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
