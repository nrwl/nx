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
import { dirname, join, parse, relative, resolve } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';

const pmc = getPackageManagerCommand();

export interface PlaywrightPluginOptions {
  targetName?: string;
  ciTargetName?: string;
  reportAggregatorTargetName?: string;
  mergeOutputs?: boolean;
  atomizedBlobReportOutputDir?: string;
}

interface NormalizedOptions {
  targetName: string;
  ciTargetName: string;
  reportAggregatorTargetName: string;
  mergeOutputs: boolean;
  atomizedBlobReportOutputDir: string;
}

type PlaywrightTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;
type ReporterOutput = [reporter: string, output?: string];

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
        reporterOutputs,
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

    const deleteAtomizedBlobReportOutputTaskName = `${options.ciTargetName}-delete-atomized-blob-report-output`;
    const deleteAtomizedBlobReportOutputTask: TargetConfiguration = {
      command: `rm -rf "${options.atomizedBlobReportOutputDir}"`,
      options: { cwd: '{projectRoot}' },
    };

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
          env: getAtomizedTaskOutputEnvVars(
            reporterOutputs,
            outputSubfolder,
            options.mergeOutputs,
            options.atomizedBlobReportOutputDir
          ),
        },
        outputs: getAtomizedTaskOutputs(
          testOutput,
          reporterOutputs,
          context.workspaceRoot,
          projectRoot,
          options.mergeOutputs,
          options.atomizedBlobReportOutputDir,
          outputSubfolder
        ),
        command: `${
          baseTargetConfig.command
        } ${relativeSpecFilePath} --output=${join(
          testOutput,
          outputSubfolder
        )}${options.mergeOutputs ? ` --reporter=blob` : ''}`,
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

      if (options.mergeOutputs) {
        targets[targetName].dependsOn = [
          ...(targets[targetName].dependsOn ?? []),
          {
            target: deleteAtomizedBlobReportOutputTaskName,
            projects: 'self',
          },
        ];
      }

      dependsOn.push({
        target: targetName,
        projects: 'self',
        params: 'forward',
      });
    }

    targets[options.ciTargetName] ??= {};

    targets[options.ciTargetName] = {
      cache: ciBaseTargetConfig.cache,
      inputs: ciBaseTargetConfig.inputs,
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

    if (options.mergeOutputs && dependsOn.length) {
      // add task to delete the atomized blob report output
      targets[deleteAtomizedBlobReportOutputTaskName] =
        deleteAtomizedBlobReportOutputTask;
      ciTargetGroup.push(deleteAtomizedBlobReportOutputTaskName);

      // create the report aggregator task
      const jsonReporterMetadata = getJsonReporterMetadata(
        reporterOutputs,
        options.atomizedBlobReportOutputDir
      );
      const { commands, envVars, extraOutputs } =
        getReportAggregatorTaskCommandsAndEnvVars(
          options.atomizedBlobReportOutputDir,
          reporterOutputs,
          jsonReporterMetadata
        );
      const outputs = Array.from(
        new Set([
          ...ciBaseTargetConfig.outputs,
          ...extraOutputs.map((output) =>
            normalizeOutput(output, context.workspaceRoot, projectRoot)
          ),
        ])
      );

      targets[options.reportAggregatorTargetName] = {
        cache: ciBaseTargetConfig.cache,
        inputs: ciBaseTargetConfig.inputs,
        outputs,
        dependsOn: dependsOn.map((d: TargetDependencyConfig) => ({
          ...d,
          skipOnFailure: false,
        })),
        options: { cwd: '{projectRoot}' },
        metadata: {
          technologies: ['playwright'],
          description: 'Aggregates Playwright Test Results from Atomized Tasks',
          help: {
            command: `${pmc.exec} playwright merge-reports --help`,
            example: { options: { reporter: 'list' } },
          },
        },
      };
      if (commands.length > 1) {
        targets[options.reportAggregatorTargetName].executor =
          'nx:run-commands';
        targets[options.reportAggregatorTargetName].options.commands = commands;
      } else {
        targets[options.reportAggregatorTargetName].command = commands[0];
      }

      if (Object.keys(envVars).length) {
        targets[options.reportAggregatorTargetName].options.env = envVars;
      }
      ciTargetGroup.push(options.reportAggregatorTargetName);

      // update the ci target
      targets[options.ciTargetName].outputs = outputs;
      targets[options.ciTargetName].dependsOn = [
        {
          target: options.reportAggregatorTargetName,
          projects: 'self',
          params: 'forward',
        },
      ];

      targets[options.ciTargetName].command = getStatusCheckCommand(
        jsonReporterMetadata.jsonReportFile,
        jsonReporterMetadata.isTempJsonReport,
        dependsOn.length
      );
      targets[options.ciTargetName].options = {
        cwd: '{projectRoot}',
      };
    } else {
      targets[options.ciTargetName].executor = 'nx:noop';
      targets[options.ciTargetName].dependsOn = dependsOn;
      targets[options.ciTargetName].outputs = ciBaseTargetConfig.outputs;
    }

    if (!webserverCommandTasks.length) {
      targets[options.ciTargetName].parallelism = false;
    }

    ciTargetGroup.push(options.ciTargetName);
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
  return {
    ...options,
    targetName: options?.targetName ?? 'e2e',
    ciTargetName: options?.ciTargetName ?? 'e2e-ci',
    reportAggregatorTargetName:
      options?.reportAggregatorTargetName ?? 'e2e-ci-report-aggregator',
    mergeOutputs: options?.mergeOutputs ?? true,
    atomizedBlobReportOutputDir:
      options?.atomizedBlobReportOutputDir ?? '.nx-atomized-blob-reports',
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
): Array<ReporterOutput> {
  const reporters: Array<ReporterOutput> = [];

  const reporterConfig = playwrightConfig.reporter;
  if (!reporterConfig) {
    // `list` is the default reporter except in CI where `dot` is the default.
    // https://playwright.dev/docs/test-reporters#list-reporter
    return [[process.env.CI ? 'dot' : 'list']];
  }

  const defaultHtmlOutputDir = 'playwright-report';
  const defaultBlobOutputDir = 'blob-report';
  if (reporterConfig === 'html') {
    reporters.push([reporterConfig, defaultHtmlOutputDir]);
  } else if (reporterConfig === 'blob') {
    reporters.push([reporterConfig, defaultBlobOutputDir]);
  } else if (typeof reporterConfig === 'string') {
    reporters.push([reporterConfig]);
  } else if (Array.isArray(reporterConfig)) {
    for (const [reporter, opts] of reporterConfig) {
      // There are a few different ways to specify an output file or directory
      // depending on the reporter. This is a best effort to find the output.
      if (opts?.outputFile) {
        reporters.push([reporter, opts.outputFile]);
      } else if (opts?.outputDir) {
        reporters.push([reporter, opts.outputDir]);
      } else if (opts?.outputFolder) {
        reporters.push([reporter, opts.outputFolder]);
      } else if (reporter === 'html') {
        reporters.push([reporter, defaultHtmlOutputDir]);
      } else if (reporter === 'blob') {
        reporters.push([reporter, defaultBlobOutputDir]);
      } else {
        reporters.push([reporter]);
      }
    }
  }

  return reporters;
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
  mergeOutputs: boolean,
  atomizedBlobReportOutputDir: string,
  subFolder?: string
): string[] {
  const outputs = new Set<string>();
  outputs.add(
    normalizeOutput(
      addSubfolderToOutput(testOutput, subFolder),
      workspaceRoot,
      projectRoot
    )
  );

  if (mergeOutputs) {
    outputs.add(
      normalizeOutput(
        getAtomizedBlobReportOutputFile(atomizedBlobReportOutputDir, subFolder),
        workspaceRoot,
        projectRoot
      )
    );
  } else {
    for (const [, output] of reporterOutputs) {
      if (!output) {
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
  }

  return Array.from(outputs);
}

function addSubfolderToOutput(output: string, subfolder?: string): string {
  if (!subfolder) return output;
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

function getReportAggregatorTaskCommandsAndEnvVars(
  blobReportOutput: string,
  reporterOutputs: Array<ReporterOutput>,
  jsonReporterMetadata: JsonReporterMetadata
): {
  commands: string[];
  envVars: Record<string, string>;
  extraOutputs: string[];
} {
  const commands: string[] = [];
  const normalizedReporterOutputs = [...reporterOutputs];

  const { jsonReporterOutput, jsonReportFile, isTempJsonReport } =
    jsonReporterMetadata;
  if (jsonReporterOutput) {
    jsonReporterOutput[1] = jsonReportFile;
  } else {
    normalizedReporterOutputs.push(['json', jsonReportFile]);
  }

  // Add merge commands for configured reporters
  for (const [reporter] of normalizedReporterOutputs) {
    commands.push(
      `playwright merge-reports ${blobReportOutput} --reporter=${reporter}`
    );
  }

  const envVars = getReporterEnvVars(normalizedReporterOutputs);

  return {
    commands,
    envVars,
    extraOutputs: !isTempJsonReport ? [jsonReportFile] : [],
  };
}

type JsonReporterMetadata = {
  jsonReporterOutput: ReporterOutput;
  jsonReportFile: string;
  isTempJsonReport: boolean;
};

function getJsonReporterMetadata(
  reporterOutputs: Array<ReporterOutput>,
  blobReportOutput: string
): JsonReporterMetadata {
  let jsonReporterOutput = reporterOutputs.find(([r]) => r === 'json');
  let isTempJsonReport = false;
  let jsonReportFile: string;
  if (jsonReporterOutput) {
    jsonReportFile =
      jsonReporterOutput[1] ?? join(blobReportOutput, 'merged-results.json');
  } else {
    jsonReportFile = join(blobReportOutput, 'merged-results.json');
    isTempJsonReport = true;
  }

  return { jsonReporterOutput, jsonReportFile, isTempJsonReport };
}

function getStatusCheckCommand(
  jsonReportFile: string,
  shouldRemoveJsonReportFile: boolean,
  testSuiteCount: number
): string {
  return `node -e "const fs=require('fs');try{const r=JSON.parse(fs.readFileSync('${jsonReportFile}','utf8'));const failed=r.stats.unexpected>0||r.suites.length!==${testSuiteCount};console.log('\\n',failed?'❌':'✅','Test suite',failed?'failed.':'passed!','\\n');process.exit(failed?1:0);}catch(e){console.error('❌Failed to read test report:',e.message);process.exit(1);}${
    shouldRemoveJsonReportFile
      ? `finally{try{fs.unlinkSync('${jsonReportFile}');}catch{}}`
      : ''
  }"`;
}

function getAtomizedTaskOutputEnvVars(
  reporterOutputs: Array<ReporterOutput>,
  outputSubfolder: string,
  mergeOutputs: boolean,
  atomizedBlobReportOutputDir: string
): Record<string, string> {
  if (mergeOutputs) {
    return {
      PLAYWRIGHT_BLOB_OUTPUT_FILE: getAtomizedBlobReportOutputFile(
        atomizedBlobReportOutputDir,
        outputSubfolder
      ),
    };
  }

  return getReporterEnvVars(reporterOutputs, outputSubfolder);
}

function getAtomizedBlobReportOutputFile(
  atomizedBlobReportOutputDir: string,
  outputSubfolder: string
): string {
  return join(atomizedBlobReportOutputDir, `${outputSubfolder}.zip`);
}

function getReporterEnvVars(
  reporterOutputs: Array<ReporterOutput>,
  outputSubfolder?: string
): Record<string, string> {
  const env: Record<string, string> = {};
  for (let [reporter, output] of reporterOutputs) {
    if (!output) {
      continue;
    }

    const isFile = parse(output).ext !== '';
    let envVarName: string;
    envVarName = `PLAYWRIGHT_${reporter.toUpperCase()}_OUTPUT_${
      isFile ? 'FILE' : 'DIR'
    }`;
    env[envVarName] = outputSubfolder
      ? addSubfolderToOutput(output, outputSubfolder)
      : output;
    // Also set PLAYWRIGHT_HTML_REPORT for Playwright prior to 1.45.0.
    // HTML prior to this version did not follow the pattern of "PLAYWRIGHT_<REPORTER>_OUTPUT_<FILE|DIR>".
    if (reporter === 'html') {
      env['PLAYWRIGHT_HTML_REPORT'] = env[envVarName];
    }
  }
  return env;
}
