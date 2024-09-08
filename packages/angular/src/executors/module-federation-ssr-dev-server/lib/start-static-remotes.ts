import { type ExecutorContext, workspaceRoot } from '@nx/devkit';
import { type Schema } from '../schema';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { join } from 'path';
import { cpSync, rmSync } from 'fs';
import type { StaticRemotesConfig } from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';
import { createAsyncIterable } from '@nx/devkit/src/utils/async-iterable';

export function startStaticRemotes(
  ssrStaticRemotesConfig: StaticRemotesConfig,
  context: ExecutorContext,
  options: Schema
) {
  if (ssrStaticRemotesConfig.remotes.length === 0) {
    return createAsyncIterable(({ next, done }) => {
      next({ success: true });
      done();
    });
  }

  // The directories are usually generated with /browser and /server suffixes so we need to copy them to a common directory
  const commonOutputDirectory = join(workspaceRoot, 'tmp/static-remotes');
  for (const app of ssrStaticRemotesConfig.remotes) {
    const remoteConfig = ssrStaticRemotesConfig.config[app];

    cpSync(
      remoteConfig.outputPath,
      join(commonOutputDirectory, remoteConfig.urlSegment),
      {
        force: true,
        recursive: true,
      }
    );
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
