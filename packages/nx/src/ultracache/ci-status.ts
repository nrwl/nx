import type { NxJsonConfiguration } from '../config/nx-json';
import type {
  InputDefinition,
  TargetConfiguration,
} from '../config/workspace-json-project-json';
import { getCloudOptions } from '../nx-cloud/utilities/get-cloud-options';
import { isNxCloudUsed } from '../utils/nx-cloud-utils';
import { supportsHyperlinks, terminalLink } from '../utils/terminal-link';
import { loadCloudClient } from './fetch';

const STATUS_TIMEOUT_MS = 2_000;

export const ULTRACACHE_DOCS_URL =
  'https://nx.dev/docs/reference/project-configuration#ultracache';

/**
 * "Learn more" as an OSC 8 link where the terminal supports one, styled like
 * the TUI's links (underline + cyan, see `tui/components/link.rs`); else the dimmed URL.
 */
export function ultracacheDocsLink(): string {
  const pc = require('picocolors') as typeof import('picocolors');
  return supportsHyperlinks()
    ? terminalLink(pc.cyan(pc.underline('Learn more')), ULTRACACHE_DOCS_URL)
    : pc.dim(ULTRACACHE_DOCS_URL);
}

let status: Promise<boolean> | undefined;

/**
 * Whether Nx Cloud's workspace setting has CI hash tasks from their Ultracache
 * configs. `false` whenever Nx Cloud cannot say. Asked once per process.
 */
export function isUltracacheOnInCI(
  nxJson: NxJsonConfiguration
): Promise<boolean> {
  status ??= readUltracacheStatus(nxJson);
  return status;
}

/** For specs. */
export function resetUltracacheStatus(): void {
  status = undefined;
}

async function readUltracacheStatus(
  nxJson: NxJsonConfiguration
): Promise<boolean> {
  if (!isNxCloudUsed(nxJson)) {
    return false;
  }
  try {
    const nxCloudOptions = getCloudOptions();
    const client = await loadCloudClient(nxCloudOptions);
    if (typeof client?.readUltracacheStatus !== 'function') {
      return false;
    }
    const { enabled } = await client.readUltracacheStatus({
      nxCloudOptions,
      timeoutMs: STATUS_TIMEOUT_MS,
    });
    return enabled === true;
  } catch {
    return false;
  }
}

export type UltracacheModeInCI = 'on' | 'warn' | 'error' | 'off';

/**
 * How CI treats this target's tasks when the workspace is On; `undefined` when
 * Ultracache doesn't apply. Mirrors the eligibility walk in `ultracache_eligibility.rs`.
 */
export function ultracacheModeInCI(
  target: TargetConfiguration,
  customHasher: boolean
): UltracacheModeInCI | undefined {
  if (target.cache !== true || target.continuous || customHasher) {
    return undefined;
  }
  return target.ultracache?.mode ?? 'on';
}

export function hasAlwaysInput(
  inputs: readonly (InputDefinition | string)[] | undefined
): boolean {
  return !!inputs?.some(
    (i) => typeof i === 'object' && 'always' in i && i.always
  );
}

/** The notice `nx show` prints after `Ultracache:` for a target in `mode`. */
export function ultracacheInCINotice(
  mode: UltracacheModeInCI,
  alwaysInputs: boolean
): string {
  switch (mode) {
    case 'on':
      return [
        'In CI, file inputs are replaced by the files this task read during previous runs.',
        ...(alwaysInputs ? ['`always` inputs still count.'] : []),
      ].join(' ');
    case 'warn':
      return 'In CI, Nx Cloud warns if this task reads files outside its hash or writes files outside its outputs.';
    case 'error':
      return 'In CI, Nx Cloud fails the run if this task reads files outside its hash or writes files outside its outputs.';
    case 'off':
      return 'In CI, this task is not recorded.';
  }
}
