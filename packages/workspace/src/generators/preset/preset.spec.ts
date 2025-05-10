import 'nx/src/internal-testing-utils/mock-project-graph';

import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { presetGenerator } from './preset';
import { Preset } from '../utils/presets';

describe('preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it(`should create files (preset = angular-monorepo)`, async () => {
    const name = `angular-preset-monorepo`;
    await presetGenerator(tree, {
      name,
      preset: Preset.AngularMonorepo,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.children(`apps/${name}`).sort()).toMatchInlineSnapshot(`
      [
        ".eslintrc.json",
        "jest.config.ts",
        "project.json",
        "public",
        "src",
        "tsconfig.app.json",
        "tsconfig.editor.json",
        "tsconfig.json",
        "tsconfig.spec.json",
      ]
    `);
    expect(tree.children(`apps/${name}/src/`).sort()).toMatchInlineSnapshot(`
      [
        "app",
        "index.html",
        "main.ts",
        "styles.css",
        "test-setup.ts",
      ]
    `);
    expect(tree.children(`apps/${name}/src/app`).sort()).toMatchInlineSnapshot(`
      [
        "app.component.css",
        "app.component.html",
        "app.component.spec.ts",
        "app.component.ts",
        "app.module.ts",
        "nx-welcome.component.ts",
      ]
    `);
  }, 60_000);

  it(`should create files (preset = web-components)`, async () => {
    const name = `webcomponents-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.WebComponents,
    });
    expect(tree.exists(`/apps/${name}/src/main.ts`)).toBe(true);
  });

  it(`should create files (preset = react-monorepo)`, async () => {
    const name = `react-preset-monorepo`;
    await presetGenerator(tree, {
      name,
      preset: Preset.ReactMonorepo,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists(`/apps/${name}/src/main.tsx`)).toBe(true);
    expect(tree.read(`apps/${name}/webpack.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
      const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
      const { join } = require('path');

      module.exports = {
        output: {
          path: join(__dirname, '../../dist/apps/react-preset-monorepo'),
        },
        devServer: {
          port: 4200,
          historyApiFallback: {
            index: '/index.html',
            disableDotRule: true,
            htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
          },
        },
        plugins: [
          new NxAppWebpackPlugin({
            tsConfig: './tsconfig.app.json',
            compiler: 'babel',
            main: './src/main.tsx',
            index: './src/index.html',
            baseHref: '/',
            assets: ['./src/favicon.ico', './src/assets'],
            styles: ['./src/styles.css'],
            outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
            optimization: process.env['NODE_ENV'] === 'production',
          }),
          new NxReactWebpackPlugin({
            // Uncomment this line if you don't want to use SVGR
            // See: https://react-svgr.com/
            // svgr: false
          }),
        ],
      };
      "
    `);
  });

  it(`should create files (preset = vue-monorepo)`, async () => {
    const name = `vue-preset-monorepo`;
    await presetGenerator(tree, {
      name,
      preset: Preset.VueMonorepo,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists(`apps/${name}/src/main.ts`)).toBe(true);
    expect(tree.read(`apps/${name}/vite.config.ts`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "/// <reference types='vitest' />
      import { defineConfig } from 'vite';
      import vue from '@vitejs/plugin-vue';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

      export default defineConfig(() => ({
        root: __dirname,
        cacheDir: '../../node_modules/.vite/apps/vue-preset-monorepo',
        server: {
          port: 4200,
          host: 'localhost',
        },
        preview: {
          port: 4300,
          host: 'localhost',
        },
        plugins: [vue(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [ nxViteTsPaths() ],
        // },
        build: {
          outDir: '../../dist/apps/vue-preset-monorepo',
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
            reportsDirectory: '../../coverage/apps/vue-preset-monorepo',
            provider: 'v8' as const,
          },
        },
      }));
      "
    `);
  });

  it(`should create files (preset = nuxt)`, async () => {
    const name = `nuxt-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.Nuxt,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists(`apps/${name}/src/app.vue`)).toBe(true);
    expect(readProjectConfiguration(tree, name)).toBeDefined();
  });

  it(`should create files (preset = next)`, async () => {
    const name = `next-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.NextJs,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists(`/apps/${name}/src/app/page.tsx`)).toBe(true);
  });

  it(`should create files (preset = express)`, async () => {
    const name = `express-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.Express,
      linter: 'eslint',
    });

    expect(tree.exists(`apps/${name}/src/main.ts`)).toBe(true);
    expect(tree.exists(`apps/${name}/.eslintrc.json`)).toBe(true);
  });

  it('should create files (preset = react-native)', async () => {
    const name = `react-native-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.ReactNative,
      linter: 'eslint',
    });

    expect(tree.exists(`/apps/${name}/src/app/App.tsx`)).toBe(true);
  });

  it(`should create files (preset = react-standalone & bundler = webpack)`, async () => {
    const name = `react-standalone-preset-webpack`;
    await presetGenerator(tree, {
      name,
      preset: Preset.ReactStandalone,
      style: 'css',
      linter: 'eslint',
      bundler: 'webpack',
    });
    expect(tree.exists('webpack.config.js')).toBe(true);
    expect(tree.read('webpack.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
      const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
      const { join } = require('path');

      module.exports = {
        output: {
          path: join(__dirname, 'dist/react-standalone-preset-webpack'),
        },
        devServer: {
          port: 4200,
          historyApiFallback: {
            index: '/index.html',
            disableDotRule: true,
            htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
          },
        },
        plugins: [
          new NxAppWebpackPlugin({
            tsConfig: './tsconfig.app.json',
            compiler: 'babel',
            main: './src/main.tsx',
            index: './src/index.html',
            baseHref: '/',
            assets: ['./src/favicon.ico', './src/assets'],
            styles: ['./src/styles.css'],
            outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
            optimization: process.env['NODE_ENV'] === 'production',
          }),
          new NxReactWebpackPlugin({
            // Uncomment this line if you don't want to use SVGR
            // See: https://react-svgr.com/
            // svgr: false
          }),
        ],
      };
      "
    `);
  });

  it(`should create files (preset = react-standalone & bundler = vite)`, async () => {
    const name = `react-standalone-preset-vite`;
    await presetGenerator(tree, {
      name,
      preset: Preset.ReactStandalone,
      style: 'css',
      linter: 'eslint',
      bundler: 'vite',
    });
    expect(tree.exists('vite.config.ts')).toBe(true);
    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "/// <reference types='vitest' />
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

      export default defineConfig(() => ({
        root: __dirname,
        cacheDir: './node_modules/.vite/react-standalone-preset-vite',
        server: {
          port: 4200,
          host: 'localhost',
        },
        preview: {
          port: 4300,
          host: 'localhost',
        },
        plugins: [react(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [ nxViteTsPaths() ],
        // },
        build: {
          outDir: './dist/react-standalone-preset-vite',
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
            reportsDirectory: './coverage/react-standalone-preset-vite',
            provider: 'v8' as const,
          },
        },
      }));
      "
    `);
  });

  it(`should create files (preset = vue-standalone)`, async () => {
    const name = `vue-standalone-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.VueStandalone,
      style: 'css',
      e2eTestRunner: 'cypress',
    });
    expect(tree.exists('vite.config.ts')).toBe(true);
    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "/// <reference types='vitest' />
      import { defineConfig } from 'vite';
      import vue from '@vitejs/plugin-vue';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

      export default defineConfig(() => ({
        root: __dirname,
        cacheDir: './node_modules/.vite/vue-standalone-preset',
        server: {
          port: 4200,
          host: 'localhost',
        },
        preview: {
          port: 4300,
          host: 'localhost',
        },
        plugins: [vue(), nxViteTsPaths(), nxCopyAssetsPlugin(['*.md'])],
        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [ nxViteTsPaths() ],
        // },
        build: {
          outDir: './dist/vue-standalone-preset',
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
            reportsDirectory: './coverage/vue-standalone-preset',
            provider: 'v8' as const,
          },
        },
      }));
      "
    `);
  });

  it(`should create files (preset = nuxt-standalone)`, async () => {
    const name = `nuxt-standalone-preset`;
    await presetGenerator(tree, {
      name,
      preset: Preset.NuxtStandalone,
      style: 'css',
      e2eTestRunner: 'cypress',
    });
    expect(tree.exists('nuxt.config.ts')).toBe(true);
    expect(readProjectConfiguration(tree, name)).toBeDefined();
  });
});
