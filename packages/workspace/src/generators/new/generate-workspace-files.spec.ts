import type { NxJsonConfiguration, Tree } from '@nx/devkit';
import { readJson } from '@nx/devkit';
import Ajv from 'ajv';
import { generateWorkspaceFiles } from './generate-workspace-files';
import { createTree } from '@nx/devkit/testing';
import { Preset } from '../utils/presets';
import * as nxSchema from 'nx/schemas/nx-schema.json';

describe('@nx/workspace:generateWorkspaceFiles', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
    // we need an actual path for the package manager version check
    tree.root = process.cwd();
  });

  it('should create files', async () => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.Apps,
      defaultBase: 'main',
      isCustomPreset: false,
    });
    expect(tree.exists('/proj/README.md')).toBe(true);
    expect(tree.exists('/proj/nx.json')).toBe(true);
  });

  describe('README.md', () => {
    it.each(Object.keys(Preset))(
      'should be created for %s preset',
      async (preset) => {
        let appName;
        if (
          [
            Preset.ReactMonorepo,
            Preset.ReactStandalone,
            Preset.VueMonorepo,
            Preset.VueStandalone,
            Preset.Nuxt,
            Preset.NuxtStandalone,
            Preset.AngularMonorepo,
            Preset.AngularStandalone,
            Preset.Nest,
            Preset.NextJs,
            Preset.WebComponents,
            Preset.Express,
            Preset.NodeStandalone,
            Preset.NextJsStandalone,
            Preset.TsStandalone,
          ].includes(Preset[preset])
        ) {
          appName = 'app1';
        }

        await generateWorkspaceFiles(tree, {
          name: 'proj',
          directory: 'proj',
          preset: Preset[preset],
          defaultBase: 'main',
          appName,
          isCustomPreset: false,
        });
        expect(tree.read('proj/README.md', 'utf-8')).toMatchSnapshot();
      }
    );
    it('should be created for custom plugins', async () => {
      await generateWorkspaceFiles(tree, {
        name: 'proj',
        directory: 'proj',
        preset: 'custom-nx-preset',
        defaultBase: 'main',
        isCustomPreset: true,
      });
      expect(tree.read('proj/README.md', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('proj/apps/.gitkeep')).toBeFalsy();
    });
  });

  it('should create nx.json', async () => {
    const ajv = new Ajv();

    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.Apps,
      defaultBase: 'main',
      isCustomPreset: false,
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, '/proj/nx.json');
    expect(nxJson).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/nx/schemas/nx-schema.json",
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
          ],
          "sharedGlobals": [],
        },
      }
    `);
    // VS Code uses a deprecationMessage keyword that is not supported by ajv.
    ajv.addKeyword('deprecationMessage');
    const validateNxJson = ajv.compile(nxSchema);
    expect(validateNxJson(nxJson)).toEqual(true);
  });

  it('should setup named inputs for non-empty presets', async () => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.ReactMonorepo,
      defaultBase: 'main',
      isCustomPreset: false,
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, '/proj/nx.json');
    expect(nxJson).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/nx/schemas/nx-schema.json",
        "namedInputs": {
          "default": [
            "{projectRoot}/**/*",
            "sharedGlobals",
          ],
          "production": [
            "default",
          ],
          "sharedGlobals": [],
        },
      }
    `);
  });

  it('should recommend vscode extensions', async () => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.Apps,
      defaultBase: 'main',
      isCustomPreset: false,
    });
    const recommendations = readJson<{ recommendations: string[] }>(
      tree,
      'proj/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toMatchSnapshot();
  });

  it('should recommend vscode extensions (angular)', async () => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.Apps,
      defaultBase: 'main',
      isCustomPreset: false,
    });
    const recommendations = readJson<{ recommendations: string[] }>(
      tree,
      'proj/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toMatchSnapshot();
  });

  it('should create a workspace using NPM preset (npm package manager)', async () => {
    tree.write('/proj/package.json', JSON.stringify({}));
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.NPM,
      defaultBase: 'main',
      packageManager: 'npm',
      isCustomPreset: false,
    });
    const nx = readJson(tree, '/proj/nx.json');
    expect(nx).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/nx/schemas/nx-schema.json",
        "extends": "nx/presets/npm.json",
      }
    `);

    const packageJson = readJson(tree, '/proj/package.json');
    expect(packageJson).toMatchInlineSnapshot(`
      {
        "dependencies": {},
        "devDependencies": {
          "nx": "0.0.1",
        },
        "license": "MIT",
        "name": "proj",
        "private": true,
        "scripts": {},
        "version": "0.0.0",
        "workspaces": [
          "packages/*",
        ],
      }
    `);
  });

  it('should create a workspace using NPM preset (pnpm package manager)', async () => {
    tree.write('/proj/package.json', JSON.stringify({}));
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.NPM,
      defaultBase: 'main',
      packageManager: 'pnpm',
      isCustomPreset: false,
    });
    const packageJson = readJson(tree, '/proj/package.json');
    expect(packageJson).toMatchInlineSnapshot(`
      {
        "dependencies": {},
        "devDependencies": {
          "nx": "0.0.1",
        },
        "license": "MIT",
        "name": "proj",
        "private": true,
        "scripts": {},
        "version": "0.0.0",
      }
    `);
    const pnpm = tree.read('/proj/pnpm-workspace.yaml').toString();
    expect(pnpm).toContain('packages/*');
  });

  it.each([
    Preset.ReactStandalone,
    Preset.VueStandalone,
    Preset.NuxtStandalone,
    Preset.AngularStandalone,
    Preset.NodeStandalone,
    Preset.NextJsStandalone,
    Preset.TsStandalone,
  ])('should create package scripts for %s preset', async (preset) => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset,
      defaultBase: 'main',
      appName: 'demo',
      isCustomPreset: false,
    });

    expect(readJson(tree, 'proj/package.json').scripts).toMatchSnapshot();
  });
});
