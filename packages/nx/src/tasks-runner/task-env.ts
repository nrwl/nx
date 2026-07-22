import { config as loadDotEnvFile } from 'dotenv';
import { expand } from 'dotenv-expand';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectGraph } from '../config/project-graph';
import { Task } from '../config/task-graph';
import { workspaceRoot } from '../utils/workspace-root';
import { getEnvPathsForTask } from './task-env-paths';

/**
 * Resolves the FORCE_COLOR value for forked child processes.
 *
 * When the user sets FORCE_COLOR=0, bin/nx.ts deletes it from process.env
 * (workaround for picocolors treating "0" as truthy) and saves the original
 * value in NX_ORIGINAL_FORCE_COLOR. Without this check, the undefined
 * FORCE_COLOR would default to 'true', re-enabling colors in all children.
 */
export function getForceColorForChild(): string {
  if (process.env.FORCE_COLOR !== undefined) {
    return process.env.FORCE_COLOR;
  }
  if (process.env.NX_ORIGINAL_FORCE_COLOR === '0') {
    return '0';
  }
  return 'true';
}

// ── .env parse cache ──────────────────────────────────────────────────────────
// Keyed by the joined file path(s). Invalidated when any file's mtime changes
// (the signature encodes every file's path + mtime). We cache only the raw
// parsed key=value pairs (pre-expansion). Variable expansion (${FOO}
// substitutions) still runs live because it depends on the per-task processEnv
// context which differs between tasks.
interface DotEnvCacheEntry {
  signature: string;
  parsed: Record<string, string>;
}
const dotEnvParseCache = new Map<string, DotEnvCacheEntry>();

export function getEnvVariablesForBatchProcess(
  skipNxCache: boolean,
  captureStderr: boolean
): NodeJS.ProcessEnv {
  const res = {
    // User Process Env Variables override Dotenv Variables
    ...process.env,
    // Nx Env Variables overrides everything
    ...getNxEnvVariablesForForkedProcess(
      getForceColorForChild(),
      skipNxCache,
      captureStderr
    ),
  };
  // NX_ORIGINAL_FORCE_COLOR is an internal signal and should not leak into child processes
  delete res.NX_ORIGINAL_FORCE_COLOR;
  return res;
}

// The orchestrator now calls this eagerly during the coordinator pre-hash
// in addition to processTask (and again in hashBatchTasks), so the same
// task hits this function multiple times per run. Each call reads 3+ .env
// files from disk — memoize by task.id to skip the repeat work.
//
// Cache lifetime is the current Nx invocation: the function is only called
// from CLI/orchestrator code (not the long-lived daemon), so the map is
// scoped to a single run. Callers must not mutate the returned env — they
// already spread it into new objects before adding task-specific overrides
// (see getEnvVariablesForTask).
const taskSpecificEnvCache = new Map<string, NodeJS.ProcessEnv>();

export function getTaskSpecificEnv(task: Task, graph: ProjectGraph) {
  const cached = taskSpecificEnvCache.get(task.id);
  if (cached) return cached;

  // Unload any dot env files at the root of the workspace that were loaded on init of Nx.
  const taskEnv = unloadDotEnvFiles({ ...process.env });
  const env =
    process.env.NX_LOAD_DOT_ENV_FILES === 'true'
      ? loadDotEnvFilesForTask(task, graph, taskEnv)
      : // If not loading dot env files, ensure env vars created by system are still loaded
        taskEnv;
  taskSpecificEnvCache.set(task.id, env);
  return env;
}

