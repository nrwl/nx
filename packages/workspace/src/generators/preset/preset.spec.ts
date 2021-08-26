import { Tree, readNxJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { overrideCollectionResolutionForTesting } from '@nrwl/devkit/ngcli-adapter';
import { presetGenerator } from './preset';
import * as path from 'path';
import { Preset } from '../utils/presets';

describe('preset', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    overrideCollectionResolutionForTesting({
      '@nrwl/workspace': path.join(
        __dirname,
        '../../../../workspace/generators.json'
      ),
      '@nrwl/angular': path.join(
        __dirname,
        '../../../../angular/generators.json'
      ),
      '@nrwl/linter': path.join(
        __dirname,
        '../../../../linter/generators.json'
      ),
      '@nrwl/nest': path.join(__dirname, '../../../../nest/generators.json'),
      '@nrwl/node': path.join(__dirname, '../../../../node/generators.json'),
      '@nrwl/jest': path.join(__dirname, '../../../../jest/generators.json'),
      '@nrwl/cypress': path.join(
        __dirname,
        '../../../../cypress/generators.json'
      ),
      '@nrwl/express': path.join(
        __dirname,
        '../../../../express/generators.json'
      ),
    });
  });

  afterEach(() => {
    overrideCollectionResolutionForTesting(null);
  });

  it(`should create files (preset = ${Preset.Angular})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.Angular,
      cli: 'nx',
      style: 'css',
      linter: 'eslint',
      standaloneConfig: false,
    });
    expect(tree.children('apps/proj')).toMatchSnapshot();
    expect(tree.children('apps/proj/src/')).toMatchSnapshot();
    expect(tree.children('apps/proj/src/app')).toMatchSnapshot();

    expect(readNxJson(tree).cli.defaultCollection).toBe('@nrwl/angular');
  });

  it(`should create files (preset = ${Preset.WebComponents})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.WebComponents,
      cli: 'nx',
      standaloneConfig: false,
    });
    expect(tree.exists('/apps/proj/src/main.ts')).toBe(true);
    expect(readNxJson(tree).cli.defaultCollection).toBe('@nrwl/web');
  });

  it(`should create files (preset = ${Preset.React})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.React,
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });
    expect(tree.exists('/apps/proj/src/main.tsx')).toBe(true);
    expect(readNxJson(tree).cli.defaultCollection).toBe('@nrwl/react');
  });

  it(`should create files (preset = ${Preset.NextJs})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.NextJs,
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });
    expect(tree.exists('/apps/proj/pages/index.tsx')).toBe(true);
    expect(readNxJson(tree).cli.defaultCollection).toBe('@nrwl/next');
  });

  it(`should create files (preset = ${Preset.AngularWithNest})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.AngularWithNest,
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });

    expect(tree.exists('/apps/proj/src/app/app.component.ts')).toBe(true);
    expect(tree.exists('/apps/api/src/app/app.controller.ts')).toBe(true);
    expect(tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')).toBe(
      true
    );
  });

  it(`should create files (preset = ${Preset.ReactWithExpress})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactWithExpress,
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });

    expect(tree.exists('/apps/proj/src/app/app.tsx')).toBe(true);
    expect(tree.exists('/libs/api-interfaces/src/lib/api-interfaces.ts')).toBe(
      true
    );
    expect(tree.exists('/apps/proj/.eslintrc.json')).toBe(true);
    expect(tree.exists('/apps/api/.eslintrc.json')).toBe(true);
    expect(tree.exists('/libs/api-interfaces/.eslintrc.json')).toBe(true);
  });

  it(`should create files (preset = ${Preset.Express})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.Express,
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });

    expect(tree.exists('apps/proj/src/main.ts')).toBe(true);
    expect(tree.exists('apps/proj/.eslintrc.json')).toBe(true);
  });

  it(`should create files (preset = ${Preset.Gatsby})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.Gatsby,
      style: 'css',
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });

    expect(tree.exists('/apps/proj/src/pages/index.tsx')).toBe(true);
    expect(readNxJson(tree).cli.defaultCollection).toBe('@nrwl/gatsby');
  });

  it('should create files (preset = react-native)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactNative,
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });

    expect(tree.exists('/apps/proj/src/app/App.tsx')).toBe(true);
    expect(readNxJson(tree).cli.defaultCollection).toBe(
      '@nrwl/react-native'
    );
  });
});
