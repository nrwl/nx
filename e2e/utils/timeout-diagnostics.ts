import { execSync } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Diagnostics for the `Command timed out after 300s` flake: an nx command whose
 * tasks all printed their final output, yet a task child (observed: `rollup -c`)
 * never exits, so the client waits until the harness kills it.
 *
 * Every node process the command spawns preloads dump-handles.js. On timeout,
 * {@link collectTimeoutDiagnostics} finds the survivors by cwd, asks each to
 * dump its live handles, and reports them next to `/proc` state — then kills
 * them so they cannot outlive the test.
 */

// Per test-runner process: pids get reused across runs, so a shared dir could
// surface a stale dump from an earlier run as this run's survivor.
const dumpDir = join(tmpdir(), 'nx-e2e-handle-dumps', String(process.pid));

/** Env that makes {@link collectTimeoutDiagnostics} able to read a survivor. */
export function timeoutDiagnosticsEnv(): Record<string, string> {
  mkdirSync(dumpDir, { recursive: true });
  const preload = `--require ${join(__dirname, 'dump-handles.js')}`;
  return {
    NODE_OPTIONS: [process.env.NODE_OPTIONS, preload].filter(Boolean).join(' '),
    NX_E2E_HANDLE_DUMP_DIR: dumpDir,
  };
}

/**
 * Returns a report on every process still running with a cwd under
 * `projectPath`, or '' when there is nothing to report (or not on Linux, where
 * `/proc` is what makes cwd-based discovery possible).
 */
export function collectTimeoutDiagnostics(projectPath: string): string {
  if (process.platform !== 'linux') return '';

  const survivors = findProcessesUnder(projectPath);
  if (survivors.length === 0) {
    return '\n\nNo surviving processes with a cwd under the e2e project.';
  }

  for (const pid of survivors) {
    try {
      process.kill(pid, 'SIGUSR2');
    } catch {
      // already gone
    }
  }
  // Give the preload a moment to write; the handler is synchronous once scheduled.
  execSync('sleep 2');

  const sections = survivors.map((pid) => {
    const parts = [`--- pid ${pid}: ${ps(pid)}`];
    parts.push(`state: ${procField(pid, 'status', 'State')}`);
    parts.push(`wchan: ${readProc(pid, 'wchan')}`);
    parts.push(`fds:\n${listFds(pid)}`);
    const dump = join(dumpDir, `${pid}.txt`);
    parts.push(
      existsSync(dump)
        ? readFileSync(dump, 'utf-8')
        : 'no handle dump (not a node process, or exited before SIGUSR2)'
    );
    return parts.join('\n');
  });

  for (const pid of survivors) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // already gone
    }
  }

  return `\n\nSurviving processes under ${projectPath}:\n${sections.join(
    '\n'
  )}`;
}

function findProcessesUnder(projectPath: string): number[] {
  const pids: number[] = [];
  for (const entry of readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    const pid = Number(entry);
    if (pid === process.pid) continue;
    try {
      if (readlinkSync(`/proc/${pid}/cwd`).startsWith(projectPath)) {
        pids.push(pid);
      }
    } catch {
      // exited, or not ours to read
    }
  }
  return pids;
}

function ps(pid: number): string {
  try {
    return execSync(`ps -o pid=,ppid=,etime=,args= -p ${pid}`, {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '(exited)';
  }
}

function readProc(pid: number, file: string): string {
  try {
    return readFileSync(`/proc/${pid}/${file}`, 'utf-8').trim();
  } catch {
    return '?';
  }
}

function procField(pid: number, file: string, field: string): string {
  const line = readProc(pid, file)
    .split('\n')
    .find((l) => l.startsWith(`${field}:`));
  return line ? line.slice(field.length + 1).trim() : '?';
}

function listFds(pid: number): string {
  try {
    return readdirSync(`/proc/${pid}/fd`)
      .map((fd) => {
        try {
          return `  ${fd} -> ${readlinkSync(`/proc/${pid}/fd/${fd}`)}`;
        } catch {
          return `  ${fd} -> ?`;
        }
      })
      .join('\n');
  } catch {
    return '  ?';
  }
}
