import {
  addProjectConfiguration,
  type ExpandedPluginConfiguration,
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
  bundleAndroidTargetName: string;
  bundleIosTargetName: string;
  podInstallTargetName: string;
  runAndroidTargetName: string;
  runIosTargetName: string;
  startTargetName: string;
  syncDepsTargetName: string;
  upgradeTargetName: string;
}

const defaultProjectOptions: ProjectOptions = {
  appName: 'demo',
  appRoot: 'apps/demo',
  buildAndroidTargetName: 'build-android',
  buildIosTargetName: 'build-ios',
  bundleAndroidTargetName: 'bundle-android',
  bundleIosTargetName: 'bundle-ios',
  podInstallTargetName: 'pod-install',
  runAndroidTargetName: 'run-android',
  runIosTargetName: 'run-ios',
  syncDepsTargetName: 'sync-deps',
  startTargetName: 'start',
  upgradeTargetName: 'upgrade',
};

const appConfig = { name: 'demo', displayName: 'Demo' };

function writeAppConfig(tree: Tree, projectRoot: string) {
  tree.write(`${projectRoot}/app.json`, JSON.stringify(appConfig));
  fs.createFileSync(`${projectRoot}/app.json`, JSON.stringify(appConfig));
  jest.doMock(join(fs.tempDir, projectRoot, 'app.json'), () => appConfig, {
    virtual: true,
  });
}

function createProject(
  tree: Tree,
  options: Partial<ProjectOptions> = {},
  additionalTargetOptions?: Record<string, Record<string, unknown>>
) {
  let projectOptions = { ...defaultProjectOptions, ...options };
  const project: ProjectConfiguration = {
    name: projectOptions.appName,
    root: projectOptions.appRoot,
    projectType: 'application',
    targets: {
      [projectOptions.buildAndroidTargetName]: {
        executor: '@nx/react-native:build-android',
        options: {
          ...additionalTargetOptions?.[projectOptions.buildAndroidTargetName],
        },
      },
      [projectOptions.buildIosTargetName]: {
        executor: '@nx/react-native:build-ios',
        options: {
          ...additionalTargetOptions?.[projectOptions.buildIosTargetName],
        },
      },
      [projectOptions.bundleAndroidTargetName]: {
        executor: '@nx/react-native:bundle',
        options: {
          platform: 'android',
          ...additionalTargetOptions?.[projectOptions.bundleAndroidTargetName],
        },
      },
      [projectOptions.bundleIosTargetName]: {
        executor: '@nx/react-native:bundle',
        options: {
          platform: 'ios',
          ...additionalTargetOptions?.[projectOptions.bundleIosTargetName],
        },
      },
      [projectOptions.podInstallTargetName]: {
        executor: '@nx/react-native:pod-install',
        options: {
          ...additionalTargetOptions?.[projectOptions.podInstallTargetName],
        },
      },
      [projectOptions.runAndroidTargetName]: {
        executor: '@nx/react-native:run-android',
        options: {
          ...additionalTargetOptions?.[projectOptions.runAndroidTargetName],
        },
      },
      [projectOptions.runIosTargetName]: {
        executor: '@nx/react-native:run-ios',
        options: {
          ...additionalTargetOptions?.[projectOptions.runIosTargetName],
        },
      },
      [projectOptions.startTargetName]: {
        executor: '@nx/react-native:start',
        options: {
          ...additionalTargetOptions?.[projectOptions.startTargetName],
        },
      },
      [projectOptions.syncDepsTargetName]: {
        executor: '@nx/react-native:sync-deps',
        options: {
          ...additionalTargetOptions?.[projectOptions.syncDepsTargetName],
        },
      },
      [projectOptions.upgradeTargetName]: {
        executor: '@nx/react-native:upgrade',
        options: {
          ...additionalTargetOptions?.[projectOptions.upgradeTargetName],
        },
      },
    },
  };

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOptions.appRoot}/project.json`,
    JSON.stringify(project)
  );

  // These file need to exist for inference, but they can be empty for the convert generator
  fs.createFileSync(`${projectOptions.appRoot}/package.json`, '{}');
  fs.createFileSync(`${projectOptions.appRoot}/metro.config.js`, '// empty');

  return project;
}

describe('convert-to-inferred', () => {
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('expo');
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
    const project = createProject(tree);
    writeAppConfig(tree, project.root);

    const project2 = createProject(tree, {
      appName: 'app2',
      appRoot: 'apps/app2',
    });

    const project2Build = project2.targets['build-ios'];

    await convertToInferred(tree, { project: project.name });

    const nxJsonPlugins = readNxJson(tree).plugins;
    const rnPlugin = nxJsonPlugins.find(
      (plugin): plugin is ExpandedPluginConfiguration =>
        typeof plugin !== 'string' &&
        plugin.plugin === '@nx/react-native/plugin'
    );

    const projectConfig = readProjectConfiguration(tree, project.name);

    expect(rnPlugin).toBeDefined();
    expect(projectConfig.targets).toEqual({
      'bundle-android': {
        executor: '@nx/react-native:bundle',
        options: {
          platform: 'android',
        },
      },
      'bundle-ios': {
        executor: '@nx/react-native:bundle',
        options: {
          platform: 'ios',
        },
      },
    });

    const updatedProject2 = readProjectConfiguration(tree, project2.name);
    expect(updatedProject2.targets['build-ios']).toEqual(project2Build);
  });

  it('should migrate options to CLI options and args', async () => {
    const project = createProject(
      tree,
      {},
      {
        'build-android': {
          mode: 'Release',
        },
        'build-ios': {
          mode: 'Release',
        },
        'run-android': {
          resetCache: true,
          activeArchOnly: true,
        },
        'run-ios': {
          resetCache: true,
          buildFolder: './custom',
        },
        start: {
          resetCache: true,
        },
      }
    );
    writeAppConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);
    expect(projectConfig.targets['build-android'].options).toEqual({
      args: ['--mode', 'Release'],
    });
    expect(projectConfig.targets['build-ios'].options).toEqual({
      args: ['--mode', 'Release'],
    });
    expect(projectConfig.targets['run-android'].options).toEqual({
      args: ['--active-arch-only'],
    });
    expect(projectConfig.targets['run-ios'].options).toEqual({
      args: ['--buildFolder', './custom'],
    });
    expect(projectConfig.targets['start'].options).toEqual({
      args: ['--reset-cache'],
    });
  });
});
