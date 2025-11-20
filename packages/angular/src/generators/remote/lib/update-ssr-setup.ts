import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  names,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';
import { gte } from 'semver';
import {
  corsVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
} from '../../../utils/versions';
import { getComponentType } from '../../utils/artifact-types';
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
  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  let project = readProjectConfiguration(tree, appName);
  const sourceRoot = getProjectSourceRoot(project, tree);

  tree.rename(
    joinPathFragments(sourceRoot, 'main.server.ts'),
    joinPathFragments(sourceRoot, 'bootstrap.server.ts')
  );

  const pathToServerEntry = joinPathFragments(
    angularMajorVersion >= 19 ? sourceRoot : project.root,
    'server.ts'
  );
  tree.write(
    pathToServerEntry,
    `import('./${angularMajorVersion >= 19 ? '' : 'src/'}main.server');`
  );

  const browserBundleOutput = project.targets.build.options.outputPath;
  const serverBundleOutput = project.targets.build.options.outputPath.replace(
    /\/browser$/,
    '/server'
  );

  generateFiles(tree, join(__dirname, '../files/common'), project.root, {
    appName,
    browserBundleOutput,
    serverBundleOutput,
    standalone,
    commonEngineEntryPoint:
      angularMajorVersion >= 19 ? '@angular/ssr/node' : '@angular/ssr',
    tmpl: '',
  });

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
    const componentType = getComponentType(tree);
    const componentFileSuffix = componentType ? `.${componentType}` : '';

    const useBootstrapContext =
      // https://github.com/angular/angular-cli/releases/tag/20.3.0
      gte(angularVersion, '20.3.0') ||
      // https://github.com/angular/angular-cli/releases/tag/19.2.16
      (angularMajorVersion === 19 && gte(angularVersion, '19.2.16')) ||
      // https://github.com/angular/angular-cli/releases/tag/18.2.21
      (angularMajorVersion === 18 && gte(angularVersion, '18.2.21'));

    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone'),
      project.root,
      {
        appName,
        standalone,
        componentType: componentType ? names(componentType).className : '',
        componentFileSuffix,
        useBootstrapContext,
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
