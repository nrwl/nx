/**
 * Spawns `nx-cloud onboard connect-workspace --json` and translates its
 * terminal payload into the result shapes consumed by `nx connect`, `nx init`,
 * and CNW. The bin's `--json` contract is external and may shift, so payload
 * parsing is defensive — unrecognized shapes log and return `error`.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { writeAiOutput, writeErrorLog } from '../../ai/ai-output';

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
  // Ocean writes section headers with `\.` ini-escapes (e.g. `[https://cloud\.nx\.app]`).
  // Strip `\` on both sides for a forgiving compare.
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

export type AgenticOnboardSource =
  | 'nx-connect'
  | 'nx-console'
  | 'nx-init'
  | 'nx-init-angular'
  | 'nx-init-monorepo'
  | 'nx-init-nest'
  | 'nx-init-npm-repo'
  | 'nx-init-turborepo'
  | 'create-nx-workspace';

export interface AgenticOnboardOptions {
  source: AgenticOnboardSource;
  cwd?: string;
  org?: string;
  name?: string;
  /**
   * Fires for each parsed JSON payload from the bin. Lets human callers
   * drive a spinner without routing through writeAiOutput.
   */
  onProgress?: (payload: Record<string, unknown>) => void;
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
  | {
      status: 'error';
      code: string;
      message: string;
      errorLogPath?: string;
    };

// Keys mirror ocean's `actionRequired.type` so unknown types pass through unchanged.
const KNOWN_ACTIONS: Record<string, { hint: string; message: string }> = {
  login_required: {
    hint: 'After login, run `npx nx connect` again.',
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

// Keep in sync with the CNW copy.
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
      // Splice deviceCode so the agent has a complete poll command. Re-running
      // connect-workspace instead would mint a fresh code and orphan the prior.
      return typeof info.deviceCode === 'string'
        ? `npx nx-cloud onboard connect github poll --device-code ${info.deviceCode}`
        : 'npx nx-cloud onboard connect github poll --device-code <deviceCode>';
    case 'github_app_install':
      // No CLI command — user installs via the URL.
      return '';
    default:
      return '';
  }
}

/**
 * Translates one stdout line from `connect-workspace --json` into a result, or
 * null for non-terminal progress lines. Pure — exported for unit tests.
 */
export function translateOnboardPayload(
  line: string
): AgenticOnboardResult | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    // Non-JSON line — ignore (the bin may emit human-readable noise).
    return null;
  }

  // Progress messages — pass through, don't terminate. Heuristic: a `stage`
  // field with no `success` / `status` / `actionRequired` / `error` / nxCloudId
  // signal alongside it means it's just a milestone.
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

  // Action required: ocean's current shape is an object with `type`. Older
  // sentinel callers pass a string. Accept both.
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

  // nxCloudId is nested under `workspace` in the current bin shape; older
  // direct callers put it at top level. Accept both.
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

  // 409 = workspace already exists server-side. Surface as needs_input (not
  // error) so callers that bypass the nx.json short-circuit can confirm via
  // `onboard status` and stop without retrying.
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

  // Explicit error payload (no actionRequired matched above).
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

  // Unrecognized terminal payload — caller should log and treat as error.
  return null;
}

function resolveNxCloudBin(cwd: string): string {
  return require.resolve('nx/bin/nx-cloud.js', { paths: [cwd, __dirname] });
}

/**
 * Spawns `nx-cloud onboard connect-workspace --json` and resolves with the
 * translated terminal payload. Streams progress NDJSON through writeAiOutput.
 */
export async function runAgenticOnboard(
  options: AgenticOnboardOptions
): Promise<AgenticOnboardResult> {
  const cwd = options.cwd ?? process.cwd();
  let bin: string;
  try {
    bin = resolveNxCloudBin(cwd);
  } catch (err) {
    return {
      status: 'error',
      code: 'BIN_NOT_FOUND',
      message: `Could not locate nx-cloud bin in ${cwd}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  // connect-workspace does repo detection + nx.json write implicitly.
  // Only --json / --org / --name are valid on this subcommand.
  const args = [bin, 'onboard', 'connect-workspace', '--json'];
  if (options.org) args.push(`--org=${options.org}`);
  if (options.name) args.push(`--name=${options.name}`);

  const onProgress = options.onProgress;

  const startMsg = {
    stage: 'configuring',
    message: 'Connecting workspace to Nx Cloud...',
  };
  writeAiOutput(startMsg);
  onProgress?.(startMsg);

  const emitFinal = (result: AgenticOnboardResult): AgenticOnboardResult => {
    // Surface the normalized result so the agent sees `verifyCommand` etc.
    // that the raw bin payload doesn't carry. Intentionally NOT auto-opening
    // verificationUri — stealing focus mid-flow disorients the user.
    writeAiOutput(result as unknown as Record<string, unknown>);
    return result;
  };

  return new Promise<AgenticOnboardResult>((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, NX_AGENTIC_ONBOARD_SOURCE: options.source },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    // `lineBuf` drives line-by-line NDJSON; `fullStdout` is a fallback for
    // close-time multi-line JSON parsing — the bin currently pretty-prints
    // its terminal payload across many lines (CLOUD-4496). Once the bin
    // emits one JSON per line, the fallback can go.
    let lineBuf = '';
    let fullStdout = '';
    let stderrBuf = '';
    let terminalResult: AgenticOnboardResult | null = null;

    const handleLine = (line: string) => {
      const result = translateOnboardPayload(line);
      const parsed = safeParse(line);
      if (parsed) {
        writeAiOutput(parsed);
        onProgress?.(parsed);
      }
      if (result) terminalResult = result;
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
      const errorLogPath = writeErrorLog(err, 'agentic-onboard');
      resolve(
        emitFinal({
          status: 'error',
          code: 'SPAWN_FAILED',
          message: err.message,
          errorLogPath,
        })
      );
    });

    child.on('close', (code) => {
      if (lineBuf.trim()) handleLine(lineBuf);

      // Recover the JSON object out of mixed stdout (JSON + bin's stray
      // output.note writes). Workaround for CLOUD-4496.
      if (!terminalResult && fullStdout.trim()) {
        const blob = extractJsonObject(fullStdout);
        if (blob) {
          const result = translateOnboardPayload(blob);
          if (result) {
            const parsed = safeParse(blob);
            if (parsed) {
              writeAiOutput(parsed);
              onProgress?.(parsed);
            }
            terminalResult = result;
          }
        }
      }

      if (terminalResult) {
        resolve(emitFinal(terminalResult));
        return;
      }

      // Inline stdout/stderr in the error message so the agent has actionable
      // context inline; still write the log for human debugging.
      const errMsg = `nx-cloud onboard exited with code ${code}\nstdout:\n${fullStdout}\nstderr:\n${stderrBuf}`;
      const errorLogPath = writeErrorLog(new Error(errMsg), 'agentic-onboard');
      const summary = stderrBuf.trim() || fullStdout.trim();
      resolve(
        emitFinal({
          status: 'error',
          code: code === 0 ? 'UNKNOWN_PAYLOAD' : 'NON_ZERO_EXIT',
          message: summary
            ? `nx-cloud onboard exited with code ${code}: ${summary.slice(0, 500)}`
            : `nx-cloud onboard exited with code ${code} and no output.`,
          errorLogPath,
        })
      );
    });
  });
}

function safeParse(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Slice the JSON object out of a buffer that may contain human-readable noise
 * before it (e.g. `NX   Updating nx.json with Nx Cloud ID`).
 * Workaround for CLOUD-4496 — once the bin emits clean `--json`, drop this.
 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}
