import {
  type CreateNodes,
  type CreateNodesContext,
  createNodesFromFiles,
  type CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  normalizePath,
  type NxJsonConfiguration,
  type ProjectConfiguration,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName } from '@nx/js';
import { readdirSync } from 'fs';
import { hashObject } from 'nx/src/devkit-internals';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { dirname, join, relative } from 'path';
import { NX_PLUGIN_OPTIONS } from '../utils/constants';

export interface CypressPluginOptions {
  ciTargetName?: string;
  targetName?: string;
  openTargetName?: string;
  componentTestingTargetName?: string;
  ciComponentTestingTargetName?: string;
}

function readTargetsCache(cachePath: string): Record<string, CypressTargets> {
  try {
    return process.env.NX_CACHE_PROJECT_GRAPH !== 'false'
      ? readJsonFile(cachePath)
      : {};
  } catch {
    return {};
  }
}

function writeTargetsToCache(cachePath: string, results: CypressTargets) {
  writeJsonFile(cachePath, results);
}

const cypressConfigGlob = '**/cypress.config.{js,ts,mjs,cjs}';
const defaultPatterns = {
  e2e: {
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    excludeSpecPattern: '*.hot-update.js',
  },
  component: {
    specPattern: '**/*.cy.{js,jsx,ts,tsx}',
    excludeSpecPattern: ['/snapshots/*', '/image_snapshots/*'],
  },
};

const pmc = getPackageManagerCommand();

