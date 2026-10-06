import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addDependenciesToPackageJson, readJson } from '@nx/devkit';
import initGenerator, { remixInitGeneratorInternal } from './init';

describe('Remix Init Generator', () => {
  it('should deny the esbuild build script pulled in by @remix-run/dev', async () => {
    const tree = createTreeWithEmptyWorkspace();

    await withPnpm(tree, '11.2.2', () => remixInitGeneratorInternal(tree, {}));

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
      /['"]?esbuild['"]?: false/
    );
  });

  it('should setup the workspace and add dependencies', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    // ACT
    // Should default to adding the plugin
    await remixInitGeneratorInternal(tree, {});

    // ASSERT
    const pkgJson = readJson(tree, 'package.json');
    expect(pkgJson.dependencies).toMatchInlineSnapshot(`
      {
        "@remix-run/serve": "^2.17.3",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@nx/web": "0.0.1",
        "@remix-run/dev": "^2.17.3",
        "typescript": "~5.9.2",
      }
    `);

    const nxJson = readJson(tree, 'nx.json');
    expect(nxJson).toMatchInlineSnapshot(`
      {
        "affected": {
          "defaultBase": "main",
        },
        "plugins": [
          {
            "options": {
              "buildDepsTargetName": "build-deps",
              "buildTargetName": "build",
              "devTargetName": "dev",
              "serveStaticTargetName": "serve-static",
              "startTargetName": "start",
              "typecheckTargetName": "typecheck",
              "watchDepsTargetName": "watch-deps",
            },
            "plugin": "@nx/remix/plugin",
          },
        ],
        "targetDefaults": {
          "build": {
            "cache": true,
          },
          "lint": {
            "cache": true,
          },
        },
      }
    `);
  });

  describe('NX_ADD_PLUGINS=false', () => {
    it('should setup the workspace and add dependencies', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace();
      process.env.NX_ADD_PLUGINS = 'false';
      // ACT
      await initGenerator(tree, {});

      // ASSERT
      const pkgJson = readJson(tree, 'package.json');
      expect(pkgJson.dependencies).toMatchInlineSnapshot(`
        {
          "@remix-run/serve": "^2.17.3",
        }
      `);
      expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
        {
          "@nx/web": "0.0.1",
          "@remix-run/dev": "^2.17.3",
          "typescript": "~5.9.2",
        }
      `);
    });
  });

  it('should throw when the workspace declares TypeScript 6', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addDependenciesToPackageJson(tree, {}, { typescript: '~6.0.3' });

    await expect(remixInitGeneratorInternal(tree, {})).rejects.toThrow(
      /Remix does not support TypeScript 6/
    );
  });
});
