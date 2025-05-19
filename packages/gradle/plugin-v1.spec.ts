import { CreateNodesContext } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodesV2 } from './plugin-v1';
import { type GradleReport } from './src/plugin-v1/utils/get-gradle-report';

let gradleReport: GradleReport;
jest.mock('./src/plugin-v1/utils/get-gradle-report', () => {
  return {
    GRADLE_BUILD_FILES: new Set(['build.gradle', 'build.gradle.kts']),
    populateGradleReport: jest.fn().mockImplementation(() => void 0),
    getCurrentGradleReport: jest.fn().mockImplementation(() => gradleReport),
  };
});

describe('@nx/gradle/plugin-v1', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('gradle-plugin');
    gradleReport = {
      gradleFileToGradleProjectMap: new Map<string, string>([
        ['proj/build.gradle', 'proj'],
      ]),
      gradleProjectToDepsMap: new Map<string, Set<string>>(),
      gradleFileToOutputDirsMap: new Map<string, Map<string, string>>([
        ['proj/build.gradle', new Map([['build', 'build']])],
      ]),
      gradleProjectToTasksMap: new Map<string, Set<string>>([
        ['proj', new Set(['test'])],
      ]),
      gradleProjectToTasksTypeMap: new Map<string, Map<string, string>>([
        ['proj', new Map([['test', 'Verification']])],
      ]),
      gradleProjectToProjectName: new Map<string, string>([['proj', 'proj']]),
      gradleProjectNameToProjectRootMap: new Map<string, string>([
        ['proj', 'proj'],
      ]),
      gradleProjectToChildProjects: new Map<string, string[]>(),
    };
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
    tempFs.createFileSync('package.json', JSON.stringify({ name: 'repo' }));
    tempFs.createFileSync(
      'my-app/project.json',
      JSON.stringify({ name: 'my-app' })
    );
  });

  afterEach(() => {
    jest.resetModules();
    tempFs.cleanup();
    tempFs = null;
  });

  it('should create nodes', async () => {
    tempFs.createFileSync('gradlew', '');

    const nodes = await createNodesFunction(
      ['gradlew', 'proj/build.gradle'],
      undefined,
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      [
        [
          "proj/build.gradle",
          {
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "Verification": [
                      "test",
                    ],
                  },
                  "technologies": [
                    "gradle",
                  ],
                },
                "name": "proj",
                "projectType": "application",
                "targets": {
                  "test": {
                    "cache": true,
                    "command": "./gradlew proj:test",
                    "dependsOn": [
                      "testClasses",
                    ],
                    "inputs": [
                      "default",
                      "^production",
                    ],
                    "metadata": {
                      "help": {
                        "command": "./gradlew help --task proj:test",
                        "example": {
                          "options": {
                            "args": [
                              "--rerun",
                            ],
                          },
                        },
                      },
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": ".",
                    },
                  },
                },
              },
            },
          },
        ],
      ]
    `);
  });
});
