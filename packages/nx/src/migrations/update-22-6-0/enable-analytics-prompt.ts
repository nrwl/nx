import { Tree } from '../../generators/tree';
import { readNxJson, updateNxJson } from '../../generators/utils/nx-json';
import { isCI } from '../../utils/is-ci';
import { promptForAnalyticsPreference } from '../../utils/analytics-prompt';

export default async function enableAnalyticsPrompt(tree: Tree) {
  const nxJson = readNxJson(tree);
  if (!nxJson) {
    return;
  }

  // Already configured
  if (typeof nxJson.analytics === 'boolean') {
    return;
  }

  // Can't prompt in CI or non-interactive terminals
  if (isCI() || !process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  const enabled = await promptForAnalyticsPreference();
  nxJson.analytics = enabled;
  updateNxJson(tree, nxJson);
}
