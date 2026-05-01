/**
 * CNW copy of packages/nx/src/command-line/nx-cloud/onboard/agentic-onboard.ts.
 * Duplicated because CNW can't import from the nx package (same pattern as
 * `src/utils/ai/ai-output.ts`).
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { writeAiOutput, logProgress } from '../ai/ai-output';

/** True iff the user has a PAT for the active Nx Cloud URL. */
export function hasNxCloudPat(
  apiUrl: string = process.env.NX_CLOUD_API || 'https://cloud.nx.app'
): boolean {
  const path = join(homedir(), '.config', 'nxcloud', 'nxcloud.ini');
  if (!existsSync(path)) return false;
  let content: string;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    return false;
  }
  // Ocean writes section headers with `\.` ini-escapes. Strip on both sides.
  const strip = (s: string) => s.replace(/\\/g, '');
  const target = strip(apiUrl);
  let inTargetSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inTargetSection = strip(line.slice(1, -1)) === target;
      continue;
    }
    if (inTargetSection && line.startsWith('personalAccessToken=')) {
      return line.slice('personalAccessToken='.length).trim().length > 0;
    }
  }
  return false;
}

export type AgenticOnboardSource = 'create-nx-workspace';

export interface AgenticOnboardOptions {
  source: AgenticOnboardSource;
  /** Must contain a `node_modules/nx` install. */
  cwd: string;
  org?: string;
  name?: string;
}

export interface AgenticOnboardNextSteps {
  description: string;
  steps: string[];
}

export type AgenticOnboardResult =
  | {
      status: 'connected';
      nxCloudId: string;
      nxCloudUrl?: string;
      verifyCommand: string;
      nextSteps: AgenticOnboardNextSteps;
    }
  | {
      status: 'needs_input';
      actionRequired: string;
      message: string;
      nextCommand: string;
      hint?: string;
      verificationUri?: string;
      userCode?: string;
      raw: Record<string, unknown>;
    }
  | { status: 'error'; code: string; message: string };

const KNOWN_ACTIONS: Record<string, { hint: string; message: string }> = {
  login_required: {
    hint: 'After login, run `npx nx connect` from the workspace.',
    message:
      'Nx Cloud authentication is required. Ask the user to run `npx nx login`, then re-run.',
  },
  // TODO(CLOUD-4501): once the ocean-side fix lands, simplify the hint to
  // `On "complete", re-run `npx nx connect`` and drop the connect-workspace
  // workaround language.
  github_oauth: {
    hint: 'Show the user the verificationUri + userCode and ask them to tell you once they have authorized. When they confirm, run the poll command (single-shot — returns `{"status":"pending"|"complete"|"expired"|"error"}`). On "complete", run `npx nx-cloud onboard connect-workspace --json` directly to advance the connection — this skips the OAuth check and goes straight to creating the workspace. (Re-running `npx nx connect` can re-trigger OAuth due to a known backend state lag — prefer `connect-workspace` until that lands.) On "pending", ask the user to confirm again; they have likely not finished. Do NOT re-run `connect-workspace` BEFORE poll returns "complete" — that mints a fresh device code and orphans the prior authorization.',
    message:
      'GitHub authorization is required to link the workspace. Show the user the verificationUri + userCode, ask them to confirm when they have authorized, then call the poll command with the deviceCode.',
  },
  github_app_install: {
    hint: 'The user must install the Nx Cloud GitHub App on the target repo at `url`, then re-run `npx nx connect`. There is no CLI command for this step.',
    message:
      'The Nx Cloud GitHub App is not installed on this repository. Ask the user to install it from the URL, then re-run.',
  },
};

const STATUS_COMMAND = 'npx nx-cloud onboard status';

export const CONNECTED_NEXT_STEPS: AgenticOnboardNextSteps = {
  description:
    'Suggest to the user that they verify remote caching by running a cacheable target twice. Pick an existing project (app, library, or package) from the workspace and use a target it already supports (build, test, lint). Do NOT scaffold a new project for this.',
  steps: [
    'List projects with `npx nx show projects` (or read `package.json`/`project.json` for available targets).',
    'Pick one project that has a cacheable target (build/test/lint). Prefer an app or a frequently-built library.',
    'Run the target once, e.g. `npx nx build <project>` (or test/lint). The first run populates the cache.',
    'Run the same command again. The second run should be a cache hit (sub-second) served from Nx Cloud.',
    'Open the run URL printed by `nx` (looks like `https://nx.app/runs/<id>` or your Nx Cloud instance equivalent) to see the trace in the platform.',
  ],
};

