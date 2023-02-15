import {
  formatFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { RspackExecutorSchema } from '../../executors/rspack/schema';
import rspackInitGenerator from '../init/init';
import { RspackProjectGeneratorSchema } from './schema';

export async function rspackProjectGenerator(
  tree: Tree,
  options: RspackProjectGeneratorSchema
) {
  const task = await rspackInitGenerator(tree, options);
  checkForTargetConflicts(tree, options);
  addBuildTarget(tree, options);
  if (options.uiFramework !== 'none' || options.devServer) {
    addServeTarget(tree, options);
  }
  writeRspackConfigFile(tree, options);
  await formatFiles(tree);
  return task;
}

function checkForTargetConflicts(
  tree: Tree,
  options: RspackProjectGeneratorSchema
) {
  if (options.skipValidation) return;

  const project = readProjectConfiguration(tree, options.project);

  if (project.targets?.build) {
    throw new Error(
      `Project "${project.name}" already has a build target. Pass --skipValidation to ignore this error.`
    );
  }

  if (options.devServer && project.targets?.serve) {
    throw new Error(
      `Project "${project.name}" already has a serve target. Pass --skipValidation to ignore this error.`
    );
  }
}

function determineMain(tree: Tree, options: RspackProjectGeneratorSchema) {
  if (options.main) return options.main;

  const project = readProjectConfiguration(tree, options.project);

  const mainTsx = joinPathFragments(project.root, 'src/main.tsx');
  if (tree.exists(mainTsx)) return mainTsx;

  return joinPathFragments(project.root, 'src/main.ts');
}

function determineTsConfig(tree: Tree, options: RspackProjectGeneratorSchema) {
  if (options.tsConfig) return options.tsConfig;

  const project = readProjectConfiguration(tree, options.project);

  const appJson = joinPathFragments(project.root, 'tsconfig.app.json');
  if (tree.exists(appJson)) return appJson;

  const libJson = joinPathFragments(project.root, 'tsconfig.lib.json');
  if (tree.exists(libJson)) return libJson;

  return joinPathFragments(project.root, 'tsconfig.json');
}

function addBuildTarget(tree: Tree, options: RspackProjectGeneratorSchema) {
  const project = readProjectConfiguration(tree, options.project);
  const buildOptions: RspackExecutorSchema = {
    target: options.target ?? 'web',
    outputPath: joinPathFragments('dist', project.root),
    main: determineMain(tree, options),
    tsConfig: determineTsConfig(tree, options),
    rspackConfig: joinPathFragments(project.root, 'rspack.config.js'),
    assets: [
      joinPathFragments(project.root, 'src/favicon.ico'),
      joinPathFragments(project.root, 'src/assets'),
    ],
  };

  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      build: {
        executor: '@nrwl/rspack:rspack',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: buildOptions,
        configurations: {
          production: {
            optimization: true,
            sourceMap: false,
          },
        },
      },
    },
  });
}

function addServeTarget(tree: Tree, options: RspackProjectGeneratorSchema) {
  const project = readProjectConfiguration(tree, options.project);
  updateProjectConfiguration(tree, options.project, {
    ...project,
    targets: {
      ...project.targets,
      serve: {
        executor: '@nrwl/rspack:dev-server',
        options: {
          buildTarget: `${options.project}:build`,
        },
        configurations: {
          production: {
            buildTarget: `${options.project}:build:production`,
          },
        },
      },
    },
  });
}

function writeRspackConfigFile(
  tree: Tree,
  options: RspackProjectGeneratorSchema
) {
  const project = readProjectConfiguration(tree, options.project);

  tree.write(
    joinPathFragments(project.root, 'rspack.config.js'),
    createConfig(options)
  );
}

function createConfig(options: RspackProjectGeneratorSchema) {
  if (options.uiFramework === 'react') {
    return `
      const { composePlugins, withNx, withReact } = require('@nrwl/rspack');

      module.exports = composePlugins(withNx(), withReact({ style: '${options.style}' }), (config) => {
        return config;
      });
    `;
  } else if (options.uiFramework === 'web') {
    return `
      const { composePlugins, withNx, withWeb } = require('@nrwl/rspack');

      module.exports = composePlugins(withNx(), withWeb({ style: '${options.style}' }), (config) => {
        return config;
      });
    `;
  } else {
    return `
      const { composePlugins, withNx } = require('@nrwl/rspack');

      module.exports = composePlugins(withNx(), (config) => {
        return config;
      });
    `;
  }
}

export default rspackProjectGenerator;
