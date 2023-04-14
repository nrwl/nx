import { readJson, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { generateTestRemoteApplication } from '../../generators/utils/testing';
import renameWebpackServer from './rename-webpack-server';

describe('renameWebpackServer', () => {
  it('should rename webpack-server to webpack-dev-server correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    await generateTestRemoteApplication(tree, { name: 'remote' });

    updateJson(tree, 'apps/remote/project.json', (json) => {
      json.targets.serve.executor = '@nrwl/angular:webpack-server';
      return json;
    });

    // ACT
    renameWebpackServer(tree);

    // ASSERT
    const serveTarget = readJson(tree, 'apps/remote/project.json').targets
      .serve;
    expect(serveTarget).toMatchInlineSnapshot(`
      {
        "configurations": {
          "development": {
            "browserTarget": "remote:build:development",
          },
          "production": {
            "browserTarget": "remote:build:production",
          },
        },
        "defaultConfiguration": "development",
        "executor": "@nrwl/angular:webpack-dev-server",
        "options": {
          "port": 4201,
          "publicHost": "http://localhost:4201",
        },
      }
    `);
  });
});
