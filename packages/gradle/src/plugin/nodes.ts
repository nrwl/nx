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
import { findProjectForPath } from 'nx/src/devkit-internals';

import { getGradleExecFile } from '../utils/exec-gradle';
import {
  populateGradleReport,
  getCurrentGradleReport,
  GradleReport,
  gradleConfigGlob,
  GRADLE_BUILD_FILES,
  gradleConfigAndTestGlob,
} from '../utils/get-gradle-report';
import { hashObject } from 'nx/src/hasher/file-hasher';

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
  gradleConfigAndTestGlob,
  async (files, options, context) => {
    const { configFiles, projectRoots, testFiles } = splitConfigFiles(files);
    const optionsHash = hashObject(options);
    const cachePath = join(
      workspaceDataDirectory,
      `gradle-${optionsHash}.hash`
    );
    const targetsCache = readTargetsCache(cachePath);

    await populateGradleReport(context.workspaceRoot);
    const gradleReport = getCurrentGradleReport();
    const gradleProjectRootToTestFilesMap = getGradleProjectRootToTestFilesMap(
      testFiles,
      projectRoots
    );

    try {
      return createNodesFromFiles(
        makeCreateNodesForGradleConfigFile(
          gradleReport,
          targetsCache,
          gradleProjectRootToTestFilesMap
        ),
        configFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const makeCreateNodesForGradleConfigFile =
  (
    gradleReport: GradleReport,
    targetsCache: GradleTargets = {},
    gradleProjectRootToTestFilesMap: Record<string, string[]> = {}
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
      context,
      gradleProjectRootToTestFilesMap[projectRoot]
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
    const internalCreateNodes =
      makeCreateNodesForGradleConfigFile(gradleReport);
    return await internalCreateNodes(configFile, options, context);
  },
];

async function createGradleProject(
  gradleReport: GradleReport,
  gradleFilePath: string,
  options: GradlePluginOptions | undefined,
  context: CreateNodesContext,
  testFiles = []
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
      gradleFilePath,
      testFiles
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
  gradleFilePath: string,
  testFiles: string[] = []
): Promise<{
  targetGroups: Record<string, string[]>;
  targets: Record<string, TargetConfiguration>;
}> {
  const inputsMap = createInputsMap(context);

  const targets: Record<string, TargetConfiguration> = {};
  const targetGroups: Record<string, string[]> = {};
  for (const task of tasks) {
    const targetName = options?.[`${task.name}TargetName`] ?? task.name;

    let outputs = [outputDirs.get(task.name)].filter(Boolean);
    if (task.name === 'test') {
      outputs = [
        outputDirs.get('testReport'),
        outputDirs.get('testResults'),
      ].filter(Boolean);
      getTestCiTargets(
        testFiles,
        gradleProject,
        targetName,
        options.ciTargetName,
        inputsMap['test'],
        outputs,
        task.type,
        targets,
        targetGroups
      );
    }

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
      ...(outputs && outputs.length ? { outputs } : {}),
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

function getTestCiTargets(
  testFiles: string[],
  gradleProject: string,
  testTargetName: string,
  ciTargetName: string,
  inputs: TargetConfiguration['inputs'],
  outputs: string[],
  targetGroupName: string,
  targets: Record<string, TargetConfiguration>,
  targetGroups: Record<string, string[]>
): void {
  if (!testFiles || testFiles.length === 0 || !ciTargetName) {
    return;
  }
  const taskCommandToRun = `${gradleProject ? gradleProject + ':' : ''}test`;

  if (!targetGroups[targetGroupName]) {
    targetGroups[targetGroupName] = [];
  }

  const dependsOn: TargetConfiguration['dependsOn'] = [];
  testFiles.forEach((testFile) => {
    const testName = basename(testFile).split('.')[0];
    const targetName = ciTargetName + '--' + testName;

    targets[targetName] = {
      command: `${getGradleExecFile()} ${taskCommandToRun} --tests ${testName}`,
      cache: true,
      inputs,
      dependsOn: dependsOnMap['test'],
      metadata: {
        technologies: ['gradle'],
        description: `Runs Gradle test ${testFile} in CI`,
      },
      ...(outputs && outputs.length > 0 ? { outputs } : {}),
    };
    targetGroups[targetGroupName].push(targetName);
    dependsOn.push({
      target: targetName,
      projects: 'self',
      params: 'forward',
    });
  });

  targets[ciTargetName] = {
    executor: 'nx:noop',
    cache: true,
    inputs,
    dependsOn: dependsOn,
    ...(outputs && outputs.length > 0 ? { outputs } : {}),
    metadata: {
      technologies: ['gradle'],
      description: 'Runs Gradle Tests in CI',
      nonAtomizedTarget: testTargetName,
    },
  };
  targetGroups[targetGroupName].push(ciTargetName);
}

function splitConfigFiles(files: readonly string[]): {
  configFiles: string[];
  testFiles: string[];
  projectRoots: string[];
} {
  const configFiles = [];
  const testFiles = [];
  const projectRoots = new Set<string>();
  files.forEach((file) => {
    if (GRADLE_BUILD_FILES.has(basename(file))) {
      configFiles.push(file);
      projectRoots.add(dirname(file));
    } else {
      testFiles.push(file);
    }
  });

  return { configFiles, testFiles, projectRoots: Array.from(projectRoots) };
}

function getGradleProjectRootToTestFilesMap(
  testFiles: string[],
  projectRoots: string[]
): Record<string, string[]> | undefined {
  if (testFiles.length === 0 || projectRoots.length === 0) {
    return;
  }
  const roots = new Map(projectRoots.map((root) => [root, root]));
  const testFilesToGradleProjectMap: Record<string, string[]> = {};
  testFiles.forEach((testFile) => {
    const projectRoot = findProjectForPath(testFile, roots);
    if (projectRoot) {
      if (!testFilesToGradleProjectMap[projectRoot]) {
        testFilesToGradleProjectMap[projectRoot] = [];
      }
      testFilesToGradleProjectMap[projectRoot].push(testFile);
    }
  });
  return testFilesToGradleProjectMap;
}