export function getEnvVariablesForTask(
  task: Task,
  taskSpecificEnv: NodeJS.ProcessEnv,
  forceColor: string,
  skipNxCache: boolean,
  captureStderr: boolean,
  outputPath: string,
  streamOutput: boolean
): NodeJS.ProcessEnv {
  const res = {
    // Start With Dotenv Variables
    ...taskSpecificEnv,
    // Nx Env Variables overrides everything
    ...getNxEnvVariablesForTask(
      task,
      forceColor,
      skipNxCache,
      captureStderr,
      outputPath,
      streamOutput
    ),
  };

  // we have to delete it because if we invoke Nx from within Nx, we need to reset those values
  if (!outputPath) {
    delete res.NX_TERMINAL_OUTPUT_PATH;
    delete res.NX_STREAM_OUTPUT;
    delete res.NX_PREFIX_OUTPUT;
  }
  // we don't reset NX_BASE or NX_HEAD because those are set by the user and should be preserved
  delete res.NX_SET_CLI;
  // NX_ORIGINAL_FORCE_COLOR is an internal signal used by getForceColorForChild()
  // and should not leak into child processes
  delete res.NX_ORIGINAL_FORCE_COLOR;
  return res;
}

function getNxEnvVariablesForForkedProcess(
  forceColor: string,
  skipNxCache: boolean,
  captureStderr: boolean,
  outputPath?: string,
  streamOutput?: boolean
) {
  const env: NodeJS.ProcessEnv = {
    FORCE_COLOR: forceColor,
    NX_WORKSPACE_ROOT: workspaceRoot,
    NX_SKIP_NX_CACHE: skipNxCache ? 'true' : undefined,
  };

  if (outputPath) {
    env.NX_TERMINAL_OUTPUT_PATH = outputPath;
    if (captureStderr) {
      env.NX_TERMINAL_CAPTURE_STDERR = 'true';
    }
    if (streamOutput) {
      env.NX_STREAM_OUTPUT = 'true';
    }
  }
  return env;
}

function getNxEnvVariablesForTask(
  task: Task,
  forceColor: string,
  skipNxCache: boolean,
  captureStderr: boolean,
  outputPath: string,
  streamOutput: boolean
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NX_TASK_TARGET_PROJECT: task.target.project,
    NX_TASK_TARGET_TARGET: task.target.target,
    NX_TASK_TARGET_CONFIGURATION: task.target.configuration ?? undefined,
    NX_TASK_HASH: task.hash,
    // used when Nx is invoked via Lerna
    LERNA_PACKAGE_NAME: task.target.project,
  };

  // TODO: remove this once we have a reasonable way to configure it
  if (task.target.target === 'test') {
    env.NX_TERMINAL_CAPTURE_STDERR = 'true';
  }

  // Pass the root Nx process PID to nested processes for DB-based loop detection.
  // The root PID is used as a key in the task_invocations table to track which tasks
  // have been invoked across nested Nx processes.

  return {
    ...getNxEnvVariablesForForkedProcess(
      forceColor,
      skipNxCache,
      captureStderr,
      outputPath,
      streamOutput
    ),
    ...env,
    // Ensure the TUI does not get spawned within the TUI if ever tasks invoke Nx again
    NX_TUI: 'false',
    // tracks the root PID for child nx tasks, used to verify nx is infinitely recursing through the same tasks
    NX_INVOCATION_ROOT_PID:
      process.env.NX_INVOCATION_ROOT_PID ?? String(process.pid),
  };
}

/**
 * This function loads one or more .env files and expands the variables in them.
 * When multiple files are provided, all files are loaded first, then variable
 * expansion happens once with the complete set of variables. This ensures
 * cross-file variable references resolve correctly.
 * @param filename the .env file(s) to load
 * @param environmentVariables the object to load environment variables into
 * @param override whether to override existing environment variables
 *
 * Parsed file content is cached in-process keyed by (path, mtime). Repeated
 * calls for the same unchanged file skip the file read and re-parse. Variable
 * expansion still runs live since it depends on the caller's env context.
 */
