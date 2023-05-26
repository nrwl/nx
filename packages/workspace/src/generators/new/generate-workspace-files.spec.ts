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
  });

  it('should create files', async () => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.Empty,
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
      preset: Preset.Empty,
      defaultBase: 'main',
      isCustomPreset: false,
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, '/proj/nx.json');
    expect(nxJson).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/nx/schemas/nx-schema.json",
        "targetDefaults": {
          "build": {
            "dependsOn": [
              "^build",
            ],
          },
        },
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "cacheableOperations": [
                "build",
                "lint",
                "test",
                "e2e",
              ],
            },
            "runner": "nx/tasks-runners/default",
          },
        },
      }
    `);
    const validateNxJson = ajv.compile(nxSchema);
    expect(validateNxJson(nxJson)).toEqual(true);
  });

  it('should setup named inputs and target defaults for non-empty presets', async () => {
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
        "targetDefaults": {
          "build": {
            "dependsOn": [
              "^build",
            ],
            "inputs": [
              "production",
              "^production",
            ],
          },
        },
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "cacheableOperations": [
                "build",
                "lint",
                "test",
                "e2e",
              ],
            },
            "runner": "nx/tasks-runners/default",
          },
        },
      }
    `);
  });

  it('should recommend vscode extensions', async () => {
    await generateWorkspaceFiles(tree, {
      name: 'proj',
      directory: 'proj',
      preset: Preset.Empty,
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
      preset: Preset.Empty,
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
    expect(tree.exists('/proj/packages/.gitkeep')).toBe(true);
    expect(tree.exists('/proj/apps/.gitkeep')).toBe(false);
    expect(tree.exists('/proj/libs/.gitkeep')).toBe(false);
    const nx = readJson(tree, '/proj/nx.json');
    expect(nx).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/nx/schemas/nx-schema.json",
        "extends": "nx/presets/npm.json",
        "tasksRunnerOptions": {
          "default": {
            "options": {
              "cacheableOperations": [
                "build",
                "lint",
                "test",
                "e2e",
              ],
            },
            "runner": "nx/tasks-runners/default",
          },
        },
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
});
