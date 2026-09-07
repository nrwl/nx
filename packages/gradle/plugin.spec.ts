import { CreateNodesContext, readJsonFile } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createNodes } from './plugin';
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
  let createNodesFunction = createNodes[1];
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
                      "cwd": "proj",
                    },
                  },
                },
              },
            },
          },
        ],
        [
          "proj/application/build.gradle",
          {
            "externalNodes": {},
            "projects": {
              "proj/application": {
                "metadata": {
                  "targetGroups": {
                    "verification": [
                      "ci",
                    ],
                  },
                  "technologies": [
                    "gradle",
                  ],
                },
                "name": "application",
                "root": "proj/application",
                "targets": {
                  "ci": {
                    "cache": true,
                    "dependsOn": [
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest10",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest7",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest6",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest3",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest2",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest9",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest5",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest4",
                      },
                      {
                        "params": "forward",
                        "target": "ci--DemoApplicationTest8",
                      },
                    ],
                    "executor": "nx:noop",
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest10.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest7.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest6.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest3.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest2.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest9.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest5.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest4.java",
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest8.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle Tests in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest10": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest10",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest10.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest10.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest2": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest2",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest2.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest2.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest3": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest3",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest3.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest3.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest4": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest4",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest4.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest4.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest5": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest5",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest5.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest5.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest6": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest6",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest6.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest6.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest7": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest7",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest7.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest7.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest8": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest8",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest8.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest8.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
                  },
                  "ci--DemoApplicationTest9": {
                    "cache": true,
                    "command": "./gradlew :application:test --tests DemoApplicationTest9",
                    "dependsOn": [
                      "application:classes",
                      "application:compileJava",
                      "library:jar",
                    ],
                    "inputs": [
                      "{projectRoot}/src/test/java/com/example/multimodule/application/DemoApplicationTest9.java",
                    ],
                    "metadata": {
                      "description": "Runs Gradle test proj/application/src/test/java/com/example/multimodule/application/DemoApplicationTest9.java in CI",
                      "technologies": [
                        "gradle",
                      ],
                    },
                    "options": {
                      "cwd": "proj",
                    },
                    "outputs": [
                      "{projectRoot}/build/classes/java/test",
                      "{projectRoot}/build/generated/sources/annotationProcessor/java/test",
                      "{projectRoot}/build/generated/sources/headers/java/test",
                      "{projectRoot}/build/tmp/compileTestJava/previous-compilation-data.bin",
                    ],
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
