import {
  addDependenciesToPackageJson,
  convertNxGenerator,
  GeneratorCallback,
  setDefaultCollection,
  Tree,
} from '@nrwl/devkit';
import { jestInitGenerator } from '@nrwl/jest';
import { cypressInitGenerator } from '@nrwl/cypress';
import { reactDomVersion, reactInitGenerator, reactVersion } from '@nrwl/react';

import {
  babelPluginModuleResolverVersion,
  babelPresetGatsbyVersion,
  gatsbyImageVersion,
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

function updateDependencies(host: Tree) {
  const isPnpm = host.exists('pnpm-lock.yaml');
  return addDependenciesToPackageJson(
    host,
    {
      gatsby: gatsbyVersion,
      'gatsby-image': gatsbyImageVersion,
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
      '@nrwl/react': nxVersion,
      '@testing-library/react': testingLibraryReactVersion,
      'babel-plugin-module-resolver': babelPluginModuleResolverVersion,
      'babel-preset-gatsby': babelPresetGatsbyVersion,
    }
  );
}

export async function gatsbyInitGenerator(host: Tree, schema: InitSchema) {
  let installTask: GeneratorCallback;

  setDefaultCollection(host, '@nrwl/gatsby');

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    installTask = jestInitGenerator(host, {});
  }
  if (!schema.e2eTestRunner || schema.e2eTestRunner === 'cypress') {
    installTask = cypressInitGenerator(host) || installTask;
  }

  installTask = (await reactInitGenerator(host, schema)) || installTask;

  installTask = updateDependencies(host) || installTask;

  return installTask;
}

export default gatsbyInitGenerator;
export const gatsbyInitSchematic = convertNxGenerator(gatsbyInitGenerator);
