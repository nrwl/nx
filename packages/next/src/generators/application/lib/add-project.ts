import { NormalizedSchema } from './normalize-options';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  readNxJson,
  Tree,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { nextVersion } from '../../../utils/versions';
import { reactDomVersion, reactVersion } from '@nx/react';
import type { PackageJson } from 'nx/src/utils/package-json';

export function addProject(host: Tree, options: NormalizedSchema) {
  const targets: Record<string, any> = {};

  // Check if plugin exists in nx.json and if it doesn't then we can continue
  // with the default targets.

  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/next/plugin'
      : p.plugin === '@nx/next/plugin'
  );

  if (!hasPlugin) {
    addBuildTargetDefaults(host, '@nx/next:build');

    targets.build = {
      executor: '@nx/next:build',
      outputs: ['{options.outputPath}'],
      defaultConfiguration: 'production',
      options: {
        outputPath: options.outputPath,
      },
      configurations: {
        development: {
          outputPath: options.appProjectRoot,
        },
        production: {},
      },
    };

    targets.serve = {
      executor: '@nx/next:server',
      defaultConfiguration: 'development',
      options: {
        buildTarget: `${options.projectName}:build`,
        dev: true,
      },
      configurations: {
        development: {
          buildTarget: `${options.projectName}:build:development`,
          dev: true,
        },
        production: {
          buildTarget: `${options.projectName}:build:production`,
          dev: false,
        },
      },
    };
  }

  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: options.appProjectRoot,
    projectType: 'application',
    targets,
    tags: options.parsedTags,
  };

  const packageJson: PackageJson = {
    name: options.importPath,
    version: '0.0.1',
    private: true,
    dependencies: {
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
  };

  if (!options.useProjectJson) {
    if (options.projectName !== options.importPath) {
      packageJson.nx = { name: options.projectName };
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }
  } else {
    addProjectConfiguration(host, options.projectName, {
      ...project,
    });
  }

  if (!options.useProjectJson || options.isTsSolutionSetup) {
    writeJson(
      host,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  }
}
