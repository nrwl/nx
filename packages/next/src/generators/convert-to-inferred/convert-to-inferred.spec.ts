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
  jest.doMock(
    join(fs.tempDir, projectRoot, 'next.config.js'),
    () => nextConfig,
    { virtual: true }
  );
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

describe('convert-to-inferred', () => {
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
    jest.resetModules();
  });

  describe('--project', () => {
    it('should register plugin in nx.json', async () => {
      const project = createProject(tree);
      writeNextConfig(tree, project.root);

      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });

      const project2Build = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      const nxJsonPlugins = readNxJson(tree).plugins;
      const nextPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/next/plugin'
      );

      const projectConfig = readProjectConfiguration(tree, project.name);

      expect(nextPlugin).toBeDefined();
      expect(projectConfig.targets.build).toEqual({
        configurations: { development: {} },
      });

      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toEqual(project2Build);
    });
  });

  it('should move fileReplacement and assets option to withNx', async () => {
    const project = createProject(
      tree,
      {},
      {
        build: {
          assets: [{ input: 'tools', output: '.', glob: 'test.txt' }],
          fileReplacements: [
            {
              replace: 'apps/my-app/environments/environment.ts',
              with: 'apps/my-app/environments/environment.foo.ts',
            },
          ],
        },
      }
    );
    writeNextConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    expect(tree.read(`${project.root}/next.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "//@ts-check
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { composePlugins, withNx } = require('@nx/next');
      const configValues = {
        default: {
          fileReplacements: [
            {
              replace: './environments/environment.ts',
              with: './environments/environment.foo.ts',
            },
          ],
          assets: [
            {
              input: '../../tools',
              output: '../..',
              glob: 'test.txt',
            },
          ],
        },
        development: {},
      };
      const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';
      const options = {
        ...configValues.default,
        // @ts-expect-error: Ignore TypeScript error for indexing configValues with a dynamic key
        ...configValues[configuration],
      };
      /**
       * @type {import('@nx/next/plugins/with-nx').WithNxOptions}
       **/
      const nextConfig = {
        nx: {
          // Set this to true if you would like to use SVGR
          // See: https://github.com/gregberge/svgr
          svgr: false,
          ...options,
        },
      };
      const plugins = [
        // Add more Next.js plugins to this list if needed.
        withNx,
      ];
      module.exports = composePlugins(...plugins)(nextConfig);
      "
    `);
  });

  it('should leave port option in serve target', async () => {
    const project = createProject(tree);
    writeNextConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);
    expect(projectConfig.targets.serve.options).toEqual({
      port: 4200,
    });

    expect(projectConfig.targets.serve).toMatchInlineSnapshot(`
      {
        "configurations": {
          "development": {},
          "production": {},
        },
        "defaultConfiguration": "development",
        "options": {
          "port": 4200,
        },
      }
    `);
  });

  it('should leave hostname option in serve target', async () => {
    const project = createProject(tree, {}, { serve: { hostname: 'foo' } });
    writeNextConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);

    expect(projectConfig.targets.serve.options).toEqual({
      port: 4200,
      hostname: 'foo',
    });

    expect(projectConfig.targets.serve).toMatchInlineSnapshot(`
      {
        "configurations": {
          "development": {},
          "production": {},
        },
        "defaultConfiguration": "development",
        "options": {
          "hostname": "foo",
          "port": 4200,
        },
      }
    `);
  });

  it('should migrate options to CLI options and args', async () => {
    const project = createProject(
      tree,
      {},
      {
        build: {
          debug: true,
          profile: true,
          experimentalAppOnly: true,
          experimentalBuildMode: 'generate',
        },
      }
    );
    writeNextConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);
    expect(projectConfig.targets.build.options).toEqual({
      args: [
        '--debug',
        '--profile',
        '--experimental-app-only',
        '--experimental-build-mode generate',
      ],
    });
  });

  it('should not migrate options to CLI args if they are booleans and are false', async () => {
    const project = createProject(
      tree,
      {},
      {
        build: {
          debug: false,
          profile: false,
          experimentalAppOnly: false,
        },
      }
    );
    writeNextConfig(tree, project.root);

    await convertToInferred(tree, { project: project.name });

    const projectConfig = readProjectConfiguration(tree, project.name);
    expect(projectConfig.targets.build.options).toBeUndefined();
  });
});
