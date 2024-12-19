import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, parse, relative } from 'node:path';

import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
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
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { hashObject } from 'nx/src/hasher/file-hasher';

const pmc = getPackageManagerCommand();

export interface PlaywrightPluginOptions {
  targetName?: string;
  ciTargetName?: string;
}

interface NormalizedOptions {
  targetName: string;
  ciTargetName?: string;
}

type PlaywrightTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(
  cachePath: string
): Record<string, PlaywrightTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, PlaywrightTargets>
) {
  writeJsonFile(cachePath, results);
}

const playwrightConfigGlob = '**/playwright.config.{js,ts,cjs,cts,mjs,mts}';
export const createNodesV2: CreateNodesV2<PlaywrightPluginOptions> = [
  playwrightConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `playwright-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);
    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFilePaths,
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
export const createNodes: CreateNodes<PlaywrightPluginOptions> = [
  playwrightConfigGlob,
  async (configFile, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    return createNodesInternal(configFile, options, context, {});
  },
];

async function createNodesInternal(
  configFilePath: string,
  options: PlaywrightPluginOptions,
  context: CreateNodesContext,
  targetsCache: Record<string, PlaywrightTargets>
) {
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

  const hash = await calculateHashForCreateNodes(
    projectRoot,
    normalizedOptions,
    context,
    [getLockFileName(detectPackageManager(context.workspaceRoot))]
  );

  targetsCache[hash] ??= await buildPlaywrightTargets(
    configFilePath,
    projectRoot,
    normalizedOptions,
    context
  );
  const { targets, metadata } = targetsCache[hash];

  return {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets,
        metadata,
      },
    },
  };
}

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

  const testOutput = getTestOutput(playwrightConfig);
  const reporterOutputs = getReporterOutputs(playwrightConfig);
  const baseTargetConfig: TargetConfiguration = {
    command: 'playwright test',
    options: {
      cwd: '{projectRoot}',
    },
    parallelism: false,
    metadata: {
      technologies: ['playwright'],
      description: 'Runs Playwright Tests',
      help: {
        command: `${pmc.exec} playwright test --help`,
        example: {
          options: {
            workers: 1,
          },
        },
      },
    },
  };

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      { externalDependencies: ['@playwright/test'] },
    ],
    outputs: getTargetOutputs(testOutput, reporterOutputs, projectRoot),
  };

  if (options.ciTargetName) {
    const ciBaseTargetConfig: TargetConfiguration = {
      ...baseTargetConfig,
      cache: true,
      inputs: [
        ...('production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default']),
        { externalDependencies: ['@playwright/test'] },
      ],
      outputs: getTargetOutputs(testOutput, reporterOutputs, projectRoot),
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

    await forEachTestFile(
      (testFile) => {
        const outputSubfolder = relative(projectRoot, testFile)
          .replace(/[\/\\]/g, '-')
          .replace(/\./g, '-');
        const relativeSpecFilePath = normalizePath(
          relative(projectRoot, testFile)
        );
        const targetName = `${options.ciTargetName}--${relativeSpecFilePath}`;
        ciTargetGroup.push(targetName);
        targets[targetName] = {
          ...ciBaseTargetConfig,
          options: {
            ...ciBaseTargetConfig.options,
            env: getOutputEnvVars(reporterOutputs, outputSubfolder),
          },
          outputs: getTargetOutputs(
            testOutput,
            reporterOutputs,
            projectRoot,
            outputSubfolder
          ),
          command: `${
            baseTargetConfig.command
          } ${relativeSpecFilePath} --output=${join(
            testOutput,
            outputSubfolder
          )}`,
          metadata: {
            technologies: ['playwright'],
            description: `Runs Playwright Tests in ${relativeSpecFilePath} in CI`,
            help: {
              command: `${pmc.exec} playwright test --help`,
              example: {
                options: {
                  workers: 1,
                },
              },
            },
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
      parallelism: false,
      metadata: {
        technologies: ['playwright'],
        description: 'Runs Playwright Tests in CI',
        nonAtomizedTarget: options.targetName,
        help: {
          command: `${pmc.exec} playwright test --help`,
          example: {
            options: {
              workers: 1,
            },
          },
        },
      },
    };
    ciTargetGroup.push(options.ciTargetName);
  }

  return { targets, metadata };
}

async function forEachTestFile(
  cb: (path: string) => void,
  opts: {
    context: CreateNodesContext;
    path: string;
    config: PlaywrightTestConfig;
  }
) {
  const files = await getFilesInDirectoryUsingContext(
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

function normalizeOptions(options: PlaywrightPluginOptions): NormalizedOptions {
  return {
    ...options,
    targetName: options.targetName ?? 'e2e',
    ciTargetName: options.ciTargetName ?? 'e2e-ci',
  };
}

function getTestOutput(playwrightConfig: PlaywrightTestConfig): string {
  const { outputDir } = playwrightConfig;
  if (outputDir) {
    return outputDir;
  } else {
    return './test-results';
  }
}

function getReporterOutputs(
  playwrightConfig: PlaywrightTestConfig
): Array<[string, string]> {
  const outputs: Array<[string, string]> = [];

  const { reporter } = playwrightConfig;

  if (reporter) {
    const DEFAULT_REPORTER_OUTPUT = 'playwright-report';
    if (reporter === 'html') {
      outputs.push([reporter, DEFAULT_REPORTER_OUTPUT]);
    } else if (reporter === 'json') {
      outputs.push([reporter, DEFAULT_REPORTER_OUTPUT]);
    } else if (Array.isArray(reporter)) {
      for (const r of reporter) {
        const [reporter, opts] = r;
        // There are a few different ways to specify an output file or directory
        // depending on the reporter. This is a best effort to find the output.
        if (opts?.outputFile) {
          outputs.push([reporter, opts.outputFile]);
        } else if (opts?.outputDir) {
          outputs.push([reporter, opts.outputDir]);
        } else if (opts?.outputFolder) {
          outputs.push([reporter, opts.outputFolder]);
        } else {
          outputs.push([reporter, DEFAULT_REPORTER_OUTPUT]);
        }
      }
    }
  }

  return outputs;
}

function getTargetOutputs(
  testOutput: string,
  reporterOutputs: Array<[string, string]>,
  projectRoot: string,
  scope?: string
): string[] {
  const outputs = new Set<string>();
  outputs.add(
    normalizeOutput(projectRoot, scope ? join(testOutput, scope) : testOutput)
  );
  for (const [, output] of reporterOutputs) {
    outputs.add(
      normalizeOutput(projectRoot, scope ? join(output, scope) : output)
    );
  }
  return Array.from(outputs);
}

function normalizeOutput(projectRoot: string, path: string): string {
  if (path.startsWith('..')) {
    return join('{workspaceRoot}', join(projectRoot, path));
  } else {
    return join('{projectRoot}', path);
  }
}

function getOutputEnvVars(
  reporterOutputs: Array<[string, string]>,
  outputSubfolder: string
): Record<string, string> {
  const env: Record<string, string> = {};
  for (let [reporter, output] of reporterOutputs) {
    if (outputSubfolder) {
      const isFile = parse(output).ext !== '';
      const envVarName = `PLAYWRIGHT_${reporter.toUpperCase()}_OUTPUT_${
        isFile ? 'FILE' : 'DIR'
      }`;
      env[envVarName] = join(output, outputSubfolder);
      // Also set PLAYWRIGHT_HTML_REPORT for Playwright prior to 1.45.0.
      // HTML prior to this version did not follow the pattern of "PLAYWRIGHT_<REPORTER>_OUTPUT_<FILE|DIR>".
      if (reporter === 'html') {
        env['PLAYWRIGHT_HTML_REPORT'] = env[envVarName];
      }
    }
  }
  return env;
}
