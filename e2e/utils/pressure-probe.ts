// Temporary CI diagnostics for the e2e flake investigation. Never merge.
//
// Records when each harness command runs and how it ends, and keeps the
// agent-wide sampler in scripts/ci-pressure-probe/probe.mjs alive. The report
// printed at teardown joins both. Nothing here may change test behavior: every
// call swallows its own errors and only writes to stdout and /tmp.
import { execFileSync, spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
// `import * as` would wrap is-ci's boolean in a namespace object that is always truthy.
import isCI from 'is-ci';
import { trimDaemonLog } from './log-utils';

const PROBE_SCRIPT = join(
  __dirname,
  '../../scripts/ci-pressure-probe/probe.mjs'
);
const DIR = '/tmp/nx-pressure-probe';
const PIDFILE = join(DIR, 'sampler.pid');
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export type ProbeFn =
  | 'runCLI'
  | 'runCommand'
  | 'runCommandAsync'
  | 'packageInstall'
  | 'pnpmReinstall'
  | 'createWorkspace'
  | 'newProject'
  | 'templateExtract'
  | 'nxReset'
  | 'backupCopy'
  | 'moveIntoPlace'
  | 'restoreCopy'
  | 'cypressVerify'
  | 'cypressInstall'
  | 'cypressWait'
  | 'playwrightInstall'
  | 'playwrightWait';

interface ProbeToken {
  id: string;
  taskId: string;
  fn: ProbeFn;
  cmd: string;
  cwd: string;
  t0: number;
  pid: number;
  timeoutMs: number | null;
  test: string | null;
  ended: boolean;
}

const probedErrors = new WeakSet<object>();
let seq = 0;

// CI runs every e2e task as an atomized e2e-ci target, which also covers agents that do not set CI.
function enabled(): boolean {
  return (
    process.platform === 'linux' &&
    (isCI || (process.env.NX_TASK_TARGET_TARGET ?? '').startsWith('e2e-ci')) &&
    process.env.NX_PRESSURE_PROBE !== 'false'
  );
}

function taskId(): string | null {
  return process.env.NX_PRESSURE_PROBE_TASK ?? null;
}

// Same rules as redact() in scripts/ci-pressure-probe/probe.mjs.
function redact(s: string): string {
  return s
    .replace(
      /((?:token|password|passwd|secret|auth|api[-_]?key|[-_]key|credential|signature)[\w-]*["']?\s*[=: ]\s*)(?:(?:bearer|basic|token)\s+)?(?:"[^"]*"|'[^']*'|[^\s"']+)/gi,
      '$1<redacted>'
    )
    .replace(/\beyJ[\w-]{5,}\.[\w-]{5,}\.[\w-]+/g, '<redacted>')
    .replace(/\b(bearer|basic)\s+[\w.~+/=-]+/gi, '$1 <redacted>')
    .replace(/\/\/[^/\s:@]+:[^/\s@]+@/g, '//<redacted>@')
    .replace(
      /\b(?:npm_\w{36}|gh[opsur]_\w{36,}|github_pat_\w{20,})\b/g,
      '<redacted>'
    );
}

function currentTestName(): string | null {
  try {
    return (globalThis as any).expect?.getState?.().currentTestName ?? null;
  } catch {
    return null;
  }
}

function samplerAlive(): boolean {
  try {
    const pid = Number(readFileSync(PIDFILE, 'utf-8'));
    if (!pid) return false;
    process.kill(pid, 0);
    return readFileSync(`/proc/${pid}/cmdline`, 'utf-8').includes(
      'ci-pressure-probe/probe.mjs'
    );
  } catch {
    return false;
  }
}

// The sampler can die (killed with a finished task's process tree, or idle
// exit), so every command checks it. Two pidfile reads; the sampler's own
// pidfile claim settles concurrent respawns.
function ensureSampler() {
  if (samplerAlive()) return;
  const env = { ...process.env };
  for (const k of Object.keys(env)) {
    if (k.startsWith('NX_TASK_') || k === 'NX_PRESSURE_PROBE_TASK') {
      delete env[k];
    }
  }
  spawnDetached([PROBE_SCRIPT, 'daemon', String(Date.now())], env);
}

// A failed spawn reports through an async 'error' event; unhandled, it would crash Jest.
function spawnDetached(args: string[], env = process.env) {
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    cwd: '/',
    env,
  });
  child.on('error', () => {});
  child.unref();
}

