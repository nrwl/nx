/**
 * Agentic Cloud Onboard Helper
 *
 * Spawns `nx-cloud onboard connect-workspace --json` and streams its NDJSON
 * to the parent process. Translates the terminal payload into the AI-output
 * result shapes consumed by `nx connect`, `nx init`, and CNW agent paths.
 *
 * The `--json` contract lives in the external nx-cloud package (downloaded at
 * runtime). Treat it as a black box: parse defensively, log unrecognized
 * payloads to the error log instead of crashing.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { writeAiOutput, writeErrorLog } from '../../ai/ai-output';

/**
 * Returns true if `~/.config/nxcloud/nxcloud.ini` has a personalAccessToken
 * for the active Nx Cloud API URL (NX_CLOUD_API or default cloud.nx.app).
 *
 * The .ini is keyed by URL with literal escaped dots in the section header,
 * e.g. `[https://cloud\.nx\.app]`. We match by walking sections rather than
 * regex to avoid escaping pain.
 *
 * When no PAT is found, callers should fall back to anonymous workspace
 * creation + claim URL (matches Netlify CLI pattern).
 */
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
  // Section headers in nxcloud.ini have literal `\.` for dots. Normalize both
  // sides by stripping `\` so comparison is robust.
  const normalize = (s: string) => s.replace(/\\/g, '');
  const target = normalize(apiUrl);
  let inTargetSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inTargetSection = normalize(line.slice(1, -1)) === target;
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
  | 'nx-init'
  | 'nx-init-angular'
  | 'nx-init-monorepo'
  | 'nx-init-nest'
  | 'nx-init-npm-repo'
  | 'nx-init-turborepo'
  | 'create-nx-workspace';

export interface AgenticOnboardOptions {
  source: AgenticOnboardSource;
  /** Working directory for the spawned bin. Defaults to process.cwd(). */
  cwd?: string;
  /** Optional org id to skip the org-selection step. */
  org?: string;
  /** Optional workspace name. */
  name?: string;
}

/**
 * Post-connection guidance for the agent to surface to the user. The agent
 * should pick a project from the workspace (build / test / lint) and run a
 * cached target twice — the second run should be a cache hit served from
 * Nx Cloud. The Nx run URL printed by `nx` opens the trace in the platform.
 */
export interface AgenticOnboardNextSteps {
  /** Tells the agent what to do with `steps`. */
  description: string;
  steps: string[];
}

export type AgenticOnboardResult =
  | {
      status: 'connected';
      nxCloudId: string;
      nxCloudUrl?: string;
      /** Command the agent (and user) can run to confirm the connection landed. */
      verifyCommand: string;
      /** What the agent should suggest to the user now that the connection is live. */
      nextSteps: AgenticOnboardNextSteps;
    }
  | {
      status: 'needs_input';
      actionRequired: string;
      message: string;
      nextCommand: string;
      hint?: string;
      /** Optional URL the user must visit (e.g. GitHub device-flow verification, app install). */
      verificationUri?: string;
      /** Optional code the user enters at verificationUri. */
      userCode?: string;
      raw: Record<string, unknown>;
    }
  | {
      status: 'error';
      code: string;
      message: string;
      errorLogPath?: string;
    };

/**
 * Maps ocean's `actionRequired.type` strings onto our normalized action set.
 * Keep keys equal to the ocean values so passthrough Just Works for unknown types.
 */
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

/**
 * Canonical post-connection next-steps payload. Keep in sync with the CNW copy.
 */
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

/**
 * Compute the command the agent should run next, given a normalized action
 * type and the action's payload (which may carry a deviceCode for the GitHub
 * device flow).
 */
function nextCommandFor(
  actionType: string,
  info: Record<string, unknown>
): string {
  switch (actionType) {
    case 'login_required':
      return 'npx nx login';
    case 'github_oauth':
      // Splice deviceCode in so the agent has a complete command. Without the
      // code the poll subcommand fails — and re-running `connect-workspace`
      // mints a fresh code, orphaning the user's prior authorization.
      return typeof info.deviceCode === 'string'
        ? `npx nx-cloud onboard connect github poll --device-code ${info.deviceCode}`
        : 'npx nx-cloud onboard connect github poll --device-code <deviceCode>';
    case 'github_app_install':
      // No CLI command — the user must visit the installation URL in a browser.
      return '';
    default:
      return '';
  }
}

