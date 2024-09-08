import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readJson } from '@nx/devkit';
import initGenerator from './init';
import { remixInitGeneratorInternal } from './init';

describe('Remix Init Generator', () => {
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
        "@remix-run/serve": "^2.8.1",
      }
    `);
    expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
      {
        "@nx/web": "0.0.1",
        "@remix-run/dev": "^2.8.1",
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
              "buildTargetName": "build",
              "devTargetName": "dev",
              "serveStaticTargetName": "serve-static",
              "startTargetName": "start",
              "typecheckTargetName": "typecheck",
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
          "@remix-run/serve": "^2.8.1",
        }
      `);
      expect(pkgJson.devDependencies).toMatchInlineSnapshot(`
        {
          "@nx/web": "0.0.1",
          "@remix-run/dev": "^2.8.1",
        }
      `);
    });
  });
});
