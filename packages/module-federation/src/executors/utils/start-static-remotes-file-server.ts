import { type ExecutorContext, workspaceRoot } from '@nx/devkit';
import { type StaticRemotesOptions } from './models';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { join } from 'path';
import { cpSync } from 'fs';
import type { StaticRemotesConfig } from '../../utils';

export function startStaticRemotesFileServer(
  staticRemotesConfig: StaticRemotesConfig,
  context: ExecutorContext,
  options: StaticRemotesOptions,
  forceMoveToCommonLocation = false
) {
  if (
    !staticRemotesConfig.remotes ||
    staticRemotesConfig.remotes.length === 0
  ) {
    return;
  }
  let shouldMoveToCommonLocation = forceMoveToCommonLocation || false;
  let commonOutputDirectory: string;
  if (!forceMoveToCommonLocation) {
    for (const app of staticRemotesConfig.remotes) {
      const remoteBasePath = staticRemotesConfig.config[app].basePath;
      if (!commonOutputDirectory) {
        commonOutputDirectory = remoteBasePath;
      } else if (commonOutputDirectory !== remoteBasePath) {
        shouldMoveToCommonLocation = true;
        break;
      }
    }
  }

  if (shouldMoveToCommonLocation) {
    commonOutputDirectory = join(workspaceRoot, 'tmp/static-remotes');
    for (const app of staticRemotesConfig.remotes) {
      const remoteConfig = staticRemotesConfig.config[app];
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

  const staticRemotesIter = fileServerExecutor(
    {
      cors: true,
      watch: false,
      staticFilePath: commonOutputDirectory,
      parallel: false,
      spa: false,
      withDeps: false,
      host: options.host,
      port: options.staticRemotesPort,
      ssl: options.ssl,
      sslCert: options.sslCert,
      sslKey: options.sslKey,
      cacheSeconds: -1,
    },
    context
  );
  return staticRemotesIter;
}

export async function* startSsrStaticRemotesFileServer(
  staticRemotesConfig: StaticRemotesConfig,
  context: ExecutorContext,
  options: StaticRemotesOptions
) {
  const staticRemotesIter = startStaticRemotesFileServer(
    staticRemotesConfig,
    context,
    options,
    true
  );
  if (!staticRemotesIter) {
    yield { success: true };
    return;
  }
  yield* staticRemotesIter;
}