function nextCommandFor(
  actionType: string,
  info: Record<string, unknown>
): string {
  switch (actionType) {
    case 'login_required':
      return 'npx nx login';
    case 'github_oauth':
      return typeof info.deviceCode === 'string'
        ? `npx nx-cloud onboard connect github poll --device-code ${info.deviceCode}`
        : 'npx nx-cloud onboard connect github poll --device-code <deviceCode>';
    case 'github_app_install':
      return '';
    default:
      return '';
  }
}

export function translateOnboardPayload(
  line: string
): AgenticOnboardResult | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (
    typeof payload.stage === 'string' &&
    !('success' in payload) &&
    !('status' in payload) &&
    !('actionRequired' in payload) &&
    !('error' in payload) &&
    !('nxCloudId' in payload) &&
    !('workspace' in payload)
  ) {
    return null;
  }

  const ar = payload.actionRequired;
  if (typeof ar === 'string' || (ar && typeof ar === 'object')) {
    const info: Record<string, unknown> =
      typeof ar === 'object' && ar !== null
        ? (ar as Record<string, unknown>)
        : {};
    const actionType =
      typeof ar === 'string'
        ? ar
        : typeof info.type === 'string'
          ? (info.type as string)
          : 'unknown';
    const known = KNOWN_ACTIONS[actionType];
    const message =
      typeof info.message === 'string'
        ? (info.message as string)
        : typeof payload.message === 'string'
          ? (payload.message as string)
          : (known?.message ?? `Action required: ${actionType}`);
    const verificationUri =
      typeof info.verificationUri === 'string'
        ? (info.verificationUri as string)
        : typeof info.url === 'string'
          ? (info.url as string)
          : undefined;
    const userCode =
      typeof info.userCode === 'string' ? (info.userCode as string) : undefined;
    return {
      status: 'needs_input',
      actionRequired: actionType,
      message,
      nextCommand: nextCommandFor(actionType, info),
      hint: known?.hint,
      verificationUri,
      userCode,
      raw: payload,
    };
  }

  const workspace =
    payload.workspace && typeof payload.workspace === 'object'
      ? (payload.workspace as Record<string, unknown>)
      : undefined;
  const nxCloudId =
    typeof payload.nxCloudId === 'string' && payload.nxCloudId.length > 0
      ? (payload.nxCloudId as string)
      : workspace &&
          typeof workspace.nxCloudId === 'string' &&
          (workspace.nxCloudId as string).length > 0
        ? (workspace.nxCloudId as string)
        : undefined;
  if (nxCloudId) {
    const nxCloudUrl =
      typeof payload.nxCloudUrl === 'string'
        ? (payload.nxCloudUrl as string)
        : workspace && typeof workspace.overviewUrl === 'string'
          ? (workspace.overviewUrl as string)
          : undefined;
    return {
      status: 'connected',
      nxCloudId,
      nxCloudUrl,
      verifyCommand: STATUS_COMMAND,
      nextSteps: CONNECTED_NEXT_STEPS,
    };
  }

  // 409 "Workspace already exists" — already connected, not a failure.
  const message =
    typeof payload.message === 'string'
      ? (payload.message as string)
      : typeof payload.error === 'string'
        ? (payload.error as string)
        : '';
  const remediation =
    payload.remediation && typeof payload.remediation === 'object'
      ? (payload.remediation as Record<string, unknown>)
      : undefined;
  const isWorkspaceExists =
    payload.status === 409 ||
    /workspace already exists/i.test(message) ||
    (remediation?.field === 'name' &&
      typeof remediation?.message === 'string' &&
      /already exists/i.test(remediation.message as string));
  if (isWorkspaceExists) {
    return {
      status: 'needs_input',
      actionRequired: 'workspace_already_exists',
      message:
        'A workspace with this name is already connected on Nx Cloud. Run `npx nx-cloud onboard status` to confirm and stop, or pass `--name=<other>` to connect a new workspace under a different name.',
      nextCommand: STATUS_COMMAND,
      hint: 'If `nx.json` already has `nxCloudId`, the connection is fine — no action needed. Use `--name=<other>` only if you intend to create a SECOND workspace pointing at the same repo.',
      raw: payload,
    };
  }

  if (
    payload.success === false ||
    payload.status === 'error' ||
    typeof payload.error === 'string'
  ) {
    return {
      status: 'error',
      code:
        typeof payload.errorCode === 'string'
          ? (payload.errorCode as string)
          : 'ONBOARD_ERROR',
      message: message || 'Nx Cloud onboard failed.',
    };
  }

  return null;
}

