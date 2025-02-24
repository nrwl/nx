import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import libraryGenerator from './library';
import { Linter } from '@nx/eslint';
import { hasPlugin as hasRollupPlugin } from '@nx/rollup/src/utils/has-plugin';
import { Schema } from './schema';

describe('lib', () => {
  let appTree: Tree;

  const defaultSchema: Schema = {
    directory: 'my-lib',
    linter: Linter.EsLint,
    skipFormat: false,
    skipTsConfig: false,
    unitTestRunner: 'jest',
    strict: true,
    addPlugin: true,
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
  });

  describe('not nested', () => {
    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.json when no tsconfig.base.json', async () => {
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      await libraryGenerator(appTree, defaultSchema);

      const tsconfigJson = readJson(appTree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.base.json (no existing path mappings)', async () => {
      updateJson(appTree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.paths = undefined;
        return json;
      });

      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(appTree, defaultSchema);

      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).toEqual(true);
      expect(tsconfigJson.compilerOptions.strict).toEqual(true);
      expect(tsconfigJson.compilerOptions.noImplicitReturns).toEqual(true);
      expect(tsconfigJson.compilerOptions.noFallthroughCasesInSwitch).toEqual(
        true
      );
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      await libraryGenerator(appTree, defaultSchema);

      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await libraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.lib.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update nx.json', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib',
        directory: 'my-dir',
        tags: 'one',
      });

      const projectConfiguration = readProjectConfiguration(appTree, 'my-lib');
      expect(projectConfiguration).toMatchObject({
        tags: ['one'],
      });

      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib2',
        directory: 'my-dir2',
        tags: 'one,two',
      });

      const lib2ProjectConfiguration = readProjectConfiguration(
        appTree,
        'my-lib2'
      );
      expect(lib2ProjectConfiguration).toMatchObject({
        tags: ['one', 'two'],
      });
    });

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib',
        directory: 'my-dir',
      });
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/src/index.ts',
      ]);
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should update root tsconfig.json when no tsconfig.base.json', async () => {
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib',
        directory: 'my-dir',
      });

      const tsconfigJson = readJson(appTree, '/tsconfig.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/src/index.ts',
      ]);
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib',
        directory: 'my-dir',
      });

      const tsconfigJson = readJson(appTree, 'my-dir/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../tsconfig.base.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);

      expect(readJson(appTree, 'my-dir/tsconfig.lib.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "outDir": "../dist/out-tsc",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/test-setup.ts",
            "jest.config.ts",
          ],
          "extends": "./tsconfig.json",
          "include": [
            "src/**/*.js",
            "src/**/*.jsx",
            "src/**/*.ts",
            "src/**/*.tsx",
          ],
        }
      `);
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      appTree.rename('tsconfig.base.json', 'tsconfig.json');

      await libraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib',
        directory: 'my-dir',
      });

      const tsconfigJson = readJson(appTree, 'my-dir/tsconfig.json');
      expect(tsconfigJson.extends).toBe('../tsconfig.json');
    });
  });

  describe('--unit-test-runner', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        unitTestRunner: 'none',
      });

      expect(appTree.exists('my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('my-lib/jest.config.ts')).toBeFalsy();
    });

    it('should generate test configuration', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        unitTestRunner: 'jest',
      });

      expect(appTree.read('my-lib/tsconfig.spec.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": "./tsconfig.json",
          "compilerOptions": {
            "outDir": "../dist/out-tsc",
            "module": "commonjs",
            "moduleResolution": "node10",
            "jsx": "react-jsx",
            "types": ["jest", "node"]
          },
          "files": ["src/test-setup.ts"],
          "include": [
            "jest.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts"
          ]
        }
        "
      `);
      expect(appTree.read('my-lib/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'my-lib',
          preset: 'react-native',
          resolver: '@nx/jest/plugins/resolver',
          moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          moduleNameMapper: {
            '\\\\.svg$': '@nx/react-native/plugins/jest/svg-mock',
          },
          transform: {
            '^.+.(js|ts|tsx)$': [
              'babel-jest',
              {
                configFile: __dirname + '/.babelrc.js',
              },
            ],
            '^.+.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
              'react-native/jest/assetFileTransformer.js'
            ),
          },
          coverageDirectory: '../coverage/my-lib',
        };
        "
      `);
    });
  });

  describe('--buildable', () => {
    it('should add a rollup.config.cjs', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        buildable: true,
      });

      expect(appTree.exists('my-lib/rollup.config.cjs')).toBeTruthy();
      expect(hasRollupPlugin(appTree)).toBeTruthy();
    });
  });

  describe('--publishable', () => {
    it('should add a rollup.config.cjs', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      expect(appTree.exists('my-lib/rollup.config.cjs')).toBeTruthy();
      expect(hasRollupPlugin(appTree)).toBeTruthy();
    });

    it('should fail if no importPath is provided with publishable', async () => {
      expect.assertions(1);

      try {
        await libraryGenerator(appTree, {
          ...defaultSchema,
          name: 'my-lib',
          directory: 'my-dir',
          publishable: true,
        });
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
    });

    it('should add package.json and .babelrc', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const packageJson = readJson(appTree, 'my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
      expect(appTree.exists('my-lib/.babelrc'));
    });
  });

  describe('--js', () => {
    it('should generate JS files', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        js: true,
      });

      expect(appTree.exists('my-lib/src/index.js')).toBe(true);
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
        name: 'my-lib',
        directory: 'my-dir',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(appTree, 'my-dir/package.json');
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        directory: 'my-lib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(appTree, {
          ...defaultSchema,
          directory: 'my-lib2',
          publishable: true,
          importPath: '@myorg/lib',
        });
      } catch (e) {
        expect(e.message).toContain(
          'You already have a library using the import path'
        );
      }

      expect.assertions(1);
    });
  });

  describe('--no-strict', () => {
    it('should not add options for strict mode', async () => {
      await libraryGenerator(appTree, {
        ...defaultSchema,
        strict: false,
      });
      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.json');

      expect(
        tsconfigJson.compilerOptions.forceConsistentCasingInFileNames
      ).not.toBeDefined();
      expect(tsconfigJson.compilerOptions.strict).not.toBeDefined();
      expect(tsconfigJson.compilerOptions.noImplicitReturns).not.toBeDefined();
      expect(
        tsconfigJson.compilerOptions.noFallthroughCasesInSwitch
      ).not.toBeDefined();
    });
  });

  describe('--skipPackageJson', () => {
    it('should not add or update dependencies when true', async () => {
      const packageJsonBefore = readJson(appTree, 'package.json');

      await libraryGenerator(appTree, {
        ...defaultSchema,
        skipPackageJson: true,
      });

      expect(readJson(appTree, 'package.json')).toEqual(packageJsonBefore);
    });
  });

  describe('TS solution setup', () => {
    it('should add project references when using TS solution', async () => {
      updateJson(appTree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(appTree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(appTree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });

      await libraryGenerator(appTree, {
        ...defaultSchema,
      });

      expect(readJson(appTree, 'tsconfig.json').references)
        .toMatchInlineSnapshot(`
        [
          {
            "path": "./my-lib",
          },
        ]
      `);
      // Make sure keys are in idiomatic order
      expect(readJson(appTree, 'my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "exports": {
            ".": {
              "default": "./src/index.ts",
              "import": "./src/index.ts",
              "types": "./src/index.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./src/index.ts",
          "name": "@proj/my-lib",
          "nx": {},
          "types": "./src/index.ts",
          "version": "0.0.1",
        }
      `);
      expect(readJson(appTree, 'my-lib/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(appTree, 'my-lib/tsconfig.lib.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "out-tsc/my-lib",
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/my-lib/tsconfig.lib.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/test-setup.ts",
            "jest.config.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "src/**/*.js",
            "src/**/*.jsx",
            "src/**/*.ts",
            "src/**/*.tsx",
          ],
        }
      `);
      expect(readJson(appTree, 'my-lib/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "./out-tsc/jest",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "files": [
            "src/test-setup.ts",
          ],
          "include": [
            "jest.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.lib.json",
            },
          ],
        }
      `);
    });
  });
});
