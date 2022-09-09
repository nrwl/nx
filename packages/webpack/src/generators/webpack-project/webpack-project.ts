import type { ProjectConfiguration, Tree } from '@nrwl/devkit';
import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

import { webpackInitGenerator } from '../init/init';
import { WebpackProjectGeneratorSchema } from './schema';
import { WebpackExecutorOptions } from '../../executors/webpack/schema';

export async function webpackProjectGenerator(
  tree: Tree,
  options: WebpackProjectGeneratorSchema
) {
  await webpackInitGenerator(tree, options);
  const project = readProjectConfiguration(tree, options.project);
  addBuildTarget(tree, project, options);
  await formatFiles(tree);
}

function addBuildTarget(
  tree: Tree,
  project: ProjectConfiguration,
  options: WebpackProjectGeneratorSchema
) {
  const buildOptions: WebpackExecutorOptions = {
    target: options.target,
    outputPath: joinPathFragments('dist', project.root),
    compiler: options.compiler ?? 'babel',
    main: options.main ?? joinPathFragments(project.root, 'src/main.ts'),
    tsConfig:
      options.tsConfig ?? joinPathFragments(project.root, 'tsconfig.app.json'),
    // TODO(jack): This should go into the web plugin when generating apps.
    // baseHref: '/',
    // index: joinPathFragments(project.root, 'src/index.html'),
    // polyfills: joinPathFragments(project.root, 'src/polyfills.ts'),
    // assets: [
    //   joinPathFragments(project.root, 'src/favicon.ico'),
    //   joinPathFragments(project.root, 'src/assets'),
    // ],
    // styles: [joinPathFragments(project.root, `src/styles.${options.style}`)],
    // scripts: [],
  };

  if (options.webpackConfig) {
    buildOptions.webpackConfig = options.webpackConfig;
  }

  const productionBuildOptions: Partial<WebpackExecutorOptions> = {
    // TODO(jack): This should go into the web plugin when generating apps.
    // fileReplacements: [
    //   {
    //     replace: joinPathFragments(
    //       project.root,
    //       `src/environments/environment.ts`
    //     ),
    //     with: joinPathFragments(
    //       project.root,
    //       `src/environments/environment.prod.ts`
    //     ),
    //   },
    // ],
    optimization: true,
    outputHashing: options.target === 'web' ? 'all' : 'none',
    sourceMap: false,
    namedChunks: false,
    extractLicenses: true,
    vendorChunk: false,
  };

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      build: {
        executor: '@nrwl/webpack:webpack',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          production: productionBuildOptions,
        },
      },
    },
  });
}

export default webpackProjectGenerator;
