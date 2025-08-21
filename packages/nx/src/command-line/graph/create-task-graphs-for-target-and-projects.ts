import { performance } from 'node:perf_hooks';
import { ProjectGraph } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import { NxJson, HashPlanner, transferProjectGraph } from '../../native';
import { transformProjectGraphForRust } from '../../native/transform-objects';
import { createTaskGraph } from '../../tasks-runner/create-task-graph';
import { TaskGraphClientResponse } from './graph';

// In-memory cache for task graphs to avoid regeneration
const taskGraphCache = new Map<string, TaskGraphClientResponse>();

// Clear cache when project graph changes
export function clearTaskGraphCache() {
  taskGraphCache.clear();
}

function createTaskId(
  projectId: string,
  targetId: string,
  configurationId?: string
) {
  if (configurationId) {
    return `${projectId}:${targetId}:${configurationId}`;
  } else {
    return `${projectId}:${targetId}`;
  }
}

/**
 * Creates task graphs for multiple projects with a specific target
 * If no projects specified, returns graphs for all projects with the target
 *
 * @param targetName - The target to create task graphs for
 * @param projectNames - Optional list of project names to filter to
 * @param configuration - Optional configuration name
 * @param projectGraph - The project graph to use
 * @param nxJson - The nx.json configuration
 * @returns TaskGraphClientResponse with task graphs, plans, and errors
 */
export function createTaskGraphsForTargetAndProjectsWithGraph(
  targetName: string,
  projectNames: string[] | undefined,
  configuration: string | undefined,
  projectGraph: ProjectGraph,
  nxJson: NxJson
): TaskGraphClientResponse {
  // Determine which projects to process
  let projectsToProcess: string[];
  if (projectNames && projectNames.length > 0) {
    // Use specified projects (filter to only those that have the target)
    projectsToProcess = projectNames.filter(
      (projectName) =>
        projectGraph.nodes[projectName]?.data.targets?.[targetName]
    );
  } else {
    // Get all projects with the target
    projectsToProcess = Object.entries(projectGraph.nodes)
      .filter(([_, project]) => project.data.targets?.[targetName])
      .map(([projectName]) => projectName);
  }

  performance.mark(`target task graphs generation:start`);

  // Create task graphs for each project
  const taskGraphs: Record<string, TaskGraph> = {};
  const taskGraphErrors: Record<string, string> = {};

  for (const projectName of projectsToProcess) {
    const taskId = createTaskId(projectName, targetName, configuration);

    // Check cache first
    const cached = taskGraphCache.get(taskId);
    if (cached) {
      Object.assign(taskGraphs, cached.taskGraphs);
      Object.assign(taskGraphErrors, cached.errors);
      continue;
    }

    // Create task graph
    try {
      taskGraphs[taskId] = createTaskGraph(
        projectGraph,
        {},
        [projectName],
        [targetName],
        configuration,
        {}
      );
    } catch (err) {
      taskGraphs[taskId] = {
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
        roots: [],
      };
      taskGraphErrors[taskId] = err.message;
    }
  }

  performance.mark(`target task graphs generation:end`);

  // Generate hash plans
  const planner = new HashPlanner(
    nxJson,
    transferProjectGraph(transformProjectGraphForRust(projectGraph))
  );
  performance.mark('target task hash plan generation:start');
  const plans: Record<string, string[]> = {};

  for (const taskGraph of Object.values(taskGraphs)) {
    const taskIds = Object.keys(taskGraph.tasks);
    if (taskIds.length > 0) {
      const taskPlans = planner.getPlans(taskIds, taskGraph);
      Object.assign(plans, taskPlans);
    }
  }

  performance.mark('target task hash plan generation:end');

  // Cache individual results for future requests
  for (const projectName of projectsToProcess) {
    const taskId = createTaskId(projectName, targetName, configuration);
    if (!taskGraphCache.has(taskId)) {
      taskGraphCache.set(taskId, {
        taskGraphs: { [taskId]: taskGraphs[taskId] },
        plans: Object.fromEntries(
          Object.entries(plans).filter(([key]) => key.startsWith(projectName))
        ),
        errors: taskGraphErrors[taskId]
          ? { [taskId]: taskGraphErrors[taskId] }
          : {},
      });
    }
  }

  performance.measure(
    `target task graphs generation for ${targetName}`,
    `target task graphs generation:start`,
    `target task graphs generation:end`
  );
  performance.measure(
    'target task hash plan generation',
    'target task hash plan generation:start',
    'target task hash plan generation:end'
  );

  return { taskGraphs, plans, errors: taskGraphErrors };
}
