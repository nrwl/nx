import type {
  NormalizedSchema,
  Schema,
  SchemaWithBrowserTarget,
  SchemaWithBuildTarget,
} from './schema';
import {
  logger,
  type ProjectConfiguration,
  type ProjectGraph,
  readCachedProjectGraph,
  readNxJson,
  workspaceRoot,
} from '@nx/devkit';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { executeDevServerBuilder } from '../dev-server/dev-server.impl';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { getExecutorInformation } from 'nx/src/command-line/run/executor-utils';
import { validateDevRemotes } from '../utilities/module-federation';
import { existsSync } from 'fs';
import { dirname, extname, join } from 'path';
import {
  getModuleFederationConfig,
  getRemotes,
} from '@nx/webpack/src/utils/module-federation';
import { fork } from 'child_process';
import { combineLatest, concatMap, from, switchMap } from 'rxjs';
import { cpSync } from 'fs';

function buildStaticRemotes(
  remotes: {
    remotePorts: any[];
    staticRemotes: string[];
    devRemotes: string[];
  },
  nxBin,
  context: import('@angular-devkit/architect').BuilderContext,
  options: Schema
) {
  const mappedLocationOfRemotes: Record<string, string> = {};
  for (const app of remotes.staticRemotes) {
    mappedLocationOfRemotes[app] = `http${options.ssl ? 's' : ''}://${
      options.host
    }:${options.staticRemotesPort}/${app}`;
  }
  process.env.NX_MF_DEV_SERVER_STATIC_REMOTES = JSON.stringify(
    mappedLocationOfRemotes
  );

  const staticRemoteBuildPromise = new Promise<void>((res) => {
    logger.info(
      `NX Building ${remotes.staticRemotes.length} static remotes...`
    );
    const staticProcess = fork(
      nxBin,
      [
        'run-many',
        `--target=build`,
        `--projects=${remotes.staticRemotes.join(',')}`,
        ...(context.target.configuration
          ? [`--configuration=${context.target.configuration}`]
          : []),
        ...(options.parallel ? [`--parallel=${options.parallel}`] : []),
      ],
      {
        cwd: context.workspaceRoot,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      }
    );
    staticProcess.stdout.on('data', (data) => {
      const ANSII_CODE_REGEX =
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      const stdoutString = data.toString().replace(ANSII_CODE_REGEX, '');
      if (stdoutString.includes('Successfully ran target build')) {
        staticProcess.stdout.removeAllListeners('data');
        logger.info(`NX Built ${remotes.staticRemotes.length} static remotes`);
        res();
      }
    });
    staticProcess.stderr.on('data', (data) => logger.info(data.toString()));
    staticProcess.on('exit', (code) => {
      if (code !== 0) {
        throw new Error(`Remotes failed to build. See above for errors.`);
      }
    });
    process.on('SIGTERM', () => staticProcess.kill('SIGTERM'));
    process.on('exit', () => staticProcess.kill('SIGTERM'));
  });
  return staticRemoteBuildPromise;
}