export function loadAndExpandDotEnvFile(
  filename: string | string[],
  environmentVariables: NodeJS.ProcessEnv,
  override = false
) {
  const files = Array.isArray(filename) ? filename : [filename];
  const cacheKey = files.join('\0');
  let signature: string;
  try {
    // Encode every file's path + mtime so the entry invalidates if any change.
    signature = files.map((f) => `${f}:${statSync(f).mtimeMs}`).join('|');
  } catch {
    // Could not stat a file (e.g. it does not exist). Fall back to dotenv's own
    // handling — which returns `{ error }` for a missing file — so callers that
    // inspect `result.error` (e.g. a missing required `envFile`) still observe
    // it. Skip caching since there is no valid mtime signature to key on.
    const myEnv = loadDotEnvFile({
      path: filename,
      processEnv: environmentVariables,
      override,
    });
    return expand({ ...myEnv, processEnv: environmentVariables });
  }

  const cached = dotEnvParseCache.get(cacheKey);
  if (cached && cached.signature === signature) {
    // Cache hit: apply pre-parsed content to environmentVariables, then expand.
    applyParsedToEnv(cached.parsed, environmentVariables, override);
    return expand({ parsed: cached.parsed, processEnv: environmentVariables });
  }

  // Cache miss: let dotenv read + parse the file(s), then store the parsed result.
  const myEnv = loadDotEnvFile({
    path: filename,
    processEnv: environmentVariables,
    override,
  });
  if (myEnv.parsed) {
    dotEnvParseCache.set(cacheKey, { signature, parsed: myEnv.parsed });
  }
  return expand({ ...myEnv, processEnv: environmentVariables });
}

/** Replicate dotenv's apply-to-processEnv step for cache-hit paths. */
function applyParsedToEnv(
  parsed: Record<string, string>,
  processEnv: NodeJS.ProcessEnv,
  override: boolean
) {
  for (const key of Object.keys(parsed)) {
    if (override || !Object.prototype.hasOwnProperty.call(processEnv, key)) {
      processEnv[key] = parsed[key];
    }
  }
}

/**
 * This function unloads a .env file and removes the variables in it from the environmentVariables.
 * @param filename
 * @param environmentVariables
 */
export function unloadDotEnvFile(
  filename: string,
  environmentVariables: NodeJS.ProcessEnv,
  override = false
) {
  const parsedDotEnvFile: NodeJS.ProcessEnv = {};
  loadAndExpandDotEnvFile(filename, parsedDotEnvFile, override);
  Object.keys(parsedDotEnvFile).forEach((envVarKey) => {
    if (environmentVariables[envVarKey] === parsedDotEnvFile[envVarKey]) {
      delete environmentVariables[envVarKey];
    }
  });
}

function getOwnerTargetForTask(
  task: Task,
  graph: ProjectGraph
): [string, string?] {
  const project = graph.nodes[task.target.project];
  if (project.data.metadata?.targetGroups) {
    for (const targets of Object.values(project.data.metadata.targetGroups)) {
      if (targets.includes(task.target.target)) {
        for (const target of targets) {
          if (project.data.targets[target].metadata?.nonAtomizedTarget) {
            return [
              target,
              project.data.targets[target].metadata?.nonAtomizedTarget,
            ];
          }
        }
      }
    }
  }
  return [task.target.target];
}

export function getEnvFilesForTask(task: Task, graph: ProjectGraph): string[] {
  const [target, nonAtomizedTarget] = getOwnerTargetForTask(task, graph);

  return getEnvPathsForTask(
    task.projectRoot,
    target,
    task.target.configuration,
    nonAtomizedTarget
  );
}

function loadDotEnvFilesForTask(
  task: Task,
  graph: ProjectGraph,
  environmentVariables: NodeJS.ProcessEnv
) {
  const dotEnvFiles = getEnvFilesForTask(task, graph);
  loadAndExpandDotEnvFile(
    dotEnvFiles.map((file) => join(workspaceRoot, file)),
    environmentVariables
  );
  return environmentVariables;
}

function unloadDotEnvFiles(environmentVariables: NodeJS.ProcessEnv) {
  for (const file of ['.env', '.local.env', '.env.local']) {
    unloadDotEnvFile(join(workspaceRoot, file), environmentVariables);
  }
  return environmentVariables;
}
