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
  type ProjectConfiguration,
  readJsonFile,
  type TargetConfiguration,
  type TargetDependencyConfig,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { loadConfigFile } from '@nx/devkit/src/utils/config-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName } from '@nx/js';
import type { PlaywrightTestConfig } from '@playwright/test';
import { minimatch } from 'minimatch';
import { readdirSync } from 'node:fs';
import { dirname, join, parse, posix, relative, resolve } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';
import { getReporterOutputs, type ReporterOutput } from '../utils/reporters';

const pmc = getPackageManagerCommand();

export interface PlaywrightPluginOptions {
  targetName?: string;
  ciTargetName?: string;
}

interface NormalizedOptions {
  targetName: string;
  ciTargetName: string;
  mergeReportsTargetName: string;
}

type PlaywrightTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

function readTargetsCache(
  cachePath: string
): Record<string, PlaywrightTargets> {
  try {
    return process.env.NX_CACHE_PROJECT_GRAPH !== 'false'
      ? readJsonFile(cachePath)
      : {};
  } catch {
    return {};
  }
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
    {
      ...normalizedOptions,
      CI: process.env.CI,
    },
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
  const webserverCommandTasks = getWebserverCommandTasks(playwrightConfig);
  const baseTargetConfig: TargetConfiguration = {
    command: 'playwright test',
    options: {
      cwd: '{projectRoot}',
    },
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

  if (webserverCommandTasks.length) {
    baseTargetConfig.dependsOn = getDependsOn(webserverCommandTasks);
  } else {
    baseTargetConfig.parallelism = false;
  }

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      { externalDependencies: ['@playwright/test'] },
    ],
    outputs: getTargetOutputs(
      testOutput,
      reporterOutputs,
      context.workspaceRoot,
      projectRoot
    ),
  };

  if (options.ciTargetName) {
    // ensure the blob reporter output is the directory containing the blob
    // report files
    const ciReporterOutputs = reporterOutputs.map<ReporterOutput>(
      ([reporter, output]) =>
        reporter === 'blob' && parse(output).ext !== ''
          ? [reporter, dirname(output)]
          : [reporter, output]
    );
    const ciBaseTargetConfig: TargetConfiguration = {
      ...baseTargetConfig,
      cache: true,
      inputs: [
        ...('production' in namedInputs
          ? ['default', '^production']
          : ['default', '^default']),
        { externalDependencies: ['@playwright/test'] },
      ],
      outputs: getTargetOutputs(
        testOutput,
        ciReporterOutputs,
        context.workspaceRoot,
        projectRoot
      ),
    };

    const groupName = 'E2E (CI)';
    metadata = { targetGroups: { [groupName]: [] } };
    const ciTargetGroup = metadata.targetGroups[groupName];

    const testDir = playwrightConfig.testDir
      ? joinPathFragments(projectRoot, playwrightConfig.testDir)
      : projectRoot;

    // Playwright defaults to the following pattern.
    playwrightConfig.testMatch ??= '**/*.@(spec|test).?(c|m)[jt]s?(x)';

    const dependsOn: TargetDependencyConfig[] = [];

    const testFiles = await getAllTestFiles({
      context,
      path: testDir,
      config: playwrightConfig,
    });

    for (const testFile of testFiles) {
      const outputSubfolder = relative(projectRoot, testFile)
        .replace(/[\/\\]/g, '-')
        .replace(/\./g, '-');
      const relativeSpecFilePath = normalizePath(
        relative(projectRoot, testFile)
      );

      if (relativeSpecFilePath.includes('../')) {
        throw new Error(
          '@nx/playwright/plugin attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
            `\n\n${JSON.stringify(
              {
                projectRoot,
                testFile,
                testFiles,
                context,
                config: playwrightConfig,
              },
              null,
              2
            )}`
        );
      }

      const targetName = `${options.ciTargetName}--${relativeSpecFilePath}`;
      ciTargetGroup.push(targetName);
      targets[targetName] = {
        ...ciBaseTargetConfig,
        options: {
          ...ciBaseTargetConfig.options,
          env: getAtomizedTaskEnvVars(reporterOutputs, outputSubfolder),
        },
        outputs: getAtomizedTaskOutputs(
          testOutput,
          reporterOutputs,
          context.workspaceRoot,
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
    }

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

    if (!webserverCommandTasks.length) {
      targets[options.ciTargetName].parallelism = false;
    }
    ciTargetGroup.push(options.ciTargetName);

    // infer the task to merge the reports from the atomized tasks
    const mergeReportsTargetOutputs = new Set<string>();
    for (const [reporter, output] of reporterOutputs) {
      if (reporter !== 'blob' && output) {
        mergeReportsTargetOutputs.add(
          normalizeOutput(output, context.workspaceRoot, projectRoot)
        );
      }
    }
    targets[options.mergeReportsTargetName] = {
      executor: '@nx/playwright:merge-reports',
      cache: true,
      inputs: ciBaseTargetConfig.inputs,
      outputs: Array.from(mergeReportsTargetOutputs),
      options: {
        config: posix.relative(projectRoot, configFilePath),
        expectedSuites: dependsOn.length,
      },
      metadata: {
        technologies: ['playwright'],
        description:
          'Merges Playwright blob reports from atomized tasks to produce unified reports for the configured reporters (excluding the "blob" reporter).',
      },
    };
    ciTargetGroup.push(options.mergeReportsTargetName);
  }

  return { targets, metadata };
}

async function getAllTestFiles(opts: {
  context: CreateNodesContext;
  path: string;
  config: PlaywrightTestConfig;
}) {
  const files = await getFilesInDirectoryUsingContext(
    opts.context.workspaceRoot,
    opts.path
  );
  const matcher = createMatcher(opts.config.testMatch);
  const ignoredMatcher = opts.config.testIgnore
    ? createMatcher(opts.config.testIgnore)
    : () => false;
  return files.filter((file) => matcher(file) && !ignoredMatcher(file));
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
  const ciTargetName = options?.ciTargetName ?? 'e2e-ci';

  return {
    ...options,
    targetName: options?.targetName ?? 'e2e',
    ciTargetName,
    mergeReportsTargetName: `${ciTargetName}--merge-reports`,
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

function getTargetOutputs(
  testOutput: string,
  reporterOutputs: Array<ReporterOutput>,
  workspaceRoot: string,
  projectRoot: string
): string[] {
  const outputs = new Set<string>();
  outputs.add(normalizeOutput(testOutput, workspaceRoot, projectRoot));
  for (const [, output] of reporterOutputs) {
    if (!output) {
      continue;
    }

    outputs.add(normalizeOutput(output, workspaceRoot, projectRoot));
  }
  return Array.from(outputs);
}

function getAtomizedTaskOutputs(
  testOutput: string,
  reporterOutputs: Array<ReporterOutput>,
  workspaceRoot: string,
  projectRoot: string,
  subFolder: string
): string[] {
  const outputs = new Set<string>();
  outputs.add(
    normalizeOutput(
      addSubfolderToOutput(testOutput, subFolder),
      workspaceRoot,
      projectRoot
    )
  );

  for (const [reporter, output] of reporterOutputs) {
    if (!output) {
      continue;
    }

    if (reporter === 'blob') {
      const blobOutput = normalizeAtomizedTaskBlobReportOutput(
        output,
        subFolder
      );
      outputs.add(normalizeOutput(blobOutput, workspaceRoot, projectRoot));
      continue;
    }

    outputs.add(
      normalizeOutput(
        addSubfolderToOutput(output, subFolder),
        workspaceRoot,
        projectRoot
      )
    );
  }

  return Array.from(outputs);
}

function addSubfolderToOutput(output: string, subfolder: string): string {
  const parts = parse(output);
  if (parts.ext !== '') {
    return join(parts.dir, subfolder, parts.base);
  }
  return join(output, subfolder);
}

function getWebserverCommandTasks(
  playwrightConfig: PlaywrightTestConfig
): Array<{ project: string; target: string }> {
  if (!playwrightConfig.webServer) {
    return [];
  }

  const tasks: Array<{ project: string; target: string }> = [];

  const webServer = Array.isArray(playwrightConfig.webServer)
    ? playwrightConfig.webServer
    : [playwrightConfig.webServer];

  for (const server of webServer) {
    if (!server.reuseExistingServer) {
      continue;
    }

    const task = parseTaskFromCommand(server.command);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
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

function getDependsOn(
  tasks: Array<{ project: string; target: string }>
): TargetConfiguration['dependsOn'] {
  const projectsPerTask = new Map<string, string[]>();

  for (const { project, target } of tasks) {
    if (!projectsPerTask.has(target)) {
      projectsPerTask.set(target, []);
    }
    projectsPerTask.get(target).push(project);
  }

  return Array.from(projectsPerTask.entries()).map(([target, projects]) => ({
    projects,
    target,
  }));
}

function normalizeOutput(
  path: string,
  workspaceRoot: string,
  projectRoot: string
): string {
  const fullProjectRoot = resolve(workspaceRoot, projectRoot);
  const fullPath = resolve(fullProjectRoot, path);
  const pathRelativeToProjectRoot = normalizePath(
    relative(fullProjectRoot, fullPath)
  );
  if (pathRelativeToProjectRoot.startsWith('..')) {
    return joinPathFragments(
      '{workspaceRoot}',
      relative(workspaceRoot, fullPath)
    );
  }
  return joinPathFragments('{projectRoot}', pathRelativeToProjectRoot);
}

function getAtomizedTaskEnvVars(
  reporterOutputs: Array<ReporterOutput>,
  outputSubfolder: string
): Record<string, string> {
  const env: Record<string, string> = {};
  for (let [reporter, output] of reporterOutputs) {
    if (!output) {
      continue;
    }

    if (reporter === 'blob') {
      output = normalizeAtomizedTaskBlobReportOutput(output, outputSubfolder);
    } else {
      // add subfolder to the output to make them unique
      output = addSubfolderToOutput(output, outputSubfolder);
    }

    const outputExtname = parse(output).ext;
    const isFile = outputExtname !== '';
    let envVarName: string;
    envVarName = `PLAYWRIGHT_${reporter.toUpperCase()}_OUTPUT_${
      isFile ? 'FILE' : 'DIR'
    }`;

    env[envVarName] = output;
    // Also set PLAYWRIGHT_HTML_REPORT for Playwright prior to 1.45.0.
    // HTML prior to this version did not follow the pattern of "PLAYWRIGHT_<REPORTER>_OUTPUT_<FILE|DIR>".
    if (reporter === 'html') {
      env['PLAYWRIGHT_HTML_REPORT'] = env[envVarName];
    }
  }
  return env;
}

function normalizeAtomizedTaskBlobReportOutput(
  output: string,
  subfolder: string
): string {
  const outputExtname = parse(output).ext;

  // set unique name for the blob report file
  return outputExtname !== ''
    ? join(dirname(output), `${subfolder}${outputExtname}`)
    : join(output, `${subfolder}.zip`);
}
