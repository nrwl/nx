import { CreateNodesContext, readJsonFile } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodesV2 } from './plugin';
import { type ProjectGraphReport } from './src/plugin/utils/get-project-graph-from-gradle-plugin';
import { join } from 'path';

let gradleReport: ProjectGraphReport;
jest.mock('./src/plugin/utils/get-project-graph-from-gradle-plugin', () => {
  return {
    GRADLE_BUILD_FILES: new Set(['build.gradle', 'build.gradle.kts']),
    populateProjectGraph: jest.fn().mockImplementation(() => void 0),
    getCurrentProjectGraphReport: jest
      .fn()
      .mockImplementation(() => gradleReport),
  };
});

describe('@nx/gradle/plugin', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('gradle-plugin');
    gradleReport = readJsonFile(
      join(__dirname, 'src/plugin/utils/__mocks__/gradle_tutorial.json')
    );
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
            "externalNodes": {},
            "projects": {
              "proj": {
                "metadata": {
                  "targetGroups": {
                    "help": [
                      "buildEnvironment",
                    ],
                  },
                  "technologies": [
                    "gradle",
                  ],
                },
                "name": "gradle-tutorial",
                "root": "proj",
                "targets": {
                  "buildEnvironment": {
                    "cache": true,
                    "command": "./gradlew :buildEnvironment",
                    "metadata": {
                      "description": "Displays all buildscript dependencies declared in root project 'gradle-tutorial'.",
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
