import { addBuildTargetDefaults, type PackageJson } from '@nx/devkit/internal';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  readNxJson,
  TargetConfiguration,
  Tree,
  updateNxJson,
  writeJson,
} from '@nx/devkit';
import {
  addPnpmDeployOutputCacheInputs,
  PNPM_INSTALL_SETTINGS_INPUTS,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  type MatchedTargetRef,
} from '@nx/js/internal';
import { hasWebpackPlugin } from '../../../utils/has-webpack-plugin';
import { NormalizedSchema } from './normalized-schema';
import {
  getEsBuildConfig,
  getNestWebpackBuildConfig,
  getServeConfig,
  getWebpackBuildConfig,
  getPruneTargets,
} from './create-targets';

export function addProject(
  tree: Tree,
  options: NormalizedSchema,
  frameworkDependencies: Record<string, string>
) {
  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: joinPathFragments(options.appProjectRoot, 'src'),
    projectType: 'application',
    targets: {},
    tags: options.parsedTags,
  };

  // The generated build target emits the pruned pnpm deploy output when
  // generatePackageJson is on; the install settings it carries are hashed by
  // no default input (see PNPM_INSTALL_SETTINGS_INPUTS).
  const pnpmDeployInputs = tree.exists('pnpm-lock.yaml')
    ? PNPM_INSTALL_SETTINGS_INPUTS
    : [];
  if (options.bundler === 'esbuild') {
    addBuildTargetDefaults(tree, '@nx/esbuild:esbuild', 'build', [
      TS_SOLUTION_SETUP_TSCONFIG_INPUT,
      ...pnpmDeployInputs,
    ]);
    project.targets.build = getEsBuildConfig(tree, project, options);
    ensurePnpmDeployInputs(tree, options, project.targets.build);
  } else if (options.bundler === 'webpack') {
    if (!hasWebpackPlugin(tree) && options.addPlugin === false) {
      addBuildTargetDefaults(tree, `@nx/webpack:webpack`, 'build', [
        TS_SOLUTION_SETUP_TSCONFIG_INPUT,
        ...pnpmDeployInputs,
      ]);
      project.targets.build = getWebpackBuildConfig(tree, project, options);
      ensurePnpmDeployInputs(tree, options, project.targets.build);
    } else if (options.isNest) {
      // If we are using Nest that has the webpack plugin we need to override the
      // build target so that NODE_ENV can be set to production or development so the serve target can be run in development mode
      project.targets.build = getNestWebpackBuildConfig(project);
    }
  }
  project.targets = {
    ...project.targets,
    ...getPruneTargets('build', options.outputPath),
  };
  project.targets.serve = getServeConfig(options);

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
    dependencies: { ...frameworkDependencies },
  };

  if (!options.useProjectJson) {
    packageJson.nx = {
      name: options.name !== options.importPath ? options.name : undefined,
      targets: project.targets,
      tags: project.tags?.length ? project.tags : undefined,
    };
  } else {
    addProjectConfiguration(tree, options.name, project);
  }

  if (!options.useProjectJson || options.isUsingTsSolutionConfig) {
    writeJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}

/**
 * Guarantees the pnpm deploy-settings inputs reach the generated build target
 * even when `addBuildTargetDefaults` skipped writing them because an
 * executor-keyed `targetDefaults` entry already existed. Resolution and
 * placement follow nx's own targetDefaults matching (see
 * `addPnpmDeployOutputCacheInputs`).
 */
function ensurePnpmDeployInputs(
  tree: Tree,
  options: NormalizedSchema,
  buildTarget: TargetConfiguration
): void {
  if (!tree.exists('pnpm-lock.yaml')) {
    return;
  }
  const nxJson = readNxJson(tree);
  const ref: MatchedTargetRef = {
    targetName: 'build',
    projectName: options.name,
    projectNode: {
      name: options.name,
      type: 'app',
      data: { root: options.appProjectRoot, tags: options.parsedTags },
    },
    matcherExecutor: buildTarget.executor,
    target: buildTarget,
  };
  const changed = addPnpmDeployOutputCacheInputs(
    ref,
    nxJson?.targetDefaults,
    buildTarget.executor
  );
  if (changed === 'defaults') {
    updateNxJson(tree, nxJson);
  }
}
