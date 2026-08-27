import { spawnSync } from 'node:child_process';
import { resolveOxlintBin } from '../../utils/oxlint-bin.js';

export interface OxlintSpan {
  offset: number;
  length: number;
  line: number;
  column: number;
}

export interface OxlintLabel {
  label?: string;
  span: OxlintSpan;
}

export interface OxlintDiagnostic {
  message: string;
  code: string;
  severity: 'error' | 'warning' | 'advice';
  filename: string;
  labels: OxlintLabel[];
  help?: string;
  url?: string;
}

export interface OxlintReport {
  diagnostics: OxlintDiagnostic[];
  number_of_files: number;
  number_of_rules: number | null;
  threads_count: number;
  start_time: number;
}

export type OxlintRun =
  | { ok: true; report: OxlintReport }
  | { ok: false; output: string };

/**
 * One `oxlint --format=json` invocation from the workspace root. A run that
 * produces no JSON (config parse error, missing binary) comes back as its raw
 * output instead, because that text is the only explanation Oxlint gives.
 */
export function runOxlint(args: string[], workspaceRoot: string): OxlintRun {
  const bin = resolveOxlintBin(workspaceRoot);
  if (!bin) {
    return {
      ok: false,
      output: `Unable to resolve "oxlint" from ${workspaceRoot}. Install it as a devDependency of the workspace.`,
    };
  }

  const result = spawnSync(process.execPath, [bin, '--format=json', ...args], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });

  if (result.error) {
    return { ok: false, output: result.error.message };
  }

  const report = parseReport(result.stdout);
  if (!report) {
    return { ok: false, output: `${result.stdout}${result.stderr}`.trim() };
  }
  return { ok: true, report };
}

function parseReport(stdout: string): OxlintReport | null {
  try {
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed?.diagnostics) ? parsed : null;
  } catch {
    return null;
  }
}
