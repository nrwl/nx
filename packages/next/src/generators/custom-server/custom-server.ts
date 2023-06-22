import type { Tree } from '@nx/devkit';
import {
  updateJson,
  convertNxGenerator,
  generateFiles,
  joinPathFragments,
  logger,
  offsetFromRoot,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import { CustomServerSchema } from './schema';

export async function customServerGenerator(
  host: Tree,
  options: CustomServerSchema
): Promise<void> {
  const project = readProjectConfiguration(host, options.project);

  if (
    project.targets?.build?.executor !== '@nx/next:build' &&
    project.targets?.build?.executor !== '@nrwl/next:build'
  ) {
    logger.error(
      `Project ${options.project} is not a Next.js project. Did you generate it with "nx g @nx/next:app"?`
    );
    return;
  }

  const outputPath = project.targets?.build?.options?.outputPath;
  const root = project.root;

  if (
    !root ||
    !outputPath ||
    !project.targets?.build?.configurations?.development ||
    !project.targets?.build?.configurations?.production
  ) {
    logger.error(
      `Project ${options.project} has invalid config. Did you generate it with "nx g @nx/next:app"?`
    );
    return;
  }

  if (
    project.targets?.['build-custom-server'] ||
    project.targets?.['serve-custom-server']
  ) {
    logger.warn(
      `Project ${options.project} has custom server targets already: build-custom-server, serve-custom-server. Remove these targets from project and try again.`
    );
    return;
  }

  generateFiles(host, joinPathFragments(__dirname, 'files'), project.root, {
    ...options,
    offsetFromRoot: offsetFromRoot(project.root),
    projectRoot: project.root,
    tmpl: '',
  });

  project.targets.build.dependsOn = ['build-custom-server'];
  project.targets.serve.options.customServerTarget = `${options.project}:serve-custom-server`;
  project.targets.serve.configurations.development.customServerTarget = `${options.project}:serve-custom-server:development`;
  project.targets.serve.configurations.production.customServerTarget = `${options.project}:serve-custom-server:production`;

  project.targets['build-custom-server'] = {
    executor: '@nx/js:tsc',
    defaultConfiguration: 'production',
    options: {
      outputPath,
      main: `${root}/server/main.ts`,
      tsConfig: `${root}/tsconfig.server.json`,
      clean: false,
      assets: [],
    },
    configurations: {
      development: {},
      production: {},
    },
  };

  project.targets['serve-custom-server'] = {
    executor: '@nx/js:node',
    defaultConfiguration: 'development',
    options: {
      buildTarget: `${options.project}:build-custom-server`,
    },
    configurations: {
      development: {
        buildTarget: `${options.project}:build-custom-server:development`,
      },
      production: {
        buildTarget: `${options.project}:build-custom-server:production`,
      },
    },
  };

  updateProjectConfiguration(host, options.project, project);

  updateJson(host, 'nx.json', (json) => {
    json.tasksRunnerOptions ??= {};
    json.tasksRunnerOptions.default ??= { options: {} };
    json.tasksRunnerOptions.default.options.cacheableOperations = [
      ...json.tasksRunnerOptions.default.options.cacheableOperations,
      'build-custom-server',
    ];
    return json;
  });
}

export const customServerSchematic = convertNxGenerator(customServerGenerator);
