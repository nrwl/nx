import {
  addProjectConfiguration,
  joinPathFragments,
  readNxJson,
  readProjectConfiguration,
  updateNxJson,
  updateProjectConfiguration,
  writeJson,
  type ExpandedPluginConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import {
  mockCjsModule,
  resetCjsMocks,
  TempFs,
} from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from '@nx/devkit/internal';
import type { WebpackPluginOptions } from '../../plugins/plugin';

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
  serveTargetName: string;
  serveExecutor: string;
}

const defaultProjectOptions: ProjectOptions = {
  appName: 'app1',
  appRoot: 'apps/app1',
  buildTargetName: 'build',
  buildExecutor: '@nx/webpack:webpack',
  serveTargetName: 'serve',
  serveExecutor: '@nx/webpack:dev-server',
};

const defaultWebpackConfig = `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { useLegacyNxPlugin } = require('@nx/webpack');

// This file was migrated using @nx/webpack:convert-config-to-webpack-plugin from your './webpack.config.old.js'
// Please check that the options here are correct as they were moved from the old webpack.config.js to this file.
const options = {};

/**
 * @type{import('webpack').WebpackOptionsNormalized}
 */
module.exports = async () => ({
  plugins: [
    new NxAppWebpackPlugin(options),
    new NxReactWebpackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await useLegacyNxPlugin(require('./webpack.config.old'), options),
  ],
});
`;

function writeWebpackConfig(
  tree: Tree,
  projectRoot: string,
  webpackConfig = defaultWebpackConfig
) {
  tree.write(`${projectRoot}/webpack.config.js`, webpackConfig);
  fs.createFileSync(`${projectRoot}/webpack.config.js`, webpackConfig);
  // loadConfigFile `require`s the config, which `vi.doMock` cannot reach.
  mockCjsModule(
    import.meta.url,
    join(fs.tempDir, projectRoot, 'webpack.config.js'),
    {}
  );
}

function createProject(
  tree: Tree,
  opts: Partial<ProjectOptions> = {},
  extraTargetOptions?: Record<string, Record<string, unknown>>
) {
  let projectOpts = { ...defaultProjectOptions, ...opts };
  const project: ProjectConfiguration = {
    name: projectOpts.appName,
    root: projectOpts.appRoot,
    projectType: 'application',
    targets: {
      [projectOpts.buildTargetName]: {
        executor: projectOpts.buildExecutor,
        options: {
          webpackConfig: `${projectOpts.appRoot}/webpack.config.js`,
          compiler: 'babel',
          outputPath: `dist/${projectOpts.appRoot}`,
          index: `${projectOpts.appRoot}/src/index.html`,
          baseHref: '/',
          main: `${projectOpts.appRoot}/src/main.tsx`,
          tsConfig: `${projectOpts.appRoot}/tsconfig.app.json`,
          assets: [
            `${projectOpts.appRoot}/src/favicon.ico`,
            `${projectOpts.appRoot}/src/assets`,
          ],
          styles: [`${projectOpts.appRoot}/src/styles.scss`],
          scripts: [],
          ...extraTargetOptions?.[projectOpts.buildTargetName],
        },
        configurations: {
          development: {
            extractLicenses: false,
            optimization: false,
            sourceMap: true,
            vendorChunk: true,
          },
          production: {
            fileReplacements: [
              {
                replace: `${projectOpts.appRoot}/src/environments/environment.ts`,
                with: `${projectOpts.appRoot}/src/environments/environment.prod.ts`,
              },
            ],
            optimization: true,
            outputHashing: 'all',
            sourceMap: false,
            namedChunks: false,
            extractLicenses: true,
            vendorChunk: false,
          },
        },
        defaultConfiguration: 'production',
      },
      [projectOpts.serveTargetName]: {
        executor: projectOpts.serveExecutor,
        options: {
          buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}`,
          hmr: true,
          ssl: true,
          sslCert: `${projectOpts.appRoot}/server.crt`,
          sslKey: `${projectOpts.appRoot}/server.key`,
          proxyConfig: `${projectOpts.appRoot}/proxy.conf.json`,
          ...extraTargetOptions?.[projectOpts.serveTargetName],
        },
        configurations: {
          development: {
            buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}:development`,
            open: true,
          },
          production: {
            buildTarget: `${projectOpts.appName}:${projectOpts.buildTargetName}:production`,
            hmr: false,
          },
        },
        defaultConfiguration: 'development',
      },
    },
  };
  fs.createFileSync(
    `${projectOpts.appRoot}/proxy.conf.json`,
    `{
      "/api": {
        "target": "http://localhost:3333",
        "secure": false
      }
    }`
  );

  writeWebpackConfig(tree, projectOpts.appRoot, `module.exports = {};`);

  addProject(tree, project.name, project);
  fs.createFileSync(
    `${projectOpts.appRoot}/project.json`,
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
    mockCjsModule(
      import.meta.url,
      '../../generators/convert-to-inferred/convert-to-inferred',
      converter
    );
  });
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('webpack');
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
    resetCjsMocks();
    vi.resetModules();
  });

  it('converts targets using the removed executors to the inference plugin', async () => {
    const project = createProject(tree);
    writeWebpackConfig(tree, project.root);

    await update(tree);

    expect(
      readNxJson(tree).plugins.find(
        (plugin) =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/webpack/plugin'
      )
    ).toMatchInlineSnapshot(`
      {
        "options": {
          "buildTargetName": "build",
          "previewTargetName": "preview",
          "serveStaticTargetName": "serve-static",
          "serveTargetName": "serve",
        },
        "plugin": "@nx/webpack/plugin",
      }
    `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "production",
        },
        "serve": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "development",
        },
      }
    `);
  });

  it('converts a config built on the removed helpers before inferring its targets', async () => {
    const project = createProject(tree);
    writeWebpackConfig(
      tree,
      project.root,
      `const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => config);
