import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  joinPathFragments,
  logger,
  normalizePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join, relative } from 'path';

import { getLockFileName } from '@nx/js';

import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';

import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { NX_PLUGIN_OPTIONS } from '../utils/constants';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { hashObject } from 'nx/src/devkit-internals';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';

export interface CypressPluginOptions {
  ciTargetName?: string;
  targetName?: string;
  openTargetName?: string;
  componentTestingTargetName?: string;
}

function readTargetsCache(cachePath: string): Record<string, CypressTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(cachePath: string, results: CypressTargets) {
  writeJsonFile(cachePath, results);
}

const cypressConfigGlob = '**/cypress.config.{js,ts,mjs,cjs}';

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

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};
  let metadata: ProjectConfiguration['metadata'];

  if ('e2e' in cypressConfig) {
    targets[options.targetName] = {
      command: `cypress run`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(namedInputs),
      outputs: getOutputs(projectRoot, cypressConfig, 'e2e'),
      metadata: {
        technologies: ['cypress'],
        description: 'Runs Cypress Tests',
      },
    };

    if (webServerCommands?.default) {
      delete webServerCommands.default;
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
      const specPatterns = Array.isArray(cypressConfig.e2e.specPattern)
        ? cypressConfig.e2e.specPattern.map((p) => join(projectRoot, p))
        : [join(projectRoot, cypressConfig.e2e.specPattern)];

      const excludeSpecPatterns: string[] = !cypressConfig.e2e
        .excludeSpecPattern
        ? cypressConfig.e2e.excludeSpecPattern
        : Array.isArray(cypressConfig.e2e.excludeSpecPattern)
        ? cypressConfig.e2e.excludeSpecPattern.map((p) => join(projectRoot, p))
        : [join(projectRoot, cypressConfig.e2e.excludeSpecPattern)];
      const specFiles = await globWithWorkspaceContext(
        context.workspaceRoot,
        specPatterns,
        excludeSpecPatterns
      );

      const dependsOn: TargetConfiguration['dependsOn'] = [];
      const outputs = getOutputs(projectRoot, cypressConfig, 'e2e');
      const inputs = getInputs(namedInputs);

      const groupName = 'E2E (CI)';
      metadata = { targetGroups: { [groupName]: [] } };
      const ciTargetGroup = metadata.targetGroups[groupName];
      for (const file of specFiles) {
        const relativeSpecFilePath = normalizePath(relative(projectRoot, file));
        const targetName = options.ciTargetName + '--' + relativeSpecFilePath;

        ciTargetGroup.push(targetName);
        targets[targetName] = {
          outputs,
          inputs,
          cache: true,
          command: `cypress run --env webServerCommand="${ciWebServerCommand}" --spec ${relativeSpecFilePath}`,
          options: {
            cwd: projectRoot,
          },
          metadata: {
            technologies: ['cypress'],
            description: `Runs Cypress Tests in ${relativeSpecFilePath} in CI`,
          },
        };
        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
        });
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
        },
      };
      ciTargetGroup.push(options.ciTargetName);
    }
  }

  if ('component' in cypressConfig) {
    // This will not override the e2e target if it is the same
    targets[options.componentTestingTargetName] ??= {
      command: `cypress run --component`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(namedInputs),
      outputs: getOutputs(projectRoot, cypressConfig, 'component'),
      metadata: {
        technologies: ['cypress'],
        description: 'Runs Cypress Component Tests',
      },
    };
  }

  targets[options.openTargetName] = {
    command: `cypress open`,
    options: { cwd: projectRoot },
    metadata: {
      technologies: ['cypress'],
      description: 'Opens Cypress',
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
