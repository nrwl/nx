import {
  CreateNodes,
  CreateNodesContext,
  ProjectConfiguration,
  TargetConfiguration,
  readJsonFile,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { projectGraphCacheDirectory } from 'nx/src/utils/cache-directory';

import { getGradleExecFile } from '../utils/exec-gradle';
import { getGradleReport } from '../utils/get-gradle-report';

const cacheableTaskType = new Set(['Build', 'Verification']);
const dependsOnMap = {
  build: ['^build', 'classes'],
  test: ['classes'],
  classes: ['^classes'],
};

interface GradleTask {
  type: string;
  name: string;
}

export interface GradlePluginOptions {
  testTargetName?: string;
  classesTargetName?: string;
  buildTargetName?: string;
  [taskTargetName: string]: string | undefined;
}

const cachePath = join(projectGraphCacheDirectory, 'gradle.hash');
const targetsCache = existsSync(cachePath) ? readTargetsCache() : {};

export const calculatedTargets: Record<
  string,
  {
    name: string;
    targets: Record<string, TargetConfiguration>;
    metadata: ProjectConfiguration['metadata'];
  }
> = {};

function readTargetsCache(): Record<
  string,
  {
    name: string;
    targets: Record<string, TargetConfiguration>;
    metadata: ProjectConfiguration['metadata'];
  }
> {
  return readJsonFile(cachePath);
}

export function writeTargetsToCache(
  targets: Record<
    string,
    {
      name: string;
      targets: Record<string, TargetConfiguration>;
      metadata: ProjectConfiguration['metadata'];
    }
  >
) {
  writeJsonFile(cachePath, targets);
}

export const createNodes: CreateNodes<GradlePluginOptions> = [
  '**/build.{gradle.kts,gradle}',
  (
    gradleFilePath,
    options: GradlePluginOptions | undefined,
    context: CreateNodesContext
  ) => {
    const projectRoot = dirname(gradleFilePath);

    const hash = calculateHashForCreateNodes(
      projectRoot,
      options ?? {},
      context
    );
    if (targetsCache[hash]) {
      calculatedTargets[hash] = targetsCache[hash];
      return {
        projects: {
          [projectRoot]: targetsCache[hash],
        },
      };
    }

    try {
      const {
        gradleProjectToTasksTypeMap,
        gradleFileToOutputDirsMap,
        gradleFileToGradleProjectMap,
        gradleProjectToProjectName,
      } = getGradleReport();

      const gradleProject = gradleFileToGradleProjectMap.get(
        gradleFilePath
      ) as string;
      const projectName = gradleProjectToProjectName.get(gradleProject);
      if (!projectName) {
        return;
      }

      const tasksTypeMap = gradleProjectToTasksTypeMap.get(
        gradleProject
      ) as Map<string, string>;
      let tasks: GradleTask[] = [];
      for (let [taskName, taskType] of tasksTypeMap.entries()) {
        tasks.push({
          type: taskType,
          name: taskName,
        });
      }

      const outputDirs = gradleFileToOutputDirsMap.get(gradleFilePath) as Map<
        string,
        string
      >;

      const { targets, targetGroups } = createGradleTargets(
        tasks,
        options,
        context,
        outputDirs,
        gradleProject
      );
      const project = {
        name: projectName,
        targets,
        metadata: {
          targetGroups,
          technologies: ['gradle'],
        },
      };
      calculatedTargets[hash] = project;

      return {
        projects: {
          [projectRoot]: project,
        },
      };
    } catch (e) {
      console.error(e);
      return {};
    }
  },
];

function createGradleTargets(
  tasks: GradleTask[],
  options: GradlePluginOptions | undefined,
  context: CreateNodesContext,
  outputDirs: Map<string, string>,
  gradleProject: string
): {
  targetGroups: Record<string, string[]>;
  targets: Record<string, TargetConfiguration>;
} {
  const inputsMap = createInputsMap(context);

  const targets: Record<string, TargetConfiguration> = {};
  const targetGroups: Record<string, string[]> = {};
  for (const task of tasks) {
    const targetName = options?.[`${task.name}TargetName`] ?? task.name;

    const outputs = outputDirs.get(task.name);
    targets[targetName] = {
      command: `${getGradleExecFile()} ${
        gradleProject ? gradleProject + ':' : ''
      }${task.name}`,
      cache: cacheableTaskType.has(task.type),
      inputs: inputsMap[task.name],
      outputs: outputs ? [outputs] : undefined,
      dependsOn: dependsOnMap[task.name],
      metadata: {
        technologies: ['gradle'],
      },
    };
    if (!targetGroups[task.type]) {
      targetGroups[task.type] = [];
    }
    targetGroups[task.type].push(task.name);
  }
  return { targetGroups, targets };
}

function createInputsMap(
  context: CreateNodesContext
): Record<string, TargetConfiguration['inputs']> {
  const namedInputs = context.nxJsonConfiguration.namedInputs;
  return {
    build: namedInputs?.production
      ? ['production', '^production']
      : ['default', '^default'],
    test: ['default', namedInputs?.production ? '^production' : '^default'],
    classes: namedInputs?.production
      ? ['production', '^production']
      : ['default', '^default'],
  };
}
