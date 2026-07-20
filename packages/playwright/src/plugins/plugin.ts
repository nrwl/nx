import {
  calculateHashesForCreateNodes,
  loadConfigFile,
  getNamedInputs,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  createNodesFromFiles,
  type CreateNodesContext,
  CreateNodesResultArray,
  type CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  normalizePath,
  type ProjectConfiguration,
  type TargetConfiguration,
  type TargetDependencyConfig,
} from '@nx/devkit';
import { getLockFileName, getRootTsConfigFileName } from '@nx/js';
import { walkTsconfigExtendsChain } from '@nx/js/internal';
import type { PlaywrightTestConfig } from '@playwright/test';
import { minimatch } from 'minimatch';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, parse, relative, resolve, sep } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { PluginCache } from 'nx/src/utils/plugin-cache-utils';
import { getFilesInDirectoryUsingContext } from 'nx/src/utils/workspace-context';
import { getReporterOutputs, type ReporterOutput } from '../utils/reporters';

export interface PlaywrightPluginOptions {
  targetName?: string;
  ciTargetName?: string;
  /**
   * Maximum time in milliseconds the inferred web server readiness task waits
   * for the server to accept connections before failing. Overrides the
   * `timeout` configured on Playwright's `webServer`. Defaults to that
   * configured timeout, or 60000 when neither is set.
   */
  webServerTimeout?: number;
}

interface NormalizedOptions {
  targetName: string;
  ciTargetName: string;
  mergeReportsTargetName: string;
  webServerTimeout?: number;
}

type PlaywrightTargets = Pick<ProjectConfiguration, 'targets' | 'metadata'>;

interface WebserverCommandTask {
  project: string;
  target: string;
  port?: number;
  url?: string;
  ignoreHTTPSErrors?: boolean;
  timeout?: number;
}

