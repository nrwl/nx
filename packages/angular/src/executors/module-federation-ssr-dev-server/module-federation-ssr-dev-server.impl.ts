import { type ExecutorContext, logger } from '@nx/devkit';
import { existsSync } from 'fs';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { extname, join } from 'path';
import {
  getDynamicMfManifestFile,
  validateDevRemotes,
} from '../../builders/utilities/module-federation';
import type { Schema } from './schema';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import { parseStaticSsrRemotesConfig } from '@nx/webpack/src/utils/module-federation/parse-static-remotes-config';
import { buildStaticRemotes } from './lib/build-static-remotes';
import { startRemotes } from './lib/start-dev-remotes';
import { startStaticRemotes } from './lib/start-static-remotes';
import {
  combineAsyncIterables,
  createAsyncIterable,
  mapAsyncIterable,
} from '@nx/devkit/src/utils/async-iterable';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import { createBuilderContext } from 'nx/src/adapter/ngcli-adapter';
import { normalizeOptions } from './lib/normalize-options';
import { waitForPortOpen } from '@nx/web/src/utils/wait-for-port-open';
import { startSsrRemoteProxies } from '@nx/webpack/src/utils/module-federation/start-ssr-remote-proxies';
import { getInstalledAngularVersionInfo } from '../utilities/angular-version-utils';

export async function* moduleFederationSsrDevServerExecutor(
  schema: Schema,
  context: ExecutorContext
) {
  const nxBin = require.resolve('nx/bin/nx');
  const options = normalizeOptions(schema);

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  const { executeSSRDevServerBuilder } =
    angularMajorVersion >= 17
      ? require('@angular-devkit/build-angular')
      : require('@nguniversal/builders');

  const currIter = eachValueFrom(
    executeSSRDevServerBuilder(
      options,
      await createBuilderContext(
        {
          builderName: '@nx/angular:webpack-server',
          description: 'Build a ssr application',
          optionSchema: require('../../builders/webpack-server/schema.json'),
        },
        context
      )
    )
  );

  if (options.isInitialHost === false) {
    return yield* currIter;
  }

  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(context.projectGraph);
  const project = workspaceProjects[context.projectName];

  let pathToManifestFile: string;
  if (options.pathToManifestFile) {
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
  } else {
    pathToManifestFile = getDynamicMfManifestFile(project, context.root);
  }

  validateDevRemotes({ devRemotes: options.devRemotes }, workspaceProjects);

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

  const staticRemotesConfig = parseStaticSsrRemotesConfig(
    [...remotes.staticRemotes, ...remotes.dynamicRemotes],
    context
  );

  const mappedLocationsOfStaticRemotes = await buildStaticRemotes(
    staticRemotesConfig,
    nxBin,
    context,
    options
  );

  // Set NX_MF_DEV_REMOTES for the Nx Runtime Library Control Plugin
  process.env.NX_MF_DEV_REMOTES = JSON.stringify([
    ...(options.devRemotes ?? []),
    project.name,
  ]);

  const devRemotes = await startRemotes(
    remotes.devRemotes,
    workspaceProjects,
    options,
    context
  );

  const staticRemotes = startStaticRemotes(
    staticRemotesConfig,
    context,
    options
  );

  startSsrRemoteProxies(
    staticRemotesConfig,
    mappedLocationsOfStaticRemotes,
    options.ssl
      ? { pathToCert: options.sslCert, pathToKey: options.sslKey }
      : undefined
  );

  const removeBaseUrlEmission = (iter: AsyncIterable<unknown>) =>
    mapAsyncIterable(iter, (v) => ({
      ...v,
      baseUrl: undefined,
    }));

  const combined = combineAsyncIterables(
    removeBaseUrlEmission(staticRemotes),
    ...(devRemotes ? devRemotes.map(removeBaseUrlEmission) : []),
    createAsyncIterable<{ success: true; baseUrl: string }>(
      async ({ next, done }) => {
        if (!options.isInitialHost) {
          done();
          return;
        }
        if (remotes.remotePorts.length) {
          logger.info(
            `Nx All remotes started, server ready at http://localhost:${options.port}`
          );

          next({ success: true, baseUrl: `http://localhost:${options.port}` });
          done();
          return;
        }
        try {
          const portsToWaitFor = staticRemotes
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
          next({ success: true, baseUrl: `http://localhost:${options.port}` });
        } catch (error) {
          throw new Error(
            `Failed to start remotes. Check above for any errors.`,
            {
              cause: error,
            }
          );
        } finally {
          done();
        }
      }
    )
  );
  let refs = 2 + (devRemotes?.length ?? 0);
  for await (const result of combined) {
    if (result.success === false) throw new Error('Remotes failed to start');
    if (result.success) refs--;
    if (refs === 0) break;
  }

  return yield* currIter;
}

export default moduleFederationSsrDevServerExecutor;
