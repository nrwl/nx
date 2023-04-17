import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { overrideCollectionResolutionForTesting } from '@nx/devkit/ngcli-adapter';
import { presetGenerator } from './preset';
import * as path from 'path';
import { Preset } from '../utils/presets';

describe('preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    overrideCollectionResolutionForTesting({
      '@nx/workspace': path.join(
        __dirname,
        '../../../../workspace/generators.json'
      ),
      '@nx/angular': path.join(
        __dirname,
        '../../../../angular/generators.json'
      ),
      '@nx/linter': path.join(__dirname, '../../../../linter/generators.json'),
      '@nx/nest': path.join(__dirname, '../../../../nest/generators.json'),
      '@nx/node': path.join(__dirname, '../../../../node/generators.json'),
      '@nx/jest': path.join(__dirname, '../../../../jest/generators.json'),
      '@nx/cypress': path.join(
        __dirname,
        '../../../../cypress/generators.json'
      ),
      '@nx/express': path.join(
        __dirname,
        '../../../../express/generators.json'
      ),
    });
  });

  afterEach(() => {
    overrideCollectionResolutionForTesting(null);
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
    expect(readProjectConfiguration(tree, 'proj').targets.serve).toBeDefined();
  });

  it(`should create files (preset = ${Preset.NextJs})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.NextJs,
      style: 'css',
      linter: 'eslint',
    });
    expect(tree.exists('/apps/proj/pages/index.tsx')).toBe(true);
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
    expect(
      readProjectConfiguration(tree, 'proj').targets.serve
    ).toMatchSnapshot();
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
    expect(
      readProjectConfiguration(tree, 'proj').targets.serve
    ).toMatchSnapshot();
  });
});
