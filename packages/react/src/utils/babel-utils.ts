export function updateBabelOptions(options: any): void {
  const idx = options.presets.findIndex(
    p => Array.isArray(p) && p[0].indexOf('@babel/preset-env') !== -1
  );
  options.presets.splice(idx + 1, 0, [
    '@babel/preset-react',
    {
      useBuiltIns: true
    }
  ]);
  return options;
}
