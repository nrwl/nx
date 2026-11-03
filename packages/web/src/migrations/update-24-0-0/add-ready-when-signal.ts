import {
  getProjects,
  parseTargetString,
  readNxJson,
  type ExecutorContext,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  addReadyWhenSignalToTargets,
  mergeTargetConfigurations,
  readApplicableTargetDefaults,
  resolveNxTokensInOptions,
} from '@nx/devkit/internal';

export default async function update(tree: Tree) {
  return addReadyWhenSignalToTargets(
    tree,
    ['@nx/web:file-server'],
    (target, projectName, defaults) =>
      addBuildDependency(tree, target, projectName, defaults)
  );
}

// The file server runs its build target before it listens, which would count
// against the readiness timeout unless the build already ran as a dependency.
// Returns false when `dependsOn` cannot express that build.
function addBuildDependency(
  tree: Tree,
  target: TargetConfiguration,
  projectName: string,
  defaults: Partial<TargetConfiguration> | null
): boolean {
  const effective = mergeTargetConfigurations(
    target,
    defaults ?? undefined,
    undefined,
    undefined,
    undefined,
    false
  );
  // `dependsOn` is per target, so a configuration that swaps the build target
  // cannot be covered
  if (
    Object.values(effective.configurations ?? {}).some(
      (config) => config?.buildTarget !== undefined
    )
  ) {
    return false;
  }
  if (typeof effective.options?.buildTarget !== 'string') {
    return true;
  }

  const projects = getProjects(tree);
  const nodes = Object.fromEntries(
    [...projects].map(([name, data]) => [
      name,
      { name, type: 'lib' as const, data },
    ])
  );
  let parsed: ReturnType<typeof parseTargetString>;
  try {
    const { buildTarget } = resolveNxTokensInOptions(
      { buildTarget: effective.options.buildTarget },
      { ...projects.get(projectName), name: projectName },
      'buildTarget'
    );
    parsed = parseTargetString(buildTarget, {
      projectName,
      projectGraph: { nodes, dependencies: {} },
    } as unknown as ExecutorContext);
  } catch {
    return false;
  }
  const { project, target: name, configuration } = parsed;

  // `dependsOn` can't name a configuration, so only the build target's default
  // one is covered
  const buildTargetConfig = projects.get(project)?.targets?.[name];
  // Nx merges defaults into a run-commands or run-script target based on its
  // command or script, so only targets with other executors read them
  const buildTargetDefaults =
    buildTargetConfig?.executor &&
    buildTargetConfig.executor !== 'nx:run-commands' &&
    buildTargetConfig.executor !== 'nx:run-script'
      ? readApplicableTargetDefaults(
          name,
          buildTargetConfig.executor,
          readNxJson(tree)?.targetDefaults,
          project,
          nodes[project]
        )
      : null;
  const defaultConfiguration =
    buildTargetConfig?.defaultConfiguration ??
    buildTargetDefaults?.defaultConfiguration;
  if (configuration !== undefined && configuration !== defaultConfiguration) {
    return false;
  }
  // Nx runs the `dependsOn` build in the requested configuration when the build
  // target has it. An inferred build target's configurations are unknown.
  const buildConfigurations = {
    ...buildTargetDefaults?.configurations,
    ...buildTargetConfig?.configurations,
  };
  const inferredBuildTarget =
    !buildTargetConfig?.executor && !buildTargetConfig?.command;
  if (
    Object.keys(effective.configurations ?? {}).some(
      (config) =>
        config !== defaultConfiguration &&
        (inferredBuildTarget || config in buildConfigurations)
    )
  ) {
    return false;
  }

  if (
    (effective.dependsOn ?? []).some((entry) =>
      project === projectName
        ? typeof entry === 'string'
          ? entry === name
          : entry.target === name && !entry.projects && !entry.dependencies
        : typeof entry === 'string'
          ? entry === `${project}:${name}`
          : entry.target === name && [entry.projects].flat().includes(project)
    )
  ) {
    return true;
  }
  const buildDependency =
    project === projectName ? name : { projects: [project], target: name };
  // A `dependsOn` in the project replaces the inherited one unless it spreads it
  target.dependsOn = target.dependsOn
    ? [...target.dependsOn, buildDependency]
    : effective.dependsOn
      ? ['...', buildDependency]
      : [buildDependency];
  return true;
}
