import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join, relative } from 'path';

import { getLockFileName } from '@nx/js';

import { CypressExecutorOptions } from '../executors/cypress/cypress.impl';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { NX_PLUGIN_OPTIONS } from '../utils/constants';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface CypressPluginOptions {
  ciTargetName?: string;
  targetName?: string;
  componentTestingTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'cypress.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration<CypressExecutorOptions>>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<
    string,
    Record<string, TargetConfiguration<CypressExecutorOptions>>
  >
) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<CypressPluginOptions> = [
  '**/cypress.config.{js,ts,mjs,cjs}',
  async (configFilePath, options, context) => {
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

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);

    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : await buildCypressTargets(
          configFilePath,
          projectRoot,
          options,
          context
        );

    calculatedTargets[hash] = targets;

    return {
      projects: {
        [projectRoot]: {
          projectType: 'application',
          targets,
        },
      },
    };
  },
];

function getOutputs(
  projectRoot: string,
  cypressConfig: any,
  testingType: 'e2e' | 'component'
): string[] {
  function getOutput(path: string): string {
    if (path.startsWith('..')) {
      return join('{workspaceRoot}', join(projectRoot, path));
    } else {
      return join('{projectRoot}', path);
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

async function buildCypressTargets(
  configFilePath: string,
  projectRoot: string,
  options: CypressPluginOptions,
  context: CreateNodesContext
) {
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

  if ('e2e' in cypressConfig) {
    targets[options.targetName] = {
      command: `cypress run`,
      options: { cwd: projectRoot },
      cache: true,
      inputs: getInputs(namedInputs),
      outputs: getOutputs(projectRoot, cypressConfig, 'e2e'),
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
      const specFiles = globWithWorkspaceContext(
        context.workspaceRoot,
        specPatterns,
        excludeSpecPatterns
      );

      const dependsOn: TargetConfiguration['dependsOn'] = [];
      const outputs = getOutputs(projectRoot, cypressConfig, 'e2e');
      const inputs = getInputs(namedInputs);
      for (const file of specFiles) {
        const relativeSpecFilePath = relative(projectRoot, file);
        const targetName = options.ciTargetName + '--' + relativeSpecFilePath;
        targets[targetName] = {
          outputs,
          inputs,
          cache: true,
          command: `cypress run --env webServerCommand="${ciWebServerCommand}" --spec ${relativeSpecFilePath}`,
          options: {
            cwd: projectRoot,
          },
        };
        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
        });
      }
      targets[options.ciTargetName] ??= {};

      targets[options.ciTargetName] = {
        executor: 'nx:noop',
        cache: true,
        inputs,
        outputs,
        dependsOn,
      };
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
    };
  }

  return targets;
}

function normalizeOptions(options: CypressPluginOptions): CypressPluginOptions {
  options ??= {};
  options.targetName ??= 'e2e';
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
