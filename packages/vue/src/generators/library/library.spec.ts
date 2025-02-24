import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { nxVersion } from '../../utils/versions';
import libraryGenerator from './library';
import { Schema } from './schema';

describe('library', () => {
  let tree: Tree;

  let defaultSchema: Schema = {
    directory: 'my-lib',
    linter: Linter.EsLint,
    skipFormat: false,
    skipTsConfig: false,
    unitTestRunner: 'vitest',
    component: true,
    strict: true,
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, '/package.json', (json) => {
      json.devDependencies = {
        '@nx/cypress': nxVersion,
        '@nx/rollup': nxVersion,
        '@nx/vite': nxVersion,
      };
      return json;
    });
  });

  it('should add vite types to tsconfigs and generate correct vite.config.ts file', async () => {
    await libraryGenerator(tree, {
      ...defaultSchema,
      bundler: 'vite',
      unitTestRunner: 'vitest',
    });
    const tsconfigApp = readJson(tree, 'my-lib/tsconfig.lib.json');
    expect(tsconfigApp.compilerOptions.types).toEqual(['vite/client']);
    const tsconfigSpec = readJson(tree, 'my-lib/tsconfig.spec.json');
    expect(tsconfigSpec.compilerOptions.types).toEqual([
      'vitest/globals',
      'vitest/importMeta',
      'vite/client',
      'node',
      'vitest',
    ]);
    expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should update tags', async () => {
    await libraryGenerator(tree, { ...defaultSchema, tags: 'one,two' });
    const project = readProjectConfiguration(tree, 'my-lib');
    expect(project).toEqual(
      expect.objectContaining({
        tags: ['one', 'two'],
      })
    );
  });

  it('should add vue, vite and vitest to package.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    expect(readJson(tree, '/package.json')).toMatchSnapshot();
    expect(tree.read('my-lib/tsconfig.lib.json', 'utf-8')).toMatchSnapshot();
  });

  it('should update root tsconfig.base.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, '/tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'my-lib/src/index.ts',
    ]);
  });

  it('should create tsconfig.base.json out of tsconfig.json', async () => {
    tree.rename('tsconfig.base.json', 'tsconfig.json');

    await libraryGenerator(tree, defaultSchema);

    expect(tree.exists('tsconfig.base.json')).toEqual(true);
    const tsconfigJson = readJson(tree, 'tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'my-lib/src/index.ts',
    ]);
  });

  it('should update root tsconfig.base.json (no existing path mappings)', async () => {
    updateJson(tree, 'tsconfig.base.json', (json) => {
      json.compilerOptions.paths = undefined;
      return json;
    });

    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, '/tsconfig.base.json');
    expect(tsconfigJson.compilerOptions.paths['@proj/my-lib']).toEqual([
      'my-lib/src/index.ts',
    ]);
  });

  it('should create a local tsconfig.json', async () => {
    await libraryGenerator(tree, defaultSchema);

    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.json');
    expect(tsconfigJson.extends).toBe('../tsconfig.base.json');
    expect(tsconfigJson.references).toEqual([
      {
        path: './tsconfig.lib.json',
      },
      {
        path: './tsconfig.spec.json',
      },
    ]);
  });

  it('should extend the tsconfig.lib.json with tsconfig.spec.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.spec.json');
    expect(tsconfigJson.extends).toEqual('./tsconfig.json');
  });

  it('should extend ./tsconfig.json with tsconfig.lib.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
    expect(tsconfigJson.extends).toEqual('./tsconfig.json');
  });

  it('should ignore test files in tsconfig.lib.json', async () => {
    await libraryGenerator(tree, defaultSchema);
    const tsconfigJson = readJson(tree, 'my-lib/tsconfig.lib.json');
    expect(tsconfigJson.exclude).toMatchSnapshot();
  });

  it('should generate files', async () => {
    await libraryGenerator(tree, defaultSchema);
    expect(tree.exists('my-lib/package.json')).toBeFalsy();
    expect(tree.exists('my-lib/src/index.ts')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/my-lib.vue')).toBeTruthy();
    expect(tree.exists('my-lib/src/lib/my-lib.spec.ts')).toBeTruthy();
    const eslintJson = readJson(tree, 'my-lib/.eslintrc.json');
    expect(eslintJson).toMatchSnapshot();
  });

  it('should support eslint flat config CJS', async () => {
    tree.write(
      'eslint.config.cjs',
      `const { FlatCompat } = require('@eslint/eslintrc');
const nxEslintPlugin = require('@nx/eslint-plugin');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  { plugins: { '@nx': nxEslintPlugin } },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...compat.config({ extends: ['plugin:@nx/typescript'] }).map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ extends: ['plugin:@nx/javascript'] }).map((config) => ({
    ...config,
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ env: { jest: true } }).map((config) => ({
    ...config,
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
    rules: {
      ...config.rules,
    },
  })),
];
`
    );

    await libraryGenerator(tree, defaultSchema);

    const eslintJson = tree.read('my-lib/eslint.config.cjs', 'utf-8');
    expect(eslintJson).toMatchSnapshot();
    // assert **/*.vue was added to override in base eslint config
    const eslintBaseJson = tree.read('eslint.config.cjs', 'utf-8');
    expect(eslintBaseJson).toContain(
      `files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],`
    );
  });

  it('should support eslint flat config ESM', async () => {
    tree.write(
      'eslint.config.mjs',
      `import { FlatCompat } from '@eslint/eslintrc';
        import { dirname } from 'path';
        import { fileURLToPath } from 'url';
        import js from '@eslint/js';
        import nx from '@nx/eslint-plugin';
        import baseConfig from '../eslint.config.mjs';

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });
        
        export default [
        { plugins: { '@nx': nxEslintPlugin } },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  ...compat.config({ extends: ['plugin:@nx/typescript'] }).map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ extends: ['plugin:@nx/javascript'] }).map((config) => ({
    ...config,
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      ...config.rules,
    },
  })),
  ...compat.config({ env: { jest: true } }).map((config) => ({
    ...config,
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
    rules: {
      ...config.rules,
    },
  })),
]`
    );

    await libraryGenerator(tree, defaultSchema);

    const eslintJson = tree.read('my-lib/eslint.config.mjs', 'utf-8');
    expect(eslintJson).toMatchSnapshot();
    // assert **/*.vue was added to override in base eslint config
    const eslintBaseJson = tree.read('eslint.config.mjs', 'utf-8');
    expect(eslintBaseJson).toContain(
      `files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.vue'],`
    );
  });

  describe('nested', () => {
    it('should update tags and implicitDependencies', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'my-dir-my-lib',
        directory: 'my-dir/my-lib',
        tags: 'one',
      });
      const myLib = readProjectConfiguration(tree, 'my-dir-my-lib');
      expect(myLib).toEqual(
        expect.objectContaining({
          tags: ['one'],
        })
      );

      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'my-dir-my-lib2',
        directory: 'my-dir/my-lib2',
        tags: 'one,two',
      });

      const myLib2 = readProjectConfiguration(tree, 'my-dir-my-lib2');
      expect(myLib2).toEqual(
        expect.objectContaining({
          tags: ['one', 'two'],
        })
      );
    });

    it('should generate files', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'my-dir-my-lib',
        directory: 'my-dir/my-lib',
      });
      expect(tree.exists('my-dir/my-lib/src/index.ts')).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-dir-my-lib.vue')
      ).toBeTruthy();
      expect(
        tree.exists('my-dir/my-lib/src/lib/my-dir-my-lib.spec.ts')
      ).toBeTruthy();
    });

    it('should update project configurations', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'my-dir-my-lib',
        directory: 'my-dir/my-lib',
      });
      const config = readProjectConfiguration(tree, 'my-dir-my-lib');

      expect(config.root).toEqual('my-dir/my-lib');
    });

    it('should update root tsconfig.base.json', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        name: 'my-dir-my-lib',
        importPath: '@proj/my-dir/my-lib',
        directory: 'my-dir/my-lib',
      });
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');
      expect(tsconfigJson.compilerOptions.paths['@proj/my-dir/my-lib']).toEqual(
        ['my-dir/my-lib/src/index.ts']
      );
      expect(
        tsconfigJson.compilerOptions.paths['my-dir-my-lib/*']
      ).toBeUndefined();
    });

    it('should create a local tsconfig.json', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-dir/my-lib',
      });

      const tsconfigJson = readJson(tree, 'my-dir/my-lib/tsconfig.json');
      expect(tsconfigJson).toMatchSnapshot();
    });
  });

  describe('--no-component', () => {
    it('should not generate components or styles', async () => {
      await libraryGenerator(tree, { ...defaultSchema, component: false });

      expect(tree.exists('my-lib/src/lib')).toBeFalsy();
    });
  });

  describe('--unit-test-runner none', () => {
    it('should not generate test configuration', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        unitTestRunner: 'none',
      });

      expect(tree.exists('my-lib/tsconfig.spec.json')).toBeFalsy();
      expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('--publishable', () => {
    it('should add build targets', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      expect(tree.read('my-lib/vite.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should fail if no importPath is provided with publishable', async () => {
      expect.assertions(1);

      try {
        await libraryGenerator(tree, {
          ...defaultSchema,
          directory: 'myDir',
          publishable: true,
        });
      } catch (e) {
        expect(e.message).toContain(
          'For publishable libs you have to provide a proper "--importPath" which needs to be a valid npm package name (e.g. my-awesome-lib or @myorg/my-lib)'
        );
      }
    });

    it('should add package.json and .babelrc', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        importPath: '@proj/my-lib',
      });

      const packageJson = readJson(tree, '/my-lib/package.json');
      expect(packageJson.name).toEqual('@proj/my-lib');
      expect(tree.exists('/my-lib/.babelrc'));
    });
  });

  describe('--js', () => {
    it('should generate JS files', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        js: true,
      });

      expect(tree.exists('/my-lib/src/index.js')).toBe(true);
    });
  });

  describe('--importPath', () => {
    it('should update the package.json & tsconfig with the given import path', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        publishable: true,
        directory: 'my-dir/my-lib',
        importPath: '@myorg/lib',
      });
      const packageJson = readJson(tree, 'my-dir/my-lib/package.json');
      const tsconfigJson = readJson(tree, '/tsconfig.base.json');

      expect(packageJson.name).toBe('@myorg/lib');
      expect(
        tsconfigJson.compilerOptions.paths[packageJson.name]
      ).toBeDefined();
    });

    it('should fail if the same importPath has already been used', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-lib1',
        publishable: true,
        importPath: '@myorg/lib',
      });

      try {
        await libraryGenerator(tree, {
          ...defaultSchema,
          directory: 'myLib2',
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
      await libraryGenerator(tree, {
        ...defaultSchema,
        strict: false,
      });
      const tsconfigJson = readJson(tree, '/my-lib/tsconfig.json');

      expect(tsconfigJson.compilerOptions.strict).toEqual(false);
    });
  });

  describe('--setParserOptionsProject', () => {
    it('should set the parserOptions.project in the eslintrc.json file', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        setParserOptionsProject: true,
      });

      const eslintConfig = readJson(tree, 'my-lib/.eslintrc.json');
      expect(eslintConfig.overrides[0].parserOptions.project).toEqual([
        'my-lib/tsconfig.*?.json',
      ]);
      expect(eslintConfig.overrides[0].files).toContain('*.vue');
    });
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });
    });

    it('should add project references when using TS solution', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        setParserOptionsProject: true,
        linter: 'eslint',
      });

      expect(tree.read('my-lib/vite.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import vue from '@vitejs/plugin-vue';
        import { defineConfig } from 'vite';

        export default defineConfig(() => ({
          root: __dirname,
          cacheDir: '../node_modules/.vite/my-lib',
          plugins: [vue()],
          // Uncomment this if you are using workers.
          // worker: {
          //  plugins: [ nxViteTsPaths() ],
          // },
          test: {
            watch: false,
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            reporters: ['default'],
            coverage: {
              reportsDirectory: './test-output/vitest/coverage',
              provider: 'v8' as const,
            },
          },
        }));
        "
      `);

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./my-lib",
          },
        ]
      `);
      // Make sure keys are in idiomatic order
      expect(Object.keys(readJson(tree, 'my-lib/package.json')))
        .toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "module",
          "types",
          "exports",
          "nx",
        ]
      `);
      expect(readJson(tree, 'my-lib/tsconfig.json')).toMatchInlineSnapshot(`
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
      expect(readJson(tree, 'my-lib/tsconfig.lib.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "preserve",
            "jsxImportSource": "vue",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "out-tsc/my-lib",
            "resolveJsonModule": true,
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/my-lib/tsconfig.lib.tsbuildinfo",
            "types": [
              "vite/client",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "src/**/__tests__/*",
            "src/**/*.spec.vue",
            "src/**/*.test.vue",
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
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
            "src/**/*.vue",
          ],
        }
      `);
      expect(readJson(tree, 'my-lib/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "preserve",
            "jsxImportSource": "vue",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "./out-tsc/vitest",
            "resolveJsonModule": true,
            "types": [
              "vitest/globals",
              "vitest/importMeta",
              "vite/client",
              "node",
              "vitest",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
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

    it('should set "nx.name" in package.json when the user provides a name that is different than the package name', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-lib',
        name: 'my-lib', // import path contains the npm scope, so it would be different
        addPlugin: true,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-lib/package.json').nx).toStrictEqual({
        name: 'my-lib',
      });
    });

    it('should not set "nx.name" in package.json when the provided name matches the package name', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema,
        directory: 'my-lib',
        name: '@proj/my-lib',
        addPlugin: true,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-lib/package.json').nx).toBeUndefined();
    });

    it('should not set "nx.name" in package.json when the user does not provide a name', async () => {
      await libraryGenerator(tree, {
        ...defaultSchema, // defaultSchema has no name
        directory: 'my-lib',
        addPlugin: true,
        skipFormat: true,
      });

      expect(readJson(tree, 'my-lib/package.json').nx).toBeUndefined();
    });
  });
});
