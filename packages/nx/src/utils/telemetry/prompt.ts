import { prompt } from 'enquirer';
import { readNxJson } from '../../config/nx-json';
import { output } from '../output';
import { setUserTelemetrySettings } from './user-settings';
import { shouldPromptForTelemetry } from './resolve-settings';

/**
 * Prompts the user for telemetry opt-in if conditions are met.
 *
 * The prompt will be shown only when:
 * - Not in CI environment
 * - Interactive terminal (stdin and stdout are TTY)
 * - No explicit telemetry setting from environment or repo config
 * - User hasn't been prompted before
 *
 * @param workspaceRoot - The workspace root path
 */
export async function promptForTelemetryIfNeeded(
  workspaceRoot: string
): Promise<void> {
  let nxJson = null;
  try {
    nxJson = readNxJson(workspaceRoot);
  } catch {
    // Silently ignore errors reading nx.json
  }
  if (!shouldPromptForTelemetry(nxJson)) {
    return;
  }

  const enabled = await promptForTelemetry();
  setUserTelemetrySettings({ enabled });
}

/**
 * Shows the telemetry opt-in prompt and returns the user's choice.
 */
async function promptForTelemetry(): Promise<boolean> {
  try {
    output.log({
      title: 'Help improve Nx by sharing anonymous usage data',
      bodyLines: [
        '',
        'We collect:',
        '  - Commands run (e.g., nx build, nx test)',
        '  - Timing and success/failure',
        '  - System info (OS, Node version)',
        '  - Plugin usage (only @nx/* plugins)',
        '',
        'We never collect:',
        '  - Project names, file paths, or code',
        '  - Personal information',
        '  - Custom executors or generators',
        '',
        'Learn more: https://nx.dev/recipes/telemetry',
      ],
    });

    const { enableTelemetry } = await prompt<{ enableTelemetry: boolean }>({
      type: 'confirm',
      name: 'enableTelemetry',
      message: 'Would you like to enable telemetry?',
      initial: true,
    });

    if (enableTelemetry) {
      output.log({
        title: 'Telemetry enabled',
        bodyLines: [
          'Thank you for helping improve Nx!',
          'You can disable telemetry at any time by setting NX_TELEMETRY=false',
          'or by adding "telemetry": { "enabled": false } to your nx.json',
        ],
      });
    } else {
      output.log({
        title: 'Telemetry disabled',
        bodyLines: [
          'You can enable telemetry at any time by setting NX_TELEMETRY=true',
          'or by adding "telemetry": { "enabled": true } to your nx.json',
        ],
      });
    }

    return enableTelemetry;
  } catch {
    // User cancelled the prompt (e.g., Ctrl+C)
    return false;
  }
}
