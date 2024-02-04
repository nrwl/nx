import {
  CreateDependencies,
  CreateNodes,
  CreateNodesContext,
  joinPathFragments,
  NxJsonConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { dirname, join, relative, resolve } from 'path';

import { readTargetDefaultsForTarget } from 'nx/src/project-graph/utils/project-configuration-utils';
import { getNamedInputs } from '@nx/devkit/src/utils/get-named-inputs';
import { existsSync, readdirSync } from 'fs';
import { readConfig } from 'jest-config';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { getGlobPatternsFromPackageManagerWorkspaces } from 'nx/src/plugins/package-json-workspaces';
import { combineGlobPatterns } from 'nx/src/utils/globs';
import { minimatch } from 'minimatch';

export interface JestPluginOptions {
  targetName?: string;
}

const cachePath = join(projectGraphCacheDirectory, 'jest.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

const calculatedTargets: Record<
  string,
  Record<string, TargetConfiguration>
> = {};

function readTargetsCache(): Record<
  string,
  Record<string, TargetConfiguration>
> {
  return readJsonFile(cachePath);
}

function writeTargetsToCache(
  targets: Record<string, Record<string, TargetConfiguration>>
) {
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

    options = normalizeOptions(options);

    const hash = calculateHashForCreateNodes(projectRoot, options, context);
    const targets =
      targetsCache[hash] ??
      (await buildJestTargets(configFilePath, projectRoot, options, context));

    calculatedTargets[hash] = targets;

    return {
      projects: {
        [projectRoot]: {
          root: projectRoot,
          targets: targets,
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
) {
  const config = await readConfig(
    {
      _: [],
      $0: undefined,
    },
    resolve(context.workspaceRoot, configFilePath)
  );

  const targetDefaults = readTargetDefaultsForTarget(
    options.targetName,
    context.nxJsonConfiguration.targetDefaults,
    'nx:run-commands'
  );

  const namedInputs = getNamedInputs(projectRoot, context);

  const targets: Record<string, TargetConfiguration> = {};

  const target: TargetConfiguration = (targets[options.targetName] = {
    command: 'jest',
    options: {
      cwd: projectRoot,
    },
  });

  if (!targetDefaults?.cache) {
    target.cache = true;
  }
  if (!targetDefaults?.inputs) {
    target.inputs = getInputs(namedInputs);
  }
  if (!targetDefaults?.outputs) {
    target.outputs = getOutputs(projectRoot, config, context);
  }

  return targets;
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
