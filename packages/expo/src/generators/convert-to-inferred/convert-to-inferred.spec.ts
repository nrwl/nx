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
  buildTargetName: string;
  exportTargetName: string;
  installTargetName: string;
  prebuildTargetName: string;
  runIosTargetName: string;
  runAndroidTargetName: string;
  serveTargetName: string;
  startTargetName: string;
  submitTargetName: string;
}

const defaultProjectOptions: ProjectOptions = {
  appName: 'demo',
  appRoot: 'apps/demo',
  buildTargetName: 'build',
  exportTargetName: 'export',
  installTargetName: 'install',
  prebuildTargetName: 'prebuild',
  runAndroidTargetName: 'run-android',
  runIosTargetName: 'run-ios',
  serveTargetName: 'serve',
  startTargetName: 'start',
  submitTargetName: 'submit',
};

const defaultExpoConfig = {
  expo: {
    name: 'demo',
    slug: 'demo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.anonymous.demo',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [],
  },
};

function writeExpoConfig(
  tree: Tree,
  projectRoot: string,
  expoConfig = defaultExpoConfig
) {
  tree.write(`${projectRoot}/app.json`, JSON.stringify(expoConfig));
  fs.createFileSync(`${projectRoot}/app.json`, JSON.stringify(expoConfig));
  jest.doMock(join(fs.tempDir, projectRoot, 'app.json'), () => expoConfig, {
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
      [projectOptions.buildTargetName]: {
        executor: '@nx/expo:build',
        options: {
          ...additionalTargetOptions?.[projectOptions.buildTargetName],
        },
      },
      [projectOptions.exportTargetName]: {
        executor: '@nx/expo:export',
        options: {
          platform: 'all',
          outputDir: `dist/${projectOptions.appName}`,
          ...additionalTargetOptions?.[projectOptions.exportTargetName],
        },
      },
      [projectOptions.installTargetName]: {
        executor: '@nx/expo:install',
        options: {
          ...additionalTargetOptions?.[projectOptions.installTargetName],
        },
      },
      [projectOptions.prebuildTargetName]: {
        executor: '@nx/expo:prebuild',
        options: {
          ...additionalTargetOptions?.[projectOptions.prebuildTargetName],
        },
      },
      [projectOptions.runAndroidTargetName]: {
        executor: '@nx/expo:run',
        options: {
          ...additionalTargetOptions?.[projectOptions.runAndroidTargetName],
        },
      },
      [projectOptions.runIosTargetName]: {
        executor: '@nx/expo:run',
        options: {
          ...additionalTargetOptions?.[projectOptions.runIosTargetName],
        },
      },
      [projectOptions.serveTargetName]: {
        executor: '@nx/expo:serve',
        options: {
          ...additionalTargetOptions?.[projectOptions.startTargetName],
        },
      },
      [projectOptions.startTargetName]: {
        executor: '@nx/expo:start',
        options: {
          ...additionalTargetOptions?.[projectOptions.serveTargetName],
        },
      },
      [projectOptions.submitTargetName]: {
        executor: '@nx/expo:submit',
        options: {
          ...additionalTargetOptions?.[projectOptions.submitTargetName],
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
    writeExpoConfig(tree, project.root);

    const project2 = createProject(tree, {
      appName: 'app2',
      appRoot: 'apps/app2',
    });

    const project2Build = project2.targets.build;

    await convertToInferred(tree, { project: project.name });

    const nxJsonPlugins = readNxJson(tree).plugins;
    const expoPlugin = nxJsonPlugins.find(
      (plugin): plugin is ExpandedPluginConfiguration =>
        typeof plugin !== 'string' && plugin.plugin === '@nx/expo/plugin'
    );

    const projectConfig = readProjectConfiguration(tree, project.name);

    expect(expoPlugin).toBeDefined();
    expect(projectConfig.targets).toEqual({
      export: {
        options: {
          args: ['--output-dir=../../dist/demo', '--platform=all'],
        },
      },
    });

    const updatedProject2 = readProjectConfiguration(tree, project2.name);
    expect(updatedProject2.targets.build).toEqual(project2Build);
  });

  it('should migrate options to CLI options and args', async () => {
    const project = createProject(
      tree,
      {},
      {
        build: {
          wait: true,
          clearCache: true,
        },
        export: { bytecode: false, minify: false, platform: 'android' },
        'run-android': {
          platform: 'android',
          variant: 'release',
          clean: true,
          bundler: false,
        },
        'run-ios': {
          platform: 'ios',
          xcodeConfiguration: 'Release',
          buildCache: false,
        },
        install: { check: true },
        prebuild: { clean: true },
        serve: { dev: false },
        start: { dev: false },
        submit: { wait: true, interactive: false },
      }
    );
    writeExpoConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);
    expect(projectConfig.targets.build.options).toEqual({
      args: ['--wait', '--clear-cache'],
    });
    expect(projectConfig.targets.export.options).toEqual({
      args: [
        '--no-minify',
        '--no-bytecode',
        '--output-dir=../../dist/demo',
        '--platform=android',
      ],
    });
    expect(projectConfig.targets.install.options).toEqual({
      args: ['--check'],
    });
    expect(projectConfig.targets.prebuild.options).toEqual({
      args: ['--clean'],
    });
    expect(projectConfig.targets['run-android'].options).toEqual({
      args: ['--variant', 'release', '--no-bundler'],
    });
    expect(projectConfig.targets['run-ios'].options).toEqual({
      args: ['--configuration', 'Release', '--no-build-cache'],
    });
    expect(projectConfig.targets.serve.options).toEqual({
      args: ['--no-dev'],
    });
    expect(projectConfig.targets.start.options).toEqual({
      args: ['--no-dev'],
    });
    expect(projectConfig.targets.submit.options).toEqual({
      args: ['--non-interactive', '--wait'],
    });
  });

  it('should migrate custom run:ios and run:android target names', async () => {
    const project1 = createProject(
      tree,
      {
        appName: 'app1',
        appRoot: 'apps/app1',
        runAndroidTargetName: 'run-android-custom-1',
        runIosTargetName: 'run-ios-custom-1',
      },
      {
        'run-android-custom-1': {
          platform: 'android',
          buildCache: false,
        },
        'run-ios-custom-1': {
          platform: 'ios',
          buildCache: false,
        },
      }
    );

    const project2 = createProject(
      tree,
      {
        appName: 'app2',
        appRoot: 'apps/app2',
        runAndroidTargetName: 'run-android-custom-2',
        runIosTargetName: 'run-ios-custom-2',
      },
      {
        'run-android-custom-2': {
          platform: 'android',
          variant: 'release',
        },
        'run-ios-custom-2': {
          platform: 'ios',
          xcodeConfiguration: 'Release',
        },
      }
    );

    writeExpoConfig(tree, project2.root);
    writeExpoConfig(tree, project1.root);

    await convertToInferred(tree, {});

    const config1 = readProjectConfiguration(tree, project1.name);
    const config2 = readProjectConfiguration(tree, project2.name);
    const nxJson = readNxJson(tree);

    expect(config1.targets['run-android-custom-1'].options).toEqual({
      args: ['--no-build-cache'],
    });
    expect(config1.targets['run-ios-custom-1'].options).toEqual({
      args: ['--no-build-cache'],
    });
    expect(config2.targets['run-android-custom-2'].options).toEqual({
      args: ['--variant', 'release'],
    });
    expect(config2.targets['run-ios-custom-2'].options).toEqual({
      args: ['--configuration', 'Release'],
    });
    expect(nxJson.plugins).toEqual([
      {
        plugin: '@nx/expo/plugin',
        options: {
          buildTargetName: 'build',
          exportTargetName: 'export',
          installTargetName: 'install',
          prebuildTargetName: 'prebuild',
          runAndroidTargetName: 'run-android-custom-1',
          runIosTargetName: 'run-ios-custom-1',
          serveTargetName: 'serve',
          startTargetName: 'start',
          submitTargetName: 'submit',
        },
        include: ['apps/app1/**/*'],
      },
      {
        plugin: '@nx/expo/plugin',
        options: {
          buildTargetName: 'build',
          exportTargetName: 'export',
          installTargetName: 'install',
          prebuildTargetName: 'prebuild',
          runAndroidTargetName: 'run-android-custom-2',
          runIosTargetName: 'run-ios-custom-2',
          serveTargetName: 'serve',
          startTargetName: 'start',
          submitTargetName: 'submit',
        },
        include: ['apps/app2/**/*'],
      },
    ]);
  });
});