export const createNodesV2: CreateNodesV2<CypressPluginOptions> = [
  cypressConfigGlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `cypress-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

/**
 * @deprecated This is replaced with {@link createNodesV2}. Update your plugin to export its own `createNodesV2` function that wraps this one instead.
 * This function will change to the v2 function in Nx 20.
 */
export const createNodes: CreateNodes<CypressPluginOptions> = [
  cypressConfigGlob,
  (configFile, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    return createNodesInternal(configFile, options, context, {});
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: CypressPluginOptions,
  context: CreateNodesContext,
  targetsCache: CypressTargets
) {
  options = normalizeOptions(options);
  const projectRoot = dirname(configFilePath);

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  }

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    options,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= await buildCypressTargets(
    configFilePath,
    projectRoot,
    options,
    context
  );
  const { targets, metadata } = targetsCache[hash];

  const project: Omit<ProjectConfiguration, 'root'> = {
    projectType: 'application',
    targets,
    metadata,
  };

  return {
    projects: {
      [projectRoot]: project,
    },
  };
}

function getTargetOutputs(outputs: string[], subfolder?: string): string[] {
  return outputs.map((output) =>
    subfolder ? join(output, subfolder) : output
  );
}

function getTargetConfig(
  cypressConfig: any,
  outputSubfolder: string,
  ciBaseUrl?: string
): string {
  const config = {};
  if (ciBaseUrl) {
    config['baseUrl'] = ciBaseUrl;
  }

  const { screenshotsFolder, videosFolder, e2e, component } = cypressConfig;

  if (videosFolder) {
    config['videosFolder'] = join(videosFolder, outputSubfolder);
  }

  if (screenshotsFolder) {
    config['screenshotsFolder'] = join(screenshotsFolder, outputSubfolder);
  }

  if (e2e) {
    config['e2e'] = {};
    if (e2e.videosFolder) {
      config['e2e']['videosFolder'] = join(e2e.videosFolder, outputSubfolder);
    }
    if (e2e.screenshotsFolder) {
      config['e2e']['screenshotsFolder'] = join(
        e2e.screenshotsFolder,
        outputSubfolder
      );
    }
  }

  if (component) {
    config['component'] = {};
    if (component.videosFolder) {
      config['component']['videosFolder'] = join(
        component.videosFolder,
        outputSubfolder
      );
    }
    if (component.screenshotsFolder) {
      config['component']['screenshotsFolder'] = join(
        component.screenshotsFolder,
        outputSubfolder
      );
    }
  }

  // Stringify twice to escape the quotes.
  return JSON.stringify(JSON.stringify(config));
}

function getOutputs(
  projectRoot: string,
  cypressConfig: any,
  testingType: 'e2e' | 'component'
): string[] {
  function getOutput(path: string): string {
    if (path.startsWith('..')) {
      return joinPathFragments('{workspaceRoot}', projectRoot, path);
    } else {
      return joinPathFragments('{projectRoot}', path);
    }
  }

  const { screenshotsFolder, videosFolder, e2e, component } = cypressConfig;
  const outputs = [];

  if (videosFolder) {
    outputs.push(getOutput(videosFolder));
  }

  if (screenshotsFolder) {
    outputs.push(getOutput(screenshotsFolder));
  }

  switch (testingType) {
    case 'e2e': {
      if (e2e.videosFolder) {
        outputs.push(getOutput(e2e.videosFolder));
      }
      if (e2e.screenshotsFolder) {
        outputs.push(getOutput(e2e.screenshotsFolder));
      }
      break;
    }
    case 'component': {
      if (component.videosFolder) {
        outputs.push(getOutput(component.videosFolder));
      }
      if (component.screenshotsFolder) {
        outputs.push(getOutput(component.screenshotsFolder));
      }
      break;
    }
  }

  return outputs;
}

type CypressTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

async function buildCypressTargets(
  configFilePath: string,
  projectRoot: string,
  options: CypressPluginOptions,
  context: CreateNodesContext
): Promise<CypressTargets> {
  const cypressConfig = await loadConfigFile(
    join(context.workspaceRoot, configFilePath)
  );

  const pluginPresetOptions = {
    ...cypressConfig.e2e?.[NX_PLUGIN_OPTIONS],
    ...cypressConfig.env,
    ...cypressConfig.e2e?.env,
  };

  const webServerCommands: Record<string, string> =
    pluginPresetOptions?.webServerCommands;
  const shouldReuseExistingServer =
    pluginPresetOptions?.reuseExistingServer ?? true;

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};
  let metadata: ProjectConfiguration['metadata'];
  const tsNodeCompilerOptions = JSON.stringify({ customConditions: null });

  if ('e2e' in cypressConfig) {
    targets[options.targetName] = {
      command: `cypress run`,
      options: {
        cwd: projectRoot,
        env: { TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions },
      },
      cache: true,
      inputs: getInputs(namedInputs),
      outputs: getOutputs(projectRoot, cypressConfig, 'e2e'),
      metadata: {
        technologies: ['cypress'],
        description: 'Runs Cypress Tests',
        help: {
          command: `${pmc.exec} cypress run --help`,
          example: {
            args: ['--dev', '--headed'],
          },
        },
      },
    };

    if (webServerCommands?.default) {
      const webServerCommandTask = shouldReuseExistingServer
        ? parseTaskFromCommand(webServerCommands.default)
        : null;
      if (webServerCommandTask) {
        targets[options.targetName].dependsOn = [
          {
            projects: [webServerCommandTask.project],
            target: webServerCommandTask.target,
          },
        ];
      } else {
        targets[options.targetName].parallelism = false;
      }

      delete webServerCommands.default;
    } else {
      targets[options.targetName].parallelism = false;
    }

    if (Object.keys(webServerCommands ?? {}).length > 0) {
      targets[options.targetName].configurations ??= {};
      for (const [configuration, webServerCommand] of Object.entries(
        webServerCommands ?? {}
      )) {
        targets[options.targetName].configurations[configuration] = {
          command: `cypress run --env webServerCommand="${webServerCommand}"`,
        };
      }
    }

    const ciWebServerCommand: string = pluginPresetOptions?.ciWebServerCommand;
    if (ciWebServerCommand) {
      const { specFiles, specPatterns, excludeSpecPatterns } =
        await getSpecFilesAndPatternsForTestType(
          cypressConfig,
          'e2e',
          context.workspaceRoot,
          projectRoot
        );

      const ciBaseUrl = pluginPresetOptions?.ciBaseUrl;

      const dependsOn: TargetConfiguration['dependsOn'] = [];
      const outputs = getOutputs(projectRoot, cypressConfig, 'e2e');
      const inputs = getInputs(namedInputs);

      const groupName = 'E2E (CI)';
      metadata = { targetGroups: { [groupName]: [] } };
      const ciTargetGroup = metadata.targetGroups[groupName];
      const ciWebServerCommandTask = shouldReuseExistingServer
        ? parseTaskFromCommand(ciWebServerCommand)
        : null;

      for (const file of specFiles) {
        const relativeSpecFilePath = normalizePath(relative(projectRoot, file));

        if (relativeSpecFilePath.includes('../')) {
          throw new Error(
            '@nx/cypress/plugin attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
              `\n\n${JSON.stringify(
                {
                  projectRoot,
                  relativeSpecFilePath,
                  specFiles,
                  context,
                  excludeSpecPatterns,
                  specPatterns,
                },
                null,
                2
              )}`
          );
        }

        const targetName = options.ciTargetName + '--' + relativeSpecFilePath;
        const outputSubfolder = relativeSpecFilePath
          .replace(/[\/\\]/g, '-')
          .replace(/\./g, '-');

        ciTargetGroup.push(targetName);
        targets[targetName] = {
          outputs: getTargetOutputs(outputs, outputSubfolder),
          inputs,
          cache: true,
          command: `cypress run --env webServerCommand="${ciWebServerCommand}" --spec ${relativeSpecFilePath} --config=${getTargetConfig(
            cypressConfig,
            outputSubfolder,
            ciBaseUrl
          )}`,
          options: {
            cwd: projectRoot,
            env: { TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions },
          },
          metadata: {
            technologies: ['cypress'],
            description: `Runs Cypress Tests in ${relativeSpecFilePath} in CI`,
            help: {
              command: `${pmc.exec} cypress run --help`,
              example: {
                args: ['--dev', '--headed'],
              },
            },
          },
        };
        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
          options: 'forward',
        });

        if (ciWebServerCommandTask) {
          targets[targetName].dependsOn = [
            {
              target: ciWebServerCommandTask.target,
              projects: [ciWebServerCommandTask.project],
            },
          ];
        } else {
          targets[targetName].parallelism = false;
        }
      }

      targets[options.ciTargetName] = {
        executor: 'nx:noop',
        cache: true,
        inputs,
        outputs,
        dependsOn,
        metadata: {
          technologies: ['cypress'],
          description: 'Runs Cypress Tests in CI',
          nonAtomizedTarget: options.targetName,
          help: {
            command: `${pmc.exec} cypress run --help`,
            example: {
              args: ['--dev', '--headed'],
            },
          },
        },
      };

      if (!ciWebServerCommandTask) {
        targets[options.ciTargetName].parallelism = false;
      }

      ciTargetGroup.push(options.ciTargetName);
    }
  }

  if ('component' in cypressConfig) {
    const inputs = getInputs(namedInputs);
    const outputs = getOutputs(projectRoot, cypressConfig, 'component');

    // This will not override the e2e target if it is the same
    targets[options.componentTestingTargetName] ??= {
      command: `cypress run --component`,
      options: {
        cwd: projectRoot,
        env: { TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions },
      },
      cache: true,
      inputs,
      outputs,
      metadata: {
        technologies: ['cypress'],
        description: 'Runs Cypress Component Tests',
        help: {
          command: `${pmc.exec} cypress run --help`,
          example: {
            args: ['--dev', '--headed'],
          },
        },
      },
    };

    if (options.ciComponentTestingTargetName) {
      const { specFiles, specPatterns, excludeSpecPatterns } =
        await getSpecFilesAndPatternsForTestType(
          cypressConfig,
          'component',
          context.workspaceRoot,
          projectRoot
        );

      const dependsOn: TargetConfiguration['dependsOn'] = [];
      const groupName = 'Component Testing (CI)';
      metadata ??= {};
      metadata.targetGroups ??= {};
      metadata.targetGroups[groupName] ??= [];
      const ctCiTargetGroup = metadata.targetGroups[groupName];

      for (const file of specFiles) {
        const relativeSpecFilePath = normalizePath(relative(projectRoot, file));

        if (relativeSpecFilePath.includes('../')) {
          throw new Error(
            '@nx/cypress/plugin attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
              `\n\n${JSON.stringify(
                {
                  projectRoot,
                  relativeSpecFilePath,
                  specFiles,
                  context,
                  excludeSpecPatterns,
                  specPatterns,
                },
                null,
                2
              )}`
          );
        }

        const targetName =
          options.ciComponentTestingTargetName + '--' + relativeSpecFilePath;
        const outputSubfolder = relativeSpecFilePath
          .replace(/[\/\\]/g, '-')
          .replace(/\./g, '-');

        ctCiTargetGroup.push(targetName);
        targets[targetName] = {
          outputs: getTargetOutputs(outputs, outputSubfolder),
          inputs,
          cache: true,
          command: `cypress run --component --spec ${relativeSpecFilePath} --config=${getTargetConfig(
            cypressConfig,
            outputSubfolder
          )}`,
          options: {
            cwd: projectRoot,
            env: { TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions },
          },
          // Cypress handles starting the server, there's no separate server
          // target we can use as continuous, so we need to disable parallelism
          // to avoid port conflicts
          parallelism: false,
          metadata: {
            technologies: ['cypress'],
            description: `Runs Cypress Component Tests for ${relativeSpecFilePath} in CI`,
            help: {
              command: `${pmc.exec} cypress run --help`,
              example: {
                args: ['--dev', '--headed'],
              },
            },
          },
        };
        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
          options: 'forward',
        });
      }

      targets[options.ciComponentTestingTargetName] = {
        executor: 'nx:noop',
        cache: true,
        inputs,
        outputs,
        dependsOn,
        metadata: {
          technologies: ['cypress'],
          description: 'Runs Cypress Component Tests in CI',
          nonAtomizedTarget: options.componentTestingTargetName,
          help: {
            command: `${pmc.exec} cypress run --help`,
            example: {
              args: ['--dev', '--headed'],
            },
          },
        },
      };

      ctCiTargetGroup.push(options.ciComponentTestingTargetName);
    }
  }

  targets[options.openTargetName] = {
    command: `cypress open`,
    options: {
      cwd: projectRoot,
      env: { TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions },
    },
    metadata: {
      technologies: ['cypress'],
      description: 'Opens Cypress',
      help: {
        command: `${pmc.exec} cypress open --help`,
        example: {
          args: ['--dev', '--e2e'],
        },
      },
    },
  };

  return { targets, metadata };
}

function normalizeOptions(options: CypressPluginOptions): CypressPluginOptions {
  options ??= {};
  options.targetName ??= 'e2e';
  options.openTargetName ??= 'open-cypress';
  options.componentTestingTargetName ??= 'component-test';
  options.ciTargetName ??= 'e2e-ci';
  // must be explicitly provided to opt-in to atomized component testing
  options.ciComponentTestingTargetName;
  return options;
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),

    {
      externalDependencies: ['cypress'],
    },
  ];
}

function parseTaskFromCommand(command: string): {
  project: string;
  target: string;
} | null {
  const nxRunRegex =
    /^(?:(?:npx|yarn|bun|pnpm|pnpm exec|pnpx) )?nx run (\S+:\S+)$/;
  const infixRegex = /^(?:(?:npx|yarn|bun|pnpm|pnpm exec|pnpx) )?nx (\S+ \S+)$/;

  const nxRunMatch = command.match(nxRunRegex);
  if (nxRunMatch) {
    const [project, target] = nxRunMatch[1].split(':');
    return { project, target };
  }

  const infixMatch = command.match(infixRegex);
  if (infixMatch) {
    const [target, project] = infixMatch[1].split(' ');
    return { project, target };
  }

  return null;
}

async function getSpecFilesAndPatternsForTestType(
  cypressConfig: any,
  testType: 'e2e' | 'component',
  workspaceRoot: string,
  projectRoot: string
): Promise<{
  specFiles: string[];
  specPatterns: string[];
  excludeSpecPatterns: string[];
}> {
  const specPattern =
    cypressConfig[testType].specPattern ??
    defaultPatterns[testType].specPattern;
  const specPatterns = Array.isArray(specPattern)
    ? specPattern.map((p) => join(projectRoot, p))
    : [join(projectRoot, specPattern)];

  const excludeSpecPattern =
    cypressConfig[testType].excludeSpecPattern ??
    defaultPatterns[testType].excludeSpecPattern;
  const excludeSpecPatterns: string[] = Array.isArray(excludeSpecPattern)
    ? excludeSpecPattern.map((p) => join(projectRoot, p))
    : [join(projectRoot, excludeSpecPattern)];
  const specFiles = await globWithWorkspaceContext(
    workspaceRoot,
    specPatterns,
    excludeSpecPatterns
  );

  return { specFiles, specPatterns, excludeSpecPatterns };
}
