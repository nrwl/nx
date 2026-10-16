import { fork } from 'node:child_process';
import { cpus } from 'node:os';
import { extname, join } from 'node:path';
import { hashArray, hashFile } from '../../hasher/file-hasher';
import { getEnvPathsForTask } from '../../tasks-runner/task-env-paths';
import { workspaceRoot } from '../../utils/workspace-root';

/**
 * The messages the evaluation worker sends. Tagged because the evaluated
 * module can call `process.send` itself.
 */
export type TaskEnvEvaluationMessage =
  | { type: 'nx-task-env-evaluation-result'; result: unknown }
  | { type: 'nx-task-env-evaluation-error'; error: string };

// An evaluation can hold a whole config module graph in memory
const MAX_CONCURRENT_EVALUATIONS = Math.max(1, Math.min(cpus().length, 8));
const EVALUATION_TIMEOUT = 30_000;
const MAX_STDERR = 8192;

let activeEvaluations = 0;
const evaluationQueue: Array<() => void> = [];

/**
 * Calls the `exportName` function of `modulePath` with `args` the way a task
 * process would: in `cwd`, with exactly `env` as its environment and no node
 * options. It runs in this process only when this process already matches all
 * three, and otherwise in a fresh one, so modules an earlier evaluation cached
 * and env it wrote cannot leak in. `args` must be JSON-serializable and the
 * result structured-cloneable.
 */
export async function evaluateUnderTaskEnv<T>(
  modulePath: string,
  exportName: string,
  args: unknown[],
  { cwd, env }: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<T> {
  if (
    cwd === process.cwd() &&
    process.execArgv.length === 0 &&
    isSameEnv(env, process.env)
  ) {
    return await require(modulePath)[exportName](...args);
  }
  // `while`: a caller arriving between a release and the woken waiter's resume
  // can take the slot first
  while (activeEvaluations >= MAX_CONCURRENT_EVALUATIONS) {
    await new Promise<void>((resolve) => evaluationQueue.push(resolve));
  }
  activeEvaluations++;
  try {
    return (await forkEvaluation(modulePath, exportName, args, cwd, env)) as T;
  } finally {
    activeEvaluations--;
    evaluationQueue.shift()?.();
  }
}

/**
 * Hashes the dotenv files the tasks of `targets` load. A cache of what an
 * evaluation under their env returned has to cover them, and the project file
 * hashes miss root and gitignored ones.
 */
export function hashTaskDotEnvFiles(
  projectRoot: string,
  targets: string[]
): string {
  const files = new Set(
    targets.flatMap((target) => getEnvPathsForTask(projectRoot, target))
  );
  const parts: string[] = [];
  for (const file of files) {
    const hash = hashFile(join(workspaceRoot, file));
    if (hash !== null) {
      parts.push(file, hash);
    }
  }
  return hashArray(parts);
}

function isSameEnv(a: NodeJS.ProcessEnv, b: NodeJS.ProcessEnv): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

function isWorkerMessage(
  message: unknown
): message is TaskEnvEvaluationMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const candidate = message as { type?: unknown; error?: unknown };
  return (
    candidate.type === 'nx-task-env-evaluation-result' ||
    (candidate.type === 'nx-task-env-evaluation-error' &&
      typeof candidate.error === 'string')
  );
}

function forkEvaluation(
  modulePath: string,
  exportName: string,
  args: unknown[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const isWorkerTypescript = extname(__filename) === '.ts';
    const child = fork(
      join(
        __dirname,
        `evaluate-under-task-env-worker.${isWorkerTypescript ? 'ts' : 'js'}`
      ),
      [modulePath, exportName, JSON.stringify(args)],
      {
        cwd,
        env,
        execArgv: isWorkerTypescript
          ? ['--require', require.resolve('@swc-node/register')]
          : [],
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        // Keeps values JSON would turn into null, such as a NaN port
        serialization: 'advanced',
      }
    );
    let stderr = '';
    // Keeps the end, where a crash prints its reason
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-MAX_STDERR);
    });
    const withStderr = (message: string) => {
      const tail = stderr.trim();
      return tail ? `${message}\n${tail}` : message;
    };
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      child.removeAllListeners();
      if (child.connected) {
        child.disconnect();
      }
      fn();
    };
    const timer = setTimeout(() => {
      // The evaluated module can handle SIGTERM and keep running
      child.kill('SIGKILL');
      finish(() =>
        reject(new Error(withStderr(`Timed out evaluating ${modulePath}`)))
      );
    }, EVALUATION_TIMEOUT);

    child.on('message', (message: unknown) => {
      if (!isWorkerMessage(message)) {
        return;
      }
      switch (message.type) {
        case 'nx-task-env-evaluation-error':
          finish(() => reject(new Error(withStderr(message.error))));
          break;
        case 'nx-task-env-evaluation-result':
          finish(() => resolve(message.result));
          break;
        default: {
          const unhandled: never = message;
          throw new Error(
            `Unhandled worker message ${JSON.stringify(unhandled)}`
          );
        }
      }
    });
    child.on('error', (error) => finish(() => reject(error)));
    // `close` rather than `exit` so the folded stderr has fully flushed
    child.on('close', (code, signal) => {
      finish(() =>
        reject(
          new Error(
            withStderr(
              `The process evaluating ${modulePath} exited with ${
                signal ?? `code ${code}`
              } before returning a result`
            )
          )
        )
      );
    });
  });
}
