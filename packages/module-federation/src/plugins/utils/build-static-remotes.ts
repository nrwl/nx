import { fork } from 'node:child_process';
import { join } from 'path';
import { createWriteStream } from 'node:fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { workspaceRoot } from '@nx/devkit';
import { StaticRemoteConfig } from '../../utils';
import { NxModuleFederationDevServerConfig } from '../models';

export async function buildStaticRemotes(
  staticRemotesConfig: Record<string, StaticRemoteConfig>,
  options: NxModuleFederationDevServerConfig,
  nxBin: string
) {
  const remotes = Object.keys(staticRemotesConfig);
  if (!remotes.length) {
    return;
  }
  const mappedLocationOfRemotes: Record<string, string> = {};
  for (const app of remotes) {
    mappedLocationOfRemotes[app] = `http${options.ssl ? 's' : ''}://${
      options.host
    }:${options.staticRemotesPort}/${staticRemotesConfig[app].urlSegment}`;
  }

  await new Promise<void>((res, rej) => {
    console.log(`NX Building ${remotes.length} static remotes...`);
    const staticProcess = fork(
      nxBin,
      [
        'run-many',
        `--target=build`,
        `--projects=${remotes.join(',')}`,
        ...(options.parallel ? [`--parallel=${options.parallel}`] : []),
      ],
      {
        cwd: workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    // File to debug build failures e.g. 2024-01-01T00_00_0_0Z-build.log'
    const remoteBuildLogFile = join(
      workspaceDataDirectory,
      // eslint-disable-next-line
      `${new Date().toISOString().replace(/[:\.]/g, '_')}-build.log`
    );
    const stdoutStream = createWriteStream(remoteBuildLogFile);
    staticProcess.stdout?.on('data', (data) => {
      const ANSII_CODE_REGEX =
        // eslint-disable-next-line no-control-regex
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      stdoutStream.write(stdoutString);

      // in addition to writing into the stdout stream, also show error directly in console
      // so the error is easily discoverable. 'ERROR in' is the key word to search in webpack output.
      if (stdoutString.includes('ERROR in')) {
        console.log(stdoutString);
      }

      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout?.removeAllListeners('data');
        console.info(`NX Built ${remotes.length} static remotes`);
        res();
      }
    });
    staticProcess.stderr?.on('data', (data) => console.log(data.toString()));
    staticProcess.once('exit', (code) => {
      stdoutStream.end();
      staticProcess.stdout?.removeAllListeners('data');
      staticProcess.stderr?.removeAllListeners('data');
      if (code !== 0) {
        rej(
          `Remote failed to start. A complete log can be found in: ${remoteBuildLogFile}`
        );
      } else {
        res();
      }
    });
    process.on('SIGTERM', () => staticProcess.kill('SIGTERM'));
    process.on('exit', () => staticProcess.kill('SIGTERM'));
  });

  return mappedLocationOfRemotes;
}
