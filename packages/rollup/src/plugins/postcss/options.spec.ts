import { normalizeOptions } from './options';

describe('normalizeOptions', () => {
  it('should return defaults when no options provided', () => {
    const result = normalizeOptions();

    expect(result.inject).toBe(true);
    expect(result.extract).toBe(false);
    expect(result.autoModules).toBe(false);
    expect(result.modules).toBe(false);
    expect(result.plugins).toEqual([]);
    expect(result.use).toEqual({});
    expect(result.extensions).toEqual(['.css', '.sss', '.pcss']);
    expect(result.sourceMap).toBe(false);
  });

  it('should preserve provided options', () => {
    const result = normalizeOptions({
      inject: false,
      extract: true,
      autoModules: true,
      sourceMap: 'inline',
    });

    expect(result.inject).toBe(false);
    expect(result.extract).toBe(true);
    expect(result.autoModules).toBe(true);
    expect(result.sourceMap).toBe('inline');
  });

  it('should handle extract as string', () => {
    const result = normalizeOptions({
      extract: 'styles.css',
    });

    expect(result.extract).toBe('styles.css');
  });

  it('should handle modules as object', () => {
    const modulesOptions = {
      generateScopedName: '[name]__[local]___[hash:base64:5]',
    };
    const result = normalizeOptions({
      modules: modulesOptions,
    });

    expect(result.modules).toEqual(modulesOptions);
  });

  it('should preserve plugins array', () => {
    const mockPlugin = { postcssPlugin: 'test' };
    const result = normalizeOptions({
      plugins: [mockPlugin as any],
    });

    expect(result.plugins).toEqual([mockPlugin]);
  });

  it('should preserve use options for preprocessors', () => {
    const result = normalizeOptions({
      use: {
        less: { javascriptEnabled: true },
        sass: { implementation: 'sass' },
      },
    });

    expect(result.use).toEqual({
      less: { javascriptEnabled: true },
      sass: { implementation: 'sass' },
    });
  });

  it('should handle custom extensions', () => {
    const result = normalizeOptions({
      extensions: ['.css', '.scss'],
    });

    expect(result.extensions).toEqual(['.css', '.scss']);
  });
});
