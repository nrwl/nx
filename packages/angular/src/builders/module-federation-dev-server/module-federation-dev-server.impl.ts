import type { Schema } from './schema';
import {
  logger,
  readCachedProjectGraph,
  readNxJson,
  workspaceRoot,
} from '@nx/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { executeWebpackDevServerBuilder } from '../webpack-dev-server/webpack-dev-server.impl';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { getExecutorInformation } from 'nx/src/command-line/run/executor-utils';
import {
  getDynamicRemotes,
  getStaticRemotes,
  validateDevRemotes,
} from '../utilities/module-federation';
import { existsSync } from 'fs';
import { extname, join } from 'path';
import { findMatchingProjects } from 'nx/src/utils/find-matching-projects';
import {
  catchError,
  combineLatest,
  concatMap,
  from,
  iif,
  Observable,
  of,
} from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { checkPortIsActive } from '@nx/js/src/utils/check-port-is-active';

export function executeModuleFederationDevServerBuilder(
  schema: Schema,
  context: import('@angular-devkit/architect').BuilderContext
): ReturnType<typeof executeWebpackDevServerBuilder | any> {
  const { ...options } = schema;
  const projectGraph = readCachedProjectGraph();
  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const project = workspaceProjects[context.target.project];

  let pathToManifestFile = join(
    context.workspaceRoot,
    project.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (options.pathToManifestFile) {
    const userPathToManifestFile = join(
      context.workspaceRoot,
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

  const remotesToSkip = new Set(
    findMatchingProjects(options.skipRemotes, projectGraph.nodes) ?? []
  );

  if (remotesToSkip.size > 0) {
    logger.info(
      `Remotes not served automatically: ${[...remotesToSkip].join(', ')}`
    );
  }
  const staticRemotes = getStaticRemotes(
    project,
    context,
    workspaceProjects,
    remotesToSkip
  );
  const dynamicRemotes = getDynamicRemotes(
    project,
    context,
    workspaceProjects,
    remotesToSkip,
    pathToManifestFile
  );
  const remotes = [...staticRemotes, ...dynamicRemotes];

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? findMatchingProjects(options.devRemotes, projectGraph.nodes)
    : findMatchingProjects([options.devRemotes], projectGraph.nodes);

  const obs: Observable<any>[] = [];
  for (const remote of remotes) {
    const isDev = devServeRemotes.includes(remote);
    const target = isDev ? 'serve' : 'serve-static';

    if (!workspaceProjects[remote].targets?.[target]) {
      throw new Error(
        `Could not find "${target}" target in "${remote}" project.`
      );
    } else if (!workspaceProjects[remote].targets?.[target].executor) {
      throw new Error(
        `Could not find executor for "${target}" target in "${remote}" project.`
      );
    }

    const runOptions: { verbose?: boolean; isInitialHost?: boolean } = {};
    const [collection, executor] =
      workspaceProjects[remote].targets[target].executor.split(':');
    const { schema } = getExecutorInformation(
      collection,
      executor,
      workspaceRoot
    );
    if (options.verbose) {
      if (schema.additionalProperties || 'verbose' in schema.properties) {
        runOptions.verbose = options.verbose;
      }
    }

    if (executor === 'module-federation-dev-server') {
      runOptions.isInitialHost = false;
    }

    const serveObs = from(
      options.isInitialHost
        ? Promise.resolve()
        : checkPortIsActive({
            port: workspaceProjects[remote].targets[target].options.port,
            host:
              workspaceProjects[remote].targets[target].options.host ??
              'localhost',
          })
    ).pipe(
      catchError((error) => of(false)),
      switchMap((portIsActive) =>
        from(
          portIsActive
            ? Promise.resolve()
            : scheduleTarget(
                context.workspaceRoot,
                {
                  project: remote,
                  target,
                  configuration: context.target.configuration,
                  runOptions,
                },
                options.verbose
              ).then((obs) => {
                obs.toPromise().catch((err) => {
                  throw new Error(
                    `Remote '${remote}' failed to serve correctly due to the following: \r\n${err.toString()}`
                  );
                });
              })
        )
      )
    );

    obs.push(serveObs);
  }

  const staticFileServer = from(
    import('@nx/web/src/executors/file-server/file-server.impl')
  ).pipe(
    switchMap((fileServerExecutor) =>
      fileServerExecutor.default(
        {
          port: options.port,
          host: options.host,
          ssl: options.ssl,
          buildTarget: options.browserTarget,
          parallel: false,
          spa: false,
          withDeps: false,
          cors: true,
        },
        {
          projectGraph,
          root: context.workspaceRoot,
          target:
            projectGraph.nodes[context.target.project].data.targets[
              context.target.target
            ],
          targetName: context.target.target,
          projectName: context.target.project,
          configurationName: context.target.configuration,
          cwd: context.currentDirectory,
          isVerbose: options.verbose,
          projectsConfigurations:
            readProjectsConfigurationFromProjectGraph(projectGraph),
          nxJsonConfiguration: readNxJson(),
        }
      )
    )
  );

  const webpackDevServer = executeWebpackDevServerBuilder(options, context);

  return combineLatest([...obs]).pipe(
    concatMap(() =>
      iif(() => options.static, staticFileServer, webpackDevServer)
    )
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeModuleFederationDevServerBuilder
);
