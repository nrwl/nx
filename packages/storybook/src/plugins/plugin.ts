import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  loadConfigFile,
  PluginCache,
} from '@nx/devkit/internal';
import {
  AggregateCreateNodesError,
  CreateDependencies,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesResultArray,
  CreateNodes,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  parseJson,
  TargetConfiguration,
} from '@nx/devkit';
import { dirname, join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { getLockFileName } from '@nx/js';
import type { StorybookConfig } from 'storybook/internal/types';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { query } from '@phenomnomnominal/tsquery';
import { addBuildAndWatchDepsTargets } from '@nx/js/internal';

export interface StorybookPluginOptions {
  buildStorybookTargetName?: string;
  serveStorybookTargetName?: string;
  staticStorybookTargetName?: string;
  testStorybookTargetName?: string;
  buildDepsTargetName?: string;
  watchDepsTargetName?: string;
}

type StorybookTargets = Record<string, TargetConfiguration>;

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const storybookConfigGlob = '**/.storybook/main.{js,ts,mjs,mts,cjs,cts}';

export const createNodes: CreateNodes<StorybookPluginOptions> = [
  storybookConfigGlob,
  async (configFilePaths, options, context) => {
    const normalizedOptions = normalizeOptions(options);
    const optionsHash = hashObject(normalizedOptions);
    const cachePath = join(
      workspaceDataDirectory,
      `storybook-${optionsHash}.hash`
    );
    const targetsCache = new PluginCache<StorybookTargets>(cachePath);
    const packageManager = detectPackageManager(context.workspaceRoot);
    const pmc = getPackageManagerCommand(packageManager);
    const lockFileName = getLockFileName(packageManager);

    try {
      const { entries, preErrors } = await filterStorybookConfigs(
        configFilePaths,
        context
      );

      const projectHashes = await calculateHashesForCreateNodes(
        entries.map((e) => e.projectRoot),
        normalizedOptions,
        context,
        entries.map(() => [lockFileName])
      );

      let results: CreateNodesResultV2 = [];
      let nodeErrors: Array<[string | null, Error]> = [];
      try {
        results = await createNodesFromFiles(
          (configFile, _, ctx, idx) =>
            createNodesInternal(
              configFile,
              normalizedOptions,
              ctx,
              targetsCache,
              pmc,
              entries[idx].projectRoot,
              projectHashes[idx]
            ),
          entries.map((e) => e.configFile),
          normalizedOptions,
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
      targetsCache.writeToDisk();
    }
  },
];

export const createNodesV2 = createNodes;

function getProjectRootFromConfigPath(configFilePath: string): string {
  let projectRoot = '';
  if (configFilePath.includes('/.storybook')) {
    projectRoot = dirname(configFilePath).replace('/.storybook', '');
  } else {
    projectRoot = dirname(configFilePath).replace('.storybook', '');
  }
  if (projectRoot === '') {
    projectRoot = '.';
  }
  return projectRoot;
}

async function createNodesInternal(
  configFilePath: string,
  options: Required<StorybookPluginOptions>,
  context: CreateNodesContext,
  targetsCache: PluginCache<StorybookTargets>,
  pmc: ReturnType<typeof getPackageManagerCommand>,
  projectRoot: string,
  hash: string
) {
  const projectName = buildProjectName(projectRoot, context.workspaceRoot);

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await buildStorybookTargets(
        configFilePath,
        projectRoot,
        options,
        context,
        projectName,
        pmc
      )
    );
  }

  const result = {
    projects: {
      [projectRoot]: {
        root: projectRoot,
        targets: targetsCache.get(hash),
      },
    },
  };

  return result;
}

async function buildStorybookTargets(
  configFilePath: string,
  projectRoot: string,
  options: StorybookPluginOptions,
  context: CreateNodesContext,
  projectName: string,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const buildOutputs = getOutputs();

  const namedInputs = getNamedInputs(projectRoot, context);

  // First attempt to do a very fast lookup for the framework
  // If that fails, the framework might be inherited, so do a very heavyweight lookup
  const storybookFramework =
    (await getStorybookFramework(configFilePath, context)) ||
    (await getStorybookFullyResolvedFramework(configFilePath, context));

  const frameworkIsAngular = storybookFramework === '@storybook/angular';

  if (frameworkIsAngular && !projectName) {
    throw new Error(
      `Could not find a name for the project at '${projectRoot}'. Please make sure that the project has a package.json or project.json file with name specified.`
    );
  }

  const targets: Record<string, TargetConfiguration> = {};

  targets[options.buildStorybookTargetName] = buildTarget(
    namedInputs,
    buildOutputs,
    projectRoot,
    frameworkIsAngular,
    projectName,
    configFilePath
  );

  targets[options.serveStorybookTargetName] = serveTarget(
    projectRoot,
    frameworkIsAngular,
    projectName,
    configFilePath
  );

  if (isStorybookTestRunnerInstalled()) {
    targets[options.testStorybookTargetName] = testTarget(projectRoot);
  }

  targets[options.staticStorybookTargetName] = serveStaticTarget(
    options,
    projectRoot
  );

  addBuildAndWatchDepsTargets(
    context.workspaceRoot,
    projectRoot,
    targets,
    options,
    pmc
  );

  return targets;
}

function buildTarget(
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string,
  frameworkIsAngular: boolean,
  projectName: string,
  configFilePath: string
) {
  let targetConfig: TargetConfiguration;

  if (frameworkIsAngular) {
    targetConfig = {
      executor: '@storybook/angular:build-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget: `${projectName}:build-storybook`,
        compodoc: false,
        outputDir: joinPathFragments(projectRoot, 'storybook-static'),
      },
      cache: true,
      outputs,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: [
            'storybook',
            '@storybook/angular',
            isStorybookTestRunnerInstalled()
              ? '@storybook/test-runner'
              : undefined,
          ].filter(Boolean),
        },
      ],
    };
  } else {
    targetConfig = {
      command: `storybook build`,
      options: { cwd: projectRoot },
      cache: true,
      outputs,
      inputs: [
        ...('production' in namedInputs
          ? ['production', '^production']
          : ['default', '^default']),
        {
          externalDependencies: [
            'storybook',
            isStorybookTestRunnerInstalled()
              ? '@storybook/test-runner'
              : undefined,
          ].filter(Boolean),
        },
      ],
    };
  }

  return targetConfig;
}

