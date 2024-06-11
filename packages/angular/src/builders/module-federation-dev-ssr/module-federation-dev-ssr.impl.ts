import {
  getPackageManagerCommand,
  readCachedProjectGraph,
  workspaceRoot,
} from '@nx/devkit';
import { execSync, fork } from 'child_process';
import { existsSync } from 'fs';
import { scheduleTarget } from 'nx/src/adapter/ngcli-adapter';
import { getExecutorInformation } from 'nx/src/command-line/run/executor-utils';
import { readProjectsConfigurationFromProjectGraph } from 'nx/src/project-graph/project-graph';
import { extname, join } from 'path';
import { from } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { getInstalledAngularVersionInfo } from '../../executors/utilities/angular-version-utils';
import {
  getDynamicMfManifestFile,
  getDynamicRemotes,
  getStaticRemotes,
  validateDevRemotes,
} from '../utilities/module-federation';
import type { Schema } from './schema';

export function executeModuleFederationDevSSRBuilder(
  schema: Schema,
  context: import('@angular-devkit/architect').BuilderContext
) {
  const { ...options } = schema;
  const projectGraph = readCachedProjectGraph();
  const { projects: workspaceProjects } =
    readProjectsConfigurationFromProjectGraph(projectGraph);
  const project = workspaceProjects[context.target.project];

  let pathToManifestFile: string;
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
  } else {
    pathToManifestFile = getDynamicMfManifestFile(
      project,
      context.workspaceRoot
    );
  }

  const devServeRemotes = !options.devRemotes
    ? []
    : Array.isArray(options.devRemotes)
    ? options.devRemotes
    : [options.devRemotes];

  validateDevRemotes({ devRemotes: devServeRemotes }, workspaceProjects);

  const remotesToSkip = new Set(options.skipRemotes ?? []);
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

  const remoteProcessPromises = [];
  for (const remote of remotes) {
    const isDev = devServeRemotes.includes(remote);
    const target = isDev ? 'serve-ssr' : 'static-server';

    if (!workspaceProjects[remote].targets?.[target]) {
      throw new Error(
        `Could not find "${target}" target in "${remote}" project.`
      );
    } else if (!workspaceProjects[remote].targets?.[target].executor) {
      throw new Error(
        `Could not find executor for "${target}" target in "${remote}" project.`
      );
    }

    const runOptions: { verbose?: boolean } = {};
    if (options.verbose) {
      const [collection, executor] =
        workspaceProjects[remote].targets[target].executor.split(':');
      const { schema } = getExecutorInformation(
        collection,
        executor,
        workspaceRoot,
        workspaceProjects
      );

      if (schema.additionalProperties || 'verbose' in schema.properties) {
        runOptions.verbose = options.verbose;
      }
    }

    const remotePromise = new Promise<void>((res, rej) => {
      if (target === 'static-server') {
        const remoteProject = workspaceProjects[remote];
        const remoteServerOutput = join(
          workspaceRoot,
          remoteProject.targets.server.options.outputPath,
          'main.js'
        );
        const pm = getPackageManagerCommand();
        execSync(
          `${pm.exec} nx run ${remote}:server${
            context.target.configuration
              ? `:${context.target.configuration}`
              : ''
          }`,
          { stdio: 'inherit' }
        );
        const child = fork(remoteServerOutput, {
          env: { PORT: remoteProject.targets['serve-ssr'].options.port },
        });
        child.on('message', (msg) => {
          if (msg === 'nx.server.ready') {
            res();
          }
        });
      }

      if (target === 'serve-ssr') {
        scheduleTarget(
          context.workspaceRoot,
          {
            project: remote,
            target,
            configuration: context.target.configuration,
            runOptions,
            projects: workspaceProjects,
          },
          options.verbose
        ).then((obs) =>
          obs
            .pipe(
              tap((result) => {
                result.success && res();
              })
            )
            .toPromise()
        );
      }
    });

    remoteProcessPromises.push(remotePromise);
  }

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();
  const { executeSSRDevServerBuilder } =
    angularMajorVersion >= 17
      ? require('@angular-devkit/build-angular')
      : require('@nguniversal/builders');

  return from(Promise.all(remoteProcessPromises)).pipe(
    switchMap(() => executeSSRDevServerBuilder(options, context))
  );
}

export default require('@angular-devkit/architect').createBuilder(
  executeModuleFederationDevSSRBuilder
);
