import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { join } from 'path';
import {
  corsVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
} from '../../../utils/versions';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export async function updateSsrSetup(
  tree: Tree,
  {
    appName,
    port,
    standalone,
    typescriptConfiguration,
    skipPackageJson,
  }: {
    appName: string;
    port: number;
    standalone: boolean;
    typescriptConfiguration: boolean;
    skipPackageJson?: boolean;
  }
) {
  let project = readProjectConfiguration(tree, appName);

  tree.rename(
    joinPathFragments(project.sourceRoot, 'main.server.ts'),
    joinPathFragments(project.sourceRoot, 'bootstrap.server.ts')
  );

  tree.write(
    joinPathFragments(project.root, 'server.ts'),
    "import('./src/main.server');"
  );

  const browserBundleOutput = project.targets.build.options.outputPath;
  const serverBundleOutput = project.targets.build.options.outputPath.replace(
    /\/browser$/,
    '/server'
  );

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);
  generateFiles(
    tree,
    join(
      __dirname,
      '../files/common',
      angularMajorVersion >= 17 ? 'v17+' : 'pre-v17'
    ),
    project.root,
    {
      appName,
      browserBundleOutput,
      serverBundleOutput,
      standalone,
      tmpl: '',
    }
  );

  const pathToTemplateFiles = typescriptConfiguration ? 'base-ts' : 'base';

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/${pathToTemplateFiles}`),
    project.root,
    {
      tmpl: '',
    }
  );

  if (standalone) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone'),
      project.root,
      {
        appName,
        standalone,
        tmpl: '',
      }
    );
  }

  // update project.json
  project = readProjectConfiguration(tree, appName);

  project.targets.server.executor = '@nx/angular:webpack-server';
  project.targets.server.options.customWebpackConfig = {
    path: joinPathFragments(
      project.root,
      `webpack.server.config.${typescriptConfiguration ? 'ts' : 'js'}`
    ),
  };
  if (
    project.targets.server.configurations &&
    project.targets.server.configurations.development
  ) {
    if ('vendorChunk' in project.targets.server.configurations.development) {
      delete project.targets.server.configurations.development.vendorChunk;
    }
  }
  project.targets['serve-ssr'].options = {
    ...(project.targets['serve-ssr'].options ?? {}),
    port,
  };

  project.targets['static-server'] = {
    dependsOn: ['build', 'server'],
    executor: 'nx:run-commands',
    options: {
      command: `PORT=${port} node ${joinPathFragments(
        project.targets.server.options.outputPath,
        'main.js'
      )}`,
    },
  };

  updateProjectConfiguration(tree, appName, project);

  if (!skipPackageJson) {
    return addDependenciesToPackageJson(
      tree,
      {
        cors: corsVersion,
        '@module-federation/node': moduleFederationNodeVersion,
      },
      {
        '@types/cors': typesCorsVersion,
      }
    );
  }

  return () => {};
}