function serveTarget(
  projectRoot: string,
  frameworkIsAngular: boolean,
  projectName: string,
  configFilePath: string
) {
  if (frameworkIsAngular) {
    return {
      continuous: true,
      executor: '@storybook/angular:start-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget: `${projectName}:build-storybook`,
        compodoc: false,
      },
    };
  } else {
    return {
      continuous: true,
      command: `storybook dev`,
      options: { cwd: projectRoot },
    };
  }
}

function testTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    command: `test-storybook`,
    options: { cwd: projectRoot },
    inputs: [
      {
        externalDependencies: ['storybook', '@storybook/test-runner'],
      },
    ],
  };

  return targetConfig;
}

function serveStaticTarget(
  options: StorybookPluginOptions,
  projectRoot: string
) {
  const targetConfig: TargetConfiguration = {
    dependsOn: [`${options.buildStorybookTargetName}`],
    continuous: true,
    executor: '@nx/web:file-server',
    options: {
      buildTarget: `${options.buildStorybookTargetName}`,
      staticFilePath: joinPathFragments(projectRoot, 'storybook-static'),
    },
  };

  return targetConfig;
}

async function getStorybookFramework(
  configFilePath: string,
  context: CreateNodesContext
): Promise<string | undefined> {
  const resolvedPath = join(context.workspaceRoot, configFilePath);
  const mainTsJs = readFileSync(resolvedPath, 'utf-8');
  const importDeclarations = query(
    mainTsJs,
    'ImportDeclaration:has(ImportSpecifier:has([text="StorybookConfig"]))'
  )?.[0];

  if (!importDeclarations) {
    return parseFrameworkName(mainTsJs);
  }

  const storybookConfigImportPackage = query(
    importDeclarations,
    'StringLiteral'
  )?.[0];

  if (storybookConfigImportPackage?.getText() === `'@storybook/core-common'`) {
    return parseFrameworkName(mainTsJs);
  }

  return storybookConfigImportPackage?.getText();
}

