import {
  CreateNodes,
  CreateNodesV2,
  CreateNodesContext,
  ProjectConfiguration,
  TargetConfiguration,
  createNodesFromFiles,
  readJsonFile,
  writeJsonFile,
  CreateNodesFunction,
  logger,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';

import { getGradleExecFile } from '../utils/exec-gradle';
import {
  populateGradleReport,
  getCurrentGradleReport,
  GradleReport,
  gradleConfigGlob,
  GRADLE_TEST_FILES,
} from '../utils/get-gradle-report';
import { hashObject } from 'nx/src/hasher/file-hasher';
import { globWithWorkspaceContext } from 'nx/src/utils/workspace-context';

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
  ciTargetName?: string;
  testTargetName?: string;
  classesTargetName?: string;
  buildTargetName?: string;
  [taskTargetName: string]: string | undefined;
}

function normalizeOptions(options: GradlePluginOptions): GradlePluginOptions {
  options ??= {};
  options.ciTargetName ??= 'test-ci';
  options.testTargetName ??= 'test';
  options.classesTargetName ??= 'classes';
  options.buildTargetName ??= 'build';
  return options;
}

type GradleTargets = Record<
  string,
  {
    name: string;
    targets: Record<string, TargetConfiguration>;
    metadata: ProjectConfiguration['metadata'];
  }
>;

