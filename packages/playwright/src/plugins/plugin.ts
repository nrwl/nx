import { readdirSync } from 'fs';
import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { basename, dirname, join, relative } from 'path';

import {
  CreateNodes,
  CreateNodesContext,
  joinPathFragments,
  TargetConfiguration,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';

import type { PlaywrightTestConfig } from '@playwright/test';
import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';
import minimatch = require('minimatch');
import { loadPlaywrightConfig } from '../utils/load-config-file';

export interface PlaywrightPluginOptions {
  targetName?: string;
  ciTargetName?: string;
}

interface NormalizedOptions {
  targetName: string;
  ciTargetName?: string;
}

export const createNodes: CreateNodes<PlaywrightPluginOptions> = [
  '**/playwright.config.{js,ts,cjs,cts,mjs,mts}',
  async (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(projectRoot);
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    const normalizedOptions = normalizeOptions(options);
    const projectName = basename(projectRoot);

    return {
      projects: {
        [projectName]: {
          root: projectRoot,
          projectType: 'library',
          targets: await buildPlaywrightTargets(
            configFilePath,
            projectRoot,
            normalizedOptions,
            context
          ),
        },
      },
    };
  },
];

async function buildPlaywrightTargets(
  configFilePath: string,
  projectRoot: string,
  options: NormalizedOptions,
  context: CreateNodesContext
) {
  const playwrightConfig: PlaywrightTestConfig = await loadPlaywrightConfig(
    join(context.workspaceRoot, configFilePath)
  );

  const targetDefaults = readTargetDefaultsForTarget(
    options.targetName,
    context.nxJsonConfiguration.targetDefaults,
    'nx:run-commands'
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration<unknown>> = {};

  const baseTargetConfig: TargetConfiguration = {
    command: 'playwright test',
    options: {
      cwd: '{projectRoot}',
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
      ...targetDefaults?.options,
    },
  };

  if (options.ciTargetName) {
    const ciTargetDefaults = readTargetDefaultsForTarget(
      options.ciTargetName,
      context.nxJsonConfiguration.targetDefaults,
      'nx:run-commands'
    );

    const ciBaseTargetConfig: TargetConfiguration = {
      ...baseTargetConfig,
      cache: ciTargetDefaults?.cache ?? true,
      inputs:
        ciTargetDefaults?.inputs ?? 'production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default'],
      outputs:
        ciTargetDefaults?.outputs ?? getOutputs(projectRoot, playwrightConfig),
      options: {
        ...baseTargetConfig.options,
        ...ciTargetDefaults?.options,
      },
    };

    const testDir =
      joinPathFragments(projectRoot, playwrightConfig.testDir) ?? projectRoot;
    // Playwright defaults to the following pattern.
    playwrightConfig.testMatch ??= '**/*.@(spec|test).?(c|m)[jt]s?(x)';

    const dependsOn: TargetConfiguration['dependsOn'] = [];
    forEachTestFile(
      (testFile) => {
        const relativeToProjectRoot = relative(projectRoot, testFile);
        const targetName = `${options.ciTargetName}--${relativeToProjectRoot}`;
        targets[targetName] = {
          ...ciBaseTargetConfig,
          command: `${baseTargetConfig.command} ${relativeToProjectRoot}`,
        };
        dependsOn.push({
          target: targetName,
          projects: 'self',
          params: 'forward',
        });
      },
      {
        context,
        path: testDir,
        config: playwrightConfig,
      }
    );

    targets[options.ciTargetName] ??= {};

    targets[options.ciTargetName] = {
      executor: 'nx:noop',
      cache: ciBaseTargetConfig.cache,
      inputs: ciBaseTargetConfig.inputs,
      outputs: ciBaseTargetConfig.outputs,
      dependsOn,
    };
  }

  return targets;
}

async function forEachTestFile(
  cb: (path: string) => void,
  opts: {
    context: CreateNodesContext;
    path: string;
    config: PlaywrightTestConfig;
  }
) {
  const files = getFilesInDirectoryUsingContext(
    opts.context.workspaceRoot,
    opts.path
  );
  const matcher = createMatcher(opts.config.testMatch);
  const ignoredMatcher = createMatcher(opts.config.testIgnore);
  for (const file of files) {
    if (matcher(file) && !ignoredMatcher(file)) {
      cb(file);
    }
  }
}

function createMatcher(pattern: string | RegExp | Array<string | RegExp>) {
  if (Array.isArray(pattern)) {
    const matchers = pattern.map((p) => createMatcher(p));
    return (path: string) => matchers.some((m) => m(path));
  } else if (pattern instanceof RegExp) {
    return (path: string) => pattern.test(path);
  } else {
    return (path: string) => minimatch(path, pattern);
  }
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

function normalizeOptions(options: PlaywrightPluginOptions): NormalizedOptions {
  return {
    ...options,
    targetName: options.targetName ?? 'e2e',
  };
}
