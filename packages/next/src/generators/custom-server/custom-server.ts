import type { Tree } from '@nx/devkit';
import {
  updateJson,
  generateFiles,
  logger,
  offsetFromRoot,
  readProjectConfiguration,
  updateProjectConfiguration,
  readNxJson,
} from '@nx/devkit';
import { CustomServerSchema } from './schema';
import { join } from 'path';
import { configureForSwc } from '../../utils/add-swc-to-custom-server';

export async function customServerGenerator(
  host: Tree,
  options: CustomServerSchema
) {
  const project = readProjectConfiguration(host, options.project);

  const nxJson = readNxJson(host);
  const hasPlugin = nxJson.plugins?.some((p) =>
    typeof p === 'string'
      ? p === '@nx/next/plugin'
      : p.plugin === '@nx/next/plugin'
  );

  if (
    project.targets?.build?.executor !== '@nx/next:build' &&
    project.targets?.build?.executor !== '@nrwl/next:build' &&
    !hasPlugin
  ) {
    logger.error(
      `Project ${options.project} is not a Next.js project. Did you generate it with "nx g @nx/next:app"?`
    );
    return;
  }

  // In Nx 18 next artifacts are inside the project root .next/ & dist/ (for custom server)
  const outputPath = hasPlugin
    ? `dist/${project.root}`
    : project.targets?.build?.options?.outputPath;
  const root = project.root;

  if (
    (!root ||
      !outputPath ||
      !project.targets?.build?.configurations?.development ||
      !project.targets?.build?.configurations?.production) &&
    !hasPlugin
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

  // In Nx 18 next artifacts are inside the project root .next/ & dist/ (for custom server)
  // So we need ensure the mapping is correct from dist to the project root
  const projectPathFromDist = `../../${offsetFromRoot(project.root)}${
    project.root
  }`;

  generateFiles(host, join(__dirname, 'files'), project.root, {
    ...options,
    hasPlugin,
    projectPathFromDist,
    offsetFromRoot: offsetFromRoot(project.root),
    projectRoot: project.root,
    tmpl: '',
  });

  if (!hasPlugin) {
    project.targets.build.dependsOn = ['build-custom-server'];
    project.targets.serve.options.customServerTarget = `${options.project}:serve-custom-server`;
    project.targets.serve.configurations.development.customServerTarget = `${options.project}:serve-custom-server:development`;
    project.targets.serve.configurations.production.customServerTarget = `${options.project}:serve-custom-server:production`;
  } else {
    project.targets['build'] = {
      dependsOn: ['^build', 'build-custom-server'],
    };
  }

  project.targets['build-custom-server'] = {
    executor: options.compiler === 'tsc' ? '@nx/js:tsc' : '@nx/js:swc',
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
    defaultConfiguration: 'production',
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
    if (
      !json.tasksRunnerOptions?.default?.options?.cacheableOperations?.includes(
        'build-custom-server'
      ) &&
      json.tasksRunnerOptions?.default?.options?.cacheableOperations
    ) {
      json.tasksRunnerOptions.default.options.cacheableOperations.push(
        'build-custom-server'
      );
    }
    json.targetDefaults ??= {};
    json.targetDefaults['build-custom-server'] ??= {};
    json.targetDefaults['build-custom-server'].cache ??= true;
    return json;
  });

  if (options.compiler === 'swc') {
    return configureForSwc(host, project.root);
  }
}