function readTargetsCache(cachePath: string): GradleTargets {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

export function writeTargetsToCache(cachePath: string, results: GradleTargets) {
  writeJsonFile(cachePath, results);
}

export const createNodesV2: CreateNodesV2<GradlePluginOptions> = [
  gradleConfigGlob,
  async (configFiles, options, context) => {
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `gradle-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    await populateGradleReport(context.workspaceRoot);
    const gradleReport = getCurrentGradleReport();

    try {
      return await createNodesFromFiles(
        makeCreateNodes(gradleReport, targetsCache),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const makeCreateNodes =
  (
    gradleReport: GradleReport,
    targetsCache: GradleTargets
  ): CreateNodesFunction =>
  async (
    gradleFilePath,
    options: GradlePluginOptions | undefined,
    context: CreateNodesContext
  ) => {
    const projectRoot = dirname(gradleFilePath);
    options = normalizeOptions(options);

    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options ?? {},
      context
    );
    targetsCache[hash] ??= await createGradleProject(
      gradleReport,
      gradleFilePath,
      options,
      context
    );
    const project = targetsCache[hash];
    if (!project) {
      return {};
    }
    return {
      projects: {
        [projectRoot]: project,
      },
    };
  };

/**
 @deprecated This is replaced with {@link createNodesV2}. Update your plugin to export its own `createNodesV2` function that wraps this one instead.
  This function will change to the v2 function in Nx 20.
 */
export const createNodes: CreateNodes<GradlePluginOptions> = [
  gradleConfigGlob,
  async (configFile, options, context) => {
    logger.warn(
      '`createNodes` is deprecated. Update your plugin to utilize createNodesV2 instead. In Nx 20, this will change to the createNodesV2 API.'
    );
    await populateGradleReport(context.workspaceRoot);
    const gradleReport = getCurrentGradleReport();
    const internalCreateNodes = makeCreateNodes(gradleReport, {});
    return await internalCreateNodes(configFile, options, context);
  },
];

async function createGradleProject(
  gradleReport: GradleReport,
  gradleFilePath: string,
  options: GradlePluginOptions | undefined,
  context: CreateNodesContext
) {
  try {
    const {
      gradleProjectToTasksTypeMap,
      gradleFileToOutputDirsMap,
      gradleFileToGradleProjectMap,
      gradleProjectToProjectName,
    } = gradleReport;

    const gradleProject = gradleFileToGradleProjectMap.get(
      gradleFilePath
    ) as string;
    const projectName = gradleProjectToProjectName.get(gradleProject);
    if (!projectName) {
      return;
    }

    const tasksTypeMap = gradleProjectToTasksTypeMap.get(gradleProject) as Map<
      string,
      string
    >;
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

    const { targets, targetGroups } = await createGradleTargets(
      tasks,
      options,
      context,
      outputDirs,
      gradleProject,
      gradleFilePath
    );
    const project = {
      name: projectName,
      targets,
      metadata: {
        targetGroups,
        technologies: ['gradle'],
      },
    };

    return project;
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

async function createGradleTargets(
  tasks: GradleTask[],
  options: GradlePluginOptions | undefined,
  context: CreateNodesContext,
  outputDirs: Map<string, string>,
  gradleProject: string,
  gradleFilePath: string
): Promise<{
  targetGroups: Record<string, string[]>;
  targets: Record<string, TargetConfiguration>;
}> {
  const inputsMap = createInputsMap(context);

  const targets: Record<string, TargetConfiguration> = {};
  const targetGroups: Record<string, string[]> = {};
  for (const task of tasks) {
    const targetName = options?.[`${task.name}TargetName`] ?? task.name;

    if (task.name === 'test') {
      const testFiles = await globWithWorkspaceContext(
        dirname(gradleFilePath),
        GRADLE_TEST_FILES
      );
      getTestTargets(
        gradleProject,
        targetName,
        options.ciTargetName,
        targets,
        targetGroups,
        inputsMap,
        outputDirs,
        task.type,
        testFiles
      );
      continue;
    }

    const output = outputDirs.get(task.name);
    const taskCommandToRun = `${gradleProject ? gradleProject + ':' : ''}${
      task.name
    }`;
    targets[targetName] = {
      command: `${getGradleExecFile()} ${taskCommandToRun}`,
      cache: cacheableTaskType.has(task.type),
      inputs: inputsMap[task.name],
      dependsOn: dependsOnMap[task.name],
      metadata: {
        technologies: ['gradle'],
      },
      ...(output ? { outputs: [output] } : {}),
    };

    if (!targetGroups[task.type]) {
      targetGroups[task.type] = [];
    }
    targetGroups[task.type].push(targetName);
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

function getTestTargets(
  gradleProject: string,
  testTargetName: string,
  ciTargetName: string,
  targets: Record<string, TargetConfiguration>,
  targetGroups: Record<string, string[]>,
  inputsMap: Record<string, TargetConfiguration['inputs']>,
  outputDirs: Map<string, string>,
  taskType: string,
  testFiles: string[]
) {
  const taskCommandToRun = `${gradleProject ? gradleProject + ':' : ''}test`;
  const outputs = [
    outputDirs.get('testReport'),
    outputDirs.get('testResults'),
  ].filter(Boolean);

  targets[testTargetName] = {
    command: `${getGradleExecFile()} ${taskCommandToRun}`,
    cache: true,
    inputs: inputsMap['test'],
    dependsOn: dependsOnMap['test'],
    metadata: {
      technologies: ['gradle'],
    },
    ...(outputs.length > 0 ? { outputs } : {}),
  };

  if (!targetGroups[taskType]) {
    targetGroups[taskType] = [];
  }
  targetGroups[taskType].push(testTargetName);

  if (!testFiles || testFiles.length === 0) {
    return;
  }

  const dependsOn: TargetConfiguration['dependsOn'] = [];
  testFiles?.forEach((testFile) => {
    const testName = basename(testFile).split('.')[0];
    const targetName = ciTargetName + '--' + testName;

    targets[targetName] = {
      command: `${getGradleExecFile()} ${taskCommandToRun} --tests ${testName}`,
      cache: true,
      inputs: inputsMap['test'],
      dependsOn: dependsOnMap['test'],
      metadata: {
        technologies: ['gradle'],
        description: `Runs Gradle Tests ${testName} in CI`,
      },
      ...(outputs && outputs.length > 0 ? { outputs } : {}),
    };
    targetGroups[taskType].push(targetName);
    dependsOn.push({
      target: targetName,
      projects: 'self',
      params: 'forward',
    });
  });

  targets[ciTargetName] = {
    executor: 'nx:noop',
    cache: true,
    inputs: inputsMap['test'],
    dependsOn: dependsOn,
    ...(outputs && outputs.length > 0 ? { outputs } : {}),
    metadata: {
      technologies: ['gradle'],
      description: 'Runs Gradle Tests in CI',
      nonAtomizedTarget: testTargetName,
    },
  };
  targetGroups[taskType].push(ciTargetName);
}
