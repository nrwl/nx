import {
  getProjects,
  parseTargetString,
  type ExecutorContext,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { addReadyWhenSignalToTargets } from '@nx/devkit/internal';

export default async function update(tree: Tree) {
  return addReadyWhenSignalToTargets(
    tree,
    ['@nx/web:file-server'],
    (target, projectName) => addBuildDependency(tree, target, projectName)
  );
}

// The file server runs its build target before it listens, which would count
// against the readiness timeout unless the build already ran as a dependency.
// Returns false when `dependsOn` cannot express that build.
function addBuildDependency(
  tree: Tree,
  target: TargetConfiguration,
  projectName: string
): boolean {
  // `dependsOn` is per target, so a configuration that swaps the build target
  // cannot be covered
  if (
    Object.values(target.configurations ?? {}).some(
      (config) => config?.buildTarget !== undefined
    )
  ) {
    return false;
  }
  const buildTarget = target.options?.buildTarget;
  if (typeof buildTarget !== 'string') {
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
  const defaultConfiguration =
    projects.get(project)?.targets?.[name]?.defaultConfiguration;
  if (configuration !== undefined && configuration !== defaultConfiguration) {
    return false;
  }

  const dependsOn = target.dependsOn ?? [];
  if (
    dependsOn.some((entry) =>
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
  target.dependsOn = [
    ...dependsOn,
    project === projectName ? name : { projects: [project], target: name },
  ];
  return true;
}
