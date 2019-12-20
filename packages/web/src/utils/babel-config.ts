export function createBabelConfig(
  context: string,
  esm: boolean,
  debug: boolean
) {
  return {
    compact: false,
    presets: [
      [
        require.resolve('@babel/preset-env'),
        {
          // Allows browserlist file from project to be used.
          configPath: context,
          // Allow importing core-js in entrypoint and use browserlist to select polyfills.
          // This is needed for differential loading as well.
          useBuiltIns: 'entry',
          debug,
          corejs: 3,
          modules: false,
          // Exclude transforms that make all code slower
          exclude: ['transform-typeof-symbol'],
          // Let babel-env figure which modern browsers to support.
          // See: https://github.com/babel/babel/blob/master/packages/babel-preset-env/data/built-in-modules.json
          targets: esm ? { esmodules: true } : undefined
        }
      ],
      [require.resolve('@babel/preset-typescript')]
    ],
    plugins: [
      require.resolve('babel-plugin-macros'),
      // Must use legacy decorators to remain compatible with TypeScript.
      [require.resolve('@babel/plugin-proposal-decorators'), { legacy: true }],
      [
        require.resolve('@babel/plugin-proposal-class-properties'),
        { loose: true }
      ]
    ],
    overrides: [
      {
        test: /\.tsx?$/,
        plugins: [
          [
            require.resolve('babel-plugin-const-enum'),
            {
              transform: 'removeConst'
            }
          ]
        ]
      }
    ]
  };
}
