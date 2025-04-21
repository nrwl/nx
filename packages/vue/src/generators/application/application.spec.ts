import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  readProjectConfiguration,
  readNxJson,
  updateNxJson,
  updateJson,
  writeJson,
  readJson,
} from '@nx/devkit';

import * as devkitExports from 'nx/src/devkit-exports';

import { applicationGenerator } from './application';
import { Schema } from './schema';
import { PackageManagerCommands } from 'nx/src/utils/package-manager';

describe('application generator', () => {
  let tree: Tree;
  const options: Schema = { directory: 'test' } as Schema;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkitExports, 'getPackageManagerCommand')
      .mockReturnValue({ exec: 'npx' } as PackageManagerCommands);
  });

  it('should run successfully', async () => {
    await applicationGenerator(tree, options);
    const config = readProjectConfiguration(tree, 'test');
    expect(config).toBeDefined();
  });

  it('should set up project correctly with given options', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        buildTargetName: 'build',
        previewTargetName: 'preview',
      },
    });
    updateNxJson(tree, nxJson);
    await applicationGenerator(tree, {
      ...options,
      unitTestRunner: 'vitest',
      e2eTestRunner: 'playwright',
      addPlugin: true,
    });
    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/src/app/App.spec.ts', 'utf-8')).toMatchSnapshot();
    expect(
      tree.read('test-e2e/playwright.config.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(listFiles(tree)).toMatchSnapshot();
  });

  it('should set up project correctly for rsbuild', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];

    updateNxJson(tree, nxJson);
    await applicationGenerator(tree, {
      ...options,
      bundler: 'rsbuild',
      unitTestRunner: 'vitest',
      e2eTestRunner: 'playwright',
      addPlugin: true,
    });

    expect(tree.read('test/vitest.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/rsbuild.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { pluginVue } from '@rsbuild/plugin-vue';
      import { defineConfig } from '@rsbuild/core';

      export default defineConfig({
        html: {
          template: './index.html',
        },
        plugins: [pluginVue()],

        source: {
          entry: {
            index: './src/main.ts',
          },
          tsconfigPath: './tsconfig.app.json',
        },
        server: {
          port: 4200,
        },
        output: {
          target: 'web',
          distPath: {
            root: 'dist',
          },
        },
      });
      "
    `);
    expect(listFiles(tree)).toMatchSnapshot();
    expect(
      readNxJson(tree).plugins.find(
        (p) => typeof p !== 'string' && p.plugin === '@nx/rsbuild'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildDepsTargetName": "build-deps",
          "buildTargetName": "build",
          "devTargetName": "dev",
          "inspectTargetName": "inspect",
          "previewTargetName": "preview",
          "typecheckTargetName": "typecheck",
          "watchDepsTargetName": "watch-deps",
        },
        "plugin": "@nx/rsbuild",
      }
    `);
  });

  it('should set up project correctly for cypress', async () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push({
      plugin: '@nx/vite/plugin',
      options: {
        buildTargetName: 'build',
        previewTargetName: 'preview',
      },
    });
    updateNxJson(tree, nxJson);
    await applicationGenerator(tree, {
      ...options,
      addPlugin: true,
      unitTestRunner: 'vitest',
      e2eTestRunner: 'cypress',
    });
    expect(tree.read('.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test/src/app/App.spec.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('test-e2e/cypress.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not use stylesheet if --style=none', async () => {
    await applicationGenerator(tree, { ...options, style: 'none' });

    expect(tree.exists('test/src/style.none')).toBeFalsy();
    expect(tree.read('test/src/main.ts', 'utf-8')).not.toContain('styles.none');
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
      await applicationGenerator(tree, {
        ...options,
        style: 'none',
        linter: 'eslint',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(tree.read('test/vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "/// <reference types='vitest' />
        import { defineConfig } from 'vite';
        import vue from '@vitejs/plugin-vue';

        export default defineConfig(() => ({
          root: __dirname,
          cacheDir: '../node_modules/.vite/test',
          server: {
            port: 4200,
            host: 'localhost',
          },
          preview: {
            port: 4300,
            host: 'localhost',
          },
          plugins: [vue()],
          // Uncomment this if you are using workers.
          // worker: {
          //  plugins: [ nxViteTsPaths() ],
          // },
          build: {
            outDir: './dist',
            emptyOutDir: true,
            reportCompressedSize: true,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
          },
          test: {
            watch: false,
            globals: true,
            environment: 'jsdom',
            include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
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
            "path": "./test-e2e",
          },
          {
            "path": "./test",
          },
        ]
      `);
      const packageJson = readJson(tree, 'test/package.json');
      expect(packageJson.name).toBe('@proj/test');
      expect(packageJson.nx).toBeUndefined();
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
        ]
      `);
      expect(readJson(tree, 'test/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'test/tsconfig.app.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "preserve",
            "jsxImportSource": "vue",
            "module": "esnext",
            "moduleResolution": "bundler",
            "outDir": "dist",
            "resolveJsonModule": true,
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.app.tsbuildinfo",
            "types": [
              "vite/client",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.vue",
            "src/**/*.test.vue",
            "vite.config.ts",
            "vite.config.mts",
            "vitest.config.ts",
            "vitest.config.mts",
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
            "src/**/*.vue",
          ],
        }
      `);
      expect(readJson(tree, 'test/tsconfig.spec.json')).toMatchInlineSnapshot(`
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
              "path": "./tsconfig.app.json",
            },
          ],
        }
      `);
    });

    it('should respect the provided name', async () => {
      await applicationGenerator(tree, {
        ...options,
        name: 'myapp',
        addPlugin: true,
        useProjectJson: false,
        skipFormat: true,
      });

      const packageJson = readJson(tree, 'test/package.json');
      expect(packageJson.name).toBe('@proj/myapp');
      expect(packageJson.nx.name).toBe('myapp');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
        ]
      `);
    });

    it('should generate project.json if useProjectJson is true', async () => {
      await applicationGenerator(tree, {
        ...options,
        directory: 'myapp',
        e2eTestRunner: 'cypress',
        style: 'none',
        linter: 'eslint',
        addPlugin: true,
        useProjectJson: true,
        skipFormat: true,
      });

      expect(tree.exists('myapp/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/myapp'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "@proj/myapp",
          "projectType": "application",
          "root": "myapp",
          "sourceRoot": "myapp/src",
          "targets": {},
        }
      `);
      expect(readJson(tree, 'myapp/package.json').nx).toBeUndefined();
      expect(tree.exists('myapp-e2e/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/myapp-e2e'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "implicitDependencies": [
            "@proj/myapp",
          ],
          "name": "@proj/myapp-e2e",
          "projectType": "application",
          "root": "myapp-e2e",
          "sourceRoot": "myapp-e2e/src",
          "tags": [],
          "targets": {},
        }
      `);
      expect(readJson(tree, 'myapp-e2e/package.json').nx).toBeUndefined();
    });
  });
});

function listFiles(tree: Tree): string[] {
  const files = new Set<string>();
  tree.listChanges().forEach((change) => {
    if (change.type !== 'DELETE') {
      files.add(change.path);
    }
  });

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}
