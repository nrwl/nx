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
  if (typeof nxJson?.analytics === 'boolean') {
    return;
  }

  const analyticsEnabled = await promptForAnalyticsPreference();

  saveAnalyticsPreference(analyticsEnabled);
}

async function promptForAnalyticsPreference(): Promise<boolean> {
  try {
    output.log({
      title: 'Help improve Nx by sharing anonymous usage data',
      bodyLines: [
        'Nx collects anonymous usage analytics to help improve the developer experience.',
        'No personal or project-specific information is collected.',
        'Learn more: https://cloud.nx.app/privacy'
      ],
    });

    const { enableAnalytics } = await prompt<{ enableAnalytics: boolean }>({
      type: 'confirm',
      name: 'enableAnalytics',
      message: 'Share anonymous usage data with the Nx team?',
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
