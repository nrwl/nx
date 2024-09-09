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
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from 'nx/src/generators/utils/project-configuration';
import { convertToInferred } from './convert-to-inferred';

let fs: TempFs;
let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
  updateProjectConfiguration: jest
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
          projectConfiguration[
            '// targets'
          ] = `to see all targets run: nx show project ${projectName} --web`;
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
jest.mock('nx/src/devkit-internals', () => ({
  ...jest.requireActual('nx/src/devkit-internals'),
  getExecutorInformation: jest
    .fn()
    .mockImplementation((pkg, ...args) =>
      jest
        .requireActual('nx/src/devkit-internals')
        .getExecutorInformation('@nx/webpack', ...args)
    ),
}));

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
  jest.doMock(
    join(fs.tempDir, projectRoot, '.detoxrc.json'),
    () => detoxConfig,
    {
      virtual: true,
    }
  );
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

describe('convert-to-inferred', () => {
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
    jest.resetModules();
  });

  it('should convert project to use inference plugin', async () => {
    const project = createProject(
      tree,
      {},
      {
        'build-android': {
          configPath: '.detoxrc.dev.json',
        },
        'build-ios': {
          configPath: '.detoxrc.dev.json',
        },
        'test-android': {
          configPath: '.detoxrc.dev.json',
        },
        'test-ios': {
          configPath: '.detoxrc.dev.json',
        },
      },
      {
        'build-android': {
          production: { configPath: '.detoxrc.prod.json' },
        },
        'build-ios': {
          production: { configPath: '.detoxrc.prod.json' },
        },
        'test-android': {
          production: { configPath: '.detoxrc.prod.json' },
        },
        'test-ios': {
          production: { configPath: '.detoxrc.prod.json' },
        },
      }
    );
    writeDetoxConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toEqual([
      {
        options: {
          buildTargetName: 'build',
          startTargetName: 'start',
          testTargetName: 'test',
        },
        plugin: '@nx/detox/plugin',
      },
    ]);
    expect(projectConfig.targets['build-android']).toEqual({
      command: 'nx run demo-e2e:build',
      options: {
        args: [
          '--args="-c android.emu.debug"',
          '--config-path',
          '.detoxrc.dev.json',
        ],
      },
      configurations: {
        production: {
          args: [
            '--args="-c android.emu.release"',
            '--config-path',
            '.detoxrc.prod.json',
          ],
        },
      },
    });
    expect(projectConfig.targets['build-ios']).toEqual({
      command: 'nx run demo-e2e:build',
      options: {
        args: [
          '--args="-c ios.sim.debug"',
          '--config-path',
          '.detoxrc.dev.json',
        ],
      },
      configurations: {
        production: {
          args: [
            '--args="-c ios.sim.release"',
            '--config-path',
            '.detoxrc.prod.json',
          ],
        },
      },
    });
    expect(projectConfig.targets['test-android']).toEqual({
      command: 'nx run demo-e2e:test',
      options: {
        args: [
          '--args="-c android.emu.debug"',
          '--config-path',
          '.detoxrc.dev.json',
        ],
      },
      configurations: {
        production: {
          args: [
            '--args="-c android.emu.release"',
            '--config-path',
            '.detoxrc.prod.json',
          ],
        },
      },
    });
    expect(projectConfig.targets['test-ios']).toEqual({
      command: 'nx run demo-e2e:test',
      options: {
        args: [
          '--args="-c ios.sim.debug"',
          '--config-path',
          '.detoxrc.dev.json',
        ],
      },
      configurations: {
        production: {
          args: [
            '--args="-c ios.sim.release"',
            '--config-path',
            '.detoxrc.prod.json',
          ],
        },
      },
    });
  });
});
