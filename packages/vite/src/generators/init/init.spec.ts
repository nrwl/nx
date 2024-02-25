import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  readNxJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

import { initGenerator } from './init';

describe('@nx/vite:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('dependencies for package.json', () => {
    it('should add required packages', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/vite': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        addPlugin: true,
      });
      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();
    });
  });

  describe('vitest targets', () => {
    it('should add target defaults for test', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.production = ['default'];
        return json;
      });

      await initGenerator(tree, {
        addPlugin: true,
      });

      const nxJson = readNxJson(tree);

      expect(nxJson).toMatchInlineSnapshot(`
        {
          "affected": {
            "defaultBase": "main",
          },
          "namedInputs": {
            "production": [
              "default",
              "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
              "!{projectRoot}/tsconfig.spec.json",
            ],
          },
          "plugins": [
            {
              "options": {
                "buildTargetName": "build",
                "previewTargetName": "preview",
                "serveStaticTargetName": "serve-static",
                "serveTargetName": "serve",
                "testTargetName": "test",
              },
              "plugin": "@nx/vite/plugin",
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
  });
});
