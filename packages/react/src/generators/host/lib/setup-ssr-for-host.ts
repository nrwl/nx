import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  runTasksInSerial,
  updateProjectConfiguration,
} from '@nx/devkit';

import type { Schema } from '../schema';
import { moduleFederationNodeVersion } from '../../../utils/versions';

export async function setupSsrForHost(
  tree: Tree,
  options: Schema,
  appName: string,
  defaultRemoteManifest: { name: string; port: number }[]
) {
  const tasks: GeneratorCallback[] = [];
  let project = readProjectConfiguration(tree, appName);
  project.targets.serve.executor =
    options.bundler === 'rspack'
      ? '@nx/rspack:module-federation-ssr-dev-server'
      : '@nx/react:module-federation-ssr-dev-server';
  updateProjectConfiguration(tree, appName, project);

  const pathToModuleFederationSsrFiles = options.typescriptConfiguration
    ? `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation-ssr-ts`
    : `${
        options.bundler === 'rspack' ? 'rspack-' : 'webpack-'
      }module-federation-ssr`;

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/${pathToModuleFederationSsrFiles}`),
    project.root,
    {
      ...options,
      static: !options?.dynamic,
      port: Number(options?.devServerPort) || 4200,
      remotes: defaultRemoteManifest.map(({ name, port }) => {
        return {
          ...names(name),
          port,
        };
      }),
      appName,
      tmpl: '',
      browserBuildOutputPath: project.targets.build.options.outputPath,
    }
  );

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      '@module-federation/node': moduleFederationNodeVersion,
    },
    {}
  );
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}