/** Called first in the jest global setup. */
export function startPressureProbe() {
  if (!enabled()) return;
  try {
    const id = `${(process.env.NX_TASK_HASH ?? 'nohash').slice(0, 16)}-${process.pid}`;
    process.env.NX_PRESSURE_PROBE_TASK = id;
    process.env.NX_PRESSURE_PROBE_START = String(Date.now());
    execFileSync(process.execPath, [PROBE_SCRIPT, 'start'], {
      stdio: ['ignore', 'inherit', 'inherit'],
      timeout: 20_000,
    });
    mkdirSync(join(DIR, 'active'), { recursive: true });
    writeFileSync(
      join(DIR, 'active', `${id}.json`),
      JSON.stringify({
        taskId: id,
        pid: process.pid,
        task: `${process.env.NX_TASK_TARGET_PROJECT}:${process.env.NX_TASK_TARGET_TARGET}`,
        t: Date.now(),
      })
    );
  } catch (e) {
    probeError('start', e);
  }
}

/**
 * Prints what this Jest run leaves on disk: the pnpm store that installs under
 * /tmp use, each of the run's cache dirs, and the e2e roots of this process.
 * Called before the e2e teardown.
 */
export function reportSuiteDisk() {
  if (!enabled()) return;
  try {
    // One budget for the whole report, so a loaded disk cannot stall teardown.
    const deadline = Date.now() + 60_000;
    const run = (cmd: string, args: string[]) => {
      const timeout = Math.min(30_000, deadline - Date.now());
      if (timeout <= 0) throw new Error('suite-disk budget spent');
      return execFileSync(cmd, args, {
        cwd: tmpdir(),
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout,
      }).trim();
    };
    const size = (dir: string) => {
      if (!existsSync(dir)) return null;
      const t0 = Date.now();
      try {
        return {
          kb: Number(run('du', ['-sk', dir]).split(/\s/)[0]),
          inodes: Number(run('du', ['-s', '--inodes', dir]).split(/\s/)[0]),
          scanMs: Date.now() - t0,
        };
      } catch {
        return { failed: true, scanMs: Date.now() - t0 };
      }
    };
    // Only plain absolute paths are printed; anything else pnpm prints is dropped.
    const plainPath = (p: string | undefined) =>
      p === undefined ? null : /^\/[\w./-]+$/.test(p) ? p : '<unexpected>';
    const storeDir = plainPath(
      run('pnpm', ['store', 'path']).split('\n').pop()
    );
    const cacheRoot = process.env.npm_config_cache
      ? dirname(process.env.npm_config_cache)
      : null;
    const store = storeDir?.startsWith('/')
      ? { dir: storeDir, ...size(storeDir) }
      : { dir: storeDir };
    const caches: Record<string, unknown> = {};
    if (cacheRoot && existsSync(cacheRoot))
      for (const name of readdirSync(cacheRoot)) {
        const dir = join(cacheRoot, name);
        caches[name] = storeDir?.startsWith(`${dir}/`) ? 'store' : size(dir);
      }
    // tmp's dirSync names e2e roots `nx-e2e--<pid>-<random>`.
    const roots: Record<string, unknown> = {};
    for (const name of readdirSync(tmpdir()))
      if (name.startsWith(`nx-e2e--${process.pid}-`))
        roots[name] = size(join(tmpdir(), name));
    process.stdout.write(
      `[pressure-probe] ${JSON.stringify({
        kind: 'suite-disk',
        t: Date.now(),
        task: taskId(),
        pid: process.pid,
        envStoreDir: plainPath(process.env.pnpm_config_store_dir),
        store,
        cacheRoot: plainPath(cacheRoot ?? undefined),
        caches,
        roots,
      })}\n`
    );
  } catch (e) {
    probeError('suite-disk', e);
  }
}

const PNPM_PROGRESS_RE =
  /Progress: resolved (\d+), reused (\d+), downloaded (\d+), added (\d+), done/g;

/** Sums pnpm's final progress line of every install in a command's output. */
function pnpmInstallSummary(output: unknown) {
  if (typeof output !== 'string') return undefined;
  const sum = { installs: 0, resolved: 0, reused: 0, downloaded: 0, added: 0 };
  for (const m of output.matchAll(PNPM_PROGRESS_RE)) {
    sum.installs++;
    sum.resolved += Number(m[1]);
    sum.reused += Number(m[2]);
    sum.downloaded += Number(m[3]);
    sum.added += Number(m[4]);
  }
  return sum.installs ? sum : undefined;
}

/** Records one step of a harness function. Returns and throws what `run` does. */
export function probeStep<T>(
  fn: ProbeFn,
  command: string,
  cwd: string,
  run: () => T
): T {
  const token = probeCommandStart(fn, command, cwd);
  let result: T;
  try {
    result = run();
  } catch (e) {
    probeCommandEnd(token, e);
    throw e;
  }
  probeCommandEnd(token);
  return result;
}

