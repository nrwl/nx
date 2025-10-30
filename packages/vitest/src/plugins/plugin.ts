import {
  CreateDependencies,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
  detectPackageManager,
  getPackageManagerCommand,
  joinPathFragments,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  workspaceRoot,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashesForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { getLockFileName } from '@nx/js';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { deriveGroupNameFromTarget } from 'nx/src/utils/plugins';
import { loadViteDynamicImport } from '../utils/executor-utils';

const pmc = getPackageManagerCommand();

export interface VitestPluginOptions {
  testTargetName?: string;
  /**
   * Atomizer for vitest
   */
  ciTargetName?: string;
  /**
   * The name that should be used to group atomized tasks on CI
   */
  ciGroupName?: string;
}

type VitestTargets = Pick<
  ProjectConfiguration,
  'targets' | 'metadata' | 'projectType'
>;

function readTargetsCache(cachePath: string): Record<string, VitestTargets> {
  return process.env.NX_CACHE_PROJECT_GRAPH !== 'false' && existsSync(cachePath)
    ? readJsonFile(cachePath)
    : {};
}

function writeTargetsToCache(
  cachePath,
  results?: Record<string, VitestTargets>
) {
  writeJsonFile(cachePath, results);
}

/**
 * @deprecated The 'createDependencies' function is now a no-op. This functionality is included in 'createNodesV2'.
 */
export const createDependencies: CreateDependencies = () => {
  return [];
};

const vitestConfigGlob = '**/{vite,vitest}.config.{js,ts,mjs,mts,cjs,cts}';

export const createNodes: CreateNodesV2<VitestPluginOptions> = [
  vitestConfigGlob,
  async (configFilePaths, options, context) => {
    const optionsHash = hashObject(options);
    const normalizedOptions = normalizeOptions(options);
    const cachePath = join(
      workspaceDataDirectory,
      `vitest-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    const { roots: projectRoots, configFiles: validConfigFiles } =
      configFilePaths.reduce(
        (acc, configFile) => {
          const potentialRoot = dirname(configFile);
          if (checkIfConfigFileShouldBeProject(potentialRoot, context)) {
            acc.roots.push(potentialRoot);
            acc.configFiles.push(configFile);
          }
          return acc;
        },
        {
          roots: [],
          configFiles: [],
        } as {
          roots: string[];
          configFiles: string[];
        }
      );

    const lockfile = getLockFileName(
      detectPackageManager(context.workspaceRoot)
    );
    const hashes = await calculateHashesForCreateNodes(
      projectRoots,
      normalizedOptions,
      context,
      projectRoots.map((r) => [lockfile])
    );

    try {
      return await createNodesFromFiles(
        async (configFile, _, context, idx) => {
          const projectRoot = dirname(configFile);

          // results from vitest.config.js will be different from results of vite.config.js
          // but the hash will be the same because it is based on the files under the project root.
          // Adding the config file path to the hash ensures that the final hash value is different
          // for different config files.
          const hash = hashes[idx] + configFile;
          const { projectType, metadata, targets } = (targetsCache[hash] ??=
            await buildVitestTargets(
              configFile,
              projectRoot,
              normalizedOptions,
              context
            ));

          const project: ProjectConfiguration = {
            root: projectRoot,
            targets,
            metadata,
            projectType,
          };

          return {
            projects: {
              [projectRoot]: project,
            },
          };
        },
        validConfigFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const createNodesV2 = createNodes;

async function buildVitestTargets(
  configFilePath: string,
  projectRoot: string,
  options: VitestPluginOptions,
  context: CreateNodesContextV2
): Promise<VitestTargets> {
  const absoluteConfigFilePath = joinPathFragments(
    context.workspaceRoot,
    configFilePath
  );

  // Workaround for the `build$3 is not a function` error that we sometimes see in agents.
  // This should be removed later once we address the issue properly
  try {
    const importEsbuild = () => new Function('return import("esbuild")')();
    await importEsbuild();
  } catch {
    // do nothing
  }

  const { resolveConfig } = await loadViteDynamicImport();
  const viteBuildConfig = await resolveConfig(
    {
      configFile: absoluteConfigFilePath,
      mode: 'development',
    },
    'build'
  );

  let metadata: ProjectConfiguration['metadata'] = {};

  const { testOutputs, hasTest } = getOutputs(
    viteBuildConfig,
    projectRoot,
    context.workspaceRoot
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  // if file is vitest.config or vite.config has definition for test, create targets for test and/or atomized tests
  if (configFilePath.includes('vitest.config') || hasTest) {
    targets[options.testTargetName] = await testTarget(
      namedInputs,
      testOutputs,
      projectRoot
    );

    if (options.ciTargetName) {
      const groupName =
        options.ciGroupName ?? deriveGroupNameFromTarget(options.ciTargetName);
      const targetGroup = [];
      const dependsOn: string[] = [];
      metadata = {
        targetGroups: {
          [groupName]: targetGroup,
        },
      };

      const projectRootRelativeTestPaths =
        await getTestPathsRelativeToProjectRoot(projectRoot);

      for (const relativePath of projectRootRelativeTestPaths) {
        if (relativePath.includes('../')) {
          throw new Error(
            '@nx/vitest/plugin attempted to run tests outside of the project root. This is not supported and should not happen. Please open an issue at https://github.com/nrwl/nx/issues/new/choose with the following information:\n\n' +
              `\n\n${JSON.stringify(
                {
                  projectRoot,
                  relativePath,
                  projectRootRelativeTestPaths,
                  context,
                },
                null,
                2
              )}`
          );
        }

        const targetName = `${options.ciTargetName}--${relativePath}`;
        dependsOn.push(targetName);
        targets[targetName] = {
          // It does not make sense to run atomized tests in watch mode as they are intended to be run in CI
          command: `vitest run ${relativePath}`,
          cache: targets[options.testTargetName].cache,
          inputs: targets[options.testTargetName].inputs,
          outputs: targets[options.testTargetName].outputs,
          options: {
            cwd: projectRoot,
            env: targets[options.testTargetName].options.env,
          },
          metadata: {
            technologies: ['vitest'],
            description: `Run Vitest Tests in ${relativePath}`,
            help: {
              command: `${pmc.exec} vitest --help`,
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

      if (targetGroup.length > 0) {
        targets[options.ciTargetName] = {
          executor: 'nx:noop',
          cache: true,
          inputs: targets[options.testTargetName].inputs,
          outputs: targets[options.testTargetName].outputs,
          dependsOn,
          metadata: {
            technologies: ['vitest'],
            description: 'Run Vitest Tests in CI',
            nonAtomizedTarget: options.testTargetName,
            help: {
              command: `${pmc.exec} vitest --help`,
              example: {
                options: {
                  coverage: true,
                },
              },
            },
          },
        };
        targetGroup.unshift(options.ciTargetName);
      }
    }
  }

  return { targets, metadata, projectType: 'library' };
}

async function testTarget(
  namedInputs: {
    [inputName: string]: any[];
  },
  outputs: string[],
  projectRoot: string
) {
  return {
    command: `vitest`,
    options: { cwd: joinPathFragments(projectRoot) },
    cache: true,
    inputs: [
      ...('production' in namedInputs
        ? ['default', '^production']
        : ['default', '^default']),
      {
        externalDependencies: ['vitest'],
      },
      { env: 'CI' },
    ],
    outputs,
    metadata: {
      technologies: ['vitest'],
      description: `Run Vitest tests`,
      help: {
        command: `${pmc.exec} vitest --help`,
        example: {
          options: {
            bail: 1,
            coverage: true,
          },
        },
      },
    },
  };
}

function getOutputs(
  viteBuildConfig: Record<string, any> | undefined,
  projectRoot: string,
  workspaceRoot: string
): {
  testOutputs: string[];
  hasTest: boolean;
} {
  const { test } = viteBuildConfig;

  const reportsDirectoryPath = normalizeOutputPath(
    test?.coverage?.reportsDirectory,
    projectRoot,
    workspaceRoot,
    'coverage'
  );

  return {
    testOutputs: [reportsDirectoryPath],
    hasTest: !!test,
  };
}

function normalizeOutputPath(
  outputPath: string | undefined,
  projectRoot: string,
  workspaceRoot: string,
  path: 'coverage'
): string | undefined {
  if (!outputPath) {
    if (projectRoot === '.') {
      return `{projectRoot}/${path}`;
    } else {
      return `{workspaceRoot}/${path}/{projectRoot}`;
    }
  } else {
    if (isAbsolute(outputPath)) {
      return `{workspaceRoot}/${relative(workspaceRoot, outputPath)}`;
    } else {
      if (outputPath.startsWith('..')) {
        return join('{workspaceRoot}', join(projectRoot, outputPath));
      } else {
        return join('{projectRoot}', outputPath);
      }
    }
  }
}

function normalizeOptions(options: VitestPluginOptions): VitestPluginOptions {
  options ??= {};
  options.testTargetName ??= 'test';
  return options;
}

function checkIfConfigFileShouldBeProject(
  projectRoot: string,
  context: CreateNodesContextV2
): boolean {
  // Do not create a project if package.json and project.json isn't there.
  const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
  if (
    !siblingFiles.includes('package.json') &&
    !siblingFiles.includes('project.json')
  ) {
    return false;
  }

  return true;
}

async function getTestPathsRelativeToProjectRoot(
  projectRoot: string
): Promise<string[]> {
  const fullProjectRoot = join(workspaceRoot, projectRoot);
  const { createVitest } = await import('vitest/node');
  const vitest = await createVitest('test', {
    dir: fullProjectRoot,
    filesOnly: true,
    watch: false,
  });
  const relevantTestSpecifications =
    await vitest.getRelevantTestSpecifications();
  return relevantTestSpecifications.map((ts) =>
    relative(projectRoot, ts.moduleId)
  );
}
