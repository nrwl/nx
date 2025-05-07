import { GeneratorCallback, names, offsetFromRoot, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';

import { NormalizedSchema } from '../../application/schema';
import type { Schema } from '../schema';
import {
  corsVersion,
  expressVersion,
  isbotVersion,
  moduleFederationNodeVersion,
  typesExpressVersion,
} from '../../../utils/versions';
import {
  createNxRspackPluginOptions,
  getDefaultTemplateVariables,
} from '../../application/lib/create-application-files';

export async function setupSsrForRemote(
  tree: Tree,
  options: NormalizedSchema<Schema>,
  appName: string
) {
  const tasks: GeneratorCallback[] = [];
  const project = readProjectConfiguration(tree, appName);

  const pathToModuleFederationSsrFiles = options.typescriptConfiguration
    ? `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation-ssr-ts`
    : `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation-ssr`;

  const templateVariables =
    options.bundler === 'rspack'
      ? {
          ...getDefaultTemplateVariables(tree, options),
          rspackPluginOptions: {
            ...createNxRspackPluginOptions(
              options,
              offsetFromRoot(options.appProjectRoot),
              false
            ),
            mainServer: `./server.ts`,
          },
          port: Number(options?.devServerPort) || 4200,
          appName,
        }
      : {
          ...options,
          port: Number(options?.devServerPort) || 4200,
          appName,
          tmpl: '',
          browserBuildOutputPath: project.targets.build?.options?.outputPath,
          serverBuildOutputPath: project.targets.server?.options?.outputPath,
        };

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/${pathToModuleFederationSsrFiles}`),
    project.root,
    templateVariables
  );

  // For hosts to use when running remotes in static mode.
  const originalOutputPath =
    project.targets.build?.options?.outputPath ??
    options.isUsingTsSolutionConfig
      ? 'dist'
      : joinPathFragments(
          offsetFromRoot(options.appProjectRoot),
          'dist',
          options.appProjectRoot != '.'
            ? options.appProjectRoot
            : options.projectName
        );
  const serverOptions = project.targets.server?.options;
  const serverOutputPath =
    serverOptions?.outputPath ??
    joinPathFragments(originalOutputPath, 'server');
  const serverOutputName = serverOptions?.outputFileName ?? 'main.js';
  project.targets['serve-static'] = {
    dependsOn: ['build', 'server'],
    executor: 'nx:run-commands',
    defaultConfiguration: 'development',
    options: {
      command: `PORT=${options.devServerPort ?? 4200} node ${joinPathFragments(
        serverOutputPath,
        serverOutputName
      )}`,
    },
  };
  updateProjectConfiguration(tree, appName, project);

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      '@module-federation/node': moduleFederationNodeVersion,
      cors: corsVersion,
      isbot: isbotVersion,
      express: expressVersion,
      '@types/express': typesExpressVersion,
    },
    {}
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}
