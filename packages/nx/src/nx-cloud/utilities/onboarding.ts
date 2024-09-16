import { readNxJson } from '../../devkit-exports';
import type { Tree } from '../../generators/tree';
import { NxCloudOnBoardingStatus } from '../models/onboarding-status';
import { isWorkspaceClaimed } from './is-workspace-claimed';
import { createNxCloudOnboardingURL } from './url-shorten';
import { getRunnerOptions } from '../../tasks-runner/run-command';

export type NxCloudTokenType = 'ciAccessToken' | 'nxCloudId';

export async function createNxCloudOnboardingURLForWelcomeApp(
  tree: Tree,
  nxCloudId?: string
): Promise<NxCloudOnBoardingStatus> {
  const { token, type } = nxCloudId
    ? { token: nxCloudId, type: 'nxCloudId' as NxCloudTokenType }
    : readNxCloudToken(tree);
  if (!token) {
    return 'not-configured';
  }
  return (await isWorkspaceClaimed(token, type)) ? 'claimed' : 'unclaimed';
}

export async function getNxCloudAppOnBoardingUrl(nxCloudId: string) {
  if (!nxCloudId) {
    return null;
  }
  return await createNxCloudOnboardingURL('nx-welcome-app', nxCloudId);
}

export function readNxCloudToken(tree: Tree): {
  token: string;
  type: NxCloudTokenType;
} {
  const nxJson = readNxJson(tree);
  const { accessToken, nxCloudId } = getRunnerOptions(
    'default',
    nxJson,
    {},
    true
  );

  return accessToken
    ? { token: accessToken, type: 'ciAccessToken' }
    : { token: nxCloudId, type: 'nxCloudId' };
}
