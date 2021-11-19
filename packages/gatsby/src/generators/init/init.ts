import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  detectPackageManager,
  GeneratorCallback,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { cypressInitGenerator } from '@nrwl/cypress';
import { reactDomVersion, reactInitGenerator, reactVersion } from '@nrwl/react';
import { setDefaultCollection } from '@nrwl/workspace/src/utilities/set-default-collection';

import {
  babelPluginModuleResolverVersion,
  babelPresetGatsbyVersion,
  gatsbyPluginImageVersion,
  gatsbyPluginManifestVersion,
  gatsbyPluginOfflineVersion,
  gatsbyPluginPnpm,
  gatsbyPluginReactHelmetVersion,
  gatsbyPluginSharpVersion,
  gatsbyPluginSvgrVersion,
  gatsbyPluginTypescriptVersion,
  gatsbySourceFilesystemVersion,
  gatsbyTransformerSharpVersion,
  gatsbyVersion,
  nxVersion,
  propTypesVersion,
  reactHelmetVersion,
  testingLibraryReactVersion,
} from '../../utils/versions';

import { InitSchema } from './schema';
import { runTasksInSerial } from '@nrwl/workspace/src/utilities/run-tasks-in-serial';

function updateDependencies(host: Tree) {
  updateJson(host, 'package.json', (json) => {
    if (json.dependencies && json.dependencies['@nrwl/gatsby']) {
      delete json.dependencies['@nrwl/gatsby'];
    }
    return json;
  });

  const isPnpm = detectPackageManager(host.root) === 'pnpm';
  return addDependenciesToPackageJson(
    host,
    {
      gatsby: gatsbyVersion,
      'gatsby-plugin-image': gatsbyPluginImageVersion,
      'gatsby-plugin-svgr': gatsbyPluginSvgrVersion,
      'gatsby-plugin-manifest': gatsbyPluginManifestVersion,
      'gatsby-plugin-offline': gatsbyPluginOfflineVersion,
      'gatsby-plugin-react-helmet': gatsbyPluginReactHelmetVersion,
      'gatsby-plugin-sharp': gatsbyPluginSharpVersion,
      'gatsby-source-filesystem': gatsbySourceFilesystemVersion,
      'gatsby-transformer-sharp': gatsbyTransformerSharpVersion,
      'prop-types': propTypesVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
      'react-helmet': reactHelmetVersion,
      'gatsby-plugin-typescript': gatsbyPluginTypescriptVersion,
      ...(isPnpm ? { 'gatsby-plugin-pnpm': gatsbyPluginPnpm } : {}),
    },
    {
      '@nrwl/gatsby': nxVersion,
      '@testing-library/react': testingLibraryReactVersion,
      'babel-plugin-module-resolver': babelPluginModuleResolverVersion,
      'babel-preset-gatsby': babelPresetGatsbyVersion,
    }
  );
}

export async function gatsbyInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];
  setDefaultCollection(host, '@nrwl/gatsby');

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const jestTask = jestInitGenerator(host, {});
    tasks.push(jestTask);
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    const cypressTask = cypressInitGenerator(host);
    tasks.push(cypressTask);
  }

  const reactTask = await reactInitGenerator(host, schema);
  tasks.push(reactTask);

  const installTask = updateDependencies(host);
  tasks.push(installTask);

  return runTasksInSerial(...tasks);
}

export default gatsbyInitGenerator;
export const gatsbyInitSchematic = convertNxGenerator(gatsbyInitGenerator);