const playwrightConfigGlob = '**/playwright.config.{js,ts,cjs,cts,mjs,mts}';
export const createNodes: CreateNodes<PlaywrightPluginOptions> = [
  playwrightConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `playwright-${optionsHash}.hash`
    );
    const pluginCache = new PluginCache<PlaywrightTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);
    const normalizedOptions = normalizeOptions(options);

    try {
      const { entries, preErrors } = await filterPlaywrightConfigs(
        configFilePaths,
        context
      );

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        { ...normalizedOptions, CI: process.env.CI },
        context,
        entries.map((e) => [lockFileName, ...e.externalTsconfigInputs])
      );

      let results: CreateNodesResultArray = [];
      let nodeErrors: Array<[string | null, Error]> = [];
      try {
        results = await createNodesFromFiles(
          (configFile, _, ctx, idx) =>
            createNodesInternal(
              configFile,
              normalizedOptions,
              ctx,
              pluginCache,
              pmc,
              entries[idx].externalTsconfigInputs,
              projectHashes[idx]
            ),
          entries.map((e) => e.configFile),
          options,
          context
        );
      } catch (e) {
        if (e instanceof AggregateCreateNodesError) {
          results = e.partialResults ?? [];
          nodeErrors = e.errors;
        } else {
          throw e;
        }
      }

      const allErrors = [...preErrors, ...nodeErrors];
      if (allErrors.length > 0) {
        throw new AggregateCreateNodesError(allErrors, results);
      }
      return results;
    } finally {
      pluginCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

async function createNodesInternal(
  configFilePath: string,
  normalizedOptions: NormalizedOptions,
  context: CreateNodesContext,
  pluginCache: PluginCache<PlaywrightTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  externalTsconfigInputs: string[],
  hash: string
) {
  const projectRoot = dirname(configFilePath);

  if (!pluginCache.has(hash)) {
    pluginCache.set(
      hash,
      await buildPlaywrightTargets(
        configFilePath,
        projectRoot,
        normalizedOptions,
        context,
        pmc,
        externalTsconfigInputs
      )
    );
  }
  const { targets, metadata } = pluginCache.get(hash);

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
  context: CreateNodesContext,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  externalTsconfigInputs: string[]
): Promise<PlaywrightTargets> {
  // Playwright forbids importing the `@playwright/test` module twice. This would affect running the tests,
  // but we're just reading the config so let's delete the variable they are using to detect this.
  // See: https://github.com/microsoft/playwright/pull/11218/files
  delete (process as any)['__pw_initiator__'];

  const playwrightConfig = await loadConfigFile<PlaywrightTestConfig>(
    join(context.workspaceRoot, configFilePath)
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const tsconfigJsonInputs = externalTsconfigInputs.map((file) => ({
    json: `{workspaceRoot}/${file}`,
    fields: ['compilerOptions', 'extends', 'files', 'include'],
  }));

  const targets: ProjectConfiguration['targets'] = {};
  let metadata: ProjectConfiguration['metadata'];

  const testOutput = getTestOutput(playwrightConfig);
  const reporterOutputs = getReporterOutputs(playwrightConfig);
  const webserverCommandTasks = getWebserverCommandTasks(playwrightConfig);

  // When an inferred web server exposes a port/url, add a task that waits for
  // it to accept connections. Playwright's `reuseExistingServer` probe
  // otherwise races the server boot, misses, and spawns its own nested server
  // command whose I/O then leaks into the task. Both the `e2e` task and the
  // atomized CI tasks depend on it.
  const webserverReadinessTasks = webserverCommandTasks.filter(
    (task) => task.port != null || task.url != null
  );
  const webserverReadinessServers = webserverReadinessTasks.map((task) => {
    const server: {
      port?: number;
      url?: string;
      ignoreHTTPSErrors?: boolean;
    } = task.port != null ? { port: task.port } : { url: task.url };
    if (task.ignoreHTTPSErrors) {
      server.ignoreHTTPSErrors = true;
    }
    return server;
  });
  const webserverReadyTargetName =
    webserverReadinessServers.length > 0
      ? `${options.targetName}--wait-for-webserver`
      : undefined;
  // Honor Playwright's own `webServer.timeout` (the budget it waits for a
  // server it starts) so a slow server is not cut short. The plugin option
  // overrides it; use the longest configured timeout across servers.
  const configuredTimeouts = webserverReadinessTasks
    .map((task) => task.timeout)
    .filter((timeout): timeout is number => timeout != null);
  const webserverReadinessTimeout =
    options.webServerTimeout ??
    (configuredTimeouts.length > 0
      ? Math.max(...configuredTimeouts)
      : undefined);

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
    baseTargetConfig.dependsOn = webserverReadyTargetName
      ? [
          ...getDependsOn(webserverCommandTasks),
          { target: webserverReadyTargetName },
        ]
      : getDependsOn(webserverCommandTasks);
  } else {
    baseTargetConfig.parallelism = false;
  }

  targets[options.targetName] = {
    ...baseTargetConfig,
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production', '^{projectRoot}/tsconfig*.json']
        : ['default', '^default']),
      ...tsconfigJsonInputs,
      { externalDependencies: ['@playwright/test'] },
    ],
    outputs: getTargetOutputs(
      testOutput,
      reporterOutputs,
      context.workspaceRoot,
      projectRoot
    ),
  };

  if (webserverReadyTargetName) {
    targets[webserverReadyTargetName] = {
      executor: '@nx/playwright:wait-for-webserver',
      cache: false,
      options: {
        servers: webserverReadinessServers,
        ...(webserverReadinessTimeout != null
          ? { timeout: webserverReadinessTimeout }
          : {}),
      },
      dependsOn: getDependsOn(webserverCommandTasks),
      metadata: {
        technologies: ['playwright'],
        description:
          'Waits for the E2E web server(s) to be ready before the Playwright test tasks run.',
      },
    };
  }

  if (options.ciTargetName) {
    // ensure the blob reporter output is the directory containing the blob
    // report files
    const ciReporterOutputs = reporterOutputs.map<ReporterOutput>(
      ([reporter, output]) =>
        reporter === 'blob' && output.endsWith('.zip')
          ? [reporter, dirname(output)]
          : [reporter, output]
    );
    const ciBaseTargetConfig: TargetConfiguration = {
      ...baseTargetConfig,
      cache: true,
      inputs: [
        ...('production' in namedInputs
          ? ['default', '^production', '^{projectRoot}/tsconfig*.json']
          : ['default', '^default']),
        ...tsconfigJsonInputs,
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
        } ${relativeSpecFilePath} --output=${joinPathFragments(
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
        params: 'forward',
        options: 'forward',
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
    if (webserverReadyTargetName) {
      ciTargetGroup.push(webserverReadyTargetName);
    }

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
      continuous: false,
      cache: true,
      inputs: ciBaseTargetConfig.inputs,
      outputs: Array.from(mergeReportsTargetOutputs),
      options: {
        config: normalizePath(relative(projectRoot, configFilePath)),
        expectedSuites: dependsOn.length,
      },
      metadata: {
        technologies: ['playwright'],
        description:
          'Merges Playwright blob reports from atomized tasks to produce unified reports for the configured reporters.',
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
    return joinPathFragments(parts.dir, subfolder, parts.base);
  }
  return joinPathFragments(output, subfolder);
}

function getWebserverCommandTasks(
  playwrightConfig: PlaywrightTestConfig
): WebserverCommandTask[] {
  if (!playwrightConfig.webServer) {
    return [];
  }

  const tasks: WebserverCommandTask[] = [];

  const webServer = Array.isArray(playwrightConfig.webServer)
    ? playwrightConfig.webServer
    : [playwrightConfig.webServer];

  for (const server of webServer) {
    if (!server.reuseExistingServer) {
      continue;
    }

    const task = parseTaskFromCommand(server.command);
    if (task) {
      tasks.push({
        ...task,
        port: server.port,
        url: server.url,
        ignoreHTTPSErrors: server.ignoreHTTPSErrors,
        timeout: server.timeout,
      });
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
  // set unique name for the blob report file
  return output.endsWith('.zip')
    ? joinPathFragments(dirname(output), `${subfolder}.zip`)
    : joinPathFragments(output, `${subfolder}.zip`);
}

interface PlaywrightEntry {
  configFile: string;
  projectRoot: string;
  externalTsconfigInputs: string[];
}

async function filterPlaywrightConfigs(
  configFilePaths: readonly string[],
  context: CreateNodesContext
): Promise<{
  entries: PlaywrightEntry[];
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFilePaths.map(async (configFile): Promise<PlaywrightEntry | null> => {
      try {
        const projectRoot = dirname(configFile);
        const siblingFiles = readdirSync(
          join(context.workspaceRoot, projectRoot)
        );
        if (
          !siblingFiles.includes('package.json') &&
          !siblingFiles.includes('project.json')
        ) {
          return null;
        }
        const externalTsconfigInputs = collectExternalTsconfigInputs(
          projectRoot,
          context.workspaceRoot
        );
        return { configFile, projectRoot, externalTsconfigInputs };
      } catch (e) {
        preErrors.push([configFile, e as Error]);
        return null;
      }
    })
  );
  return {
    entries: candidates.filter((c): c is PlaywrightEntry => c !== null),
    preErrors,
  };
}

/**
 * Collects tsconfig files read by the Playwright task that are NOT already
 * covered by other inputs, returned as workspace-relative paths.
 *
 * Sources:
 * - The project tsconfig's `extends` chain (compile-time config loading)
 * - The workspace root `tsconfig.json` (read at runtime by
 *   `isUsingTsSolutionSetup`, which `nxE2EPreset` calls from the Playwright
 *   worker to pick the output directory convention)
 *
 * Exclusions:
 * - Files inside the project root — covered by `default`
 * - The native `TsConfiguration` hash instruction file at the workspace
 *   root (`tsconfig.base.json` when it exists, otherwise `tsconfig.json`)
 * - Files under `node_modules` — invalidated via the lockfile
 * - Paths outside the workspace — cannot be expressed as inputs
 */
function collectExternalTsconfigInputs(
  projectRoot: string,
  workspaceRoot: string
): string[] {
  const rootTsConfigName = getRootTsConfigFileName();
  const projectPrefix = `${projectRoot}/`;
  const collected: string[] = [];
  const seen = new Set<string>();

  const visit = (absolutePath: string): 'continue' => {
    const wsRelative = relative(workspaceRoot, absolutePath)
      .split(sep)
      .join('/');
    if (seen.has(wsRelative)) return 'continue';
    seen.add(wsRelative);
    if (wsRelative.startsWith('../') || wsRelative === '..') return 'continue';
    if (
      wsRelative.startsWith('node_modules/') ||
      wsRelative.includes('/node_modules/')
    ) {
      return 'continue';
    }
    if (wsRelative === projectRoot || wsRelative.startsWith(projectPrefix)) {
      return 'continue';
    }
    if (wsRelative === rootTsConfigName) return 'continue';
    collected.push(wsRelative);
    return 'continue';
  };

  const projectTsconfig = join(workspaceRoot, projectRoot, 'tsconfig.json');
  if (existsSync(projectTsconfig)) {
    walkTsconfigExtendsChain(projectTsconfig, visit);
  }

  const rootTsconfig = join(workspaceRoot, 'tsconfig.json');
  if (existsSync(rootTsconfig)) {
    walkTsconfigExtendsChain(rootTsconfig, visit);
  }

  return collected;
}
