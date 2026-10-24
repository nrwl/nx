import {
  addProjectConfiguration,
  joinPathFragments,
  type ProjectConfiguration,
  type ProjectGraph,
  readNxJson,
  readProjectConfiguration,
  type Tree,
  writeJson,
} from '@nx/devkit';
import {
  mockCjsModule as mockConverterModule,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';

let fs: TempFs;
let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
  updateProjectConfiguration: vi
    .fn()
    .mockImplementation((tree, projectName, projectConfiguration) => {
      function handleEmptyTargets(
        projectName: string,
        projectConfiguration: ProjectConfiguration
      ): void {
        if (
          projectConfiguration.targets &&
          !Object.keys(projectConfiguration.targets).length
        ) {
          // Re-order `targets` to appear after the `// target` comment.
          delete projectConfiguration.targets;
          projectConfiguration['// targets'] =
            `to see all targets run: nx show project ${projectName} --web`;
          projectConfiguration.targets = {};
        } else {
          delete projectConfiguration['// targets'];
        }
      }

      const projectConfigFile = joinPathFragments(
        projectConfiguration.root,
        'project.json'
      );

      if (!tree.exists(projectConfigFile)) {
        throw new Error(
          `Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`
        );
      }
      handleEmptyTargets(projectName, projectConfiguration);
      writeJson(tree, projectConfigFile, {
        name: projectConfiguration.name ?? projectName,
        $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
        ...projectConfiguration,
        root: undefined,
      });
      projectGraph.nodes[projectName].data = projectConfiguration;
    }),
}));
vi.mock('nx/src/devkit-internals', async () => {
  const actual = await vi.importActual<any>('nx/src/devkit-internals');
  const { retrieveProjectConfigurations } = await vi.importActual<any>(
    'nx/src/project-graph/utils/retrieve-workspace-files'
  );
  return {
    ...actual,
    retrieveProjectConfigurations,
    getExecutorInformation: vi
      .fn()
      .mockImplementation((pkg, ...args) =>
        actual.getExecutorInformation('@nx/webpack', ...args)
      ),
  };
});

function addProject(tree: Tree, name: string, project: ProjectConfiguration) {
  addProjectConfiguration(tree, name, project);
  projectGraph.nodes[name] = {
    name: name,
    type: project.projectType === 'application' ? 'app' : 'lib',
    data: {
      projectType: project.projectType,
      root: project.root,
      targets: project.targets,
    },
  };
}

interface ProjectOptions {
  appName: string;
  appRoot: string;
  buildAndroidTargetName: string;
  buildIosTargetName: string;
  testAndroidTargetName: string;
  testIosTargetName: string;
}

const defaultProjectOptions: ProjectOptions = {
  appName: 'demo-e2e',
  appRoot: 'apps/demo-e2e',
  buildAndroidTargetName: 'build-android',
  buildIosTargetName: 'build-ios',
  testAndroidTargetName: 'test-android',
  testIosTargetName: 'test-ios',
};

const detoxConfig = {
  testRunner: {
    args: {
      $0: 'jest',
      config: './jest.config.json',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      build:
        "cd ../demo/ios && xcodebuild -workspace Demo.xcworkspace -scheme Demo -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
      binaryPath:
        '../demo/ios/build/Build/Products/Debug-iphonesimulator/Demo.app',
    },
    'ios.release': {
      type: 'ios.app',
      build:
        "cd ../demo/ios && xcodebuild -workspace Demo.xcworkspace -scheme Demo -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
      binaryPath:
        '../demo/ios/build/Build/Products/Release-iphonesimulator/Demo.app',
    },

    'android.debug': {
      type: 'android.apk',
      build:
        'cd ../demo/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      binaryPath: '../demo/android/app/build/outputs/apk/debug/app-debug.apk',
    },
    'android.release': {
      type: 'android.apk',
      build:
        'cd ../demo/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
      binaryPath:
        '../demo/android/app/build/outputs/apk/release/app-release.apk',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Plus',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_4a_API_30',
      },
    },
  },
  configurations: {
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },

    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};

function writeDetoxConfig(tree: Tree, projectRoot: string) {
  tree.write(`${projectRoot}/.detoxrc.json`, JSON.stringify(detoxConfig));
  fs.createFileSync(
    `${projectRoot}/.detoxrc.json`,
    JSON.stringify(detoxConfig)
  );
  vi.doMock(join(fs.tempDir, projectRoot, '.detoxrc.json'), () => detoxConfig, {
    virtual: true,
  });
}

