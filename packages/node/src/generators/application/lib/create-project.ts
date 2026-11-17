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
  addDeployOutputCacheInputs,
  PNPM_INSTALL_SETTINGS_INPUTS,
  TS_SOLUTION_SETUP_TSCONFIG_INPUT,
  type DeployOutputSettingsInput,
  type MatchedTargetRef,
} from '@nx/js/internal';
import { addTscAppBuildPlugin } from './add-tsc-build-plugin';
import { NormalizedSchema } from './normalized-schema';
import {
  getEsBuildConfig,
  getServeConfig,
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
  const deployInputs: readonly DeployOutputSettingsInput[] = tree.exists(
    'pnpm-lock.yaml'
  )
    ? PNPM_INSTALL_SETTINGS_INPUTS
    : [];
  if (options.bundler === 'esbuild') {
    addBuildTargetDefaults(tree, '@nx/esbuild:esbuild', 'build', [
      TS_SOLUTION_SETUP_TSCONFIG_INPUT,
      ...deployInputs,
    ]);
    project.targets.build = getEsBuildConfig(tree, project, options);
    ensureDeployInputs(tree, options, project.targets.build, deployInputs);
  } else if (options.bundler === 'tsc') {
    options.buildTargetName = addTscAppBuildPlugin(
      tree,
      options.appProjectRoot
    );
  }
  // The rolldown build target comes from @nx/rolldown:configuration.
  project.targets = {
    ...project.targets,
    ...getPruneTargets(options.buildTargetName, options.outputPath),
  };
  if (!options.serveRuntime) {
    project.targets.serve = getServeConfig(options);
  } else {
    // @nx/js/node or @nx/js/tsx infers the command. `^build` builds workspace
    // libraries whose exports point at their output.
    project.targets.serve = { continuous: true, dependsOn: ['^build'] };
  }
  // The framework templates call emitReadySignal once the server listens
  if (options.isNest || (options.framework && options.framework !== 'none')) {
    project.targets.serve.readyWhen = { signal: true };
  }

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
    // Node runs the TypeScript source as ESM; without this it warns on every start.
    ...(options.serveRuntime === 'node' && { type: 'module' }),
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

  // The prune targets read the project package.json for the deps to deploy.
  if (
    !options.useProjectJson ||
    options.isUsingTsSolutionConfig ||
    !options.rootProject
  ) {
    writeJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}

/**
 * Guarantees the deploy-settings inputs reach the generated build target even
 * when `addBuildTargetDefaults` skipped writing them because an
 * executor-keyed `targetDefaults` entry already existed. Resolution and
 * placement follow nx's own targetDefaults matching (see
 * `addDeployOutputCacheInputs`).
 */
function ensureDeployInputs(
  tree: Tree,
  options: NormalizedSchema,
  buildTarget: TargetConfiguration,
  deployInputs: readonly DeployOutputSettingsInput[]
): void {
  if (deployInputs.length === 0) {
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
  const changed = addDeployOutputCacheInputs(
    ref,
    nxJson?.targetDefaults,
    buildTarget.executor,
    deployInputs
  );
  if (changed === 'defaults') {
    updateNxJson(tree, nxJson);
  }
}
