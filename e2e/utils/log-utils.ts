import { styleText } from 'node:util';

const orangeColor = (text) => `\x1b[38;5;214m${text}\x1b[39m`;

export const E2E_LOG_PREFIX = `${styleText(
  ['reset', 'inverse', 'bold'],
  orangeColor(' E2E ')
)}`;

export function e2eConsoleLogger(message: string, body?: string) {
  process.stdout.write('\n');
  process.stdout.write(`${E2E_LOG_PREFIX} ${message}\n`);
  if (body) {
    process.stdout.write(`${body}\n`);
  }
  process.stdout.write('\n');
}

export function logInfo(title: string, body?: string) {
  const message = `${styleText(
    ['reset', 'inverse', 'bold', 'white'],
    ' INFO '
  )} ${styleText(['bold', 'white'], title)}`;
  return e2eConsoleLogger(message, body);
}

export function logError(title: string, body?: string) {
  const message = `${styleText(
    ['reset', 'inverse', 'bold', 'red'],
    ' ERROR '
  )} ${styleText(['bold', 'red'], title)}`;
  return e2eConsoleLogger(message, body);
}

export function logSuccess(title: string, body?: string) {
  const message = `${styleText(
    ['reset', 'inverse', 'bold', 'green'],
    ' SUCCESS '
  )} ${styleText(['bold', 'green'], title)}`;
  return e2eConsoleLogger(message, body);
}

/**
 * The Nx daemon log is mostly per-file watcher events and per-message
 * bookkeeping — thousands of lines that bury the handful that explain a
 * failure. Keep only the lines useful for diagnosing daemon/plugin issues
 * (daemon restarts, plugin loads, stale-graph discards, errors) plus the
 * tail, and mark where runs of noise were removed so the gaps are visible.
 *
 * Use when dumping `daemon.log` from an e2e test so CI output stays small
 * while a failing run is still debuggable.
 */
export function trimDaemonLog(contents: string, tailLines = 30): string {
  const signal =
    /New daemon|Server stopped|Restarting daemon|Started new daemon|Daemon outdated|lock file hash|loadSpecifiedNxPlugins|loadDefaultNxPlugins|Load Nx Plugin:|Failed to load|AggregateError|Unable to find local plugin|Discarding stale|No in-memory cached project graph|Graph recompute necessary|recomputing project graph|Cannot find module|with an error|Error:/;
  const lines = contents.split('\n');
  const tailStart = Math.max(0, lines.length - tailLines);
  const out: string[] = [];
  let dropped = 0;
  lines.forEach((line, i) => {
    if (signal.test(line) || i >= tailStart) {
      if (dropped > 0) {
        out.push(`  … ${dropped} line(s) trimmed …`);
        dropped = 0;
      }
      out.push(line);
    } else {
      dropped++;
    }
  });
  if (dropped > 0) {
    out.push(`  … ${dropped} line(s) trimmed …`);
  }
  return out.join('\n');
}
