import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, extname, join } from 'path';
import { registerTsProject } from '@nx/js/src/internal';

import { getRootTsConfigPath } from '@nx/js';

import { CypressExecutorOptions } from '../executors/cypress/cypress.impl';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';

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
  '**/cypress.config.{js,ts,mjs,mts,cjs,cts}',
  (configFilePath, options, context) => {
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

    const hash = calculateHashForCreateNodes(projectRoot, options, context);

    const targets = targetsCache[hash]
      ? targetsCache[hash]
      : buildCypressTargets(configFilePath, projectRoot, options, context);

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
  const outputs = ['{options.videosFolder}', '{options.screenshotsFolder}'];

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
function buildCypressTargets(
  configFilePath: string,
  projectRoot: string,
  options: CypressPluginOptions,
  context: CreateNodesContext
) {
  const cypressConfig = getCypressConfig(configFilePath, context);

  const namedInputs = getNamedInputs(projectRoot, context);

  const baseTargetConfig: TargetConfiguration<CypressExecutorOptions> = {
    executor: '@nx/cypress:cypress',
    options: {
      cypressConfig: configFilePath,
    },
  };

  const targets: Record<
    string,
    TargetConfiguration<CypressExecutorOptions>
  > = {};

  if ('e2e' in cypressConfig) {
    const e2eTargetDefaults = readTargetDefaultsForTarget(
      options.targetName,
      context.nxJsonConfiguration.targetDefaults,
      '@nx/cypress:cypress'
    );

    targets[options.targetName] = {
      ...baseTargetConfig,
      options: {
        ...baseTargetConfig.options,
        testingType: 'e2e',
      },
    };

    if (e2eTargetDefaults?.cache === undefined) {
      targets[options.targetName].cache = true;
    }

    if (e2eTargetDefaults?.inputs === undefined) {
      targets[options.targetName].inputs =
        'production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default'];
    }

    if (e2eTargetDefaults?.outputs === undefined) {
      targets[options.targetName].outputs = getOutputs(
        projectRoot,
        cypressConfig,
        'e2e'
      );
    }

    const cypressEnv = {
      ...cypressConfig.env,
      ...cypressConfig.e2e?.env,
    };

    const devServerTargets: Record<string, string> =
      cypressEnv?.devServerTargets;

    if (devServerTargets?.default) {
      targets[options.targetName].options.devServerTarget =
        devServerTargets.default;
      delete devServerTargets.default;
    }

    if (Object.keys(devServerTargets ?? {}).length > 0) {
      targets[options.targetName].configurations ??= {};
      for (const [configuration, devServerTarget] of Object.entries(
        devServerTargets ?? {}
      )) {
        targets[options.targetName].configurations[configuration] = {
          devServerTarget,
        };
      }
    }

    const ciDevServerTarget: string = cypressEnv?.ciDevServerTarget;
    if (ciDevServerTarget) {
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
      const inputs =
        'production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default'];
      for (const file of specFiles) {
        const targetName = options.ciTargetName + '--' + file;
        targets[targetName] = {
          ...targets[options.targetName],
          outputs,
          inputs,
          cache: true,
          configurations: undefined,
          options: {
            ...targets[options.targetName].options,
            devServerTarget: ciDevServerTarget,
            spec: file,
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
    const componentTestingTargetDefaults = readTargetDefaultsForTarget(
      options.componentTestingTargetName,
      context.nxJsonConfiguration.targetDefaults,
      '@nx/cypress:cypress'
    );

    // This will not override the e2e target if it is the same
    targets[options.componentTestingTargetName] ??= {
      ...baseTargetConfig,
      options: {
        ...baseTargetConfig.options,
        testingType: 'component',
      },
    };

    if (componentTestingTargetDefaults?.cache === undefined) {
      targets[options.componentTestingTargetName].cache = true;
    }

    if (componentTestingTargetDefaults?.inputs === undefined) {
      targets[options.componentTestingTargetName].inputs =
        'production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default'];
    }

    if (componentTestingTargetDefaults?.outputs === undefined) {
      targets[options.componentTestingTargetName].outputs = getOutputs(
        projectRoot,
        cypressConfig,
        'component'
      );
    }
  }

  return targets;
}

function getCypressConfig(
  configFilePath: string,
  context: CreateNodesContext
): any {
  const resolvedPath = join(context.workspaceRoot, configFilePath);

  let module: any;
  if (['.ts', '.mts', '.cts'].includes(extname(configFilePath))) {
    const tsConfigPath = getRootTsConfigPath();

    if (tsConfigPath) {
      const unregisterTsProject = registerTsProject(tsConfigPath);
      try {
        module = require(resolvedPath);
      } finally {
        unregisterTsProject();
      }
    } else {
      module = require(resolvedPath);
    }
  } else {
    module = require(resolvedPath);
  }
  return module.default ?? module;
}

function normalizeOptions(options: CypressPluginOptions): CypressPluginOptions {
  options ??= {};
  options.targetName ??= 'e2e';
  options.componentTestingTargetName ??= 'component-test';
  options.ciTargetName ??= 'e2e-ci';
  return options;
}
