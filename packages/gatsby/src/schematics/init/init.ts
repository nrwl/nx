import { JsonObject } from '@angular-devkit/core';
import { chain, noop, Rule } from '@angular-devkit/schematics';
import {
  addDepsToPackageJson,
  addPackageWithInit,
  updateWorkspace,
} from '@nrwl/workspace';
import { setDefaultCollection } from '@nrwl/workspace/src/utils/rules/workspace';
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
  reactDomVersion,
  reactHelmetVersion,
  reactVersion,
  testingLibraryReactVersion,
} from '../../utils/versions';
import { Schema } from './schema';

function jsonIdentity(x: any): JsonObject {
  return x as JsonObject;
}

function setDefault(): Rule {
  const updateProjectWorkspace = updateWorkspace((workspace) => {
    workspace.extensions.schematics =
      jsonIdentity(workspace.extensions.schematics) || {};

    const gatsbySchematics =
      jsonIdentity(workspace.extensions.schematics['@nrwl/gatsby']) || {};

    workspace.extensions.schematics = {
      ...workspace.extensions.schematics,
      '@nrwl/gatsby': {
        application: {
          ...jsonIdentity(gatsbySchematics.application),
        },
      },
    };
  });
  return chain([setDefaultCollection('@nrwl/gatsby'), updateProjectWorkspace]);
}

export default function (schema: Schema) {
  return (tree) => {
    const isPnpm = tree.exists('pnpm-lock.yaml');
    return chain([
      setDefault(),
      schema.unitTestRunner === 'jest'
        ? addPackageWithInit('@nrwl/jest')
        : noop(),
      schema.e2eTestRunner === 'cypress'
        ? addPackageWithInit('@nrwl/cypress')
        : noop(),
      addDepsToPackageJson(
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
      ),
    ]);
  };
}
