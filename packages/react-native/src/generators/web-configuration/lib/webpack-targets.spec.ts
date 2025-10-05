import { Tree, joinPathFragments } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  createBuildTarget,
  createServeTarget,
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

  it('should create a correct build target', () => {
    const buildTarget = createBuildTarget(tree, options);
    expect(buildTarget.executor).toEqual('@nx/webpack:webpack');
    expect(buildTarget.outputs).toEqual(['{options.outputPath}']);
    expect(buildTarget.options.outputPath).toEqual(
      joinPathFragments('dist', projectRoot, 'web')
    );
    expect(buildTarget.options.index).toEqual(
      joinPathFragments(projectRoot, 'src/index.html')
    );
    expect(buildTarget.options.main).toEqual(
      joinPathFragments(projectRoot, 'src/main-web.tsx')
    );
    expect(buildTarget.options.tsConfig).toEqual(
      joinPathFragments(projectRoot, 'tsconfig.json')
    );
    expect(buildTarget.options.assets).toEqual([
      joinPathFragments(projectRoot, 'src/favicon.ico'),
      joinPathFragments(projectRoot, 'src/assets'),
    ]);
    expect(buildTarget.options.webpackConfig).toEqual(
      joinPathFragments(projectRoot, 'webpack.config.js')
    );
  });

  it('should create a correct serve target', () => {
    const serveTarget = createServeTarget(options);
    expect(serveTarget.executor).toEqual('@nx/webpack:dev-server');
    expect(serveTarget.options.buildTarget).toEqual('my-app:build');
    expect(serveTarget.options.hmr).toBe(true);
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
