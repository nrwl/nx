import { validateTypesVersionsExportsSync } from './index';

const SOURCE_PROJECT = 'test-project';
const PACKAGE_JSON_PATH = '/path/to/test-project/package.json';

describe('types-versions-exports-sync', () => {
  describe('validateTypesVersionsExportsSync()', () => {
    it('should return no violations when both fields are fully in sync', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/utils': ['dist/src/utils/index.d.ts'],
              'src/*': ['dist/src/*.d.ts'],
            },
          },
          exports: {
            '.': {
              types: './dist/index.d.ts',
              default: './dist/index.js',
            },
            './src/utils': {
              types: './dist/src/utils/index.d.ts',
              default: './dist/src/utils/index.js',
            },
            './src/*': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toEqual([]);
    });

    it('should return no violations when package has only exports', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          exports: {
            '.': {
              types: './dist/index.d.ts',
              default: './dist/index.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toEqual([]);
    });

    it('should return no violations when package has only typesVersions', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/*': ['dist/src/*.d.ts'],
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toEqual([]);
    });

    it('should return no violations for exports string shorthand entries', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/*': ['dist/src/*.d.ts'],
            },
          },
          exports: {
            './package.json': './package.json',
            './src/*': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toEqual([]);
    });

    it('should return no violations for exports entries without a types condition', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/*': ['dist/src/*.d.ts'],
            },
          },
          exports: {
            './presets/*': {
              default: './dist/presets/*',
            },
            './src/*': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toEqual([]);
    });

    it('should return a violation when exports has types but no typesVersions entry', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/*': ['dist/src/*.d.ts'],
            },
          },
          exports: {
            './src/*': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
            './release': {
              types: './dist/release/index.d.ts',
              default: './dist/release/index.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/path/to/test-project/package.json",
            "message": "The exports entry './release' has a 'types' condition but no corresponding 'typesVersions' entry. Add 'release' to 'typesVersions' to support node10 module resolution.",
            "sourceProject": "test-project",
          },
        ]
      `);
    });

    it('should return a violation when types paths mismatch', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/utils': ['dist/src/utils.d.ts'],
            },
          },
          exports: {
            './src/utils': {
              types: './dist/src/utils/index.d.ts',
              default: './dist/src/utils/index.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/path/to/test-project/package.json",
            "message": "The 'typesVersions' entry 'src/utils' maps to 'dist/src/utils.d.ts' but 'exports' maps types to 'dist/src/utils/index.d.ts'. These must match.",
            "sourceProject": "test-project",
          },
        ]
      `);
    });

    it('should return a violation for stale typesVersions entry with no matching export', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/*': ['dist/src/*.d.ts'],
              'old-module': ['dist/old-module/index.d.ts'],
            },
          },
          exports: {
            './src/*': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/path/to/test-project/package.json",
            "message": "The 'typesVersions' entry 'old-module' has no corresponding 'exports' entry with a 'types' condition. Remove it from 'typesVersions' or add a matching export with a 'types' condition.",
            "sourceProject": "test-project",
          },
        ]
      `);
    });

    it('should require separate typesVersions entries for extensionless and extension-bearing subpaths', () => {
      const violations = validateTypesVersionsExportsSync(
        {
          typesVersions: {
            '*': {
              'src/*': ['dist/src/*.d.ts'],
            },
          },
          exports: {
            './src/*': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
            './src/*.js': {
              types: './dist/src/*.d.ts',
              default: './dist/src/*.js',
            },
          },
        },
        SOURCE_PROJECT,
        PACKAGE_JSON_PATH
      );
      expect(violations).toMatchInlineSnapshot(`
        [
          {
            "file": "/path/to/test-project/package.json",
            "message": "The exports entry './src/*.js' has a 'types' condition but no corresponding 'typesVersions' entry. Add 'src/*.js' to 'typesVersions' to support node10 module resolution.",
            "sourceProject": "test-project",
          },
        ]
      `);
    });
  });
});
