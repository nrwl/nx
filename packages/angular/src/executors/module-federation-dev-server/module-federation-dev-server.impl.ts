import {
  type ExecutorContext,
  logger,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';
import { type Schema } from './schema';
import {
  buildStaticRemotes,
  normalizeOptions,
  parseStaticRemotesConfig,
  startRemotes,
  startStaticRemotesFileServer,
} from './lib';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import {
  combineAsyncIterables,
  createAsyncIterable,
  mapAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import fileServerExecutor from '@nx/web/src/executors/file-server/file-server.impl';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { executeDevServerBuilder } from '../../builders/dev-server/dev-server.impl';
import {
  getDynamicMfManifestFile,
  validateDevRemotes,
} from '../../builders/utilities/module-federation';
import { extname, join } from 'path';
import { existsSync } from 'fs';

export async function* moduleFederationDevServerExecutor(
  schema: Schema,
  context: ExecutorContext
) {
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');
  const options = normalizeOptions(schema);
  options.staticRemotesPort ??= options.port + 1;

  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(context.projectGraph);
  const project = workspaceProjects[context.projectName];

  const currIter = options.static
    ? fileServerExecutor(
        {
          port: options.port,
          host: options.host,
          ssl: options.ssl,
          buildTarget: options.buildTarget,
          parallel: false,
          spa: false,
          withDeps: false,
          cors: true,
        },
        context
      )
    : eachValueFrom(
        executeDevServerBuilder(
          options,
          await createBuilderContext(
            {
              builderName: '@nx/angular:webpack-browser',
              description: 'Build a browser application',
              optionSchema: require('../../builders/webpack-browser/schema.json'),
            },
            context
          )
        )
      );

  if (options.isInitialHost === false) {
    return yield* currIter;
  }

  let pathToManifestFile: string;
  if (!options.pathToManifestFile) {
    pathToManifestFile = getDynamicMfManifestFile(project, context.root);
  } else {
    const userPathToManifestFile = join(
      context.root,
      options.pathToManifestFile
    );
    if (!existsSync(userPathToManifestFile)) {
      throw new Error(
        `The provided Module Federation manifest file path does not exist. Please check the file exists at "${userPathToManifestFile}".`
      );
    } else if (extname(options.pathToManifestFile) !== '.json') {
      throw new Error(
        `The Module Federation manifest file must be a JSON. Please ensure the file at ${userPathToManifestFile} is a JSON.`
      );
    }

    pathToManifestFile = userPathToManifestFile;
  }

  validateDevRemotes(options, workspaceProjects);

  const moduleFederationConfig = getModuleFederationConfig(
    project.targets.build.options.tsConfig,
    context.root,
    project.root,
    'angular'
  );

  const remoteNames = options.devRemotes.map((r) =>
    typeof r === 'string' ? r : r.remoteName
  );

  const remotes = getRemotes(
    remoteNames,
    options.skipRemotes,
    moduleFederationConfig,
    {
      projectName: project.name,
      projectGraph: context.projectGraph,
      root: context.root,
    },
    pathToManifestFile
  );

  if (remotes.devRemotes.length > 0 && !schema.staticRemotesPort) {
    options.staticRemotesPort = options.devRemotes.reduce((portToUse, r) => {
      const remoteName = typeof r === 'string' ? r : r.remoteName;
      const remotePort =
        context.projectGraph.nodes[remoteName].data.targets['serve'].options
          .port;
      if (remotePort >= portToUse) {
        return remotePort + 1;
      } else {
        return portToUse;
      }
    }, options.staticRemotesPort);
  }

  const staticRemotesConfig = parseStaticRemotesConfig(
    remotes.staticRemotes,
    context
  );
  await buildStaticRemotes(staticRemotesConfig, nxBin, context, options);

  const devRemoteIters = await startRemotes(
    remotes.devRemotes,
    workspaceProjects,
    options,
    context,
    'serve'
  );

  const dynamicRemoteIters = await startRemotes(
    remotes.dynamicRemotes,
    workspaceProjects,
    options,
    context,
    'serve-static'
  );

  const staticRemotesIter =
    remotes.staticRemotes.length > 0
      ? startStaticRemotesFileServer(staticRemotesConfig, context, options)
      : undefined;

  const removeBaseUrlEmission = (iter: AsyncIterable<unknown>) =>
    mapAsyncIterable(iter, (v) => ({
      ...v,
      baseUrl: undefined,
    }));

  return yield* combineAsyncIterables(
    removeBaseUrlEmission(currIter),
    ...devRemoteIters.map(removeBaseUrlEmission),
    ...dynamicRemoteIters.map(removeBaseUrlEmission),
    ...(staticRemotesIter ? [removeBaseUrlEmission(staticRemotesIter)] : []),
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        if (!options.isInitialHost) {
          done();
          return;
        }
        if (remotes.remotePorts.length === 0) {
          logger.info(
            `NX All remotes started, server ready at http://localhost:${options.port}`
          );
          next({ success: true, baseUrl: `http://localhost:${options.port}` });
          done();
          return;
        }
        try {
          const portsToWaitFor = staticRemotesIter
            ? [options.staticRemotesPort, ...remotes.remotePorts]
            : [...remotes.remotePorts];
          await Promise.all(
            portsToWaitFor.map((port) =>
              waitForPortOpen(port, {
                retries: 480,
                retryDelay: 2500,
                host: 'localhost',
              })
            )
          );

          logger.info(
            `NX All remotes started, server ready at http://localhost:${options.port}`
          );
          next({ success: true, baseUrl: `http://localhost:${options.port}` });
        } catch (err) {
          throw new Error(
            `Failed to start remotes. Check above for any errors.`,
            {
              cause: err,
            }
          );
        } finally {
          done();
        }
      }
    )
  );
}

export default moduleFederationDevServerExecutor;
