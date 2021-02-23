import { NormalizedSchema } from './normalize-options';
import {
  addProjectConfiguration,
  joinPathFragments,
  NxJsonProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';

export function addProject(host: Tree, options: NormalizedSchema) {
  const nxConfig: NxJsonProjectConfiguration = {
    tags: options.parsedTags,
  };

  const targets: Record<string, any> = {};

  targets.build = {
    builder: '@nrwl/gatsby:build',
    options: {
      outputPath: `${options.projectRoot}/public`,
      uglify: true,
      color: true,
      profile: false,
    },
    configurations: {
      production: {},
    },
  };

  targets.serve = {
    builder: '@nrwl/gatsby:server',
    options: {
      buildTarget: `${options.projectName}:build`,
    },
    configurations: {
      production: {
        buildTarget: `${options.projectName}:build:production`,
      },
    },
  };

  const project: ProjectConfiguration = {
    root: options.projectRoot,
    sourceRoot: joinPathFragments(options.projectRoot, 'src'),
    projectType: 'application',
    targets,
  };

  addProjectConfiguration(host, options.projectName, {
    ...project,
    ...nxConfig,
  });
}
