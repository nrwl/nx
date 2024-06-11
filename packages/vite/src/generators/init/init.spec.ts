import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  ProjectGraph,
  readJson,
  readNxJson,
  stripIndents,
  Tree,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nxVersion } from '../../utils/versions';
import { initGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/vite:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
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

  it('should add nxViteTsPaths plugin to vite config files when setupPathsPlugin is set to true', async () => {
    tree.write(
      'proj/vite.config.ts',
      stripIndents`
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    export default defineConfig({
      plugins: [react()],
    })`
    );

    await initGenerator(tree, {
      addPlugin: true,
      setupPathsPlugin: true,
    });

    expect(tree.read('proj/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      export default defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });
      "
    `);
  });
});
