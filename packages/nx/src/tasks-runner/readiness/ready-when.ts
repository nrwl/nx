import { relative } from 'path';
import type { ProjectGraph } from '../../config/project-graph';
import type { Task, TaskGraph } from '../../config/task-graph';
import type {
  ProjectConfiguration,
  ReadyWhen,
} from '../../config/workspace-json-project-json';
import { combineOptionsForExecutor, type Options } from '../../utils/params';
import {
  parseTokens,
  readPath,
  renderTokens,
  type TokenNode,
  type TokenScope,
} from '../tokens';
import { getExecutorForTask } from '../utils';

const DEFAULT_READY_TIMEOUT = 60_000;
// Node timers take at most a signed 32-bit count of milliseconds
const MAX_DURATION = 2_147_483_647;

// No interval means the probe's own default applies
type ReadyWhenProbe<Deferred> = { timeout: number; interval?: number } & (
  | { kind: 'url'; url: string | Deferred }
  | { kind: 'port'; port: number | Deferred; host?: string | Deferred }
  | { kind: 'command'; command: string | Deferred }
  | { kind: 'logMatches'; logMatches: (string | Deferred)[] }
);

export type NormalizedReadyWhen = ReadyWhenProbe<never>;

// A process that doesn't run the producer only waits on its readiness row
export interface ReadyWhenWait {
  timeout: number;
  description: string;
}

const PROBE_KEYS = ['url', 'port', 'command', 'logMatches'] as const;

// Only the process that runs the producer knows the env it runs with
class EnvUnknownHere extends Error {}

// A value that reads that env: it keeps its written form, and the producer's
// process checks it
class EnvDeferred {
  constructor(private readonly written: string) {}

  toString() {
    return this.written;
  }
}

// `options` and `env` are tokens only with a path, so shell text such as
// `${options}` stays as written
const PATHLESS_TOKENS = new Set([
  'workspaceRoot',
  'projectRoot',
  'projectName',
]);

export interface ReadyWhenData {
  workspaceRoot: string;
  projectRoot: string;
  projectName: string;
  options: Record<string, unknown>;
  env: () => NodeJS.ProcessEnv;
}

export function normalizeReadyWhen(
  readyWhen: ReadyWhen,
  taskId: string,
  data: ReadyWhenData
): NormalizedReadyWhen {
  // Only checkReadyWhen's env throws EnvUnknownHere, so nothing is deferred
  return resolveReadyWhen(readyWhen, taskId, data) as NormalizedReadyWhen;
}

function resolveReadyWhen(
  readyWhen: ReadyWhen,
  taskId: string,
  data: ReadyWhenData
): ReadyWhenProbe<EnvDeferred> {
  const invalid = (reason: string) =>
    new Error(`Task "${taskId}" has an invalid "readyWhen": ${reason}.`);

  if (typeof readyWhen !== 'object' || readyWhen === null) {
    throw invalid('expected an object');
  }

  const config = readyWhen as unknown as Record<string, unknown>;
  const scope: TokenScope = {
    isToken: (name, path) =>
      path === undefined
        ? PATHLESS_TOKENS.has(name)
        : name === 'options' || name === 'env',
    read: (name, path) => readPath(data[name], path),
    env: { read: data.env },
    noValue: (token) => {
      throw invalid(`"${token}" has no value`);
    },
    toText: (value, token) => {
      if (!['string', 'number', 'boolean'].includes(typeof value)) {
        throw invalid(`"${token}" is not a string or a number`);
      }
      return String(value);
    },
  };
  const resolve = (value: unknown): unknown => {
    if (typeof value !== 'string') {
      return value;
    }
    let nodes: TokenNode[];
    try {
      nodes = parseTokens(value, scope);
    } catch (e) {
      throw invalid(e.message);
    }
    try {
      return renderTokens(nodes, scope);
    } catch (e) {
      if (e instanceof EnvUnknownHere) {
        return new EnvDeferred(value);
      }
      throw e;
    }
  };
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
      if (
        !(url instanceof EnvDeferred) &&
        (typeof url !== 'string' || !isHttpUrl(url))
      ) {
        throw invalid('"url" must be an http or https URL');
      }
      return { kind: 'url', url, ...shared };
    }
    case 'port': {
      let port = resolveWithoutBraces('port');
      if (typeof port === 'string' && /^\d+$/.test(port)) {
        port = Number(port);
      }
      if (
        !(port instanceof EnvDeferred) &&
        (!isPositiveInteger(port) || port > 65535)
      ) {
        throw invalid('"port" must be an integer from 1 to 65535');
      }
      const host = resolveWithoutBraces('host');
      if (host == null) {
        return { kind: 'port', port, ...shared };
      }
      if (
        !(host instanceof EnvDeferred) &&
        (typeof host !== 'string' || !host)
      ) {
        throw invalid('"host" must be a non-empty string');
      }
      return { kind: 'port', port, host, ...shared };
    }
    case 'command': {
      const command = resolve(config.command);
      if (
        !(command instanceof EnvDeferred) &&
        (typeof command !== 'string' || !command)
      ) {
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
        !logMatches.every(
          (m): m is string | EnvDeferred =>
            m instanceof EnvDeferred || (typeof m === 'string' && !!m)
        )
      ) {
        throw invalid(
          '"logMatches" must be a non-empty string or an array of them'
        );
      }
      return { kind: 'logMatches', logMatches, ...shared };
    }
  }
}

