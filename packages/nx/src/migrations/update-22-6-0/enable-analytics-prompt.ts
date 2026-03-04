import { createHash, randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { prompt } from 'enquirer';
import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { output } from '../../utils/output';
import { isCI } from '../../utils/is-ci';

export default async function enableAnalyticsPrompt(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }

  // Already configured
  if (typeof nxJson.analytics === 'string' || nxJson.analytics === false) {
    return;
  }

  // Can't prompt in CI or non-interactive terminals
  if (isCI() || !process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  const enabled = await promptForAnalyticsPreference();
  nxJson.analytics = enabled ? generateWorkspaceId(tree.root) : false;
  updateNxJson(tree, nxJson);
}

async function promptForAnalyticsPreference(): Promise<boolean> {
  try {
    output.log({
      title: 'Help improve Nx by sharing anonymous usage data',
      bodyLines: [
        'Nx collects anonymous usage analytics to help improve the developer experience.',
        'No personal or project-specific information is collected.',
        'Learn more: https://cloud.nx.app/privacy',
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
    return false;
  }
}

function generateWorkspaceId(root: string): string {
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
  return randomUUID();
}
