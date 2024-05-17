import {
  Tree,
  ensurePackage,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/add-build-target-defaults';

export async function setupBundler(tree: Tree, options: NormalizedSchema) {
  const main = joinPathFragments(options.appProjectRoot, 'src/main.ts');
  const tsConfig = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.app.json'
  );
  const assets = [
    joinPathFragments(options.appProjectRoot, 'src/favicon.ico'),
    joinPathFragments(options.appProjectRoot, 'src/assets'),
  ];

  if (options.bundler === 'webpack') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/webpack')
    >('@nx/webpack', nxVersion);
    await configurationGenerator(tree, {
      target: 'web',
      project: options.projectName,
      main,
      tsConfig,
      compiler: options.compiler ?? 'babel',
      devServer: true,
      webpackConfig: joinPathFragments(
        options.appProjectRoot,
        'webpack.config.js'
      ),
      skipFormat: true,
      addPlugin: options.addPlugin,
    });
    const project = readProjectConfiguration(tree, options.projectName);
    if (project.targets.build) {
      const prodConfig = project.targets.build.configurations.production;
      const buildOptions = project.targets.build.options;
      buildOptions.assets = assets;
      buildOptions.index = joinPathFragments(
        options.appProjectRoot,
        'src/index.html'
      );
      buildOptions.baseHref = '/';
      buildOptions.styles = [
        joinPathFragments(
          options.appProjectRoot,
          `src/styles.${options.style}`
        ),
      ];
      // We can delete that, because this projest is an application
      // and applications have a .babelrc file in their root dir.
      // So Nx will find it and use it
      delete buildOptions.babelUpwardRootMode;
      buildOptions.scripts = [];
      prodConfig.fileReplacements = [
        {
          replace: joinPathFragments(
            options.appProjectRoot,
            `src/environments/environment.ts`
          ),
          with: joinPathFragments(
            options.appProjectRoot,
            `src/environments/environment.prod.ts`
          ),
        },
      ];
      prodConfig.optimization = true;
      prodConfig.outputHashing = 'all';
      prodConfig.sourceMap = false;
      prodConfig.namedChunks = false;
      prodConfig.extractLicenses = true;
      prodConfig.vendorChunk = false;
      updateProjectConfiguration(tree, options.projectName, project);
    }
    // TODO(jack): Flush this out... no bundler should be possible for web but the experience isn't holistic due to missing features (e.g. writing index.html).
  } else if (options.bundler === 'none') {
    const project = readProjectConfiguration(tree, options.projectName);
    addBuildTargetDefaults(tree, `@nx/js:${options.compiler}`);
    project.targets.build = {
      executor: `@nx/js:${options.compiler}`,
      outputs: ['{options.outputPath}'],
      options: {
        main,
        outputPath: joinPathFragments('dist', options.appProjectRoot),
        tsConfig,
      },
    };
    updateProjectConfiguration(tree, options.projectName, project);
  } else {
    throw new Error('Unsupported bundler type');
  }
}
