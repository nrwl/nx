import { existsSync, readdirSync } from 'fs';
import { dirname, join, relative } from 'path';

import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  detectPackageManager,
  joinPathFragments,
  normalizePath,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';

import type { PlaywrightTestConfig } from '@playwright/test';
import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';
import { minimatch } from 'minimatch';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';

export interface PlaywrightPluginOptions {
  targetName?: string;
  ciTargetName?: string;
}

interface NormalizedOptions {
  targetName: string;
  ciTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'playwright.hash');

const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

type PlaywrightTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

const calculatedTargets: Record<string, PlaywrightTargets> = {};

function readTargetsCache(): Record<string, PlaywrightTargets> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(targets: Record<string, PlaywrightTargets>) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<PlaywrightPluginOptions> = [
  '**/playwright.config.{js,ts,cjs,cts,mjs,mts}',
  async (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);

    // Do not create a project if package.json and project.json isn't there.
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    const normalizedOptions = normalizeOptions(options);

    const hash = calculateHashForCreateNodes(projectRoot, options, context, [
      getLockFileName(detectPackageManager(context.workspaceRoot)),
    ]);

    const { targets, metadata } =
      targetsCache[hash] ??
      (await buildPlaywrightTargets(
        configFilePath,
        projectRoot,
        normalizedOptions,
        context
      ));

    calculatedTargets[hash] = { targets, metadata };

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets,
          metadata,
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
): Promise<PlaywrightTargets> {
  // Playwright forbids importing the `@playwright/test` module twice. This would affect running the tests,
  // but we're just reading the config so let's delete the variable they are using to detect this.
  // See: https://github.com/microsoft/playwright/pull/11218/files
  delete (process as any)['__pw_initiator__'];

  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    join(context.workspaceRoot, configFilePath)
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: ProjectConfiguration['targets'] = {};
  let metadata: ProjectConfiguration['metadata'];

  const baseTargetConfig: TargetConfiguration = {
    command: 'playwright test',
    options: {
      cwd: '{projectRoot}',
    },
    metadata: {
      technologies: ['playwright'],
      description: 'Runs Playwright Tests',
    },
  };

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: true,
    inputs:
      'production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default'],
    outputs: getOutputs(projectRoot, playwrightConfig),
  };

  if (options.ciTargetName) {
    const ciBaseTargetConfig: TargetConfiguration = {
      ...baseTargetConfig,
      cache: true,
      inputs:
        'production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default'],
      outputs: getOutputs(projectRoot, playwrightConfig),
    };

    const groupName = 'E2E (CI)';
    metadata = { targetGroups: { [groupName]: [] } };
    const ciTargetGroup = metadata.targetGroups[groupName];

    const testDir = playwrightConfig.testDir
      ? joinPathFragments(projectRoot, playwrightConfig.testDir)
      : projectRoot;

    // Playwright defaults to the following pattern.
    playwrightConfig.testMatch ??= '**/*.@(spec|test).?(c|m)[jt]s?(x)';

    const dependsOn: TargetConfiguration['dependsOn'] = [];
    forEachTestFile(
      (testFile) => {
        const relativeSpecFilePath = normalizePath(
          relative(projectRoot, testFile)
        );
        const targetName = `${options.ciTargetName}--${relativeSpecFilePath}`;
        ciTargetGroup.push(targetName);
        targets[targetName] = {
          ...ciBaseTargetConfig,
          command: `${baseTargetConfig.command} ${relativeSpecFilePath}`,
          metadata: {
            technologies: ['playwright'],
            description: `Runs Playwright Tests in ${relativeSpecFilePath} in CI`,
          },
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
      metadata: {
        technologies: ['playwright'],
        description: 'Runs Playwright Tests in CI',
      },
    };
    ciTargetGroup.push(options.ciTargetName);
  }

  return { targets, metadata };
}

function forEachTestFile(
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
  const ignoredMatcher = opts.config.testIgnore
    ? createMatcher(opts.config.testIgnore)
    : () => false;
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
    return (path: string) => {
      try {
        return minimatch(path, pattern);
      } catch (e) {
        throw new Error(`Error matching ${path} with ${pattern}: ${e.message}`);
      }
    };
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
    ciTargetName: options.ciTargetName ?? 'e2e-ci',
  };
}
