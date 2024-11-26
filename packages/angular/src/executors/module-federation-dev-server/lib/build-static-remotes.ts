import { type Schema } from '../schema';
import { type ExecutorContext, logger } from '@nx/devkit';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { fork } from 'node:child_process';
import { join } from 'node:path';
import { createWriteStream } from 'node:fs';
import type { StaticRemotesConfig } from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';

export async function buildStaticRemotes(
  staticRemotesConfig: StaticRemotesConfig,
  nxBin,
  context: ExecutorContext,
  options: Schema
) {
  if (!staticRemotesConfig.remotes.length) {
    return;
  }
  const mappedLocationOfRemotes: Record<string, string> = {};
  for (const app of staticRemotesConfig.remotes) {
    mappedLocationOfRemotes[app] = `http${options.ssl ? 's' : ''}://${
      options.host
    }:${options.staticRemotesPort}/${
      staticRemotesConfig.config[app].urlSegment
    }`;
  }

  await new Promise<void>((res, rej) => {
    logger.info(
      `NX Building ${staticRemotesConfig.remotes.length} static remotes...`
    );
    const staticProcess = fork(
      nxBin,
      [
        'run-many',
        `--target=build`,
        `--projects=${staticRemotesConfig.remotes.join(',')}`,
        ...(context.configurationName
          ? [`--configuration=${context.configurationName}`]
          : []),
        ...(options.parallel ? [`--parallel=${options.parallel}`] : []),
      ],
      {
        cwd: context.root,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    // File to debug build failures e.g. 2024-01-01T00_00_0_0Z-build.log'
    const remoteBuildLogFile = join(
      workspaceDataDirectory,
      `${new Date().toISOString().replace(/[:\.]/g, '_')}-build.log`
    );
    const stdoutStream = createWriteStream(remoteBuildLogFile);
    staticProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      stdoutStream.write(stdoutString);

      // in addition to writing into the stdout stream, also show error directly in console
      // so the error is easily discoverable. 'ERROR in' is the key word to search in webpack output.
      if (stdoutString.includes('ERROR in')) {
        logger.log(stdoutString);
      }

      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout.removeAllListeners('data');
        logger.info(
          `NX Built ${staticRemotesConfig.remotes.length} static remotes`
        );
        res();
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.once('exit', (code) => {
      stdoutStream.end();
      staticProcess.stdout.removeAllListeners('data');
      staticProcess.stderr.removeAllListeners('data');
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
