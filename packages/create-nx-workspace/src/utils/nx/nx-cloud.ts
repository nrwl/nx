import * as ora from 'ora';
import { CLIOutput, output } from '../output';
import { mapErrorToBodyLines } from '../error-utils';
import { getMessageFactory } from './messages';

export type NxCloud = 'yes' | 'github' | 'circleci' | 'skip';

export async function setupNxCloud(
  directory: string,
  nxCloud: NxCloud,
  useGitHub?: boolean
) {
  const nxCloudSpinner = ora(`Setting up Nx Cloud`).start();
  try {
    // nx-ignore-next-line
    const { connectWorkspaceToCloud } = require(require.resolve(
      'nx/src/command-line/connect/connect-to-nx-cloud',
      {
        paths: [directory],
      }
      // nx-ignore-next-line
    )) as typeof import('nx/src/command-line/connect/connect-to-nx-cloud');

    const accessToken = await connectWorkspaceToCloud(
      {
        installationSource: 'create-nx-workspace',
        directory,
        github: useGitHub,
      },
      directory
    );

    nxCloudSpinner.succeed('Nx Cloud has been set up successfully');
    return accessToken;
  } catch (e) {
    nxCloudSpinner.fail();

    if (e instanceof Error) {
      output.error({
        title: `Failed to setup Nx Cloud`,
        bodyLines: mapErrorToBodyLines(e),
      });
    } else {
      console.error(e);
    }

    process.exit(1);
  } finally {
    nxCloudSpinner.stop();
  }
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
