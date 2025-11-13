/*
 * Babel preset to provide Next.js support for Nx.
 */
module.exports = function (api, options) {
  api.assertVersion(7);
  // When running from Jest with babel-jest, remove @babel/plugin-syntax-import-assertions since babel-jest-preset
  // comes with @babel/plugin-syntax-import-attributes. These plugins are incompatible. If we don't remove the
  // conflicting plugin from `next/babel`, then an error will be thrown.
  // e.g. "Cannot combine importAssertions and importAttributes plugins"
  // NOTE: We don't want to do this outside of Jest since it may affect `next build`--although the default is SWC anyway.
  if (process.env.JEST_WORKER_ID) {
    const nextBabel = require('next/babel').default;
    const {
      presets: nextBabelPresets,
      plugins: nextBabelPlugins,
      ...rest
    } = nextBabel(api, options);
    api.assertVersion(7);

    try {
      const conflictingPlugin =
        require('next/dist/compiled/babel/plugin-syntax-import-assertions').default;
      return {
        ...rest,
        presets: nextBabelPresets,
        plugins: [
          ...nextBabelPlugins.filter((p) => p.default !== conflictingPlugin),
          [
            require.resolve('@babel/plugin-proposal-decorators'),
            { legacy: true },
          ],
        ],
      };
    } catch {
      // If this plugin cannot be import, continue as usual. It could be removed in future versions of Next.js.
    }
  }

  return {
    presets: [['next/babel', options]],
    plugins: [
      [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
    ],
  };
};
