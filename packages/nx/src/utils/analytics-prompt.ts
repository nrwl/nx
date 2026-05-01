import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { prompt } from 'enquirer';
import { join } from 'path';
import { output } from './output';
import { isCI } from './is-ci';
import { readNxJson } from '../config/nx-json';
import { readJsonFile } from './fileutils';
import { writeFormattedJsonFile } from './write-formatted-json-file';
import { workspaceRoot } from './workspace-root';

/**
 * Prompts user for analytics preference if not already set in nx.json.
 * Only prompts in interactive terminals, not in CI.
 */
export async function ensureAnalyticsPreferenceSet(): Promise<void> {
  if (isCI()) {
    return;
  }

  // Only prompt in interactive terminals
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  if (!isInteractive) {
    return;
  }

  // Only prompt inside a workspace that has nx.json — avoid creating
  // nx.json in arbitrary directories (e.g. when running cloud commands
  // outside a workspace).
  const nxJsonPath = join(workspaceRoot, 'nx.json');
  if (!existsSync(nxJsonPath)) {
    return;
  }

  const nxJson = readNxJson(workspaceRoot);
  // Check if already set (true = enabled, false = disabled)
  if (typeof nxJson?.analytics === 'boolean') {
    return;
  }

  const analyticsEnabled = await promptForAnalyticsPreference();

  await saveAnalyticsPreference(analyticsEnabled);
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

async function saveAnalyticsPreference(enabled: boolean): Promise<void> {
  try {
    const nxJsonPath = join(workspaceRoot, 'nx.json');
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
 * Priority: nxCloudId > git remote URL (hashed).
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

  // Fall back to git remote URL hash
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      stdio: 'pipe',
      cwd: root,
      windowsHide: true,
    })
      .toString()
      .trim();

    if (remoteUrl) {
      return createHash('sha256').update(remoteUrl).digest('hex').slice(0, 32);
    }
  } catch {
    // No git remote available
  }

  // Fall back to first commit SHA — already a hash
  try {
    const firstCommit = execSync('git rev-list --max-parents=0 HEAD', {
      stdio: 'pipe',
      cwd: root,
      windowsHide: true,
    })
      .toString()
      .trim()
      .split('\n')[0];

    if (firstCommit) {
      return firstCommit;
    }
  } catch {
    // Not a git repo
  }

  return null;
}
