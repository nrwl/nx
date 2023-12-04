import { type ExecutorContext, workspaceRoot } from '@nx/devkit';
import { type Schema } from '../schema';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { dirname, join } from 'path';
import { cpSync } from 'fs';

export function startStaticRemotesFileServer(
  remotes: {
    remotePorts: any[];
    staticRemotes: string[];
    devRemotes: string[];
  },
  context: ExecutorContext,
  options: Schema
) {
  let shouldMoveToCommonLocation = false;
  let commonOutputDirectory: string;
  for (const app of remotes.staticRemotes) {
    const outputPath =
      context.projectGraph.nodes[app].data.targets['build'].options.outputPath;
    const directoryOfOutputPath = dirname(outputPath);

    if (!commonOutputDirectory) {
      commonOutputDirectory = directoryOfOutputPath;
    } else if (
      commonOutputDirectory !== directoryOfOutputPath ||
      !outputPath.endsWith(app)
    ) {
      shouldMoveToCommonLocation = true;
    }
  }

  if (shouldMoveToCommonLocation) {
    commonOutputDirectory = join(workspaceRoot, 'tmp/static-remotes');
    for (const app of remotes.staticRemotes) {
      const outputPath =
        context.projectGraph.nodes[app].data.targets['build'].options
          .outputPath;
      cpSync(outputPath, join(commonOutputDirectory, app), {
        force: true,
        recursive: true,
      });
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
    },
    context
  );
  return staticRemotesIter;
}
