import { Tree, readJson, NxJsonConfiguration } from '@nrwl/devkit';
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
  }, 10000);

  it(`should create files (preset = ${Preset.WebComponents})`, async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.WebComponents,
      cli: 'nx',
      standaloneConfig: false,
    });
    expect(tree.exists('/apps/proj/src/main.ts')).toBe(true);
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

  it('should create files (preset = react-native)', async () => {
    await presetGenerator(tree, {
      name: 'proj',
      preset: Preset.ReactNative,
      linter: 'eslint',
      cli: 'nx',
      standaloneConfig: false,
    });

    expect(tree.exists('/apps/proj/src/app/App.tsx')).toBe(true);
  });

  describe('core preset', () => {
    it('should not contain workspace.json or angular.json', async () => {
      await presetGenerator(tree, {
        name: 'proj',
        preset: Preset.Core,
        linter: 'eslint',
        cli: 'nx',
        standaloneConfig: false,
        packageManager: 'npm',
      });
      expect(tree.exists('workspace.json')).toBeFalsy();
      expect(tree.exists('angular.json')).toBeFalsy();
    });

    describe('package manager workspaces', () => {
      it('should be configured in package.json', async () => {
        await presetGenerator(tree, {
          name: 'proj',
          preset: Preset.Core,
          linter: 'eslint',
          cli: 'nx',
          standaloneConfig: false,
          packageManager: 'npm',
        });

        expect(readJson(tree, 'package.json').workspaces)
          .toMatchInlineSnapshot(`
          Array [
            "packages/**",
          ]
        `);
      });

      it('should be configured in pnpm-workspace.yaml', async () => {
        await presetGenerator(tree, {
          name: 'proj',
          preset: Preset.Core,
          linter: 'eslint',
          cli: 'nx',
          standaloneConfig: false,
          packageManager: 'pnpm',
        });

        expect(tree.read('pnpm-workspace.yaml', 'utf-8'))
          .toMatchInlineSnapshot(`
          "packages:
            - 'packages/**'
          "
        `);
      });
    });
  });
});
