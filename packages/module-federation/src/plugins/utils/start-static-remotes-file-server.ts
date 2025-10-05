import { join, resolve } from 'path';
import { cpSync } from 'fs';
import { fork } from 'node:child_process';
import { StaticRemoteConfig } from '../../utils';
import { workspaceRoot } from '@nx/devkit';
import { readModulePackageJson } from 'nx/src/devkit-internals';

export function startStaticRemotesFileServer(
  staticRemotesConfig: Record<string, StaticRemoteConfig>,
  root: string,
  staticRemotesPort: number
) {
  const remotes = Object.keys(staticRemotesConfig);
  if (!remotes || remotes.length === 0) {
    return;
  }
  let shouldMoveToCommonLocation = false;
  const commonOutputDirectory = join(workspaceRoot, 'tmp/static-remotes');
  for (const app of remotes) {
    const remoteConfig = staticRemotesConfig[app];
    if (remoteConfig) {
      cpSync(
        remoteConfig.outputPath,
        join(commonOutputDirectory, remoteConfig.urlSegment),
        {
          force: true,
          recursive: true,
        }
      );
    }
  }

  const { path: pathToHttpServerPkgJson, packageJson } = readModulePackageJson(
    'http-server',
    module.paths
  );
  const pathToHttpServerBin = (packageJson.bin! as Record<string, string>)[
    'http-server'
  ] as string;
  const pathToHttpServer = resolve(
    pathToHttpServerPkgJson.replace('package.json', ''),
    pathToHttpServerBin
  );
  const httpServerProcess = fork(
    pathToHttpServer,
    [
      commonOutputDirectory!,
      `-p=${staticRemotesPort}`,
      `-a=localhost`,
      `--cors`,
    ],
    {
      stdio: 'pipe',
      cwd: root,
      env: {
        FORCE_COLOR: 'true',
        ...process.env,
      },
    }
  );
  process.on('SIGTERM', () => httpServerProcess.kill('SIGTERM'));
  process.on('exit', () => httpServerProcess.kill('SIGTERM'));
}
