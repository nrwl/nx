import { createHash } from 'crypto';
import { execSync } from 'child_process';
import { prompt } from 'enquirer';
import { join } from 'path';
import { output } from './output';
import { isCI } from './is-ci';
import { readNxJson } from '../config/nx-json';
import { writeJsonFile } from './fileutils';
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

  const nxJson = readNxJson(workspaceRoot);
  // Check if already set (true = enabled, false = disabled)
  if (typeof nxJson?.analytics === 'boolean') {
    return;
  }

  const analyticsEnabled = await promptForAnalyticsPreference();

  saveAnalyticsPreference(analyticsEnabled);
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

function saveAnalyticsPreference(enabled: boolean): void {
  try {
    const nxJsonPath = join(workspaceRoot, 'nx.json');
    const nxJson = readNxJson(workspaceRoot);
    nxJson.analytics = enabled;
    writeJsonFile(nxJsonPath, nxJson);

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
 * Generates a deterministic workspace ID from the git repo.
 * Tries git remote URL first, then falls back to the first commit SHA.
 * Returns null if not in a git repo (no telemetry for non-git workspaces).
 */
export function generateWorkspaceId(cwd?: string): string | null {
  const root = cwd ?? workspaceRoot;

  // Try git remote URL hash first
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      stdio: 'pipe',
      cwd: root,
    })
      .toString()
      .trim();

    if (remoteUrl) {
      return createHash('sha256').update(remoteUrl).digest('hex').slice(0, 32);
    }
  } catch {
    // No git remote available
  }

  // Fall back to first commit SHA hash
  try {
    const firstCommit = execSync('git rev-list --max-parents=0 HEAD', {
      stdio: 'pipe',
      cwd: root,
    })
      .toString()
      .trim()
      .split('\n')[0]; // Take first line in case of multiple roots

    if (firstCommit) {
      return createHash('sha256')
        .update(firstCommit)
        .digest('hex')
        .slice(0, 32);
    }
  } catch {
    // Not a git repo
  }

  return null;
}
