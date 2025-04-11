import {
  CreateNodesContext,
  createNodesFromFiles,
  CreateNodesFunction,
  CreateNodesV2,
  ProjectConfiguration,
  readJsonFile,
  TargetConfiguration,
  writeJsonFile,
} from '@nx/devkit';
import { calculateHashForCreateNodes } from '@nx/devkit/src/utils/calculate-hash-for-create-nodes';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory';
import { hashObject } from 'nx/src/devkit-internals';
import { parsePomXml } from '../utils/parse-pom-xml';
// import { MavenReport } from '../utils/get-maven-report';

const MAVEN_CONFIG_GLOB = '**/pom.xml';
const MAVEN_CONFIG_AND_TEST_GLOB = '{**/pom.xml,**/src/test/**/*.java}';

export interface MavenPluginOptions {
  includeSubmodules?: boolean;
  verifyTargetName?: string;
  runTargetName?: string;
  testTargetName?: string;
  compileTargetName?: string;
  packageTargetName?: string;
  installTargetName?: string;
}

function normalizeOptions(options: MavenPluginOptions): MavenPluginOptions {
  options ??= {};
  options.verifyTargetName ??= 'verify';
  options.runTargetName ??= 'run';
  options.testTargetName ??= 'test';
  options.compileTargetName ??= 'compile';
  options.packageTargetName ??= 'package';
  options.installTargetName ??= 'install';
  return options;
}

type MavenTargets = Record<string, Partial<ProjectConfiguration>>;

function readTargetsCache(cachePath: string): MavenTargets {
  return existsSync(cachePath) ? readJsonFile(cachePath) : {};
}

export function writeTargetsToCache(cachePath: string, results: MavenTargets) {
  writeJsonFile(cachePath, results);
}

export const createNodesV2: CreateNodesV2<MavenPluginOptions> = [
  MAVEN_CONFIG_AND_TEST_GLOB,
  async (files, options, context) => {
    const { pomFiles, testFiles } = splitConfigFiles(files);
    const optionsHash = hashObject(options);
    const cachePath = join(workspaceDataDirectory, `maven-${optionsHash}.hash`);
    const targetsCache = readTargetsCache(cachePath);

    const mavenReport = await parsePomXml(context.workspaceRoot, pomFiles);
    const mavenProjectRootToTestFilesMap = getMavenProjectRootToTestFilesMap(
      testFiles,
      pomFiles.map((f) => dirname(f))
    );

    try {
      return createNodesFromFiles(
        makeCreateNodesForMavenConfigFile(
          mavenReport,
          targetsCache,
          mavenProjectRootToTestFilesMap
        ),
        pomFiles,
        options,
        context
      );
    } finally {
      writeTargetsToCache(cachePath, targetsCache);
    }
  },
];

export const makeCreateNodesForMavenConfigFile =
  (
    mavenReport: any,
    targetsCache: MavenTargets = {},
    mavenProjectRootToTestFilesMap: Record<string, string[]> = {}
  ): CreateNodesFunction =>
  async (
    pomFilePath,
    options: MavenPluginOptions | undefined,
    context: CreateNodesContext
  ) => {
    const projectRoot = dirname(pomFilePath);
    options = normalizeOptions(options);

    const hash = await calculateHashForCreateNodes(
      projectRoot,
      options ?? {},
      context
    );
    targetsCache[hash] ??= await createMavenProject(
      mavenReport,
      pomFilePath,
      options,
      context,
      mavenProjectRootToTestFilesMap[projectRoot]
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

async function createMavenProject(
  mavenReport: any,
  pomFilePath: string,
  options: MavenPluginOptions | undefined,
  context: CreateNodesContext,
  testFiles = []
) {
  try {
    const projectInfo = mavenReport.projects.get(pomFilePath);
    if (!projectInfo) {
      return;
    }

    const { targets, targetGroups } = await createMavenTargets(
      projectInfo,
      options,
      context,
      pomFilePath,
      testFiles
    );

    const project: Partial<ProjectConfiguration> = {
      name: `${projectInfo.groupId ?? projectInfo.parent.groupId}.${
        projectInfo.artifactId
      }`,
      projectType: 'application',
      targets,
      metadata: {
        targetGroups,
        technologies: ['maven'],
      },
    };

    return project;
  } catch (e) {
    console.error(e);
    return undefined;
  }
}

async function createMavenTargets(
  projectInfo: any,
  options: MavenPluginOptions | undefined,
  context: CreateNodesContext,
  pomFilePath: string,
  testFiles: string[] = []
): Promise<{
  targetGroups: Record<string, string[]>;
  targets: Record<string, TargetConfiguration>;
}> {
  const targets: Record<string, TargetConfiguration> = {};
  const targetGroups: Record<string, string[]> = {
    build: [],
    test: [],
  };

  // Add standard Maven lifecycle targets
  const standardTargets = [
    { name: options.runTargetName, phase: 'run' },
    { name: options.compileTargetName, phase: 'compile' },
    { name: options.verifyTargetName, phase: 'verify' },
    { name: options.testTargetName, phase: 'test' },
    { name: options.packageTargetName, phase: 'package' },
    { name: options.installTargetName, phase: 'install' },
  ];

  for (const target of standardTargets) {
    const targetConfig: TargetConfiguration = {
      command: `mvn ${target.phase}`,
      options: {
        cwd: dirname(pomFilePath),
      },
      cache: true,
      inputs: ['default', '^production'],
      metadata: {
        technologies: ['maven'],
      },
    };

    targets[target.name] = targetConfig;
    targetGroups.build.push(target.name);
  }

  // Add test-specific configuration
  if (testFiles.length > 0) {
    const testTarget = targets[options.testTargetName];
    if (testTarget) {
      testTarget.outputs = ['{projectRoot}/target/test-results'];
      targetGroups.test.push(options.testTargetName);
    }
  }

  return { targets, targetGroups };
}

function splitConfigFiles(files: readonly string[]) {
  const pomFiles = files.filter((f) => f.endsWith('pom.xml'));
  const testFiles = files.filter((f) => f.includes('/src/test/'));
  return { pomFiles, testFiles };
}

function getMavenProjectRootToTestFilesMap(
  testFiles: string[],
  projectRoots: string[]
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const root of projectRoots) {
    map[root] = testFiles.filter((f) => f.startsWith(root));
  }
  return map;
}
