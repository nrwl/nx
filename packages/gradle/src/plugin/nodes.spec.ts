import { CreateNodesContext } from '@nx/devkit';

import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import type { GradleReport } from '../utils/get-gradle-report';

let gradleReport: GradleReport;
jest.mock('../utils/get-gradle-report.ts', () => {
  return {
    getGradleReport: jest.fn().mockImplementation(() => gradleReport),
  };
});

import { createNodes } from './nodes';

describe('@nx/gradle/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    gradleReport = {
      gradleFileToGradleProjectMap: new Map<string, string>([
        ['proj/gradle.build', 'proj'],
      ]),
      buildFileToDepsMap: new Map<string, string>(),
      gradleFileToOutputDirsMap: new Map<string, Map<string, string>>([
        ['proj/gradle.build', new Map([['build', 'build']])],
      ]),
      gradleProjectToTasksTypeMap: new Map<string, Map<string, string>>([
        ['proj', new Map([['test', 'Test']])],
      ]),
      gradleProjectToProjectName: new Map<string, string>([['proj', 'proj']]),
    };
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };

    await tempFs.createFiles({
      'proj/gradle.build': ``,
      gradlew: '',
    });
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(cwd);
  });

  it('should create nodes based on gradle', async () => {
    const nodes = await createNodesFunction(
      'proj/gradle.build',
      {
        buildTargetName: 'build',
      },
      context
    );

    expect(nodes.projects.proj).toMatchInlineSnapshot(`
      {
        "metadata": {
          "targetGroups": {
            "Test": [
              "test",
            ],
          },
          "technologies": [
            "gradle",
          ],
        },
        "name": "proj",
        "targets": {
          "test": {
            "cache": false,
            "command": "./gradlew proj:test",
            "dependsOn": [
              "classes",
            ],
            "inputs": [
              "default",
              "^production",
            ],
            "metadata": {
              "technologies": [
                "gradle",
              ],
            },
            "outputs": undefined,
          },
        },
      }
    `);
  });

  it('should create nodes based on gradle for nested project root', async () => {
    gradleReport = {
      gradleFileToGradleProjectMap: new Map<string, string>([
        ['nested/nested/proj/gradle.build', 'proj'],
      ]),
      buildFileToDepsMap: new Map<string, string>(),
      gradleFileToOutputDirsMap: new Map<string, Map<string, string>>([
        ['nested/nested/proj/gradle.build', new Map([['build', 'build']])],
      ]),
      gradleProjectToTasksTypeMap: new Map<string, Map<string, string>>([
        ['proj', new Map([['test', 'Test']])],
      ]),
      gradleProjectToProjectName: new Map<string, string>([['proj', 'proj']]),
    };
    await tempFs.createFiles({
      'nested/nested/proj/gradle.build': ``,
    });

    const nodes = await createNodesFunction(
      'nested/nested/proj/gradle.build',
      {
        buildTargetName: 'build',
      },
      context
    );

    expect(nodes.projects['nested/nested/proj']).toMatchInlineSnapshot(`
      {
        "metadata": {
          "targetGroups": {
            "Test": [
              "test",
            ],
          },
          "technologies": [
            "gradle",
          ],
        },
        "name": "proj",
        "targets": {
          "test": {
            "cache": false,
            "command": "./gradlew proj:test",
            "dependsOn": [
              "classes",
            ],
            "inputs": [
              "default",
              "^production",
            ],
            "metadata": {
              "technologies": [
                "gradle",
              ],
            },
            "outputs": undefined,
          },
        },
      }
    `);
  });
});
