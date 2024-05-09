import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  ProjectGraph,
  readJson,
  readNxJson,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

import { initGenerator } from './init';

describe('@nx/vite:init', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
  });

  describe('vite basic setup', () => {
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

    it('should add sharedGlobals for .env if sharedGlobals is defined', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.sharedGlobals = [];
        return json;
      });
      await initGenerator(tree, {});
      const sharedGlobalsNamedInputs = readJson(tree, 'nx.json').namedInputs
        .sharedGlobals;
      console.log(sharedGlobalsNamedInputs);
      expect(sharedGlobalsNamedInputs).toContain('{workspaceRoot}/.env?(.*)');
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
