import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { hasPlugin as hasRollupPlugin } from '@nx/rollup/src/utils/has-plugin';
import { expoLibraryGenerator } from './library';
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
    js: false,
    addPlugin: true,
  };

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
  });

  describe('not nested', () => {
    it('should update project.json', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        tags: 'one,two',
      });
      const projectConfiguration = readProjectConfiguration(appTree, 'my-lib');
      expect(projectConfiguration).toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "my-lib",
          "projectType": "library",
          "root": "my-lib",
          "sourceRoot": "my-lib/src",
          "tags": [
            "one",
            "two",
          ],
          "targets": {},
        }
      `);
    });

    it('should update tsconfig.base.json', async () => {
      await expoLibraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.ts',
      ]);
    });

    it('should update root tsconfig.base.json (no existing path mappings)', async () => {
      updateJson(appTree, 'tsconfig.base.json', (json) => {
        json.compilerOptions.paths = undefined;
        return json;
      });

      await expoLibraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-lib/src/index.ts',
      ]);
    });

    it('should create a local tsconfig.json', async () => {
      await expoLibraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
      expect(tsconfigJson).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "allowSyntheticDefaultImports": true,
            "esModuleInterop": true,
            "forceConsistentCasingInFileNames": true,
            "jsx": "react-jsx",
            "noFallthroughCasesInSwitch": true,
            "noImplicitReturns": true,
            "strict": true,
          },
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
            "outDir": "../dist/out-tsc",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "**/*.test.ts",
            "**/*.spec.ts",
            "**/*.test.tsx",
            "**/*.spec.tsx",
            "**/*.test.js",
            "**/*.spec.js",
            "**/*.test.jsx",
            "**/*.spec.jsx",
            "src/test-setup.ts",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
          ],
          "extends": "./tsconfig.json",
          "include": [
            "**/*.js",
            "**/*.jsx",
            "**/*.ts",
            "**/*.tsx",
          ],
        }
      `);
    });

    it('should extend the local tsconfig.json with tsconfig.spec.json', async () => {
      await expoLibraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.spec.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });

    it('should extend the local tsconfig.json with tsconfig.lib.json', async () => {
      await expoLibraryGenerator(appTree, defaultSchema);
      const tsconfigJson = readJson(appTree, 'my-lib/tsconfig.lib.json');
      expect(tsconfigJson.extends).toEqual('./tsconfig.json');
    });
  });

  describe('nested', () => {
    it('should update project.json with two libs', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-dir-my-lib',
        directory: 'my-dir/my-lib',
        tags: 'one',
      });

      const projectConfiguration = readProjectConfiguration(
        appTree,
        'my-dir-my-lib'
      );
      expect(projectConfiguration).toMatchObject({
        tags: ['one'],
      });

      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-dir-my-lib2',
        directory: 'my-dir/my-lib2',
        tags: 'one,two',
      });

      const lib2ProjectConfiguration = readProjectConfiguration(
        appTree,
        'my-dir-my-lib2'
      );
      expect(lib2ProjectConfiguration).toMatchObject({
        tags: ['one', 'two'],
      });
    });

    it('should update project.json', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-dir-my-lib',
        directory: 'my-dir/my-lib',
      });
      const projectConfiguration = readProjectConfiguration(
        appTree,
        'my-dir-my-lib'
      );
      expect(projectConfiguration).toMatchInlineSnapshot(`
        {
          "$schema": "../../node_modules/nx/schemas/project-schema.json",
          "name": "my-dir-my-lib",
          "projectType": "library",
          "root": "my-dir/my-lib",
          "sourceRoot": "my-dir/my-lib/src",
          "tags": [],
          "targets": {},
        }
      `);
    });

    it('should update tsconfig.base.json', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        directory: 'my-dir',
        name: 'my-lib',
      });
      const tsconfigJson = readJson(appTree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
        'my-dir/src/index.ts',
      ]);
      expect(tsconfigJson.compilerOptions.paths['my-dir/*']).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        directory: 'my-dir',
      });

      const tsconfigJson = readJson(appTree, 'my-dir/tsconfig.json');
      expect(tsconfigJson.references).toEqual([
        {
          path: './tsconfig.lib.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ]);
    });
  });

  describe('--unit-test-runner', () => {
    it('should not generate test configuration', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        unitTestRunner: 'none',
      });

      expect(appTree.exists('my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(appTree.exists('my-lib/jest.config.ts')).toBeFalsy();
      const projectConfiguration = readProjectConfiguration(appTree, 'my-lib');
      expect(projectConfiguration).toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "my-lib",
          "projectType": "library",
          "root": "my-lib",
          "sourceRoot": "my-lib/src",
          "tags": [],
          "targets": {},
        }
      `);
    });

    it('should generate test configuration', async () => {
      await expoLibraryGenerator(appTree, {
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
          resolver: '@nx/jest/plugins/resolver',
          preset: 'jest-expo',
          moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
          setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
          moduleNameMapper: {
            '\\\\.svg$': '@nx/expo/plugins/jest/svg-mock',
          },
          transform: {
            '.[jt]sx?$': [
              'babel-jest',
              {
                configFile: __dirname + '/.babelrc.js',
              },
            ],
            '^.+.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$':
              require.resolve('jest-expo/src/preset/assetFileTransformer.js'),
          },
          coverageDirectory: '../coverage/my-lib',
        };
        "
      `);
    });
  });

  describe('--buildable', () => {
    it('should add a rollup.config.cjs', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        buildable: true,
      });

      expect(appTree.exists('my-lib/rollup.config.cjs')).toBeTruthy();
      expect(hasRollupPlugin(appTree)).toBeTruthy();
    });
  });

  describe('--publishable', () => {
    it('should add a rollup.config.cjs', async () => {
      await expoLibraryGenerator(appTree, {
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
        await expoLibraryGenerator(appTree, {
          ...defaultSchema,
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
      await expoLibraryGenerator(appTree, {
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
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        js: true,
      });

      expect(appTree.exists('my-lib/src/index.js')).toBe(true);
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        publishable: true,
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
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        name: 'my-lib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await expoLibraryGenerator(appTree, {
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
      await expoLibraryGenerator(appTree, {
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

  describe('TS solution setup', () => {
    beforeEach(() => {
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
    });

    it('should add project references when using TS solution', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        strict: false,
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
          "main": "src/index.ts",
          "name": "@proj/my-lib",
          "nx": {},
          "types": "src/index.ts",
          "version": "0.0.1",
        }
      `);
      expect(Object.keys(readJson(appTree, 'my-lib/package.json')))
        .toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "main",
          "types",
          "exports",
          "nx",
        ]
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
            "**/*.test.ts",
            "**/*.spec.ts",
            "**/*.test.tsx",
            "**/*.spec.tsx",
            "**/*.test.js",
            "**/*.spec.js",
            "**/*.test.jsx",
            "**/*.spec.jsx",
            "src/test-setup.ts",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "include": [
            "**/*.js",
            "**/*.jsx",
            "**/*.ts",
            "**/*.tsx",
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

    it('should generate buildable library', async () => {
      await expoLibraryGenerator(appTree, {
        ...defaultSchema,
        buildable: true,
        strict: false,
      });

      expect(readJson(appTree, 'my-lib/package.json')).toMatchInlineSnapshot(`
        {
          "exports": {
            ".": {
              "default": "./dist/index.esm.js",
              "import": "./dist/index.esm.js",
              "types": "./dist/index.esm.d.ts",
            },
            "./package.json": "./package.json",
          },
          "main": "./dist/index.esm.js",
          "module": "./dist/index.esm.js",
          "name": "@proj/my-lib",
          "nx": {
            "projectType": "library",
            "sourceRoot": "my-lib/src",
            "tags": [],
            "targets": {
              "build": {
                "executor": "@nx/rollup:rollup",
                "options": {
                  "assets": [
                    {
                      "glob": "my-lib/README.md",
                      "input": ".",
                      "output": ".",
                    },
                  ],
                  "entryFile": "my-lib/src/index.ts",
                  "external": [
                    "react/jsx-runtime",
                    "react-native",
                    "react",
                    "react-dom",
                  ],
                  "outputPath": "dist/my-lib",
                  "project": "my-lib/package.json",
                  "rollupConfig": "@nx/react/plugins/bundle-rollup",
                  "tsConfig": "my-lib/tsconfig.lib.json",
                },
                "outputs": [
                  "{options.outputPath}",
                ],
              },
            },
          },
          "peerDependencies": {
            "react": "~18.3.1",
            "react-native": "0.76.3",
          },
          "type": "module",
          "types": "./dist/index.esm.d.ts",
          "version": "0.0.1",
        }
      `);
    });
  });
});