function parseFrameworkName(mainTsJs: string) {
  const frameworkPropertyAssignment = query(
    mainTsJs,
    `PropertyAssignment:has(Identifier:has([text="framework"]))`
  )?.[0];

  if (!frameworkPropertyAssignment) {
    return undefined;
  }

  const propertyAssignments = query(
    frameworkPropertyAssignment,
    `PropertyAssignment:has(Identifier:has([text="name"]))`
  );

  const namePropertyAssignment = propertyAssignments?.find((expression) => {
    return expression.getText().startsWith('name');
  });

  if (!namePropertyAssignment) {
    const storybookConfigImportPackage = query(
      frameworkPropertyAssignment,
      'StringLiteral'
    )?.[0];
    return storybookConfigImportPackage?.getText();
  }

  return query(namePropertyAssignment, `StringLiteral`)?.[0]?.getText();
}

async function getStorybookFullyResolvedFramework(
  configFilePath: string,
  context: CreateNodesContext
): Promise<string> {
  const resolvedPath = join(context.workspaceRoot, configFilePath);
  const { framework } = await loadConfigFile<StorybookConfig>(resolvedPath);

  return typeof framework === 'string' ? framework : framework.name;
}

function getOutputs(): string[] {
  const outputs = [
    `{projectRoot}/storybook-static`,
    `{options.output-dir}`,
    `{options.outputDir}`,
    `{options.o}`,
  ];

  return outputs;
}

interface StorybookEntry {
  configFile: string;
  projectRoot: string;
}

async function filterStorybookConfigs(
  configFiles: readonly string[],
  context: CreateNodesContext
): Promise<{
  entries: StorybookEntry[];
  preErrors: Array<[string, Error]>;
}> {
  const preErrors: Array<[string, Error]> = [];
  const candidates = await Promise.all(
    configFiles.map(async (configFile): Promise<StorybookEntry | null> => {
      try {
        const projectRoot = getProjectRootFromConfigPath(configFile);
        const siblingFiles = readdirSync(
          join(context.workspaceRoot, projectRoot)
        );
        if (
          !siblingFiles.includes('package.json') &&
          !siblingFiles.includes('project.json')
        ) {
          return null;
        }
        return { configFile, projectRoot };
      } catch (e) {
        preErrors.push([configFile, e as Error]);
        return null;
      }
    })
  );
  return {
    entries: candidates.filter((c): c is StorybookEntry => c !== null),
    preErrors,
  };
}

function normalizeOptions(
  options: StorybookPluginOptions
): Required<StorybookPluginOptions> {
  return {
    buildStorybookTargetName:
      options.buildStorybookTargetName ?? 'build-storybook',
    serveStorybookTargetName: options.serveStorybookTargetName ?? 'storybook',
    testStorybookTargetName:
      options.testStorybookTargetName ?? 'test-storybook',
    staticStorybookTargetName:
      options.staticStorybookTargetName ?? 'static-storybook',
    buildDepsTargetName: options.buildDepsTargetName ?? 'build-deps',
    watchDepsTargetName: options.watchDepsTargetName ?? 'watch-deps',
  };
}

function buildProjectName(
  projectRoot: string,
  workspaceRoot: string
): string | undefined {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  let name: string;
  if (existsSync(projectJsonPath)) {
    const projectJson = parseJson(readFileSync(projectJsonPath, 'utf-8'));
    name = projectJson.name;
  } else if (existsSync(packageJsonPath)) {
    const packageJson = parseJson(readFileSync(packageJsonPath, 'utf-8'));
    name = packageJson.name;
  }
  return name;
}

function isStorybookTestRunnerInstalled(): boolean {
  try {
    require.resolve('@storybook/test-runner');
    return true;
  } catch (e) {
    return false;
  }
}
