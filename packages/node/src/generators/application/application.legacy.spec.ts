import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

// nx-ignore-next-line
import { applicationGenerator } from './application';

describe('node app generator (legacy)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    updateNxJson(tree, nxJson);
  });

  it('should not skip the build target', async () => {
    await applicationGenerator(tree, {
      name: 'my-node-app',
      bundler: 'webpack',
      projectNameAndRootFormat: 'as-provided',
      addPlugin: false,
    });
    const project = readProjectConfiguration(tree, 'my-node-app');
    expect(project.root).toEqual('my-node-app');
    expect(project.targets.build).toMatchInlineSnapshot(`
      {
        "configurations": {
          "development": {},
          "production": {},
        },
        "defaultConfiguration": "production",
        "executor": "@nx/webpack:webpack",
        "options": {
          "assets": [
            "my-node-app/src/assets",
          ],
          "compiler": "tsc",
          "main": "my-node-app/src/main.ts",
          "outputPath": "dist/my-node-app",
          "target": "node",
          "tsConfig": "my-node-app/tsconfig.app.json",
          "webpackConfig": "my-node-app/webpack.config.js",
        },
        "outputs": [
          "{options.outputPath}",
        ],
      }
    `);

    const webpackConfig = tree.read('my-node-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toContain(`composePlugins`);
    expect(webpackConfig).toContain(`target: 'node'`);
  });
});
