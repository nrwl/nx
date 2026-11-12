import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { release } from 'node:os';
import { dirname, join } from 'node:path';
import { workspaceDataDirectory } from '../../../utils/cache-directory';
import { NX_USER_TMP_DIR } from '../../../utils/nx-tmp-dir';
import {
  ensureOwnedPrivateDir,
  ensureSafeSharedRoot,
} from '../../../utils/owned-private-dir';

/**
 * Records which files an isolated plugin worker, and every process it starts,
 * opens for reading. The tracer is a library injected into the process tree:
 * `LD_PRELOAD` on Linux, `DYLD_INSERT_LIBRARIES` on macOS, and a launcher that
 * injects a DLL on Windows. Each traced process appends one line per
 * successful read-open to the worker's log. Sources are in
 * `src/native/fstrace`, built by `scripts/build-fstrace-shim.mjs` into the
 * platform packages.
 */

export interface WorkerCommand {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export interface TracedWorkerCommand extends WorkerCommand {
  logPath: string;
}

const nativeDir = join(__dirname, '../../../native');

/** Directory the worker logs live in, also used to tell nx's files from a plugin's. */
export const READ_LOG_DIR = join(workspaceDataDirectory, 'plugin-reads');

function windowsArch(): string | null {
  return (
    { arm64: 'arm64', x64: 'x64', ia32: 'x86' }[process.arch as string] ?? null
  );
}

function tracerFileName(): string | null {
  switch (process.platform) {
    case 'darwin':
      return 'fstrace.darwin.dylib';
    case 'linux':
      return 'fstrace.linux.so';
    case 'win32': {
      const arch = windowsArch();
      return arch ? `fstrace-${arch}.exe` : null;
    }
    default:
      return null;
  }
}

/** The platform packages that ship a tracer for this process, in lookup order. */
function tracerPackages(): string[] {
  switch (process.platform) {
    case 'darwin':
      return [`@nx/nx-darwin-${process.arch}`];
    case 'linux':
      return process.arch === 'arm'
        ? ['@nx/nx-linux-arm-gnueabihf']
        : [
            `@nx/nx-linux-${process.arch}-gnu`,
            `@nx/nx-linux-${process.arch}-musl`,
          ];
    case 'win32':
      return [`@nx/nx-win32-${process.arch}-msvc`];
    default:
      return [];
  }
}

let tracerPath: string | null | undefined;

/** The tracer for this platform: next to a local native build, else in the platform package. */
export function findTracer(): string | null {
  if (tracerPath !== undefined) {
    return tracerPath;
  }
  tracerPath = null;
  const file = tracerFileName();
  if (!file) {
    return tracerPath;
  }
  const candidates = [join(nativeDir, file)];
  for (const pkg of tracerPackages()) {
    try {
      candidates.push(
        join(dirname(require.resolve(`${pkg}/package.json`)), file)
      );
    } catch {
      // Not installed for this platform variant.
    }
  }
  tracerPath = candidates.find((c) => existsSync(c)) ?? null;
  return tracerPath;
}

export function isReadTracingEnabled(): boolean {
  return (
    process.env.NX_PLUGIN_READ_TRACING !== 'false' &&
    process.env.NX_CACHE_PROJECT_GRAPH !== 'false' &&
    findTracer() !== null
  );
}

/**
 * Owner-only directory for ad-hoc re-signed copies of binaries dyld strips
 * `DYLD_INSERT_LIBRARIES` for, or `null` when it cannot be established, in
 * which case tracing stops at those binaries and the run reports itself
 * incomplete. Traced processes execute what is in here, so it is held to the
 * native file cache's bar. One directory per kernel release, so an OS update
 * starts clean.
 */
function ensureSipCopyDir(): string | null {
  const root = join(NX_USER_TMP_DIR, 'sip-copies');
  const userRoot = dirname(root);
  if (ensureSafeSharedRoot(dirname(userRoot)).status !== 'ok') {
    return null;
  }
  const releaseDir = join(root, release());
  for (const dir of [userRoot, root, releaseDir]) {
    if (ensureOwnedPrivateDir(dir).status !== 'ok') {
      return null;
    }
  }
  return releaseDir;
}

/** Quotes one argument the way `CommandLineToArgvW` reads it back. */
export function quoteWindowsArg(arg: string): string {
  if (arg && !/[\s"]/.test(arg)) {
    return arg;
  }
  let out = '"';
  let backslashes = 0;
  for (const ch of arg) {
    if (ch === '\\') {
      backslashes++;
      continue;
    }
    out += '\\'.repeat(ch === '"' ? backslashes * 2 + 1 : backslashes) + ch;
    backslashes = 0;
  }
  return out + '\\'.repeat(backslashes * 2) + '"';
}

/**
 * Rewrites a worker spawn so its process tree is traced into a fresh log, or
 * returns `null` when tracing is unavailable and the worker runs as before.
 */
export function traceWorkerCommand(
  worker: WorkerCommand,
  id: string
): TracedWorkerCommand | null {
  if (!isReadTracingEnabled()) {
    return null;
  }
  const tracer = findTracer();
  mkdirSync(READ_LOG_DIR, { recursive: true });
  removeStaleReadLogs();
  const logPath = join(READ_LOG_DIR, `${id}.log`);
  // The tracers append to the log and never create it.
  writeFileSync(logPath, '');

  const env: NodeJS.ProcessEnv = { ...worker.env, FSTRACE_OUT: logPath };

  switch (process.platform) {
    case 'linux':
      env.LD_PRELOAD = [tracer, worker.env.LD_PRELOAD]
        .filter(Boolean)
        .join(' ');
      return { ...worker, env, logPath };
    case 'darwin': {
      env.DYLD_INSERT_LIBRARIES = [tracer, worker.env.DYLD_INSERT_LIBRARIES]
        .filter(Boolean)
        .join(':');
      const sipDir = ensureSipCopyDir();
      if (sipDir) {
        env.FSTRACE_SIP_DIR = sipDir;
      }
      return { ...worker, env, logPath };
    }
    case 'win32':
      return {
        command: tracer,
        args: [
          'trace',
          logPath,
          [worker.command, ...worker.args].map(quoteWindowsArg).join(' '),
        ],
        env,
        logPath,
      };
    default:
      return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e?.code === 'EPERM';
  }
}

let staleLogsRemoved = false;

/**
 * Logs are named after the host's pid, as worker socket ids are, so a log
 * whose host is gone belongs to a worker that was never shut down cleanly.
 */
function removeStaleReadLogs(): void {
  if (staleLogsRemoved) {
    return;
  }
  staleLogsRemoved = true;
  for (const name of readdirSync(READ_LOG_DIR)) {
    const pid = Number(name.split('-')[0]);
    if (pid && pid !== process.pid && !isAlive(pid)) {
      rmSync(join(READ_LOG_DIR, name), { force: true });
    }
  }
}

export function removeReadLog(logPath: string): void {
  rmSync(logPath, { force: true });
}
