import {
  createProjectGraphAsync,
  formatFiles,
  getProjects,
  ProjectConfiguration,
  ProjectGraphProjectNode,
  readNxJson,
  TargetConfiguration,
  TargetDefaults,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { forEachExecutorOptionsInGraph } from '@nx/devkit/src/generators/executor-options-utils';
import { VitestExecutorOptions } from '../../executors/test/schema';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';

export default async function update(tree: Tree) {
  const nxJson = readNxJson(tree);

  // Don't override anything if there are already target defaults for vitest
  if (nxJson.targetDefaults?.['@nx/vite:test']) {
    return;
  }

  nxJson.targetDefaults ??= {};

  /**
   * A set of targets which does not use any other executors
   */
  const vitestTargets = new Set<string>();
  const graph = await createProjectGraphAsync();
  const projectMap = getProjects(tree);

  forEachExecutorOptionsInGraph(
    graph,
    '@nx/vite:test',
    (value, proj, targetName) => {
      vitestTargets.add(targetName);
    }
  );

  // Workspace does not use vitest
  if (vitestTargets.size === 0) {
    return;
  }

  // Use the project graph nodes so that targets which are inferred are considered
  const projects = graph.nodes;

  const vitestDefaults: TargetConfiguration<Partial<VitestExecutorOptions>> =
    (nxJson.targetDefaults['@nx/vite:test'] = {});

  // All vitest targets have the same name
  if (vitestTargets.size === 1) {
    const targetName = Array.from(vitestTargets)[0];
    if (nxJson.targetDefaults[targetName]) {
      Object.assign(vitestDefaults, nxJson.targetDefaults[targetName]);
    }
  }

  vitestDefaults.cache ??= true;

  const inputs = ['default'];
  inputs.push(nxJson.namedInputs?.production ? '^production' : '^default');
  vitestDefaults.inputs ??= inputs;

  // Cleanup old target defaults
  for (const [targetDefaultKey, targetDefault] of Object.entries(
    nxJson.targetDefaults
  )) {
    if (
      !isTargetDefaultUsed(
        targetDefault,
        nxJson.targetDefaults,
        projects,
        projectMap
      )
    ) {
      delete nxJson.targetDefaults[targetDefaultKey];
    }
  }

  updateNxJson(tree, nxJson);

  await formatFiles(tree);
}

/**
 * Checks every target on every project to see if one of them uses the target default
 */
function isTargetDefaultUsed(
  targetDefault: Partial<TargetConfiguration>,
  targetDefaults: TargetDefaults,
  projects: Record<string, ProjectGraphProjectNode>,
  projectMap: Map<string, ProjectConfiguration>
) {
  for (const p of Object.values(projects)) {
    for (const targetName in p.data?.targets ?? {}) {
      if (
        readTargetDefaultsForTarget(
          targetName,
          targetDefaults,
          // It might seem like we should use the graph here too but we don't want to pass an executor which was processed in the graph
          projectMap.get(p.name).targets?.[targetName]?.executor
        ) === targetDefault
      ) {
        return true;
      }
    }
  }
  return false;
}
