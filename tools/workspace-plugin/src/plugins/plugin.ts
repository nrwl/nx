import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { createNodes as jestCreateNodes } from '@nx/jest/plugin';
import { dirname, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import {
  type CreateDependencies,
  type CreateNodes,
  CreateNodesContext,
  readJsonFile,
  type TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';

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

export interface WorkspaceJestPluginOptions {
  testTargetName?: string;
  e2eTargetName?: string;
}

// "e2e": {
//   "inputs": [
//     "default",
//     "^production",
//     "{workspaceRoot}/jest.preset.js",
//     "{workspaceRoot}/.verdaccio/config.yml",
//     {
//       "env": "SELECTED_CLI"
//     },
//     {
//       "env": "SELECTED_PM"
//     },
//     {
//       "env": "NX_E2E_CI_CACHE_KEY"
//     },
//     {
//       "env": "CI"
//     }
//   ],
//     "executor": "@nx/jest:jest",
//     "options": {
//     "jestConfig": "{projectRoot}/jest.config.ts",
//       "passWithNoTests": true,
//       "runInBand": true
//   },
//   "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
//     "cache": true
// },

export const createNodes: CreateNodes<WorkspaceJestPluginOptions> = [
  '{e2e,packages}/*/jest.config.ts',
  async (configFilePath, options, context) => {
    const projectRoot = dirname(configFilePath);
    // Do not create a project if package.json and project.json do not exist
    const siblingFiles = readdirSync(join(context.workspaceRoot, projectRoot));
    if (
      !siblingFiles.includes('package.json') &&
      !siblingFiles.includes('project.json')
    ) {
      return {};
    }

    options.e2eTargetName ??= 'e2e';
    options.testTargetName ??= 'test';

    const hash = calculateHashForCreateNodes(projectRoot, options, context);
    const targets =
      targetsCache[hash] ??
      (await buildJestTargets(configFilePath, projectRoot, options, context));

    calculatedTargets[hash] = targets;

    return targets
      ? {
          projects: {
            [projectRoot]: {
              root: projectRoot,
              targets: targets,
            },
          },
        }
      : {};
  },
];

async function buildJestTargets(
  configFilePath: string,
  projectRoot: string,
  options: WorkspaceJestPluginOptions,
  context: CreateNodesContext
) {
  // Prevents `TS2451: Cannot redeclare block-scoped variable` error
  process.env.TS_NODE_TRANSPILE_ONLY = 'true';

  const isE2E = projectRoot.startsWith('e2e');
  const targetName = isE2E ? options.e2eTargetName : options.testTargetName;
  const targets = await jestCreateNodes[1](
    configFilePath,
    { targetName },
    context
  );

  return targets.projects?.[projectRoot]?.targets ?? null;
}
