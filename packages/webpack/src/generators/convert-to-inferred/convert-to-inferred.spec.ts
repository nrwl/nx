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
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from 'nx/src/generators/utils/project-configuration';
import type { WebpackPluginOptions } from '../../plugins/plugin';
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
  jest.doMock(join(fs.tempDir, projectRoot, 'webpack.config.js'), () => ({}), {
    virtual: true,
  });
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

describe('convert-to-inferred', () => {
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
    jest.resetModules();
  });

  describe('--project', () => {
    it('should not convert projects without the "webpackConfig" option set', async () => {
      const project = createProject(tree);
      delete project.targets.build.options.webpackConfig;
      updateProjectConfiguration(tree, project.name, project);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await expect(
        convertToInferred(tree, { project: project.name })
      ).rejects.toThrow(/missing in the project configuration/);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should not convert projects still using "composePlugins"', async () => {
      const project = createProject(tree);
      writeWebpackConfig(
        tree,
        project.root,
        `const { composePlugins, withNx } = require('@nx/webpack');
        const { withReact } = require('@nx/react');

        // Nx plugins for webpack.
        module.exports = composePlugins(
          withNx(),
          withReact({
            // Uncomment this line if you don't want to use SVGR
            // See: https://react-svgr.com/
            // svgr: false
          }),
          (config) => {
            return config;
          }
        );
        `
      );
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await expect(
        convertToInferred(tree, { project: project.name })
      ).rejects.toThrow(/@nx\/webpack:convert-config-to-webpack-plugin"/);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should not convert projects not using "NxAppWebpackPlugin"', async () => {
      const project = createProject(tree);
      writeWebpackConfig(
        tree,
        project.root,
        `module.exports = {
          entry: './src/main.js',
          output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'main.bundle.js',
          },
        };
        `
      );
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await expect(
        convertToInferred(tree, { project: project.name })
      ).rejects.toThrow(/webpack config/);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should register plugin in nx.json', async () => {
      const project = createProject(tree);
      writeWebpackConfig(tree, project.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const webpackPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/webpack/plugin' &&
          plugin.include?.length === 1
      );
      expect(webpackPlugin).toBeTruthy();
      expect(webpackPlugin.include).toEqual([`${project.root}/**/*`]);
      // project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toStrictEqual({
        configurations: { development: {}, production: {} },
        defaultConfiguration: 'production',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should remove "includes" from the plugin registration when all projects are included', async () => {
      const project1 = createProject(tree);
      writeWebpackConfig(tree, project1.root);
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/webpack/plugin',
        options: {
          buildTargetName: 'build',
          previewTargetName: 'preview',
          serveStaticTargetName: 'serve-static',
          serveTargetName: 'serve',
        },
        include: [`${project1.root}/**/*`],
      });
      updateNxJson(tree, nxJson);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      writeWebpackConfig(tree, project2.root);

      await convertToInferred(tree, { project: project2.name });

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const webpackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<WebpackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/webpack/plugin'
      );
      expect(webpackPluginRegistrations.length).toBe(1);
      expect(webpackPluginRegistrations[0].include).toBeUndefined();
    });

    it('should not add to "includes" when existing matching registration does not have it set', async () => {
      const project1 = createProject(tree);
      writeWebpackConfig(tree, project1.root);
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/webpack/plugin',
        options: {
          buildTargetName: 'build',
          previewTargetName: 'preview',
          serveStaticTargetName: 'serve-static',
          serveTargetName: 'serve',
        },
      });
      updateNxJson(tree, nxJson);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      writeWebpackConfig(tree, project2.root);
      const project3 = createProject(tree, {
        appName: 'app3',
        appRoot: 'apps/app3',
      });
      writeWebpackConfig(tree, project3.root);

      await convertToInferred(tree, { project: project2.name });

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const webpackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<WebpackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/webpack/plugin'
      );
      expect(webpackPluginRegistrations.length).toBe(1);
      expect(webpackPluginRegistrations[0].include).toBeUndefined();
    });

    it('should move options to the webpack config file', async () => {
      const project = createProject(tree);
      writeWebpackConfig(tree, project.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // check the updated webpack config
      expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');

        // These options were migrated by @nx/webpack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              compiler: 'babel',
              outputPath: '../../dist/apps/app1',
              index: './src/index.html',
              baseHref: '/',
              main: './src/main.tsx',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/favicon.ico', './src/assets'],
              styles: ['./src/styles.scss'],
            },
            development: {
              extractLicenses: false,
              optimization: false,
              sourceMap: true,
              vendorChunk: true,
            },
            production: {
              fileReplacements: [
                {
                  replace: './src/environments/environment.ts',
                  with: './src/environments/environment.prod.ts',
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
          serve: {
            default: {
              hot: true,
              liveReload: false,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              proxy: { '/api': { target: 'http://localhost:3333', secure: false } },
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hot: false },
          },
        };

        // Determine the correct configValue to use based on the configuration
        const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

        const buildOptions = {
          ...configValues.build.default,
          ...configValues.build[configuration],
        };
        const devServerOptions = {
          ...configValues.serve.default,
          ...configValues.serve[configuration],
        };

        /**
         * @type{import('webpack').WebpackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppWebpackPlugin(buildOptions),
            new NxReactWebpackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./webpack.config.old'), buildOptions),
          ],
        });
        "
      `);
      // project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toStrictEqual({
        configurations: { development: {}, production: {} },
        defaultConfiguration: 'production',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should merge options into the options object in the webpack config file', async () => {
      const project = createProject(tree, undefined, {
        build: {
          main: `${defaultProjectOptions.appRoot}/src/main.tsx`,
          tsConfig: `${defaultProjectOptions.appRoot}/tsconfig.app.json`,
          assets: [
            `${defaultProjectOptions.appRoot}/src/favicon.ico`,
            `${defaultProjectOptions.appRoot}/src/public`,
          ],
          styles: [`${defaultProjectOptions.appRoot}/src/theme.scss`],
        },
      });
      writeWebpackConfig(
        tree,
        project.root,
        `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');
        
        // This file was migrated using @nx/webpack:convert-config-to-webpack-plugin from your './webpack.config.old.js'
        // Please check that the options here are correct as they were moved from the old webpack.config.js to this file.
        const options = {
          assets: ['./src/favicon.ico', './src/assets'],
          styles: ['./src/styles.scss'],
          memoryLimit: 4096,
        };
        
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
        `
      );
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // check the updated webpack config
      expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');

        // These options were migrated by @nx/webpack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              assets: ['./src/favicon.ico', './src/assets'],
              styles: ['./src/styles.scss'],
              memoryLimit: 4096,
              compiler: 'babel',
              outputPath: '../../dist/apps/app1',
              index: './src/index.html',
              baseHref: '/',
              main: './src/main.tsx',
              tsConfig: './tsconfig.app.json',
            },
            development: {
              extractLicenses: false,
              optimization: false,
              sourceMap: true,
              vendorChunk: true,
            },
            production: {
              fileReplacements: [
                {
                  replace: './src/environments/environment.ts',
                  with: './src/environments/environment.prod.ts',
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
          serve: {
            default: {
              hot: true,
              liveReload: false,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              proxy: { '/api': { target: 'http://localhost:3333', secure: false } },
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hot: false },
          },
        };

        // Determine the correct configValue to use based on the configuration
        const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

        const buildOptions = {
          ...configValues.build.default,
          ...configValues.build[configuration],
        };
        const devServerOptions = {
          ...configValues.serve.default,
          ...configValues.serve[configuration],
        };

        /**
         * @type{import('webpack').WebpackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppWebpackPlugin(buildOptions),
            new NxReactWebpackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./webpack.config.old'), buildOptions),
          ],
        });
        "
      `);
      // project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toStrictEqual({
        configurations: { development: {}, production: {} },
        defaultConfiguration: 'production',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should not touch the existing "devServer" option', async () => {
      const project = createProject(tree);
      writeWebpackConfig(
        tree,
        project.root,
        `const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');
        
        // This file was migrated using @nx/webpack:convert-config-to-webpack-plugin from your './webpack.config.old.js'
        // Please check that the options here are correct as they were moved from the old webpack.config.js to this file.
        const options = {};
        
        /**
         * @type{import('webpack').WebpackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: { hot: true },
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
        `
      );
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // check the updated webpack config
      expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8')).toEqual(
        expect.stringContaining(`// This is the untouched "devServer" option from the original webpack config. Please review it and make any necessary changes manually.
  devServer: { hot: true },`)
      );
      // project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toStrictEqual({
        configurations: { development: {}, production: {} },
        defaultConfiguration: 'production',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should keep the "port" value if set', async () => {
      const project = createProject(tree, undefined, {
        serve: { port: 1234 },
      });
      writeWebpackConfig(tree, project.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // check the updated webpack config
      expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8')).toContain(
        'port: 1234,'
      );
      expect(
        tree.read(`${project.root}/webpack.config.js`, 'utf-8')
      ).not.toContain('port: 4200,');
      // project configuration
      const updatedProject = readProjectConfiguration(tree, project.name);
      expect(updatedProject.targets.build).toStrictEqual({
        configurations: { development: {}, production: {} },
        defaultConfiguration: 'production',
      });
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });
  });

  describe('all projects', () => {
    it('should migrate all projects using the webpack executors', async () => {
      const project1 = createProject(tree);
      writeWebpackConfig(tree, project1.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
        buildExecutor: '@nrwl/webpack:webpack',
        serveExecutor: '@nrwl/webpack:dev-server',
      });
      writeWebpackConfig(tree, project2.root);
      const project3 = createProject(tree, {
        appName: 'app3',
        appRoot: 'apps/app3',
        buildTargetName: 'build-webpack',
        serveTargetName: 'serve-webpack',
      });
      writeWebpackConfig(tree, project3.root);
      const project4 = createProject(tree, {
        appName: 'app4',
        appRoot: 'apps/app4',
        buildTargetName: 'build',
        serveTargetName: 'serve-webpack',
      });
      writeWebpackConfig(tree, project4.root);
      const project5 = createProject(tree, {
        appName: 'app5',
        appRoot: 'apps/app5',
        buildTargetName: 'build-webpack',
        serveTargetName: 'serve',
      });
      writeWebpackConfig(tree, project5.root);
      const projectWithComposePlugins = createProject(tree, {
        appName: 'app6',
        appRoot: 'apps/app6',
      });
      const projectWithComposePluginsInitialTargets =
        projectWithComposePlugins.targets;
      const initialProjectWithComposePluginsWebpackConfig = `const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact({
    // Uncomment this line if you don't want to use SVGR
    // See: https://react-svgr.com/
    // svgr: false
  }),
  (config) => {
    return config;
  }
);
`;
      writeWebpackConfig(
        tree,
        projectWithComposePlugins.root,
        initialProjectWithComposePluginsWebpackConfig
      );
      const projectWithNoNxAppWebpackPlugin = createProject(tree, {
        appName: 'app7',
        appRoot: 'apps/app7',
      });
      const projectWithNoNxAppWebpackPluginInitialTargets =
        projectWithNoNxAppWebpackPlugin.targets;
      const initialProjectWithNoNxAppWebpackPluginWebpackConfig = `module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.bundle.js',
  },
};
`;
      writeWebpackConfig(
        tree,
        projectWithNoNxAppWebpackPlugin.root,
        initialProjectWithNoNxAppWebpackPluginWebpackConfig
      );

      await convertToInferred(tree, {});

      // project configurations
      const updatedProject1 = readProjectConfiguration(tree, project1.name);
      expect(updatedProject1.targets).toStrictEqual({
        build: {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'production',
        },
        serve: {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'development',
        },
      });
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets).toStrictEqual({
        build: {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'production',
        },
        serve: {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'development',
        },
      });
      const updatedProject3 = readProjectConfiguration(tree, project3.name);
      expect(updatedProject3.targets).toStrictEqual({
        'build-webpack': {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'production',
        },
        'serve-webpack': {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'development',
        },
      });
      const updatedProject4 = readProjectConfiguration(tree, project4.name);
      expect(updatedProject4.targets).toStrictEqual({
        build: {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'production',
        },
        'serve-webpack': {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'development',
        },
      });
      const updatedProject5 = readProjectConfiguration(tree, project5.name);
      expect(updatedProject5.targets).toStrictEqual({
        'build-webpack': {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'production',
        },
        serve: {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'development',
        },
      });
      const updatedProjectWithComposePlugins = readProjectConfiguration(
        tree,
        projectWithComposePlugins.name
      );
      expect(updatedProjectWithComposePlugins.targets).toStrictEqual(
        projectWithComposePluginsInitialTargets
      );
      const updatedProjectWithNoNxAppWebpackPlugin = readProjectConfiguration(
        tree,
        projectWithNoNxAppWebpackPlugin.name
      );
      expect(updatedProjectWithNoNxAppWebpackPlugin.targets).toStrictEqual(
        projectWithNoNxAppWebpackPluginInitialTargets
      );
      // webpack config files
      const project1WebpackConfig = tree.read(
        `${project1.root}/webpack.config.js`,
        'utf-8'
      );
      expect(project1WebpackConfig).toMatchSnapshot();
      const project2WebpackConfig = tree.read(
        `${project2.root}/webpack.config.js`,
        'utf-8'
      );
      expect(project2WebpackConfig).toMatchSnapshot();
      const project3WebpackConfig = tree.read(
        `${project3.root}/webpack.config.js`,
        'utf-8'
      );
      expect(project3WebpackConfig).toMatchSnapshot();
      const updatedProjectWithComposePluginsWebpackConfig = tree.read(
        `${projectWithComposePlugins.root}/webpack.config.js`,
        'utf-8'
      );
      expect(updatedProjectWithComposePluginsWebpackConfig).toBe(
        initialProjectWithComposePluginsWebpackConfig
      );
      const updatedProjectWithNoNxAppWebpackPluginWebpackConfig = tree.read(
        `${projectWithNoNxAppWebpackPlugin.root}/webpack.config.js`,
        'utf-8'
      );
      expect(updatedProjectWithNoNxAppWebpackPluginWebpackConfig).toBe(
        initialProjectWithNoNxAppWebpackPluginWebpackConfig
      );
      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const webpackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<WebpackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/webpack/plugin'
      );
      expect(webpackPluginRegistrations.length).toBe(4);
      expect(webpackPluginRegistrations[0].options.buildTargetName).toBe(
        'build'
      );
      expect(webpackPluginRegistrations[0].options.serveTargetName).toBe(
        'serve'
      );
      expect(webpackPluginRegistrations[0].include).toEqual([
        `${project1.root}/**/*`,
        `${project2.root}/**/*`,
      ]);
      expect(webpackPluginRegistrations[1].options.buildTargetName).toBe(
        'build'
      );
      expect(webpackPluginRegistrations[1].options.serveTargetName).toBe(
        'serve-webpack'
      );
      expect(webpackPluginRegistrations[1].include).toEqual([
        `${project4.root}/**/*`,
      ]);
      expect(webpackPluginRegistrations[2].options.buildTargetName).toBe(
        'build-webpack'
      );
      expect(webpackPluginRegistrations[2].options.serveTargetName).toBe(
        'serve-webpack'
      );
      expect(webpackPluginRegistrations[2].include).toEqual([
        `${project3.root}/**/*`,
      ]);
      expect(webpackPluginRegistrations[3].options.buildTargetName).toBe(
        'build-webpack'
      );
      expect(webpackPluginRegistrations[3].options.serveTargetName).toBe(
        'serve'
      );
      expect(webpackPluginRegistrations[3].include).toEqual([
        `${project5.root}/**/*`,
      ]);
    });

    it('should remove "includes" from the plugin registration when all projects are included', async () => {
      const project1 = createProject(tree);
      writeWebpackConfig(tree, project1.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
        buildExecutor: '@nrwl/webpack:webpack',
        serveExecutor: '@nrwl/webpack:dev-server',
      });
      writeWebpackConfig(tree, project2.root);

      await convertToInferred(tree, {});

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const webpackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<WebpackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/webpack/plugin'
      );
      expect(webpackPluginRegistrations.length).toBe(1);
      expect(webpackPluginRegistrations[0].include).toBeUndefined();
    });

    it('should keep the higher "memoryLimit" value in the build configuration', async () => {
      const project = createProject(tree, undefined, {
        build: { memoryLimit: 4096 },
        serve: { memoryLimit: 8192 }, // higher value, should be set in the build configuration
      });
      writeWebpackConfig(tree, project.root);
      const project2 = createProject(
        tree,
        { appName: 'app2', appRoot: 'apps/app2' },
        {
          build: { memoryLimit: 8192 }, // higher value, should be kept in the build configuration
          serve: { memoryLimit: 4096 },
        }
      );
      writeWebpackConfig(tree, project2.root);

      await convertToInferred(tree, {});

      // check the updated webpack config
      expect(tree.read(`${project.root}/webpack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');

        // These options were migrated by @nx/webpack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              compiler: 'babel',
              outputPath: '../../dist/apps/app1',
              index: './src/index.html',
              baseHref: '/',
              main: './src/main.tsx',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/favicon.ico', './src/assets'],
              styles: ['./src/styles.scss'],
              memoryLimit: 8192,
            },
            development: {
              extractLicenses: false,
              optimization: false,
              sourceMap: true,
              vendorChunk: true,
            },
            production: {
              fileReplacements: [
                {
                  replace: './src/environments/environment.ts',
                  with: './src/environments/environment.prod.ts',
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
          serve: {
            default: {
              hot: true,
              liveReload: false,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              proxy: { '/api': { target: 'http://localhost:3333', secure: false } },
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hot: false },
          },
        };

        // Determine the correct configValue to use based on the configuration
        const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

        const buildOptions = {
          ...configValues.build.default,
          ...configValues.build[configuration],
        };
        const devServerOptions = {
          ...configValues.serve.default,
          ...configValues.serve[configuration],
        };

        /**
         * @type{import('webpack').WebpackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppWebpackPlugin(buildOptions),
            new NxReactWebpackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./webpack.config.old'), buildOptions),
          ],
        });
        "
      `);
      expect(tree.read(`${project2.root}/webpack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
        const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
        const { useLegacyNxPlugin } = require('@nx/webpack');

        // These options were migrated by @nx/webpack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              compiler: 'babel',
              outputPath: '../../dist/apps/app2',
              index: './src/index.html',
              baseHref: '/',
              main: './src/main.tsx',
              tsConfig: './tsconfig.app.json',
              assets: ['./src/favicon.ico', './src/assets'],
              styles: ['./src/styles.scss'],
              memoryLimit: 8192,
            },
            development: {
              extractLicenses: false,
              optimization: false,
              sourceMap: true,
              vendorChunk: true,
            },
            production: {
              fileReplacements: [
                {
                  replace: './src/environments/environment.ts',
                  with: './src/environments/environment.prod.ts',
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
          serve: {
            default: {
              hot: true,
              liveReload: false,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              proxy: { '/api': { target: 'http://localhost:3333', secure: false } },
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hot: false },
          },
        };

        // Determine the correct configValue to use based on the configuration
        const configuration = process.env.NX_TASK_TARGET_CONFIGURATION || 'default';

        const buildOptions = {
          ...configValues.build.default,
          ...configValues.build[configuration],
        };
        const devServerOptions = {
          ...configValues.serve.default,
          ...configValues.serve[configuration],
        };

        /**
         * @type{import('webpack').WebpackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppWebpackPlugin(buildOptions),
            new NxReactWebpackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./webpack.config.old'), buildOptions),
          ],
        });
        "
      `);
    });
  });
});
