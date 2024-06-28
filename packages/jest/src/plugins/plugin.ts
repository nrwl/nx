import {
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesV2,
  getPackageManagerCommand,
  joinPathFragments,
  logger,
  normalizePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, isAbsolute, join, relative, resolve } from 'path';

import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { readConfig, replaceRootDirInPath } from 'jest-config';
import jestResolve from 'jest-resolve';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import {
  clearRequireCache,
  loadConfigFile,
} from '@nx/devkit/src/utils/config-utils';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json-workspaces';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { minimatch } from 'minimatch';
import { hashObject } from 'nx/src/devkit-internals';

const pmc = getPackageManagerCommand();

export interface JestPluginOptions {
  targetName?: string;
  ciTargetName?: string;
}

type JestTargets = Awaited<ReturnType<typeof buildJestTargets>>;

function readTargetsCache(cachePath: string): Record<string, JestTargets> {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

function writeTargetsToCache(
  cachePath: string,
  results: Record<string, JestTargets>
) {
  writeJsonFile(cachePath, results);
}

const jestConfigGlob = '**/jest.config.{cjs,mjs,js,cts,mts,ts}';

export const createNodesV2: CreateNodesV2<JestPluginOptions> = [
  jestConfigGlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `jest-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);

    try {
      return await createNodesFromFiles(
        (configFile, options, context) =>
          createNodesInternal(configFile, options, context, targetsCache),
        configFiles,
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
export const createNodes: CreateNodes<JestPluginOptions> = [
  jestConfigGlob,
  (...args) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );

    return createNodesInternal(...args, {});
  },
];

async function createNodesInternal(
  configFilePath,
  options,
  context,
  targetsCache: Record<string, JestTargets>
) {
  const projectRoot = dirname(configFilePath);

  const packageManagerWorkspacesGlob = combineGlobPatterns(
    getGlobPatternsFromPackageManagerWorkspaces(context.workspaceRoot)
  );

  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return {};
  } else if (
    !siblingFiles.includes('project.json') &&
    siblingFiles.includes('package.json')
  ) {
    const path = joinPathFragments(projectRoot, 'package.json');

    const isPackageJsonProject = minimatch(path, packageManagerWorkspacesGlob);

    if (!isPackageJsonProject) {
      return {};
    }
  }

  const jestConfigContent = readFileSync(
    resolve(context.workspaceRoot, configFilePath),
    'utf-8'
  );
  if (jestConfigContent.includes('getJestProjectsAsync()')) {
    // The `getJestProjectsAsync` function uses the project graph, which leads to a
    // circular dependency. We can skip this since it's no intended to be used for
    // an Nx project.
    return {};
  }

  options = normalizeOptions(options);

  const hash = await calculateHashForCreateNodes(projectRoot, options, context);
  targetsCache[hash] ??= await buildJestTargets(
    configFilePath,
    projectRoot,
    options,
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

async function buildJestTargets(
  configFilePath: string,
  projectRoot: string,
  options: JestPluginOptions,
  context: CreateNodesContext
): Promise<Pick<ProjectConfiguration, 'targets' | 'metadata'>> {
  const absConfigFilePath = resolve(context.workspaceRoot, configFilePath);

  if (require.cache[absConfigFilePath]) {
    clearRequireCache();
  }

  const rawConfig = await loadConfigFile(absConfigFilePath);
  const config = await readConfig(
    {
      _: [],
      $0: undefined,
    },
    rawConfig,
    undefined,
    dirname(absConfigFilePath)
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  const target: TargetConfiguration = (targets[options.targetName] = {
    command: 'jest',
    options: {
      cwd: projectRoot,
    },
    metadata: {
      technologies: ['jest'],
      description: 'Run Jest Tests',
      help: {
        command: `${pmc.exec} jest --help`,
        example: {
          options: {
            coverage: true,
          },
        },
      },
    },
  });

  const cache = (target.cache = true);
  const inputs = (target.inputs = getInputs(
    namedInputs,
    rawConfig,
    projectRoot,
    context.workspaceRoot
  ));
  const outputs = (target.outputs = getOutputs(projectRoot, config, context));

  let metadata: ProjectConfiguration['metadata'];
  if (options?.ciTargetName) {
    // Resolve the version of `jest-runtime` that `jest` is using.
    const jestPath = require.resolve('jest');
    const jest = require(jestPath) as typeof import('jest');
    // nx-ignore-next-line
    const { default: Runtime } = require(require.resolve('jest-runtime', {
      paths: [dirname(jestPath)],
      // nx-ignore-next-line
    })) as typeof import('jest-runtime');

    const jestContext = await Runtime.createContext(config.projectConfig, {
      maxWorkers: 1,
      watchman: false,
    });

    const source = new jest.SearchSource(jestContext);

    const specs = await source.getTestPaths(config.globalConfig);

    const testPaths = new Set(specs.tests.map(({ path }) => path));

    if (testPaths.size > 0) {
      const groupName = 'E2E (CI)';
      const targetGroup = [];
      metadata = {
        targetGroups: {
          [groupName]: targetGroup,
        },
      };
      const dependsOn: string[] = [];

      targets[options.ciTargetName] = {
        executor: 'nx:noop',
        cache: true,
        inputs,
        outputs,
        dependsOn,
        metadata: {
          technologies: ['jest'],
          description: 'Run Jest Tests in CI',
          nonAtomizedTarget: options.targetName,
          help: {
            command: `${pmc.exec} jest --help`,
            example: {
              options: {
                coverage: true,
              },
            },
          },
        },
      };
      targetGroup.push(options.ciTargetName);

      for (const testPath of testPaths) {
        const relativePath = normalizePath(
          relative(join(context.workspaceRoot, projectRoot), testPath)
        );
        const targetName = `${options.ciTargetName}--${relativePath}`;
        dependsOn.push(targetName);
        targets[targetName] = {
          command: `jest ${relativePath}`,
          cache,
          inputs,
          outputs,
          options: {
            cwd: projectRoot,
          },
          metadata: {
            technologies: ['jest'],
            description: `Run Jest Tests in ${relativePath}`,
            help: {
              command: `${pmc.exec} jest --help`,
              example: {
                options: {
                  coverage: true,
                },
              },
            },
          },
        };
        targetGroup.push(targetName);
      }
    }
  }

  return { targets, metadata };
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs'],
  jestConfig: { preset?: string },
  projectRoot: string,
  workspaceRoot: string
): TargetConfiguration['inputs'] {
  const inputs: TargetConfiguration['inputs'] = [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
  ];

  const externalDependencies = ['jest'];
  const presetInput = resolvePresetInput(
    jestConfig.preset,
    projectRoot,
    workspaceRoot
  );
  if (presetInput) {
    if (
      typeof presetInput !== 'string' &&
      'externalDependencies' in presetInput
    ) {
      externalDependencies.push(...presetInput.externalDependencies);
    } else {
      inputs.push(presetInput);
    }
  }

  inputs.push({ externalDependencies });

  return inputs;
}

// preset resolution adapted from:
// https://github.com/jestjs/jest/blob/c54bccd657fb4cf060898717c09f633b4da3eec4/packages/jest-config/src/normalize.ts#L122
function resolvePresetInput(
  presetValue: string | undefined,
  projectRoot: string,
  workspaceRoot: string
): TargetConfiguration['inputs'][number] | null {
  if (!presetValue) {
    return null;
  }

  let presetPath = replaceRootDirInPath(projectRoot, presetValue);
  const isNpmPackage = !presetValue.startsWith('.') && !isAbsolute(presetPath);
  presetPath = presetPath.startsWith('.')
    ? presetPath
    : join(presetPath, 'jest-preset');
  const presetModule = jestResolve.findNodeModule(presetPath, {
    basedir: projectRoot,
    extensions: ['.json', '.js', '.cjs', '.mjs'],
  });

  if (!presetModule) {
    return null;
  }

  if (isNpmPackage) {
    return { externalDependencies: [presetValue] };
  }

  const relativePath = relative(join(workspaceRoot, projectRoot), presetModule);
  return relativePath.startsWith('..')
    ? join('{workspaceRoot}', join(projectRoot, relativePath))
    : join('{projectRoot}', relativePath);
}

function getOutputs(
  projectRoot: string,
  { globalConfig }: Awaited<ReturnType<typeof readConfig>>,
  context: CreateNodesContext
): string[] {
  function getOutput(path: string): string {
    const relativePath = relative(
      join(context.workspaceRoot, projectRoot),
      path
    );
    if (relativePath.startsWith('..')) {
      return join('{workspaceRoot}', join(projectRoot, relativePath));
    } else {
      return join('{projectRoot}', relativePath);
    }
  }

  const outputs = [];

  for (const outputOption of [
    globalConfig.coverageDirectory,
    globalConfig.outputFile,
  ]) {
    if (outputOption) {
      outputs.push(getOutput(outputOption));
    }
  }

  return outputs;
}

function normalizeOptions(options: JestPluginOptions): JestPluginOptions {
  options ??= {};
  options.targetName ??= 'test';
  return options;
}
