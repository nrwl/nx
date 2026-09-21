import type { ProjectGraph } from '../../config/project-graph';
import type { Task, TaskGraph } from '../../config/task-graph';
import type {
  ReadyWhen,
  TargetDependencyConfig,
} from '../../config/workspace-json-project-json';
import {
  getAllTargetNames,
  normalizeDependencyConfigDefinition,
} from '../utils';

const DEFAULT_READY_TIMEOUT = 60_000;
// Node timers and the native probe both take a 32-bit count of milliseconds
const MAX_DURATION = 2_147_483_647;

// No interval means the probe backs off on its own
export type NormalizedReadyWhen = { timeout: number; interval?: number } & (
  | { kind: 'url'; url: string }
  | { kind: 'port'; port: number; host?: string }
  | { kind: 'command'; command: string }
  | { kind: 'logMatches'; logMatches: string[] }
);

const PROBE_KEYS = ['url', 'port', 'command', 'logMatches'] as const;

export function normalizeReadyWhen(
  readyWhen: ReadyWhen,
  taskId: string
): NormalizedReadyWhen {
  const invalid = (reason: string) =>
    new Error(`Task "${taskId}" has an invalid "readyWhen": ${reason}.`);

  if (typeof readyWhen !== 'object' || readyWhen === null) {
    throw invalid('expected an object');
  }

  const config = readyWhen as unknown as Record<string, unknown>;
  const present = PROBE_KEYS.filter((key) => config[key] != null);
  if (present.length !== 1) {
    throw invalid(
      `expected exactly one of ${PROBE_KEYS.map((k) => `"${k}"`).join(', ')}`
    );
  }
  const timeout = config.timeout ?? DEFAULT_READY_TIMEOUT;
  if (!isDuration(timeout)) {
    throw invalid(`"timeout" must be an integer from 1 to ${MAX_DURATION}`);
  }
  const shared: { timeout: number; interval?: number } = { timeout };
  if (config.interval != null) {
    if (!isDuration(config.interval)) {
      throw invalid(`"interval" must be an integer from 1 to ${MAX_DURATION}`);
    }
    shared.interval = config.interval;
  }

  switch (present[0]) {
    case 'url': {
      const url = config.url;
      if (typeof url !== 'string' || !isHttpUrl(url)) {
        throw invalid('"url" must be an http or https URL');
      }
      return { kind: 'url', url, ...shared };
    }
    case 'port': {
      const port = config.port;
      if (!isPositiveInteger(port) || port > 65535) {
        throw invalid('"port" must be an integer from 1 to 65535');
      }
      const host = config.host;
      if (host == null) {
        return { kind: 'port', port, ...shared };
      }
      if (typeof host !== 'string' || !host) {
        throw invalid('"host" must be a non-empty string');
      }
      return { kind: 'port', port, host, ...shared };
    }
    case 'command': {
      const command = config.command;
      if (typeof command !== 'string' || !command) {
        throw invalid('"command" must be a non-empty string');
      }
      return { kind: 'command', command, ...shared };
    }
    case 'logMatches': {
      const logMatches = Array.isArray(config.logMatches)
        ? config.logMatches
        : [config.logMatches];
      if (
        logMatches.length === 0 ||
        logMatches.some((m) => typeof m !== 'string' || !m)
      ) {
        throw invalid(
          '"logMatches" must be a non-empty string or an array of them'
        );
      }
      return { kind: 'logMatches', logMatches, ...shared };
    }
  }
}

export function readinessTimeoutError(
  taskId: string,
  readyWhen: NormalizedReadyWhen
): Error {
  return new Error(
    `Task "${taskId}" did not become ready within ${
      readyWhen.timeout
    }ms (readyWhen: ${describeReadyWhen(readyWhen)}).`
  );
}

export function notReadyError(
  taskId: string,
  reason: 'exited' | 'was stopped' | 'failed'
): Error {
  return new Error(`Task "${taskId}" ${reason} before it became ready.`);
}

// The row carries only the status; the owner prints the reason under
// NX_VERBOSE_LOGGING
export function readinessFailedElsewhereError(taskId: string): Error {
  return new Error(
    `Task "${taskId}" failed its readiness check in the process that started it.`
  );
}

