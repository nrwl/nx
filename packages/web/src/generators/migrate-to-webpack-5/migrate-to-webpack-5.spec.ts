import { readJson, Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { webMigrateToWebpack5Generator } from './migrate-to-webpack-5';

describe('webMigrateToWebpack5Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add packages needed by Web ', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        '@nrwl/cli': '100.0.0',
        '@nrwl/jest': '100.0.0',
        '@nrwl/node': '100.0.0',
        '@nrwl/react': '100.0.0',
        '@nrwl/web': '100.0.0',
        '@nrwl/workspace': '100.0.0',
      };
      return json;
    });

    await webMigrateToWebpack5Generator(tree, {});

    const json = readJson(tree, '/package.json');

    expect(json.devDependencies['webpack']).toMatch(/\^5/);
    expect(
      json.devDependencies['@pmmmwh/react-refresh-webpack-plugin']
    ).toMatch(/^0\.5/);
  });
});
