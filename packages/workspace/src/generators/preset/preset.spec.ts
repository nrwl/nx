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

  it(`should create files (preset = ${Preset.AngularMonorepo})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.AngularMonorepo,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.children('apps/proj')).toMatchSnapshot();
    expect(tree.children('apps/proj/src/')).toMatchSnapshot();
    expect(tree.children('apps/proj/src/app')).toMatchSnapshot();
  }, 20000);

  it(`should create files (preset = ${Preset.WebComponents})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.WebComponents,
    });
    expect(tree.exists('/apps/proj/src/main.ts')).toBe(true);
  });

  it(`should create files (preset = ${Preset.ReactMonorepo})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactMonorepo,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists('/apps/proj/src/main.tsx')).toBe(true);
    expect(tree.read('apps/proj/webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it(`should create files (preset = ${Preset.VueMonorepo})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.VueMonorepo,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists('apps/proj/src/main.ts')).toBe(true);
    expect(tree.read('apps/proj/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it(`should create files (preset = ${Preset.Nuxt})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.Nuxt,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists('apps/proj/src/app.vue')).toBe(true);
    expect(readProjectConfiguration(tree, 'proj')).toBeDefined();
  });

  it(`should create files (preset = ${Preset.NextJs})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.NextJs,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists('/apps/proj/src/app/page.tsx')).toBe(true);
  });

  it(`should create files (preset = ${Preset.Express})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.Express,
      linter: 'eslint',
    });

    expect(tree.exists('apps/proj/src/main.ts')).toBe(true);
    expect(tree.exists('apps/proj/.eslintrc.json')).toBe(true);
  });

  it('should create files (preset = react-native)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactNative,
      linter: 'eslint',
    });

    expect(tree.exists('/apps/proj/src/app/App.tsx')).toBe(true);
  });

  it(`should create files (preset = ${Preset.ReactStandalone} bundler = webpack)`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactStandalone,
      style: 'css',
      linter: 'eslint',
      bundler: 'webpack',
    });
    expect(tree.exists('webpack.config.js')).toBe(true);
    expect(tree.read('webpack.config.js', 'utf-8')).toMatchSnapshot();
  });

  it(`should create files (preset = ${Preset.ReactStandalone} bundler = vite)`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactStandalone,
      style: 'css',
      linter: 'eslint',
      bundler: 'vite',
    });
    expect(tree.exists('vite.config.ts')).toBe(true);
    expect(tree.read('vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it(`should create files (preset = ${Preset.VueStandalone})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.VueStandalone,
      style: 'css',
      e2eTestRunner: 'cypress',
    });
    expect(tree.exists('vite.config.ts')).toBe(true);
    expect(tree.read('vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it(`should create files (preset = ${Preset.NuxtStandalone})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.NuxtStandalone,
      style: 'css',
      e2eTestRunner: 'cypress',
    });
    expect(tree.exists('nuxt.config.ts')).toBe(true);
    expect(readProjectConfiguration(tree, 'proj')).toBeDefined();
  });
});
