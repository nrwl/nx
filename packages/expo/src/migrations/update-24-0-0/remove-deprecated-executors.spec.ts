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
  vi.doMock(join(fs.tempDir, projectRoot, 'app.json'), () => expoConfig, {
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
    vi.resetModules();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createProject(
      tree,
      {},
      { 'run-android': { platform: 'android' }, 'run-ios': { platform: 'ios' } }
    );
    writeExpoConfig(tree, project.root);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/expo/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
          "exportTargetName": "export",
          "installTargetName": "install",
          "prebuildTargetName": "prebuild",
          "runAndroidTargetName": "run-android",
          "runIosTargetName": "run-ios",
          "serveTargetName": "serve",
          "startTargetName": "start",
          "submitTargetName": "submit",
        },
        "plugin": "@nx/expo/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "export": {
          "options": {
            "args": [
              "--output-dir=../../dist/demo",
              "--platform=all",
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
