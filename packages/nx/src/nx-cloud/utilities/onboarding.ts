import type { Tree } from '../../generators/tree';
import { NxCloudOnBoardingStatus } from '../models/onboarding-status';
import { isWorkspaceClaimed } from './is-workspace-claimed';
import { createNxCloudOnboardingURL } from './url-shorten';
import { getRunnerOptions } from '../../tasks-runner/run-command';
import { readNxJson } from '../../generators/utils/nx-json';

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
    token
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