/** Called last in the jest global teardown. */
export function reportPressureProbe() {
  const id = taskId();
  if (!enabled() || !id) return;
  try {
    unlinkSync(join(DIR, 'active', `${id}.json`));
  } catch {}
  try {
    execFileSync(
      process.execPath,
      [PROBE_SCRIPT, 'report', id, process.env.NX_PRESSURE_PROBE_START ?? '0'],
      { stdio: ['ignore', 'inherit', 'inherit'], timeout: 90_000 }
    );
  } catch (e) {
    probeError('report', e);
  }
}

export function probeCommandStart(
  fn: ProbeFn,
  command: string,
  cwd: string,
  timeoutMs?: number
): ProbeToken | null {
  const task = taskId();
  if (!enabled() || !task) return null;
  try {
    const token: ProbeToken = {
      id: `${task}-${process.pid}-${++seq}`,
      taskId: task,
      fn,
      cmd: redact(command).slice(0, 400),
      cwd,
      t0: Date.now(),
      pid: process.pid,
      timeoutMs: timeoutMs ?? null,
      test: currentTestName(),
      ended: false,
    };
    for (const d of ['running', 'tasks', 'forensics']) {
      mkdirSync(join(DIR, d), { recursive: true });
    }
    writeFileSync(
      join(DIR, 'running', `${token.id}.json`),
      JSON.stringify(token)
    );
    ensureSampler();
    return token;
  } catch (e) {
    probeError('command-start', e);
    return null;
  }
}

/**
 * Records how a command ended. Pass `failureOutput` only where the harness
 * throws the failure at the test: it snapshots the agent in the background and
 * prints the workspace daemon log. Expected failures (silenceError, a
 * non-throwing return) pass none.
 */
export function probeCommandEnd(
  token: ProbeToken | null,
  error?: any,
  failureOutput?: string,
  // Read only for pnpm's install counts; never printed.
  output?: unknown
) {
  if (!token || token.ended) return;
  token.ended = true;
  try {
    try {
      unlinkSync(join(DIR, 'running', `${token.id}.json`));
    } catch {}
    const timedOut = !!(error && (error.killed || error.signal));
    const forensics = failureOutput !== undefined;
    const { ended, ...rest } = token;
    appendFileSync(
      join(DIR, 'tasks', `${token.taskId}.ndjson`),
      JSON.stringify({
        ...rest,
        t: token.t0,
        t1: Date.now(),
        outcome: !error
          ? 'ok'
          : timedOut
            ? 'killed'
            : forensics
              ? 'failed'
              : 'nonzero',
        status: error?.status ?? error?.code ?? null,
        signal: error?.signal ?? null,
        forensics,
        pnpm: pnpmInstallSummary(output ?? failureOutput),
      }) + '\n'
    );
    if (!forensics) return;
    if (error && typeof error === 'object') probedErrors.add(error);
    const outputFile = join(DIR, 'forensics', `${token.id}.out`);
    writeFileSync(outputFile, failureOutput.slice(-MAX_OUTPUT_BYTES));
    spawnDetached([
      PROBE_SCRIPT,
      'forensics',
      token.id,
      join(DIR, 'forensics', `${token.id}.ndjson`),
      token.cwd,
      outputFile,
    ]);
    printDaemonLog(token);
  } catch (e) {
    probeError('command-end', e);
  }
}

/** True for an error a nested command already recorded with forensics. */
export function wasProbed(error: unknown): boolean {
  return !!error && typeof error === 'object' && probedErrors.has(error);
}

function printDaemonLog(token: ProbeToken) {
  if (!['runCLI', 'runCommand', 'runCommandAsync'].includes(token.fn)) return;
  for (const name of ['daemon.log', 'daemon-error.log']) {
    const file = join(token.cwd, '.nx/workspace-data/d', name);
    if (!existsSync(file)) continue;
    const trimmed = redact(
      trimDaemonLog(readFileSync(file, 'utf-8'), 40)
        .split('\n')
        .slice(-200)
        .join('\n')
    );
    process.stdout.write(
      `[pressure-probe] ${JSON.stringify({ kind: 'daemon-log', id: token.id, file: name })}\n${trimmed}\n[pressure-probe] ${JSON.stringify({ kind: 'daemon-log-end', id: token.id })}\n`
    );
  }
}

function probeError(phase: string, e: unknown) {
  try {
    process.stdout.write(
      `[pressure-probe] ${JSON.stringify({ kind: 'probe-error', phase, error: String((e as Error)?.stack ?? e).slice(0, 1000) })}\n`
    );
  } catch {}
}
