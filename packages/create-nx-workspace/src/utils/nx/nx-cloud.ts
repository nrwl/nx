import { CLIOutput } from '../output';
import { getMessageFactory } from './messages';
import * as ora from 'ora';

export type NxCloud = 'yes' | 'github' | 'circleci' | 'skip';

export function readNxCloudToken(directory: string) {
  const nxCloudSpinner = ora(`Checking Nx Cloud setup`).start();
  // nx-ignore-next-line
  const { getCloudOptions } = require(require.resolve(
    'nx/src/nx-cloud/utilities/get-cloud-options',
    {
      paths: [directory],
    }
    // nx-ignore-next-line
  )) as typeof import('nx/src/nx-cloud/utilities/get-cloud-options');

  const { accessToken, nxCloudId } = getCloudOptions(directory);
  nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
  return accessToken || nxCloudId;
}

export async function getOnboardingInfo(
  nxCloud: NxCloud,
  token: string,
  directory: string,
  useGithub?: boolean
) {
  // nx-ignore-next-line
  const { createNxCloudOnboardingURL } = require(require.resolve(
    'nx/src/nx-cloud/utilities/url-shorten',
    {
      paths: [directory],
    }
    // nx-ignore-next-line
  )) as typeof import('nx/src/nx-cloud/utilities/url-shorten');

  const source =
    nxCloud === 'yes'
      ? 'create-nx-workspace-success-cache-setup'
      : 'create-nx-workspace-success-ci-setup';
  const { code, createMessage } = getMessageFactory(source);
  const connectCloudUrl = await createNxCloudOnboardingURL(
    source,
    token,
    useGithub ??
      (nxCloud === 'yes' || nxCloud === 'github' || nxCloud === 'circleci'),
    code
  );
  const out = new CLIOutput(false);
  const message = createMessage(connectCloudUrl);
  if (message.type === 'success') {
    out.success(message);
  } else {
    out.warn(message);
  }
  return { output: out.getOutput(), connectCloudUrl };
}
