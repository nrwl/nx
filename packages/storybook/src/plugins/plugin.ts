import {
  getNamedInputs,
  calculateHashesForCreateNodes,
  loadConfigFile,
  PluginCache,
  workspaceDataDirectory,
  hashObject,
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
import { getLockFileName } from '@nx/js';
import type { StorybookConfig } from 'storybook/internal/types';
import { query } from '@phenomnomnominal/tsquery';
import { addBuildAndWatchDepsTargets } from '@nx/js/internal';
import { findStorybookAndBuildTargetsAndCompiler } from '../utils/utilities';

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

// Vite-builder frameworks we infer the addon target for. The addon itself only
// checks that the resolved builder is Vite, so this list is conservative rather
// than exhaustive. `@storybook/sveltekit` uses the Vite builder despite the name.
const VITE_BUILDER_FRAMEWORKS = new Set([
  '@storybook/angular-vite',
  '@storybook/react-vite',
  '@storybook/react-native-web-vite',
  '@storybook/tanstack-react',
  '@storybook/vue-vite',
  '@storybook/vue3-vite',
  '@storybook/svelte-vite',
  '@storybook/sveltekit',
  '@storybook/web-components-vite',
  '@storybook/html-vite',
  '@storybook/preact-vite',
  '@storybook/nextjs-vite',
]);

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

      let results: CreateNodesResultArray = [];
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
  const { projectName, angularBuildTarget } = getProjectMetadata(
    projectRoot,
    context.workspaceRoot
  );

  if (!targetsCache.has(hash)) {
    targetsCache.set(
      hash,
      await buildStorybookTargets(
        configFilePath,
        projectRoot,
        options,
        context,
        projectName,
        angularBuildTarget,
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
  angularBuildTarget: string | undefined,
  pmc: ReturnType<typeof getPackageManagerCommand>
) {
  const buildOutputs = getOutputs();

  const namedInputs = getNamedInputs(projectRoot, context);

  // First attempt to do a very fast lookup for the framework
  // If that fails, the framework might be inherited, so do a very heavyweight lookup
  // The slow path returns whatever the config holds, which for the common
  // `getAbsolutePath('@storybook/react-vite')` shape is a resolved path.
  const storybookFramework = normalizePackageName(
    (await getStorybookFramework(configFilePath, context)) ||
      (await getStorybookFullyResolvedFramework(configFilePath, context))
  );

  const frameworkIsAngular = storybookFramework === '@storybook/angular';

  if (frameworkIsAngular && !projectName) {
    throw new Error(
      `Could not find a name for the project at '${projectRoot}'. Please make sure that the project has a package.json or project.json file with name specified.`
    );
  }

  const targets: Record<string, TargetConfiguration> = {};

  // Resolution alone is not enough: the addon lives in the root package.json, so
  // it resolves for every project. Registration in this project's own config is
  // what makes it ours. Resolve first - it is a stat walk, while reading the
  // registration executes the user's config.
  const usesVitestAddon =
    VITE_BUILDER_FRAMEWORKS.has(storybookFramework) &&
    isInstalled(
      '@storybook/addon-vitest',
      context.workspaceRoot,
      projectRoot
    ) &&
    (await registersVitestAddon(configFilePath, context));
  const hasTestRunner = isInstalled(
    '@storybook/test-runner',
    context.workspaceRoot,
    projectRoot
  );

  // Falls back to the storybook build target, whose name is configurable, so
  // resolve it from the options rather than assuming the default.
  const browserTarget = `${projectName}:${
    angularBuildTarget ?? options.buildStorybookTargetName
  }`;

  targets[options.buildStorybookTargetName] = buildTarget(
    namedInputs,
    buildOutputs,
    projectRoot,
    frameworkIsAngular,
    browserTarget,
    configFilePath,
    hasTestRunner
  );

  targets[options.serveStorybookTargetName] = serveTarget(
    projectRoot,
    frameworkIsAngular,
    browserTarget,
    configFilePath
  );

  if (usesVitestAddon) {
    targets[options.testStorybookTargetName] = vitestTestTarget(projectRoot);
  } else if (hasTestRunner) {
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
  browserTarget: string,
  configFilePath: string,
  hasTestRunner: boolean
) {
  let targetConfig: TargetConfiguration;

  if (frameworkIsAngular) {
    targetConfig = {
      executor: '@storybook/angular:build-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget,
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
            hasTestRunner ? '@storybook/test-runner' : undefined,
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
            hasTestRunner ? '@storybook/test-runner' : undefined,
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
  browserTarget: string,
  configFilePath: string
) {
  if (frameworkIsAngular) {
    return {
      continuous: true,
      executor: '@storybook/angular:start-storybook',
      options: {
        configDir: `${dirname(configFilePath)}`,
        browserTarget,
        compodoc: false,
        // The builder defaults to 9009, but test-storybook looks for 6006. Match
        // the port the non-Angular `storybook dev` target serves on.
        port: 6006,
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

function vitestTestTarget(projectRoot: string) {
  const targetConfig: TargetConfiguration = {
    // `--passWithNoTests` so the target is green before any stories exist. It does
    // not mask a missing `storybook` project: that is a startup error either way.
    command: `vitest run --project=storybook --passWithNoTests`,
    options: { cwd: projectRoot },
    inputs: [
      {
        externalDependencies: [
          'storybook',
          '@storybook/addon-vitest',
          'vitest',
        ],
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

  const frameworkPackage = stringLiteralValue(storybookConfigImportPackage);

  if (frameworkPackage === '@storybook/core-common') {
    return parseFrameworkName(mainTsJs);
  }

  return frameworkPackage;
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
    return stringLiteralValue(storybookConfigImportPackage);
  }

  return stringLiteralValue(
    query(namePropertyAssignment, `StringLiteral`)?.[0]
  );
}

function stringLiteralValue(node: { getText(): string } | undefined) {
  const value = node?.getText();
  return value?.slice(1, -1);
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

function getProjectMetadata(
  projectRoot: string,
  workspaceRoot: string
): { projectName: string | undefined; angularBuildTarget: string | undefined } {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');
  const projectJsonPath = join(workspaceRoot, projectRoot, 'project.json');
  let projectJsonName: string;
  let projectJsonTargets: Record<string, TargetConfiguration> = {};
  let packageJsonName: string;
  let packageJsonTargets: Record<string, TargetConfiguration> = {};
  if (existsSync(projectJsonPath)) {
    const projectJson = parseJson(readFileSync(projectJsonPath, 'utf-8'));
    projectJsonName = projectJson.name;
    projectJsonTargets = projectJson.targets ?? {};
  }
  if (existsSync(packageJsonPath)) {
    const packageJson = parseJson(readFileSync(packageJsonPath, 'utf-8'));
    packageJsonName = packageJson.name;
    packageJsonTargets = packageJson.nx?.targets ?? {};
  }

  // Mirror how Nx itself names a project: project.json, then package.json, then
  // the directory. Both files can carry targets, and project.json wins.
  const targets = { ...packageJsonTargets, ...projectJsonTargets };

  return {
    projectName:
      projectJsonName ?? packageJsonName ?? nameFromRoot(projectRoot),
    angularBuildTarget:
      findStorybookAndBuildTargetsAndCompiler(targets).ngBuildTarget,
  };
}

// Same derivation as Nx's `toProjectName`. The workspace root has no directory
// segment to name it after, so leave it undefined and let the caller complain.
function nameFromRoot(projectRoot: string): string | undefined {
  const segment = projectRoot.split(/[\/\\]/g).pop();
  return !segment || segment === '.' ? undefined : segment.toLowerCase();
}

async function registersVitestAddon(
  configFilePath: string,
  context: CreateNodesContext
): Promise<boolean> {
  try {
    const { addons } = await loadConfigFile<StorybookConfig>(
      join(context.workspaceRoot, configFilePath)
    );
    return addons?.some(isVitestAddon) ?? false;
  } catch {
    return false;
  }
}

function isVitestAddon(addon: unknown): boolean {
  const addonName =
    typeof addon === 'string'
      ? addon
      : typeof addon === 'object' && addon !== null && 'name' in addon
        ? addon.name
        : undefined;

  return (
    typeof addonName === 'string' &&
    normalizePackageName(addonName) === '@storybook/addon-vitest'
  );
}

// Addons and frameworks are both written either as a bare specifier or as a
// resolved path, so compare on the trailing scope/name either way.
function normalizePackageName(packageName: string): string;
function normalizePackageName(
  packageName: string | undefined
): string | undefined;
function normalizePackageName(packageName: string | undefined) {
  return packageName
    ?.replace(/\\/g, '/')
    .split('/')
    .filter(Boolean)
    .slice(-2)
    .join('/');
}

// Resolved from the project first so a runner declared in the project's own
// package.json counts, not just one hoisted to the workspace root.
function isInstalled(
  packageName: string,
  workspaceRoot: string,
  projectRoot: string
): boolean {
  try {
    require.resolve(packageName, {
      paths: [join(workspaceRoot, projectRoot), workspaceRoot],
    });
    return true;
  } catch {
    return false;
  }
}