function createProject(
  tree: Tree,
  options: Partial<ProjectOptions> = {},
  extraTargetOptions?: Record<string, Record<string, unknown>>,
  extraTargetConfigurations?: Record<
    string,
    Record<string, Record<string, unknown>>
  >
) {
  let projectOptions = { ...defaultProjectOptions, ...options };
  const project: ProjectConfiguration = {
    name: projectOptions.appName,
    root: projectOptions.appRoot,
    projectType: 'application',
    targets: {
      [projectOptions.buildAndroidTargetName]: {
        executor: '@nx/detox:build',
        options: {
          detoxConfiguration: 'android.emu.debug',
          ...extraTargetOptions?.[projectOptions.buildAndroidTargetName],
        },
        configurations: {
          production: {
            ...extraTargetConfigurations?.[
              projectOptions.buildAndroidTargetName
            ].production,
            detoxConfiguration: 'android.emu.release',
          },
        },
      },
      [projectOptions.buildIosTargetName]: {
        executor: '@nx/detox:build',
        options: {
          detoxConfiguration: 'ios.sim.debug',
          ...extraTargetOptions?.[projectOptions.buildIosTargetName],
        },
        configurations: {
          production: {
            ...extraTargetConfigurations?.[projectOptions.buildIosTargetName]
              .production,
            detoxConfiguration: 'ios.sim.release',
          },
        },
      },
      [projectOptions.testAndroidTargetName]: {
        executor: '@nx/detox:test',
        options: {
          detoxConfiguration: 'android.emu.debug',
          buildTarget: 'demo-e2e:build-android',
          ...extraTargetOptions?.[projectOptions.testAndroidTargetName],
        },
        configurations: {
          production: {
            detoxConfiguration: 'android.emu.release',
            buildTarget: 'demo-e2e:build-android:production',
            ...extraTargetConfigurations?.[projectOptions.testAndroidTargetName]
              .production,
          },
        },
      },
      [projectOptions.testIosTargetName]: {
        executor: '@nx/detox:test',
        options: {
          detoxConfiguration: 'ios.sim.debug',
          buildTarget: 'demo-e2e:build-ios',
          ...extraTargetOptions?.[projectOptions.testIosTargetName],
        },
        configurations: {
          production: {
            detoxConfiguration: 'ios.sim.release',
            buildTarget: 'demo-e2e:build-ios:production',
            ...extraTargetConfigurations?.[projectOptions.testIosTargetName]
              .production,
          },
        },
      },
    },
  };

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOptions.appRoot}/project.json`,
    JSON.stringify(project)
  );

  return project;
}

import * as converter from '../../generators/convert-to-inferred/convert-to-inferred';
import update from './remove-deprecated-executors';

describe('remove-deprecated-executors', () => {
  // The migration loads its converter through `require`, which vi.mock cannot
  // reach, so hand it the module that sees the mocked project graph.
  beforeEach(() => {
    mockConverterModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('detox');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;

    projectGraph = {
      nodes: {},
      dependencies: {},
      externalNodes: {},
    };
  });

  afterEach(() => {
    fs.cleanup();
    vi.resetModules();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createProject(tree);
    writeDetoxConfig(tree, project.root);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/detox/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
          "startTargetName": "start",
          "testTargetName": "test",
        },
        "plugin": "@nx/detox/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build-android": {
          "command": "nx run demo-e2e:build",
          "configurations": {
            "production": {
              "args": [
                "--args="-c android.emu.release"",
              ],
            },
          },
          "options": {
            "args": [
              "--args="-c android.emu.debug"",
            ],
          },
        },
        "build-ios": {
          "command": "nx run demo-e2e:build",
          "configurations": {
            "production": {
              "args": [
                "--args="-c ios.sim.release"",
              ],
            },
          },
          "options": {
            "args": [
              "--args="-c ios.sim.debug"",
            ],
          },
        },
        "test-android": {
          "command": "nx run demo-e2e:test",
          "configurations": {
            "production": {
              "args": [
                "--args="-c android.emu.release"",
              ],
            },
          },
          "dependsOn": [
            "demo-e2e:build-android",
          ],
          "options": {
            "args": [
              "--args="-c android.emu.debug"",
            ],
          },
        },
        "test-ios": {
          "command": "nx run demo-e2e:test",
          "configurations": {
            "production": {
              "args": [
                "--args="-c ios.sim.release"",
              ],
            },
          },
          "dependsOn": [
            "demo-e2e:build-ios",
          ],
          "options": {
            "args": [
              "--args="-c ios.sim.debug"",
            ],
          },
        },
      }
    `);
  });

  it('skips the prompt when no project uses the removed executors', async () => {
    const nxJson = readNxJson(tree);

    expect(await update(tree)).toEqual({ skipAgentic: true });
    expect(readNxJson(tree)).toEqual(nxJson);
  });
});
