import { readdirSync } from 'fs';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { basename, dirname, extname, join, resolve } from 'path';

import {
  CreateNodes,
  CreateNodesContext,
  TargetConfiguration,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getRootTsConfigPath } from '@nx/js';
import { registerTsProject } from '@nx/js/src/internal';
import type { PlaywrightTestConfig } from '@playwright/test';

import { PlaywrightExecutorSchema } from '../executors/playwright/playwright';

export interface PlaywrightPluginOptions {
  targetName?: string;
}

export const createNodes: CreateNodes<PlaywrightPluginOptions> = [
  '**/playwright.config.{js,ts}',
  (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(projectRoot);
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options = normalizeOptions(options);
    const projectName = basename(projectRoot);

    return {
      projects: {
        [projectName]: {
          root: projectRoot,
          projectType: 'library',
          targets: buildPlaywrightTargets(
            configFilePath,
            projectRoot,
            options,
            context
          ),
        },
      },
    };
  },
];

function buildPlaywrightTargets(
  configFilePath: string,
  projectRoot: string,
  options: PlaywrightPluginOptions,
  context: CreateNodesContext
) {
  const playwrightConfig: PlaywrightTestConfig = getPlaywrightConfig(
    configFilePath,
    context
  );

  const targetDefaults = readTargetDefaultsForTarget(
    options.targetName,
    context.nxJsonConfiguration.targetDefaults,
    'executorName'
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<
    string,
    TargetConfiguration<PlaywrightExecutorSchema>
  > = {};

  const baseTargetConfig: TargetConfiguration<PlaywrightExecutorSchema> = {
    executor: '@nx/playwright:playwright',
    options: {
      config: configFilePath,
      ...targetDefaults?.options,
    },
  };

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: targetDefaults?.cache ?? true,
    inputs:
      targetDefaults?.inputs ?? 'production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default'],
    outputs:
      targetDefaults?.outputs ?? getOutputs(projectRoot, playwrightConfig),
    options: {
      ...baseTargetConfig.options,
    },
  };

  return targets;
}

function getPlaywrightConfig(
  configFilePath: string,
  context: CreateNodesContext
): any {
  const resolvedPath = join(context.workspaceRoot, configFilePath);

  let module: any;
  if (extname(configFilePath) === '.ts') {
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

function getOutputs(
  projectRoot: string,
  playwrightConfig: PlaywrightTestConfig
): string[] {
  function getOutput(path: string): string {
    if (path.startsWith('..')) {
      return join('{workspaceRoot}', join(projectRoot, path));
    } else {
      return join('{projectRoot}', path);
    }
  }

  const outputs = [];

  const { reporter, outputDir } = playwrightConfig;

  if (reporter) {
    const DEFAULT_REPORTER_OUTPUT = getOutput('playwright-report');
    if (reporter === 'html' || reporter === 'json') {
      // Reporter is a string, so it uses the default output directory.
      outputs.push(DEFAULT_REPORTER_OUTPUT);
    } else if (Array.isArray(reporter)) {
      for (const r of reporter) {
        const [, opts] = r;
        // There are a few different ways to specify an output file or directory
        // depending on the reporter. This is a best effort to find the output.
        if (!opts) {
          outputs.push(DEFAULT_REPORTER_OUTPUT);
        } else if (opts.outputFile) {
          outputs.push(getOutput(opts.outputFile));
        } else if (opts.outputDir) {
          outputs.push(getOutput(opts.outputDir));
        } else if (opts.outputFolder) {
          outputs.push(getOutput(opts.outputFolder));
        } else {
          outputs.push(DEFAULT_REPORTER_OUTPUT);
        }
      }
    }
  }

  if (outputDir) {
    outputs.push(getOutput(outputDir));
  } else {
    outputs.push(getOutput('./test-results'));
  }

  return outputs;
}

function normalizeOptions(
  options: PlaywrightPluginOptions
): PlaywrightPluginOptions {
  options ??= {};
  options.targetName ??= 'e2e';
  return options;
}
