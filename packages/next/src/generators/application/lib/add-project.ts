import { NormalizedSchema } from './normalize-options';
import {
  addProjectConfiguration,
  joinPathFragments,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

export function addProject(host: Tree, options: NormalizedSchema) {
  const targets: Record<string, any> = {};

  targets.build = {
    builder: '@nrwl/next:build',
    outputs: ['{options.outputPath}'],
    defaultConfiguration: 'production',
    options: {
      root: options.appProjectRoot,
      outputPath: joinPathFragments('dist', options.appProjectRoot),
    },
    configurations: {
      development: {},
      production: {},
    },
  };

  targets.serve = {
    builder: '@nrwl/next:server',
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

  if (options.server) {
    targets.serve.options = {
      ...targets.serve.options,
      customServerPath: options.server,
    };
  }

  targets.export = {
    builder: '@nrwl/next:export',
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

  addProjectConfiguration(
    host,
    options.projectName,
    {
      ...project,
    },
    options.standaloneConfig
  );
}
