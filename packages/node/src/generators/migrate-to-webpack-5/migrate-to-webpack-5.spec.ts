import { readJson, Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { nodeMigrateToWebpack5Generator } from './migrate-to-webpack-5';

describe('nodeMigrateToWebpack5Generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        '@nrwl/cli': '100.0.0',
        '@nrwl/jest': '100.0.0',
        '@nrwl/node': '100.0.0',
        '@nrwl/workspace': '100.0.0',
      };
      return json;
    });
  });

  it('should add packages needed by Node', async () => {
    await nodeMigrateToWebpack5Generator(tree, {});

    const json = readJson(tree, '/package.json');

    expect(json.devDependencies['webpack']).toMatch(/\^5/);
  });

  it('should add packages needed by Web if used', async () => {
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

    await nodeMigrateToWebpack5Generator(tree, {});

    const json = readJson(tree, '/package.json');

    expect(
      json.devDependencies['@pmmmwh/react-refresh-webpack-plugin']
    ).toMatch(/^0\.5/);
  });
});