`
    );

    await update(tree);

    expect(tree.exists(`${project.root}/webpack.config.old.js`)).toBe(true);
    expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8')).toContain(
      'new NxAppWebpackPlugin(buildOptions)'
    );
    expect(
      readProjectConfiguration(tree, project.name).targets.build?.executor
    ).toBeUndefined();
  });

  it('leaves a Module Federation helper config for the Module Federation migration', async () => {
    const project = createProject(tree);
    const config = `const { composePlugins, withNx } = require('@nx/webpack');
const { withModuleFederation } = require('@nx/module-federation/webpack');

module.exports = composePlugins(withNx(), withModuleFederation({ name: 'host' }));
`;
    writeWebpackConfig(tree, project.root, config);

    await update(tree);

    expect(tree.exists(`${project.root}/webpack.config.old.js`)).toBe(false);
    expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8')).toBe(
      config
    );
  });

  it('converts a helper config on an @nrwl-aliased target in one run', async () => {
    const project = createProject(tree, {
      buildExecutor: '@nrwl/webpack:webpack',
    });
    writeWebpackConfig(
      tree,
      project.root,
      `const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => config);
`
    );

    const result = await update(tree);

    expect(result.nextSteps).toBeUndefined();
    expect(tree.exists(`${project.root}/webpack.config.old.js`)).toBe(true);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
      {
        "build": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "production",
        },
        "serve": {
          "configurations": {
            "development": {},
            "production": {},
          },
          "defaultConfiguration": "development",
        },
      }
    `);
  });

  it('converts a Nest project served by the @nx/js:node executor', async () => {
    const project: ProjectConfiguration = {
      name: 'api',
      root: 'apps/api',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/webpack:webpack',
          outputs: ['{options.outputPath}'],
          defaultConfiguration: 'production',
          options: {
            target: 'node',
            compiler: 'tsc',
            outputPath: 'dist/apps/api',
            main: 'apps/api/src/main.ts',
            tsConfig: 'apps/api/tsconfig.app.json',
            assets: ['apps/api/src/assets'],
            webpackConfig: 'apps/api/webpack.config.js',
          },
          configurations: {
            development: {},
            production: {},
          },
        },
        serve: {
          executor: '@nx/js:node',
          defaultConfiguration: 'development',
          options: {
            buildTarget: 'api:build',
          },
          configurations: {
            development: {
              buildTarget: 'api:build:development',
            },
            production: {
              buildTarget: 'api:build:production',
            },
          },
        },
      },
    };
    addProject(tree, project.name, project);
    fs.createFileSync(`${project.root}/project.json`, JSON.stringify(project));
    writeWebpackConfig(
      tree,
      project.root,
      `const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(withNx(), (config) => config);
`
    );

    const result = await update(tree);

    expect(result.nextSteps).toBeUndefined();
    expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');

        // These options were migrated by @nx/webpack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              target: 'node',
              compiler: 'tsc',
              outputPath: '../../dist/apps/api',
              main: './src/main.ts',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/assets'],
            },
          },
        };

        // Determine the correct configValue to use based on the configuration
        const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

        const buildOptions = {
          ...configValues.build.default,
          ...configValues.build[configuration],
        };

        /**
         * @type{import('webpack').WebpackOptionsNormalized}
         */
        module.exports = async () => ({
          plugins: [
            new NxAppWebpackPlugin(buildOptions),
            // NOTE: useLegacyNxPlugin ensures that the non-standard Webpack configuration file previously used still works.
            // To remove its usage, move options such as "plugins" into this file as standard Webpack configuration options.
            // To enhance configurations after Nx plugins have applied, you can add a new plugin with the \\\`apply\\\` method.
            // e.g. \\\`{ apply: (compiler) => { /* modify compiler.options */ }\\\`
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./webpack.config.old.js'), buildOptions),
          ],
        });
        "
      `);
    expect(readProjectConfiguration(tree, project.name).targets)
      .toMatchInlineSnapshot(`
        {
          "build": {
            "defaultConfiguration": "production",
            "outputs": [
              "{workspaceRoot}/dist/apps/api",
            ],
          },
          "serve": {
            "configurations": {
              "development": {
                "buildTarget": "api:build:development",
              },
              "production": {
                "buildTarget": "api:build:production",
              },
            },
            "defaultConfiguration": "development",
            "executor": "@nx/js:node",
            "options": {
              "buildTarget": "api:build",
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
