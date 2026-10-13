import { relative } from 'path';
import type { ProjectGraph } from '../../config/project-graph';
import type { Task, TaskGraph } from '../../config/task-graph';
import type {
  ProjectConfiguration,
  ReadyWhen,
} from '../../config/workspace-json-project-json';
import { combineOptionsForExecutor, type Options } from '../../utils/params';
import { getExecutorForTask } from '../utils';

const DEFAULT_READY_TIMEOUT = 60_000;
// Node timers take at most a signed 32-bit count of milliseconds
const MAX_DURATION = 2_147_483_647;

// No interval means the probe backs off on its own
export type NormalizedReadyWhen = { timeout: number; interval?: number } & (
  | { kind: 'url'; url: string }
  | { kind: 'port'; port: number; host?: string }
  | { kind: 'command'; command: string }
  | { kind: 'logMatches'; logMatches: string[] }
);

const PROBE_KEYS = ['url', 'port', 'command', 'logMatches'] as const;

// The placeholders `outputs` resolve, matched by name so that braces a shell
// command needs (`{{.State.Health.Status}}`, `${VAR}`, `{a,b}`) stay literal
const PLACEHOLDER = /{(workspaceRoot|projectRoot|projectName|options\.[^}]+)}/g;

export interface ReadyWhenData {
  workspaceRoot: string;
  projectRoot: string;
  projectName: string;
  options: Record<string, unknown>;
}

export function normalizeReadyWhen(
  readyWhen: ReadyWhen,
  taskId: string,
  data: ReadyWhenData
): NormalizedReadyWhen {
  const invalid = (reason: string) =>
    new Error(`Task "${taskId}" has an invalid "readyWhen": ${reason}.`);

  if (typeof readyWhen !== 'object' || readyWhen === null) {
    throw invalid('expected an object');
  }

  const config = readyWhen as unknown as Record<string, unknown>;
  const resolve = (value: unknown): unknown =>
    typeof value === 'string'
      ? value.replace(PLACEHOLDER, (match, name: string) => {
          let resolved: unknown = data;
          for (const key of name.split('.')) {
            resolved = resolved?.[key];
          }
          if (resolved == null) {
            throw invalid(`"${match}" has no value`);
          }
          if (!['string', 'number', 'boolean'].includes(typeof resolved)) {
            throw invalid(`"${match}" is not a string or a number`);
          }
          return String(resolved);
        })
      : value;
  // Braces are never valid in a host or port once resolved, so a leftover is
  // a typo. A url keeps them: they are legal in its path and query.
  const resolveWithoutBraces = (key: string): unknown => {
    const value = resolve(config[key]);
    if (typeof value === 'string' && /[{}]/.test(value)) {
      throw invalid(`"${key}" contains an unknown placeholder`);
    }
    return value;
  };
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
      const url = resolve(config.url);
      if (typeof url !== 'string' || !isHttpUrl(url)) {
        throw invalid('"url" must be an http or https URL');
      }
      return { kind: 'url', url, ...shared };
    }
    case 'port': {
      let port = resolveWithoutBraces('port');
      if (typeof port === 'string' && /^\d+$/.test(port)) {
        port = Number(port);
      }
      if (!isPositiveInteger(port) || port > 65535) {
        throw invalid('"port" must be an integer from 1 to 65535');
      }
      const host = resolveWithoutBraces('host');
      if (host == null) {
        return { kind: 'port', port, ...shared };
      }
      if (typeof host !== 'string' || !host) {
        throw invalid('"host" must be a non-empty string');
      }
      return { kind: 'port', port, host, ...shared };
    }
    case 'command': {
      const command = resolve(config.command);
      if (typeof command !== 'string' || !command) {
        throw invalid('"command" must be a non-empty string');
      }
      return { kind: 'command', command, ...shared };
    }
    case 'logMatches': {
      const logMatches = (
        Array.isArray(config.logMatches)
          ? config.logMatches
          : [config.logMatches]
      ).map(resolve);
      if (
        logMatches.length === 0 ||
        !logMatches.every((m): m is string => typeof m === 'string' && !!m)
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

// The row carries only the status; the owner reports the reason
export class ProducerFailedError extends Error {
  constructor(taskId: string) {
    super(
      `Task "${taskId}" failed its readiness check in the process that started it.`
    );
  }
}

// An exit or a stop is completed by its own handler, not as a verdict
export class NotReadyError extends Error {}

export function notReadyError(
  taskId: string,
  reason: 'exited' | 'was stopped' | 'failed'
): Error {
  return new NotReadyError(
    `Task "${taskId}" ${reason} before it became ready.`
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

// Placeholders resolve against the options the executor receives: aliases,
// schema defaults and the spelling of command-line overrides applied
export function getReadyWhen(
  task: Task,
  projectGraph: ProjectGraph,
  projects: Record<string, ProjectConfiguration>,
  workspaceRoot: string
): NormalizedReadyWhen | null {
  const readyWhen = getReadyWhenConfig(task, projectGraph);
  if (readyWhen == null) {
    return null;
  }
  const node = projectGraph.nodes[task.target.project];
  const target = node.data.targets[task.target.target];
  const { schema } = getExecutorForTask(task, projects);
  return normalizeReadyWhen(readyWhen, task.id, {
    workspaceRoot,
    projectRoot: node.data.root,
    projectName: node.name,
    options: combineOptionsForExecutor(
      task.overrides as Options,
      task.target.configuration ?? target.defaultConfiguration,
      target,
      schema,
      task.target.project,
      relative(task.projectRoot ?? workspaceRoot, process.cwd()),
      process.env.NX_VERBOSE_LOGGING === 'true'
    ),
  });
}

export function getReadyProducerIds(
  task: Task,
  taskGraph: TaskGraph
): string[] {
  return (taskGraph.continuousDependencies[task.id] ?? [])
    .filter((edge) => edge.waitFor === 'ready')
    .map((edge) => edge.id);
}

// Producers with a probe that each task waits on; tasks with none are left out
export function getReadyDependencies(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph
): Record<string, string[]> {
  const readyDependencies: Record<string, string[]> = {};
  for (const task of Object.values(taskGraph.tasks)) {
    const producerIds = getReadyProducerIds(task, taskGraph).filter(
      (id) => getReadyWhenConfig(taskGraph.tasks[id], projectGraph) != null
    );
    if (producerIds.length > 0) {
      readyDependencies[task.id] = producerIds;
    }
  }
  return readyDependencies;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isDuration(value: unknown): value is number {
  return isPositiveInteger(value) && value <= MAX_DURATION;
}

function isHttpUrl(value: string): boolean {
  return (
    URL.canParse(value) && ['http:', 'https:'].includes(new URL(value).protocol)
  );
}
