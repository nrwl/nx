export function updateBabelOptions(options: any): void {
  const idx = options.presets.findIndex(
    p => Array.isArray(p) && p[0].indexOf('@babel/preset-env') !== -1
  );
  options.presets.splice(idx + 1, 0, [
    require.resolve('@babel/preset-react'),
    {
      useBuiltIns: true
    }
  ]);
  options.plugins.splice(
    0,
    0,
    [
      require.resolve('babel-plugin-styled-components'),
      {
        pure: true
      }
    ],
    require.resolve('babel-plugin-emotion')
  );
  return options;
}
