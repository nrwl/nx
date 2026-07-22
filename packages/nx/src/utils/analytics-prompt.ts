import { existsSync } from 'fs';
import { prompt } from 'enquirer';
import { join } from 'path';
import { output } from './output';
import { isCI } from './is-ci';
import { readNxJson } from '../config/nx-json';
import { readJsonFile } from './fileutils';
import { writeFormattedJsonFile } from './write-formatted-json-file';
import { deriveRepoKey } from './repo-key';
import { workspaceRoot } from './workspace-root';

/**
 * Prompts for analytics preference if not already set in nx.json, persists the
 * answer so later commands don't re-ask, and returns it for telemetry. Returns
 * 'unset' when not prompted (CI / non-interactive / no nx.json). `nx init`
 * passes its own root + interactive flag; the default call (bin/nx.ts) derives
 * interactive from the TTY.
 */
export async function ensureAnalyticsPreferenceSet(
  root: string = workspaceRoot,
  interactive: boolean = !!(process.stdin.isTTY && process.stdout.isTTY)
): Promise<'yes' | 'no' | 'unset'> {
  if (!interactive || isCI()) {
    return 'unset';
  }

  // Only prompt inside a workspace that has nx.json — avoid creating
  // nx.json in arbitrary directories (e.g. when running cloud commands
  // outside a workspace).
  if (!existsSync(join(root, 'nx.json'))) {
    return 'unset';
  }

  const nxJson = readNxJson(root);
  // Already chosen (true = enabled, false = disabled) — report it.
  if (typeof nxJson?.analytics === 'boolean') {
    return nxJson.analytics ? 'yes' : 'no';
  }

  const enabled = await promptForAnalyticsPreference();
  await saveAnalyticsPreference(root, enabled);
  return enabled ? 'yes' : 'no';
}

export async function promptForAnalyticsPreference(): Promise<boolean> {
  try {
    output.log({
      title: 'Help improve Nx by sharing usage data',
      bodyLines: [
        'Nx collects usage analytics to help improve the developer experience.',
        'No project-specific information is collected.',
        'Learn more: https://cloud.nx.app/privacy',
      ],
    });

    const { enableAnalytics } = await prompt<{ enableAnalytics: boolean }>({
      type: 'confirm',
      name: 'enableAnalytics',
      message: 'Share usage data with the Nx team?',
      initial: true,
    });

    return enableAnalytics;
  } catch {
    // User cancelled - default to false
    return false;
  }
}

async function saveAnalyticsPreference(
  root: string,
  enabled: boolean
): Promise<void> {
  try {
    const nxJsonPath = join(root, 'nx.json');
    const nxJson = readJsonFile(nxJsonPath);
    nxJson.analytics = enabled;
    await writeFormattedJsonFile(nxJsonPath, nxJson);

    if (enabled) {
      output.success({ title: 'Thank you for helping improve Nx!' });
    } else {
      output.log({
        title: 'Analytics disabled.',
        bodyLines: [
          'You can change this anytime by setting "analytics" in nx.json.',
        ],
      });
    }
  } catch {
    // Silently fail - don't block user's command
  }
}

/**
 * Generates a deterministic workspace ID.
 * Priority: nxCloudId > repo key (normalized remote + relative path).
 * Returns null if neither is available (no telemetry).
 */
export function generateWorkspaceId(cwd?: string): string | null {
  const root = cwd ?? workspaceRoot;

  // Use nxCloudId if available — most stable identifier
  const nxJson = readNxJson(root);
  const nxCloudId = nxJson?.nxCloudId ?? nxJson?.nxCloudAccessToken;
  if (nxCloudId) {
    return nxCloudId;
  }

  return deriveRepoKey(root);
}
