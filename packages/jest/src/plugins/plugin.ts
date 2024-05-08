import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  joinPathFragments,
  normalizePath,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join, normalize, relative, resolve } from 'path';

import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { readConfig } from 'jest-config';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { clearRequireCache } from '@nx/devkit/src/utils/config-utils';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json-workspaces';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { minimatch } from 'minimatch';

export interface JestPluginOptions {
  targetName?: string;
  ciTargetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'jest.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

type JestTargets = Awaited<ReturnType<typeof buildJestTargets>>;

const calculatedTargets: JestTargets = {};

function readTargetsCache(): Record<string, JestTargets> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(targets: JestTargets) {
  writeJsonFile(cachePath, targets);
}

export const createDependencies: CreateDependencies = () => {
  writeTargetsToCache(calculatedTargets);
  return [];
};

export const createNodes: CreateNodes<JestPluginOptions> = [
  '**/jest.config.{cjs,mjs,js,cts,mts,ts}',
  async (configFilePath, options, context) => {
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

      const isPackageJsonProject = minimatch(
        path,
        packageManagerWorkspacesGlob
      );

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

    const hash = calculateHashForCreateNodes(projectRoot, options, context);
    const { targets, metadata } =
      targetsCache[hash] ??
      (await buildJestTargets(configFilePath, projectRoot, options, context));

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

  const config = await readConfig(
    {
      _: [],
      $0: undefined,
    },
    absConfigFilePath
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
    },
  });

  const cache = (target.cache = true);
  const inputs = (target.inputs = getInputs(namedInputs));
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
          },
        };
        targetGroup.push(targetName);
      }
    }
  }

  return { targets, metadata };
}

function getInputs(
  namedInputs: NxJsonConfiguration['namedInputs']
): TargetConfiguration['inputs'] {
  return [
    ...('production' in namedInputs
      ? ['default', '^production']
      : ['default', '^default']),
    {
      externalDependencies: ['jest'],
    },
  ];
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
