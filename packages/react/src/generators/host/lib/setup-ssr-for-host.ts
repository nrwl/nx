import { GeneratorCallback, offsetFromRoot, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { NormalizedSchema } from '../schema';
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

export async function setupSsrForHost(
  tree: Tree,
  options: NormalizedSchema,
  appName: string,
  defaultRemoteManifest: { name: string; port: number }[]
) {
  const tasks: GeneratorCallback[] = [];
  let project = readProjectConfiguration(tree, appName);
  if (options.bundler !== 'rspack') {
    project.targets.serve.executor =
      '@nx/react:module-federation-ssr-dev-server';
    updateProjectConfiguration(tree, appName, project);
  }

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
          ...getDefaultTemplateVariables(tree, options as any),
          rspackPluginOptions: {
            ...createNxRspackPluginOptions(
              options as any,
              offsetFromRoot(options.appProjectRoot),
              false
            ),
            mainServer: `./server.ts`,
          },
          port: Number(options?.devServerPort) || 4200,
          appName,
          static: !options?.dynamic,
          remotes: defaultRemoteManifest.map(({ name, port }) => {
            return {
              ...names(name),
              port,
            };
          }),
        }
      : {
          ...options,
          static: !options?.dynamic,
          port: Number(options?.devServerPort) || 4200,
          appName,
          tmpl: '',
          offsetFromRoot: offsetFromRoot(options.appProjectRoot),
          browserBuildOutputPath: project.targets.build?.options?.outputPath,
          remotes: defaultRemoteManifest.map(({ name, port }) => {
            return {
              ...names(name),
              port,
            };
          }),
        };

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/${pathToModuleFederationSsrFiles}`),
    project.root,
    templateVariables
  );

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
