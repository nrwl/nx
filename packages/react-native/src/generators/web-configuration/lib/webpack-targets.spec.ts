import { Tree, joinPathFragments } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  createNxWebpackPluginOptions,
  determineTsConfig,
} from './webpack-targets';
import { NormalizedSchema } from './normalize-schema';

describe('webpack-targets', () => {
  let tree: Tree;
  const projectRoot = 'apps/my-app';
  const options: NormalizedSchema = {
    project: 'my-app',
    bundler: 'webpack',
    skipFormat: false,
    skipPackageJson: false,
    projectRoot,
    fileName: 'my-app',
    className: 'MyApp',
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write(
      `${projectRoot}/project.json`,
      JSON.stringify({
        name: 'my-app',
        root: projectRoot,
        sourceRoot: `${projectRoot}/src`,
        projectType: 'application',
        targets: {},
      })
    );
  });

  it('should create correct NxWebpackPluginOptions', () => {
    const nxWebpackPluginOptions = createNxWebpackPluginOptions(tree, options);
    expect(nxWebpackPluginOptions.target).toEqual('web');
    expect(nxWebpackPluginOptions.compiler).toEqual('babel');
    expect(nxWebpackPluginOptions.outputPath).toEqual(
      joinPathFragments('dist', projectRoot)
    );
    expect(nxWebpackPluginOptions.index).toEqual('./src/index.html');
    expect(nxWebpackPluginOptions.main).toEqual('./src/main-web.tsx');
    expect(nxWebpackPluginOptions.tsConfig).toEqual('tsconfig.json');
    expect(nxWebpackPluginOptions.assets).toEqual([
      './src/favicon.ico',
      './src/assets',
    ]);
  });

  describe('determineTsConfig', () => {
    it('should return tsconfig.app.json if it exists', () => {
      tree.write(`${projectRoot}/tsconfig.app.json`, '{}');
      expect(determineTsConfig(tree, options)).toEqual('tsconfig.app.json');
    });

    it('should return tsconfig.lib.json if tsconfig.app.json does not exist but tsconfig.lib.json does', () => {
      tree.write(`${projectRoot}/tsconfig.lib.json`, '{}');
      expect(determineTsConfig(tree, options)).toEqual('tsconfig.lib.json');
    });

    it('should return tsconfig.json if neither tsconfig.app.json nor tsconfig.lib.json exist', () => {
      expect(determineTsConfig(tree, options)).toEqual('tsconfig.json');
    });
  });
});
