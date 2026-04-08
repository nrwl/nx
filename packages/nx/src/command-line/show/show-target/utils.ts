import { relative, resolve } from 'path';
import { calculateDefaultProjectName } from '../../../config/calculate-default-project-name';
import { readNxJson } from '../../../config/configuration';
import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import {
  createProjectGraphAsync,
  createProjectGraphAndSourceMapsAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../../project-graph/project-graph';
import type { ConfigurationSourceMaps } from '../../../project-graph/utils/project-configuration/source-maps';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { output } from '../../../utils/output';
import { splitTarget } from '../../../utils/split-target';
import { workspaceRoot } from '../../../utils/workspace-root';
import type {
  ShowTargetBaseOptions,
  ShowTargetInputsOptions,
} from '../command-object';

// ── ResolvedTarget ──────────────────────────────────────────────────

export interface ResolvedTarget {
  graph: ProjectGraph;
  nxJson: NxJsonConfiguration;
  projectName: string;
  targetName: string;
  configuration: string | undefined;
  node: ProjectGraph['nodes'][string];
  sourceMaps?: ConfigurationSourceMaps;
}

export async function resolveTarget(
  args: ShowTargetBaseOptions | ShowTargetInputsOptions,
  opts?: { withSourceMaps?: boolean }
): Promise<ResolvedTarget> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');

  let graph: ProjectGraph;
  let sourceMaps: ConfigurationSourceMaps | undefined;

  if (opts?.withSourceMaps) {
    const result = await createProjectGraphAndSourceMapsAsync();
    graph = result.projectGraph;
    sourceMaps = result.sourceMaps;
  } else {
    graph = await createProjectGraphAsync();
  }

  const nxJson = readNxJson();

  const { projectName, targetName, configurationName } =
    resolveTargetIdentifier(args, graph, nxJson);

  const node = resolveProjectNode(projectName, graph);
  if (!node.data.targets?.[targetName]) {
    reportTargetNotFound(projectName, targetName, node);
  }

  const configuration = configurationName ?? args.configuration;
  if (configuration) {
    validateConfiguration(
      projectName,
      targetName,
      configuration,
      node.data.targets[targetName]
    );
  }

  return {
    graph,
    nxJson,
    projectName,
    targetName,
    configuration,
    node,
    sourceMaps,
  };
}

// ── Target identifier & project resolution ──────────────────────────

function resolveTargetIdentifier(
  args: ShowTargetBaseOptions | ShowTargetInputsOptions,
  graph: ProjectGraph,
  nxJson: NxJsonConfiguration
): { projectName: string; targetName: string; configurationName?: string } {
  if (!args.target) {
    output.error({
      title: 'No target specified.',
      bodyLines: [
        `Please specify a target using:`,
        `  nx show target <project:target>`,
        `  nx show target <target>  (infers project from cwd)`,
      ],
    });
    process.exit(1);
  }

  const defaultProjectName = calculateDefaultProjectName(
    process.cwd(),
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(graph),
    nxJson
  );

  const [project, target, config] = splitTarget(args.target, graph, {
    currentProject: defaultProjectName,
  });

  if (project && target) {
    return {
      projectName: project,
      targetName: target,
      configurationName: config,
    };
  }

  const targetName = project; // splitTarget returns the string as the first element
  const projectName = defaultProjectName;

  if (!projectName) {
    output.error({
      title: `Could not infer project from the current working directory.`,
      bodyLines: [
        `Please specify the project explicitly:`,
        `  nx show target <project>:${targetName}`,
        ``,
        `Or run this command from within a project directory.`,
      ],
    });
    process.exit(1);
  }

  return { projectName, targetName };
}

function resolveProjectNode(projectName: string, graph: ProjectGraph) {
  let node = graph.nodes[projectName];
  if (!node) {
    const projects = findMatchingProjects([projectName], graph.nodes);
    if (projects.length === 1) {
      node = graph.nodes[projects[0]];
    } else if (projects.length > 1) {
      output.error({
        title: `Multiple projects matched "${projectName}":`,
        bodyLines:
          projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
      });
      process.exit(1);
    } else {
      output.error({ title: `Could not find project "${projectName}".` });
      process.exit(1);
    }
  }
  return node;
}

function reportTargetNotFound(
  projectName: string,
  targetName: string,
  node: ProjectGraph['nodes'][string]
): never {
  const availableTargets = Object.keys(node.data.targets ?? {});
  output.error({
    title: `Target "${targetName}" not found for project "${projectName}".`,
    bodyLines: availableTargets.length
      ? [`Available targets:`, ...availableTargets.map((t) => `  - ${t}`)]
      : [`This project has no targets configured.`],
  });
  process.exit(1);
}

function validateConfiguration(
  projectName: string,
  targetName: string,
  configuration: string,
  targetConfig: { configurations?: Record<string, unknown> }
): void {
  const availableConfigs = Object.keys(targetConfig.configurations ?? {});
  if (!availableConfigs.includes(configuration)) {
    output.error({
      title: `Configuration "${configuration}" not found for target "${projectName}:${targetName}".`,
      bodyLines: availableConfigs.length
        ? [
            `Available configurations:`,
            ...availableConfigs.map((c) => `  - ${c}`),
          ]
        : [`This target has no configurations.`],
    });
    process.exit(1);
  }
}

// ── Custom hasher detection ──────────────────────────────────────────

/**
 * Checks whether a target's executor defines a custom hasher.
 * Returns true if the executor has a hasherFactory — meaning the
 * standard input-based hashing is bypassed for this target.
 */
export function hasCustomHasher(
  projectName: string,
  targetName: string,
  graph: ProjectGraph
): boolean {
  try {
    const { getExecutorForTask } = require('../../../tasks-runner/utils');
    const task = {
      id: `${projectName}:${targetName}`,
      target: { project: projectName, target: targetName },
      overrides: {},
    };
    const executorConfig = getExecutorForTask(task, graph);
    return !!executorConfig.hasherFactory;
  } catch {
    return false;
  }
}

// ── Small helpers shared across slices ───────────────────────────────

export function normalizePath(p: string): string {
  const absolute = resolve(process.cwd(), p);
  return relative(workspaceRoot, absolute).replace(/\\/g, '/');
}

export function deduplicateFolderEntries(items: string[]): string[] {
  const normalized = items.map((item) => ({
    original: item,
    path: normalizePath(item),
  }));

  return normalized
    .filter(({ path }) => {
      const dirPrefix = path.endsWith('/') ? path : path + '/';
      return !normalized.some(
        (other) => other.path !== path && other.path.startsWith(dirPrefix)
      );
    })
    .map(({ original }) => original);
}

let _pc: typeof import('picocolors');
export function pc() {
  return (_pc ??= require('picocolors'));
}

export function printList(header: string, items: unknown[], prefix = '\n') {
  if (items.length === 0) return;
  console.log(`${prefix}${pc().bold(header)}:`);
  for (const item of items) console.log(`  ${item}`);
}