function describeReadyWhen(readyWhen: NormalizedReadyWhen): string {
  switch (readyWhen.kind) {
    case 'url':
      return `url ${readyWhen.url}`;
    case 'port':
      return readyWhen.host
        ? `port ${readyWhen.host}:${readyWhen.port}`
        : `port ${readyWhen.port}`;
    case 'command':
      return `command "${readyWhen.command}"`;
    case 'logMatches':
      return `logMatches ${readyWhen.logMatches.map((m) => `"${m}"`).join(', ')}`;
  }
}

// Raw config: scheduling must not throw on an invalid value, the producer's
// own start reports that
export function getReadyWhenConfig(
  task: Task,
  projectGraph: ProjectGraph
): ReadyWhen | undefined {
  if (!task.continuous) {
    return undefined;
  }
  return projectGraph.nodes[task.target.project]?.data?.targets?.[
    task.target.target
  ]?.readyWhen;
}

const allTargetNamesCache = new WeakMap<ProjectGraph, string[]>();

// Whether each producer declares a `readyWhen` is up to the caller.
export function getReadyProducerIds(
  task: Task,
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph
): string[] {
  const producerIds = taskGraph.continuousDependencies[task.id];
  if (!producerIds?.length) {
    return [];
  }
  const { project, target } = task.target;
  const dependsOn: (TargetDependencyConfig | string)[] =
    projectGraph.nodes[project]?.data?.targets?.[target]?.dependsOn ?? [];
  const readyEntries = dependsOn
    .filter((entry) => typeof entry !== 'string' && entry.waitFor === 'ready')
    .flatMap((entry) =>
      normalizeDependencyConfigDefinition(
        entry,
        project,
        projectGraph,
        cachedAllTargetNames(projectGraph)
      )
    )
    .map((entry) => ({
      target: entry.target,
      projects: entry.dependencies
        ? dependenciesWithTarget(project, entry.target, projectGraph)
        : new Set(entry.projects),
    }));
  if (readyEntries.length === 0) {
    return [];
  }
  return producerIds.filter((producerId) => {
    const producer = taskGraph.tasks[producerId];
    return (
      producer &&
      readyEntries.some(
        (entry) =>
          entry.target === producer.target.target &&
          entry.projects.has(producer.target.project)
      )
    );
  });
}

// Producers with a probe that each task in the graph waits on, keyed by the
// waiting task. Tasks with none are left out.
export function getReadyDependencies(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph
): Record<string, string[]> {
  const readyDependencies: Record<string, string[]> = {};
  for (const task of Object.values(taskGraph.tasks)) {
    const producerIds = getReadyProducerIds(
      task,
      taskGraph,
      projectGraph
    ).filter(
      (id) => getReadyWhenConfig(taskGraph.tasks[id], projectGraph) != null
    );
    if (producerIds.length > 0) {
      readyDependencies[task.id] = producerIds;
    }
  }
  return readyDependencies;
}

function cachedAllTargetNames(projectGraph: ProjectGraph): string[] {
  let names = allTargetNamesCache.get(projectGraph);
  if (!names) {
    names = getAllTargetNames(projectGraph);
    allTargetNamesCache.set(projectGraph, names);
  }
  return names;
}

// Same walk as the task graph's `dependencies: true` resolution: a dependency
// without the target is looked through to its own dependencies.
function dependenciesWithTarget(
  project: string,
  target: string,
  projectGraph: ProjectGraph
): Set<string> {
  const matches = new Set<string>();
  const visited = new Set<string>([project]);
  const queue = [project];
  while (queue.length) {
    const current = queue.pop();
    for (const dep of projectGraph.dependencies[current] ?? []) {
      if (visited.has(dep.target)) {
        continue;
      }
      visited.add(dep.target);
      const node = projectGraph.nodes[dep.target];
      if (!node) {
        continue;
      }
      if (node.data.targets?.[target]) {
        matches.add(dep.target);
      } else {
        queue.push(dep.target);
      }
    }
  }
  return matches;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isDuration(value: unknown): value is number {
  return isPositiveInteger(value) && value <= MAX_DURATION;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}
