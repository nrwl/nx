import {
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

// nx-ignore-next-line
import { applicationGenerator } from './application';

describe('node app generator (PCv3)', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    const nxJson = readNxJson(tree);
    nxJson.plugins ??= [];
    nxJson.plugins.push('@nx/webpack/plugin');
    updateNxJson(tree, nxJson);
  });

  it('should skip the build target and setup webpack config', async () => {
    await applicationGenerator(tree, {
      name: 'my-node-app',
      bundler: 'webpack',
      projectNameAndRootFormat: 'as-provided',
    });
    const project = readProjectConfiguration(tree, 'my-node-app');
    expect(project.root).toEqual('my-node-app');
    expect(project.targets.build).toBeUndefined();

    const webpackConfig = tree.read('my-node-app/webpack.config.js', 'utf-8');
    expect(webpackConfig).toContain(`new NxWebpackPlugin`);
    expect(webpackConfig).toContain(`target: 'node'`);
    expect(webpackConfig).toContain(`'../dist/my-node-app'`);
    expect(webpackConfig).toContain(`main: './src/main.ts'`);
    expect(webpackConfig).toContain(`tsConfig: './tsconfig.app.json'`);
  });
});
