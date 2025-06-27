import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import type { PackageJson } from 'nx/src/utils/package-json';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { NormalizedSchema } from './normalized-schema';
import {
  getEsBuildConfig,
  getNestWebpackBuildConfig,
  getServeConfig,
  getWebpackBuildConfig,
} from './create-targets';

export function addProject(tree: Tree, options: NormalizedSchema) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  if (options.bundler === 'esbuild') {
    addBuildTargetDefaults(tree, '@nx/esbuild:esbuild');
    project.targets.build = getEsBuildConfig(project, options);
  } else if (options.bundler === 'webpack') {
    if (!hasWebpackPlugin(tree) && options.addPlugin === false) {
      addBuildTargetDefaults(tree, `@nx/webpack:webpack`);
      project.targets.build = getWebpackBuildConfig(project, options);
    } else if (options.isNest) {
      // If we are using Nest that has the webpack plugin we need to override the
      // build target so that node-env can be set to production or development so the serve target can be run in development mode
      project.targets.build = getNestWebpackBuildConfig();
    }
  }
  project.targets.serve = getServeConfig(options);

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
  };

  if (!options.useProjectJson) {
    packageJson.nx = {
      name: options.name !== options.importPath ? options.name : undefined,
      targets: project.targets,
      tags: project.tags?.length ? project.tags : undefined,
    };
  } else {
    addProjectConfiguration(
      tree,
      options.name,
      project,
      options.standaloneConfig
    );
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    writeJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}
