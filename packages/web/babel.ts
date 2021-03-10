/*
 * Babel preset to provide TypeScript support and module/nomodule for Nx.
 */

interface NxReactBabelPresetOptions {
  decorators?: {
    decoratorsBeforeExport?: boolean;
    legacy?: boolean;
  };
  classProperties?: {
    loose?: boolean;
  };
}

module.exports = function (api: any, options: NxReactBabelPresetOptions = {}) {
  api.assertVersion(7);

  const isModern = api.caller((caller) => caller?.isModern);
  const emitDecoratorMetadata = api.caller(
    (caller) => caller?.emitDecoratorMetadata ?? true
  );

  return {
    presets: [
      // Support module/nomodule pattern.
      [
        require.resolve('@babel/preset-env'),
        // For Jest tests, NODE_ENV is set as 'test' and we only want to set target as Node.
        // All other options will fail in Jest since Node does not support some ES features
        // such as import syntax.
        process.env.NODE_ENV === 'test'
          ? { targets: { node: 'current' } }
          : {
              // Allow importing core-js in entrypoint and use browserlist to select polyfills.
              // This is needed for differential loading as well.
              useBuiltIns: 'entry',
              corejs: 3,
              // Do not transform modules to CJS
              modules: false,
              targets: isModern ? { esmodules: true } : undefined,
              bugfixes: true,
              // Exclude transforms that make all code slower
              exclude: ['transform-typeof-symbol'],
            },
      ],
      require.resolve('@babel/preset-typescript'),
    ],
    plugins: [
      require.resolve('babel-plugin-macros'),
      emitDecoratorMetadata
        ? require.resolve('babel-plugin-transform-typescript-metadata')
        : undefined,
      // Must use legacy decorators to remain compatible with TypeScript.
      [
        require.resolve('@babel/plugin-proposal-decorators'),
        options.decorators ?? { legacy: true },
      ],
      [
        require.resolve('@babel/plugin-proposal-class-properties'),
        options.classProperties ?? { loose: true },
      ],
    ].filter(Boolean),
    overrides: [
      // Convert `const enum` to `enum`. The former cannot be supported by babel
      // but at least we can get it to not error out.
      {
        test: /\.tsx?$/,
        plugins: [
          [
            require.resolve('babel-plugin-const-enum'),
            {
              transform: 'removeConst',
            },
          ],
        ],
      },
    ],
  };
};
