import { NormalizedSchema } from './normalize-options';
import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nx/devkit';

export function addProject(host: Tree, options: NormalizedSchema) {
  const targets: Record<string, any> = {};

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

  targets.export = {
    executor: '@nx/next:export',
    options: {
      buildTarget: `${options.projectName}:build:production`,
    },
  };

  const project: ProjectConfiguration = {
    root: options.appProjectRoot,
    sourceRoot: options.appProjectRoot,
    projectType: 'application',
    targets,
    tags: options.parsedTags,
  };

  addProjectConfiguration(host, options.projectName, {
    ...project,
  });
}