function startStaticRemotesFileServer(
  remotes: {
    remotePorts: any[];
    staticRemotes: string[];
    devRemotes: string[];
  },
  projectGraph: ProjectGraph,
  options: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  let shouldMoveToCommonLocation = false;
  let commonOutputDirectory: string;

  for (const app of remotes.staticRemotes) {
    const outputPath =
      projectGraph.nodes[app].data.targets['build'].options.outputPath;
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
        projectGraph.nodes[app].data.targets['build'].options.outputPath;
      cpSync(outputPath, join(commonOutputDirectory, app), {
        force: true,
        recursive: true,
      });
    }
  }

  const staticRemotesIter$ = from(
    import('@nx/web/src/executors/file-server/file-server.impl')
  ).pipe(
    switchMap((fileServerExecutor) =>
      fileServerExecutor.default(
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
  return staticRemotesIter$;
}

function startDevRemotes(
  remotes: {
    remotePorts: any[];
    staticRemotes: string[];
    devRemotes: string[];
  },
  workspaceProjects: Record<string, ProjectConfiguration>,
  options: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  const devRemotes$ = [];
  for (const app of remotes.devRemotes) {
    if (!workspaceProjects[app].targets?.['serve']) {
      throw new Error(`Could not find "serve" target in "${app}" project.`);
    } else if (!workspaceProjects[app].targets?.['serve'].executor) {
      throw new Error(
        `Could not find executor for "serve" target in "${app}" project.`
      );
    }

    const runOptions: { verbose?: boolean; isInitialHost?: boolean } = {};
    const [collection, executor] =
      workspaceProjects[app].targets['serve'].executor.split(':');
    const isUsingModuleFederationDevServerExecutor = executor.includes(
      'module-federation-dev-server'
    );
    const { schema } = getExecutorInformation(
      collection,
      executor,
      workspaceRoot,
      workspaceProjects
    );
    if (
      (options.verbose && schema.additionalProperties) ||
      'verbose' in schema.properties
    ) {
      runOptions.verbose = options.verbose;
    }

    if (isUsingModuleFederationDevServerExecutor) {
      runOptions.isInitialHost = false;
    }

    const serve$ = scheduleTarget(
      context.workspaceRoot,
      {
        project: app,
        target: 'serve',
        configuration: context.target.configuration,
        runOptions,
        projects: workspaceProjects,
      },
      options.verbose
    ).then((obs) => {
      obs.toPromise().catch((err) => {
        throw new Error(
          `Remote '${app}' failed to serve correctly due to the following: \r\n${err.toString()}`
        );
      });
    });

    devRemotes$.push(serve$);
  }
  return devRemotes$;
}

export function executeModuleFederationDevServerBuilder(
  schema: Schema,
  context: import('@angular-devkit/architect').BuilderContext
): ReturnType<typeof executeDevServerBuilder | any> {
  // Force Node to resolve to look for the nx binary that is inside node_modules
  const nxBin = require.resolve('nx/bin/nx');
  const options = normalizeOptions(schema);
  options.staticRemotesPort ??= options.port + 1;

  const projectGraph = readCachedProjectGraph();
  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const project = workspaceProjects[context.target.project];

  const staticFileServer = from(
    import('@nx/web/src/executors/file-server/file-server.impl')
  ).pipe(
    switchMap((fileServerExecutor) =>
      fileServerExecutor.default(
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
          projectsConfigurations: { projects: workspaceProjects, version: 2 },
          nxJsonConfiguration: readNxJson(),
        }
      )
    )
  );
  const webpackDevServer = executeDevServerBuilder(options, context);

  const currExecutor = options.static ? staticFileServer : webpackDevServer;

  if (options.isInitialHost === false) {
    return currExecutor;
  }

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

  const moduleFederationConfig = getModuleFederationConfig(
    project.targets.build.options.tsConfig,
    context.workspaceRoot,
    project.root,
    'angular'
  );

  const remotes = getRemotes(
    options.devRemotes,
    options.skipRemotes,
    moduleFederationConfig,
    {
      projectName: project.name,
      projectGraph,
      root: context.workspaceRoot,
    },
    pathToManifestFile
  );

  if (remotes.devRemotes.length > 0 && !schema.staticRemotesPort) {
    options.staticRemotesPort = options.devRemotes.reduce((portToUse, r) => {
      const remotePort =
        projectGraph.nodes[r].data.targets['serve'].options.port;
      if (remotePort >= portToUse) {
        return remotePort + 1;
      }
    }, options.staticRemotesPort);
  }

  const staticRemoteBuildPromise = buildStaticRemotes(
    remotes,
    nxBin,
    context,
    options
  );

  return from(staticRemoteBuildPromise).pipe(
    concatMap(() => {
      const staticRemotesIter$ =
        remotes.staticRemotes.length > 0
          ? startStaticRemotesFileServer(
              remotes,
              projectGraph,
              options,
              context
            )
          : from(Promise.resolve());

      const devRemotes$ = startDevRemotes(
        remotes,
        workspaceProjects,
        options,
        context
      );

      return devRemotes$.length > 0
        ? combineLatest([...devRemotes$, staticRemotesIter$]).pipe(
            concatMap(() => currExecutor)
          )
        : from(staticRemotesIter$).pipe(concatMap(() => currExecutor));
    })
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeModuleFederationDevServerBuilder
);

function normalizeOptions(schema: Schema): NormalizedSchema {
  let buildTarget = (schema as SchemaWithBuildTarget).buildTarget;
  if ((schema as SchemaWithBrowserTarget).browserTarget) {
    buildTarget ??= (schema as SchemaWithBrowserTarget).browserTarget;
    delete (schema as SchemaWithBrowserTarget).browserTarget;
  }

  return {
    ...schema,
    buildTarget,
    host: schema.host ?? 'localhost',
    port: schema.port ?? 4200,
    liveReload: schema.liveReload ?? true,
    open: schema.open ?? false,
    ssl: schema.ssl ?? false,
  };
}