/**
 * Checks a producer's probe in a process that doesn't run the producer. A
 * value that reads the producer's env is left to the producer's process, and
 * every other value is checked the way that process checks it.
 */
export function checkReadyWhen(
  readyWhen: ReadyWhen,
  taskId: string,
  data: Omit<ReadyWhenData, 'env'>
): ReadyWhenWait {
  const probe = resolveReadyWhen(readyWhen, taskId, {
    ...data,
    env: () => {
      throw new EnvUnknownHere();
    },
  });
  return {
    timeout: probe.timeout,
    description: describeReadyWhen(probe),
  };
}

export function readinessTimeoutError(
  taskId: string,
  readyWhen: NormalizedReadyWhen | ReadyWhenWait
): Error {
  const description =
    'kind' in readyWhen ? describeReadyWhen(readyWhen) : readyWhen.description;
  return new Error(
    `Task "${taskId}" did not become ready within ${readyWhen.timeout}ms (readyWhen: ${description}).`
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

function describeReadyWhen(readyWhen: ReadyWhenProbe<EnvDeferred>): string {
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

/**
 * The probe of a producer this process runs, resolved against `taskEnv`, the
 * env it starts the producer with
 */
export function getReadyWhen(
  task: Task,
  projectGraph: ProjectGraph,
  projects: Record<string, ProjectConfiguration>,
  workspaceRoot: string,
  taskEnv: NodeJS.ProcessEnv
): NormalizedReadyWhen | null {
  const inputs = getReadyWhenInputs(
    task,
    projectGraph,
    projects,
    workspaceRoot
  );
  if (!inputs) {
    return null;
  }
  return normalizeReadyWhen(inputs.readyWhen, task.id, {
    ...inputs.data,
    env: () => taskEnv,
  });
}

// The probe of a producer another process may run
export function getReadyWhenWait(
  task: Task,
  projectGraph: ProjectGraph,
  projects: Record<string, ProjectConfiguration>,
  workspaceRoot: string
): ReadyWhenWait | null {
  const inputs = getReadyWhenInputs(
    task,
    projectGraph,
    projects,
    workspaceRoot
  );
  return inputs && checkReadyWhen(inputs.readyWhen, task.id, inputs.data);
}

// Placeholders resolve against the options the executor receives: aliases,
// schema defaults and the spelling of command-line overrides applied
function getReadyWhenInputs(
  task: Task,
  projectGraph: ProjectGraph,
  projects: Record<string, ProjectConfiguration>,
  workspaceRoot: string
) {
  const readyWhen = getReadyWhenConfig(task, projectGraph);
  if (readyWhen == null) {
    return null;
  }
  const node = projectGraph.nodes[task.target.project];
  const target = node.data.targets[task.target.target];
  const { schema } = getExecutorForTask(task, projects);
  const options = combineOptionsForExecutor(
    task.overrides as Options,
    task.target.configuration ?? target.defaultConfiguration,
    target,
    schema,
    task.target.project,
    relative(task.projectRoot ?? workspaceRoot, process.cwd()),
    process.env.NX_VERBOSE_LOGGING === 'true'
  );
  return {
    readyWhen,
    data: {
      workspaceRoot,
      projectRoot: node.data.root,
      projectName: node.name,
      options,
    },
  };
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
