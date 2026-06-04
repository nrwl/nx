import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import * as pc from 'picocolors';
import { readNxJson } from '../../config/nx-json';
import { isCI } from '../is-ci';
import { isNxCloudDisabled, isNxCloudUsed } from '../nx-cloud-utils';
import { terminalLink } from '../terminal-link';
import { NX_TIPS, NxTip, TipContext } from './catalog';

// ── State ──────────────────────────────────────────────────────────────────

export interface TipsState {
  disabled: boolean;
}

const TIPS_FILE_NAME = 'tips.json';
const EMPTY_STATE: TipsState = { disabled: false };

/**
 * User-level Nx config dir, matching the Rust get_user_config_dir
 * (native/config/dir.rs) that backs NxConsolePreferences - so tips state sits
 * alongside the other user prefs (ide.json), NOT in the workspace cache. This
 * makes `nx tips disable` survive `nx reset` and stay machine-local (never
 * committed). Windows: %USERPROFILE%\.nx. Unix: $XDG_CONFIG_HOME/nx or
 * ~/.config/nx. Keep in sync with native/config/dir.rs.
 */
function nxUserConfigDir(): string {
  if (process.platform === 'win32') {
    return join(homedir(), '.nx');
  }
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(base, 'nx');
}

function tipsFilePath(): string {
  return join(nxUserConfigDir(), TIPS_FILE_NAME);
}

export function readTipsState(): TipsState {
  try {
    return {
      ...EMPTY_STATE,
      ...JSON.parse(readFileSync(tipsFilePath(), 'utf-8')),
    };
  } catch {
    return { ...EMPTY_STATE };
  }
}

/**
 * Persist tip state. Throws on failure - the only callers are the explicit
 * `nx tips enable|disable` commands, where a silent failure would wrongly
 * report success. The per-run path never writes (and is try/caught anyway).
 */
function writeTipsState(state: TipsState): void {
  const dir = nxUserConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(tipsFilePath(), JSON.stringify(state, null, 2), 'utf-8');
}

// ── Context ──────────────────────────────────────────────────────────────────

/** Run facts used to fill command placeholders. */
export type TipRunInfo = Pick<TipContext, 'runTargets' | 'sampleProject'>;

export function buildTipContext(opts?: TipRunInfo): TipContext {
  let isCloudConnected = false;
  let isCloudOptedOut = false;
  try {
    const nxJson = readNxJson();
    isCloudConnected = isNxCloudUsed(nxJson);
    isCloudOptedOut = isNxCloudDisabled(nxJson);
  } catch {
    // Workspace may not have nx.json - treat as disconnected, not opted out
  }
  return {
    isCloudConnected,
    isCloudOptedOut,
    isCI: !!isCI(),
    isInteractive: !!(process.stdin.isTTY && process.stdout.isTTY),
    runTargets: opts?.runTargets,
    sampleProject: opts?.sampleProject,
  };
}

// ── Selection ──────────────────────────────────────────────────────────────

/**
 * True when a tip should print: enabled, interactive TTY, not CI.
 * Prints on every successful run - there is no cooldown.
 */
export function shouldShowTip(ctx: TipContext, state: TipsState): boolean {
  return !state.disabled && !ctx.isCI && ctx.isInteractive;
}

/**
 * Pick a random tip eligible for ctx. Skips tips whose command needs a
 * {project} we don't have (e.g. `nx tips show` or a zero-project run) so we
 * never print an unrunnable `nx show project <project>`.
 */
export function selectTip(ctx: TipContext): NxTip | undefined {
  const eligible = NX_TIPS.filter(
    (t) =>
      (!t.appliesWhen || t.appliesWhen(ctx)) &&
      (ctx.sampleProject || !t.command.includes('{project}'))
  );
  return eligible.length
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : undefined;
}

// ── Enable / disable ─────────────────────────────────────────────────────────

export function enableTips(): void {
  writeTipsState({ ...readTipsState(), disabled: false });
}

export function disableTips(): void {
  writeTipsState({ ...readTipsState(), disabled: true });
}

// ── Formatting ───────────────────────────────────────────────────────────────

/**
 * Fill a command template's placeholders from the run context:
 *   {target=<default>} -> first run target, else <default>
 *   {project}          -> a real project from the run, else <project>
 */
export function applyTipContext(command: string, ctx?: TipContext): string {
  return command
    .replace(
      /\{target(?:=([^}]*))?\}/g,
      (_, def) => ctx?.runTargets?.[0] ?? def ?? ''
    )
    .replace(/\{project\}/g, ctx?.sampleProject ?? '<project>');
}

/** Append UTM attribution matching the CNW/init cloud links (see nxCloudHyperlink). */
function withTipsUtm(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}utm_source=nx-cli&utm_medium=tips`;
}

/**
 * One muted line where only the command (the CTA) is highlighted. A tip may
 * carry a docs `link`, rendered as a UTM-tracked OSC 8 hyperlink (clean URL
 * visible, tracking on the click; bare URL on terminals without OSC 8).
 * Example: Tip: Share your task cache across your team and CI · npx nx connect · https://nx.dev/nx-cloud
 */
export function formatTip(tip: NxTip, ctx?: TipContext): string {
  const message = pc.dim(`Tip: ${tip.text}`);
  const command = pc.cyan(applyTipContext(tip.command, ctx));
  const link = tip.link
    ? ` ${pc.dim('·')} ${pc.dim(terminalLink(tip.link, withTipsUtm(tip.link)))}`
    : '';
  // Leading: summary already leaves a blank line above, so none here.
  // Trailing: blank line so the tip stays distinct from any following epilogue
  // (e.g. the "AI agent configuration is outdated" notice).
  return `${message} ${pc.dim('·')} ${command}${link}\n\n`;
}

// ── High-level hook (called from run-command after the summary) ────────────────

export function maybePrintTip(opts?: TipRunInfo): void {
  try {
    const ctx = buildTipContext(opts);
    if (!shouldShowTip(ctx, readTipsState())) return;
    const tip = selectTip(ctx);
    if (!tip) return;
    process.stdout.write(formatTip(tip, ctx));
  } catch {
    // Silent - tips are best-effort
  }
}
