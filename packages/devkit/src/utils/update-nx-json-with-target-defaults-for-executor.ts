import type {
  Tree,
  NxJsonConfiguration,
  TargetDefaults,
  ProjectGraph,
  ProjectGraphProjectNode,
  ProjectConfiguration,
  TargetConfiguration,
} from 'nx/src/devkit-exports';
import { forEachExecutorOptionsInGraph } from '../generators/executor-options-utils';
import { requireNx } from '../../nx';

const { getProjects, readTargetDefaultsForTarget } = requireNx();

export function getExecutorTargets(
  graph: ProjectGraph,
  executor: string
): Set<string> {
  /**
   * A set of targets which does not use any other executors
   */
  const executorTargets = new Set<string>();

  forEachExecutorOptionsInGraph(graph, executor, (_, __, targetName) => {
    executorTargets.add(targetName);
  });

  return executorTargets;
}

export function updateNxJsonWithTargetDefaultsForExecutor(
  tree: Tree,
  nxJson: NxJsonConfiguration,
  graph: ProjectGraph,
  executor: string,
  executorDefaults: TargetDefaults[string],
  executorTargets: Set<string>
): NxJsonConfiguration {
  // Use the project graph so targets which are inferred are considered
  const projects = graph.nodes;

  const defaults: TargetConfiguration = (nxJson.targetDefaults[executor] = {});

  // All jest targets have the same name
  if (executorTargets.size === 1) {
    const targetName = Array.from(executorTargets)[0];
    if (nxJson.targetDefaults[targetName]) {
      Object.assign(defaults, nxJson.targetDefaults[targetName]);
    }
  }

  if (executorDefaults?.cache !== undefined) {
    defaults.cache ??= executorDefaults.cache;
  }

  if (executorDefaults?.inputs !== undefined) {
    defaults.inputs ??= executorDefaults.inputs;
  }

  const projectMap = getProjects(tree);

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

  return nxJson;
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
          projectMap.get(p.name)?.targets?.[targetName]?.executor
        ) === targetDefault
      ) {
        return true;
      }
    }
  }
  return false;
}
