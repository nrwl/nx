import {
  type ExecutorContext,
  logger,
  readProjectsConfigurationFromProjectGraph,
} from '@nx/devkit';
import { type Schema } from './schema';
import {
  buildStaticRemotes,
  normalizeOptions,
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
import { startRemoteProxies } from '@nx/webpack/src/utils/module-federation/start-remote-proxies';
import { parseStaticRemotesConfig } from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';

export async function* moduleFederationDevServerExecutor(
  schema: Schema,
  context: ExecutorContext
) {
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');
  const options = normalizeOptions(schema);

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
          cacheSeconds: -1,
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

  options.staticRemotesPort ??= remotes.staticRemotePort;

  // Set NX_MF_DEV_REMOTES for the Nx Runtime Library Control Plugin
  process.env.NX_MF_DEV_REMOTES = JSON.stringify([
    ...(remotes.devRemotes.map((r) =>
      typeof r === 'string' ? r : r.remoteName
    ) ?? []),
    project.name,
  ]);

  const staticRemotesConfig = parseStaticRemotesConfig(
    [...remotes.staticRemotes, ...remotes.dynamicRemotes],
    context
  );
  const mappedLocationsOfStaticRemotes = await buildStaticRemotes(
    staticRemotesConfig,
    nxBin,
    context,
    options
  );

  const devRemoteIters = await startRemotes(
    remotes.devRemotes,
    workspaceProjects,
    options,
    context,
    'serve'
  );

  const staticRemotesIter = startStaticRemotesFileServer(
    staticRemotesConfig,
    context,
    options
  );

  startRemoteProxies(
    staticRemotesConfig,
    mappedLocationsOfStaticRemotes,
    options.ssl
      ? {
          pathToCert: options.sslCert,
          pathToKey: options.sslKey,
        }
      : undefined
  );

  const removeBaseUrlEmission = (iter: AsyncIterable<unknown>) =>
    mapAsyncIterable(iter, (v) => ({
      ...v,
      baseUrl: undefined,
    }));

  return yield* combineAsyncIterables(
    removeBaseUrlEmission(currIter),
    ...devRemoteIters.map(removeBaseUrlEmission),
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
