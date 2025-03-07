import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';

import { hasExpoPlugin } from '../../../utils/has-expo-plugin';
import { NormalizedSchema } from './normalize-options';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import type { PackageJson } from 'nx/src/utils/package-json';

export function addProject(host: Tree, options: NormalizedSchema) {
  const hasPlugin = hasExpoPlugin(host);

  if (!hasPlugin) {
    addBuildTargetDefaults(host, '@nx/expo:build');
  }

  const projectConfiguration: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: `${options.appProjectRoot}/src`,
    projectType: 'application',
    targets: hasPlugin ? {} : getTargets(options),
    tags: options.parsedTags,
  };

  if (isUsingTsSolutionSetup(host)) {
    const packageJson: PackageJson = {
      name: options.importPath,
      version: '0.0.1',
      private: true,
    };

    if (options.importPath !== options.projectName) {
      packageJson.nx = { name: options.projectName };
    }
    if (!hasPlugin) {
      packageJson.nx ??= {};
      packageJson.nx.targets = getTargets(options);
    }
    if (options.parsedTags?.length) {
      packageJson.nx ??= {};
      packageJson.nx.tags = options.parsedTags;
    }

    writeJson(
      host,
      joinPathFragments(options.appProjectRoot, 'package.json'),
      packageJson
    );
  } else {
    addProjectConfiguration(
      host,
      options.projectName,
      projectConfiguration,
      options.standaloneConfig
    );
  }
}

function getTargets(options: NormalizedSchema) {
  const architect: { [key: string]: TargetConfiguration } = {};

  architect.start = {
    executor: '@nx/expo:start',
    dependsOn: ['sync-deps'],
    options: {},
  };

  architect.serve = {
    executor: '@nx/expo:serve',
    dependsOn: ['sync-deps'],
    options: {
      port: 4200,
    },
  };

  architect['run-ios'] = {
    executor: '@nx/expo:run',
    dependsOn: ['sync-deps'],
    options: {
      platform: 'ios',
    },
  };

  architect['run-android'] = {
    executor: '@nx/expo:run',
    dependsOn: ['sync-deps'],
    options: {
      platform: 'android',
    },
  };

  architect['build'] = {
    executor: '@nx/expo:build',
    dependsOn: ['sync-deps'],
    options: {},
  };

  architect['submit'] = {
    executor: '@nx/expo:submit',
    options: {},
  };

  architect['build-list'] = {
    executor: '@nx/expo:build-list',
    options: {},
  };

  architect['sync-deps'] = {
    executor: '@nx/expo:sync-deps',
    options: {},
  };

  architect['prebuild'] = {
    executor: '@nx/expo:prebuild',
    dependsOn: ['sync-deps'],
    options: {},
  };

  architect['install'] = {
    executor: '@nx/expo:install',
    options: {},
  };

  architect['update'] = {
    executor: '@nx/expo:update',
    options: {},
  };

  architect['export'] = {
    executor: '@nx/expo:export',
    dependsOn: ['sync-deps'],
    outputs: ['{options.outputDir}'],
    options: {
      platform: 'all',
      outputDir: `dist/${options.appProjectRoot}`,
    },
  };

  return architect;
}
