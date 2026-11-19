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
  buildExecutor: string;
  serverTargetName: string;
  serverExecutor: string;
}

const defaultProjectOptions: ProjectOptions = {
  appName: 'my-app',
  appRoot: 'apps/my-app',
  buildTargetName: 'build',
  buildExecutor: '@nx/next:build',
  serverTargetName: 'serve',
  serverExecutor: '@nx/next:server',
};

const defaultNextConfig = `
  //@ts-check

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { composePlugins, withNx } = require('@nx/next');

/**
 * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
 **/
const nextConfig = {
  nx: {
    // Set this to true if you would like to use SVGR
    // See: https://github.com/gregberge/svgr
    svgr: false,
  },
};

const plugins = [
  // Add more Next.js plugins to this list if needed.
  withNx,
];

module.exports = composePlugins(...plugins)(nextConfig)
  `;

function writeNextConfig(
  tree: Tree,
  projectRoot: string,
  nextConfig = defaultNextConfig
) {
  tree.write(`${projectRoot}/next.config.js`, defaultNextConfig);
  fs.createFileSync(`${projectRoot}/next.config.js`, nextConfig);
  vi.doMock(join(fs.tempDir, projectRoot, 'next.config.js'), () => nextConfig, {
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
        executor: projectOptions.buildExecutor,
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/${projectOptions.appRoot}`,
          ...additionalTargetOptions?.[projectOptions.buildTargetName],
        },
        configurations: {
          development: {
            outputPath: projectOptions.appRoot,
          },
          production: {},
        },
      },
      [projectOptions.serverTargetName]: {
        executor: projectOptions.serverExecutor,
        defaultConfiguration: 'development',
        options: {
          dev: true,
          port: 4200,
          ...additionalTargetOptions?.[projectOptions.serverTargetName],
        },
        configurations: {
          development: {
            buildTarget: `${projectOptions.appName}:${projectOptions.buildTargetName}:development`,
            dev: true,
          },
          production: {
            buildTarget: `${projectOptions.appName}:${projectOptions.buildTargetName}:production`,
            dev: false,
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
    fs = new TempFs('nextjs');
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
    writeNextConfig(tree, project.root);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/next/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
          "devTargetName": "serve",
          "serveStaticTargetName": "serve-static",
          "startTargetName": "start",
        },
        "plugin": "@nx/next/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build": {
          "configurations": {
            "development": {},
          },
        },
        "serve": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "development",
          "options": {
            "port": 4200,
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
