import { logger } from '@nx/devkit';
import { createAllowlistFromExports } from './get-non-buildable-libs';

describe('createAllowlistFromExports', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should handle undefined exports', () => {
    const result = createAllowlistFromExports('@test/lib', undefined);
    expect(result).toEqual(['@test/lib']);
  });

  it('should handle string exports', () => {
    const result = createAllowlistFromExports('@test/lib', './index.js');
    expect(result).toEqual(['@test/lib']);
  });

  it('should handle wildcard exports', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './*': './src/*.ts',
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('@test/lib');
    expect(result[1]).toBeInstanceOf(RegExp);

    const regex = result[1] as RegExp;
    expect(regex.test('@test/lib/utils')).toBe(true);
    expect(regex.test('@test/lib/nested/path')).toBe(true);
    expect(regex.test('@other/lib/utils')).toBe(false);
    expect(regex.test('@test/lib')).toBe(false);
  });

  it('should handle exact subpath exports', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './utils': './src/utils.ts',
      './types': './src/types.ts',
    });
    expect(result).toEqual(['@test/lib', '@test/lib/utils', '@test/lib/types']);
  });

  it('should handle conditional exports', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './utils': {
        import: './src/utils.mjs',
        require: './src/utils.cjs',
        default: './src/utils.js',
      },
    });
    expect(result).toEqual(['@test/lib', '@test/lib/utils']);
  });

  it('should handle conditional exports with development priority', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './utils': {
        development: './src/utils.ts',
        import: './src/utils.mjs',
        require: './src/utils.cjs',
        default: './src/utils.js',
      },
    });
    expect(result).toEqual(['@test/lib', '@test/lib/utils']);
  });

  it('should handle mixed patterns', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './utils': './src/utils.ts',
      './*': './src/*.ts',
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('@test/lib');
    expect(result[1]).toBe('@test/lib/utils');
    expect(result[2]).toBeInstanceOf(RegExp);

    const regex = result[2] as RegExp;
    expect(regex.test('@test/lib/helpers')).toBe(true);
    expect(regex.test('@test/lib/utils')).toBe(true); // Also matches regex
  });

  it('should escape special characters in package names', () => {
    const result = createAllowlistFromExports('@test/lib.name', {
      './*': './src/*.ts',
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toBeInstanceOf(RegExp);

    const regex = result[1] as RegExp;
    expect(regex.test('@test/lib.name/utils')).toBe(true);
    expect(regex.test('@test/lib-name/utils')).toBe(false);
  });

  it('should handle scoped package names with special characters', () => {
    const result = createAllowlistFromExports('@my-org/my-lib.pkg', {
      './*': './src/*.ts',
    });
    expect(result).toHaveLength(2);
    expect(result[1]).toBeInstanceOf(RegExp);

    const regex = result[1] as RegExp;
    expect(regex.test('@my-org/my-lib.pkg/utils')).toBe(true);
    expect(regex.test('@my-org/my-lib-pkg/utils')).toBe(false);
  });

  it('should handle complex wildcard patterns', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './utils/*': './src/utils/*.ts',
      './types/*': './src/types/*.ts',
    });
    expect(result).toHaveLength(3);
    expect(result[0]).toBe('@test/lib');
    expect(result[1]).toBeInstanceOf(RegExp);
    expect(result[2]).toBeInstanceOf(RegExp);

    const utilsRegex = result[1] as RegExp;
    const typesRegex = result[2] as RegExp;

    expect(utilsRegex.test('@test/lib/utils/helpers')).toBe(true);
    expect(utilsRegex.test('@test/lib/types/common')).toBe(false);
    expect(typesRegex.test('@test/lib/types/common')).toBe(true);
    expect(typesRegex.test('@test/lib/utils/helpers')).toBe(false);
  });

  it('should ignore main export (.)', () => {
    const result = createAllowlistFromExports('@test/lib', {
      '.': './src/index.ts',
      './utils': './src/utils.ts',
    });
    expect(result).toEqual(['@test/lib', '@test/lib/utils']);
  });

  it('should handle invalid conditional exports gracefully', () => {
    const result = createAllowlistFromExports('@test/lib', {
      './utils': {
        import: null,
        require: undefined,
        types: './src/types.d.ts', // Should be ignored
      },
      './valid': './src/valid.ts',
    });
    expect(result).toEqual(['@test/lib', '@test/lib/valid']);
  });

  it('should handle non-string export paths', () => {
    const result = createAllowlistFromExports('@test/lib', {
      123: './src/invalid.ts',
      './valid': './src/valid.ts',
    } as any);
    expect(result).toEqual(['@test/lib', '@test/lib/valid']);
  });
});
