import type { Tree } from '../../generators/tree';
import { NxCloudOnBoardingStatus } from '../models/onboarding-status.js';
import { isWorkspaceClaimed } from './is-workspace-claimed.js';
import { createNxCloudOnboardingURL } from './url-shorten.js';
import { getRunnerOptions } from '../../tasks-runner/run-command.js';
import { readNxJson } from '../../generators/utils/nx-json.js';

export async function createNxCloudOnboardingURLForWelcomeApp(
  tree: Tree,
  token?: string
): Promise<NxCloudOnBoardingStatus> {
  token = token || readNxCloudToken(tree);
  if (!token) {
    return 'not-configured';
  }
  return (await isWorkspaceClaimed(token)) ? 'claimed' : 'unclaimed';
}

export async function getNxCloudAppOnBoardingUrl(token: string) {
  if (!token) {
    return null;
  }
  const onboardingUrl = await createNxCloudOnboardingURL(
    'nx-welcome-app',
    token,
    undefined,
    false
  );
  return onboardingUrl;
}

export function readNxCloudToken(tree: Tree) {
  const nxJson = readNxJson(tree);
  const { accessToken, nxCloudId } = getRunnerOptions(
    'default',
    nxJson,
    {},
    true
  );
  return accessToken || nxCloudId;
}