function resolveNxCloudBin(cwd: string): string {
  return require.resolve('nx/bin/nx-cloud.js', { paths: [cwd] });
}

export async function runAgenticOnboard(
  options: AgenticOnboardOptions
): Promise<AgenticOnboardResult> {
  let bin: string;
  try {
    bin = resolveNxCloudBin(options.cwd);
  } catch (err) {
    return {
      status: 'error',
      code: 'BIN_NOT_FOUND',
      message: `Could not locate nx-cloud bin in ${options.cwd}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  // connect-workspace does repo detection + nx.json write implicitly.
  // Only --json / --org / --name are valid on this subcommand.
  const args = [bin, 'onboard', 'connect-workspace', '--json'];
  if (options.org) args.push(`--org=${options.org}`);
  if (options.name) args.push(`--name=${options.name}`);

  logProgress('configuring', 'Connecting workspace to Nx Cloud...');

  const emitFinal = (result: AgenticOnboardResult): AgenticOnboardResult => {
    // Surface the normalized result; don't auto-open verificationUri
    // (stealing focus mid-flow disorients the user).
    writeAiOutput(result as any);
    return result;
  };

  return new Promise<AgenticOnboardResult>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd,
      env: { ...process.env, NX_AGENTIC_ONBOARD_SOURCE: options.source },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // `lineBuf` drives line-by-line NDJSON; `fullStdout` is a fallback for
    // close-time multi-line JSON parsing (CLOUD-4496 workaround — once the
    // bin emits one JSON per line the fallback can go).
    let lineBuf = '';
    let fullStdout = '';
    let stderrBuf = '';
    let terminalResult: AgenticOnboardResult | null = null;

    const handleLine = (line: string) => {
      const parsed = tryParseObject(line);
      if (parsed) {
        writeAiOutput(parsed as any);
        const result = translateOnboardPayload(line);
        if (result) terminalResult = result;
      }
    };

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8');
      fullStdout += text;
      lineBuf += text;
      let idx: number;
      while ((idx = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.slice(0, idx);
        lineBuf = lineBuf.slice(idx + 1);
        handleLine(line);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuf += chunk.toString('utf8');
    });

    child.on('error', (err) => {
      resolve(
        emitFinal({
          status: 'error',
          code: 'SPAWN_FAILED',
          message: err.message,
        })
      );
    });

    child.on('close', (code) => {
      if (lineBuf.trim()) handleLine(lineBuf);

      if (!terminalResult && fullStdout.trim()) {
        for (const payload of extractJsonPayloads(fullStdout)) {
          const result = translateOnboardPayload(JSON.stringify(payload));
          if (result) {
            writeAiOutput(payload as any);
            terminalResult = result;
          }
        }
      }

      if (terminalResult) {
        resolve(emitFinal(terminalResult));
        return;
      }

      const summary = stderrBuf.trim() || fullStdout.trim();
      resolve(
        emitFinal({
          status: 'error',
          code: code === 0 ? 'UNKNOWN_PAYLOAD' : 'NON_ZERO_EXIT',
          message: summary
            ? `nx-cloud onboard exited with code ${code}: ${summary.slice(0, 500)}`
            : `nx-cloud onboard exited with code ${code} and no output.`,
        })
      );
    });
  });
}

/**
 * Parse every top-level JSON object out of a stdout buffer.
 *
 * Handles three shapes from `nx-cloud onboard connect-workspace`:
 *  - NDJSON: one parseable object per line (target after CLOUD-4496)
 *  - Pretty-printed multi-line: `{` and matching `}` at column 0 (current bin)
 *  - Either, with non-JSON noise lines interleaved (always possible — a stray
 *    `output.note(...)` writing to stdout will leak through any contract)
 *
 * "Top-level" = line starts with `{` or `}` at column 0. Inner braces inside
 * a pretty-printed object are indented and ignored.
 */
export function extractJsonPayloads(
  text: string
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    if (!lines[i].startsWith('{')) {
      i++;
      continue;
    }
    const single = tryParseObject(lines[i]);
    if (single) {
      out.push(single);
      i++;
      continue;
    }
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('}')) j++;
    if (j < lines.length) {
      const multi = tryParseObject(lines.slice(i, j + 1).join('\n'));
      if (multi) {
        out.push(multi);
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

function tryParseObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    const v = JSON.parse(trimmed);
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