/**
 * Pure translator: takes a single line of stdout from `nx-cloud onboard
 * connect-workspace --json` and returns the structured result, or null if the
 * line is a progress message that should pass through without terminating.
 *
 * Exported for unit tests — feed real JSON strings, no mocks needed.
 *
 * Ocean payload shapes (from libs/nx-packages/client-bundle/.../onboarding-connect-workspace.ts):
 *   - Action required: `{ success: false, actionRequired: { type, message, url?, deviceCode?, userCode?, verificationUri?, ... } }`
 *   - Success:         `{ success: true, workspace: { nxCloudId, overviewUrl, ... }, configWritten }`
 *   - Error:           `{ success: false, error: "..." }` (sometimes accompanied by actionRequired)
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

  // Success: nxCloudId may be at the top level (legacy / direct callers) or
  // nested under `workspace` (current ocean `connect-workspace --json` shape).
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

  // 409 "Workspace already exists" is not a failure — it means the workspace
  // is already connected on the server. Most callers will be caught earlier
  // by the connect-to-nx-cloud agent-mode pre-check (which short-circuits when
  // `nx.json` has `nxCloudId`), but if a caller bypasses that or `nx.json` is
  // out of sync with the server, surface this as needs_input pointing to
  // `nx-cloud onboard status` so the agent can confirm and stop.
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
 * translated terminal payload. Streams progress NDJSON through writeAiOutput
 * so the agent sees a unified output stream.
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

  // The `connect-workspace` subcommand is the one-shot agent flow — it does
  // repo detection and nx.json write-back implicitly. Only --json / --org /
  // --name are valid here; --detect-repo / --write-config are flags on the
  // parent `nx-cloud onboard` command, not this subcommand.
  const args = [bin, 'onboard', 'connect-workspace', '--json'];
  if (options.org) args.push(`--org=${options.org}`);
  if (options.name) args.push(`--name=${options.name}`);

  writeAiOutput({
    stage: 'configuring',
    message: 'Connecting workspace to Nx Cloud...',
  });

  const emitFinal = (result: AgenticOnboardResult): AgenticOnboardResult => {
    // Always surface the normalized result as NDJSON so the agent sees a
    // canonical terminal payload — including `verifyCommand` on success
    // (`npx nx-cloud onboard status`), which the raw bin payload doesn't carry.
    // Intentionally NOT auto-opening verificationUri in the browser: stealing
    // window focus from the terminal disorients the user mid-flow. The agent
    // surfaces the URL + userCode in chat and the user clicks when ready.
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

    // Two stdout buffers: `lineBuf` is consumed line-by-line for NDJSON
    // streaming, `fullStdout` accumulates the entire output so we can fall
    // back to parsing it as a single multi-line JSON blob at close. Ocean's
    // `connect-workspace --json` emits ONE pretty-printed JSON object spanning
    // many lines (`{\n  "success": false,\n  ...\n}`); the line-by-line parser
    // sees `{`, `  "success": false,` etc. and rejects them. Without the
    // fallback, every payload looks like UNKNOWN_PAYLOAD.
    let lineBuf = '';
    let fullStdout = '';
    let stderrBuf = '';
    let terminalResult: AgenticOnboardResult | null = null;

    const handleLine = (line: string) => {
      const result = translateOnboardPayload(line);
      // Always forward the raw line as NDJSON to the agent (it's already JSON
      // when the bin obeys --json, and writeAiOutput is a no-op outside agent
      // mode anyway).
      const parsed = safeParse(line);
      if (parsed) writeAiOutput(parsed);
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

      // Multi-line JSON fallback: ocean's `--json` mode emits ONE pretty-
      // printed JSON object, sometimes preceded by `output.note(...)` writes
      // from the bin (e.g. `NX   Updating nx.json with Nx Cloud ID`). Find
      // the balanced JSON object inside the buffer and translate that.
      if (!terminalResult && fullStdout.trim()) {
        const blob = extractJsonObject(fullStdout);
        if (blob) {
          const result = translateOnboardPayload(blob);
          if (result) {
            const parsed = safeParse(blob);
            if (parsed) writeAiOutput(parsed);
            terminalResult = result;
          }
        }
      }

      if (terminalResult) {
        resolve(emitFinal(terminalResult));
        return;
      }

      // No recognized terminal payload. Inline the captured stdout/stderr in
      // the error so the agent has actionable context without having to read
      // a temp file. Still write the log for human debugging.
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
 * Extract the JSON object substring from a buffer that may also contain
 * human-readable text. Walks from the first `{` forward, tracks brace depth
 * (string-aware so braces inside JSON strings are ignored), and returns the
 * first balanced top-level object. Used to recover the terminal payload from
 * `--json` output that's polluted by `output.note(...)` writes from the bin
 * (e.g. `NX   Updating nx.json with Nx Cloud ID` printed to stdout before
 * the JSON blob).
 */
export function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString) {
      if (c === '\\') escape = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
