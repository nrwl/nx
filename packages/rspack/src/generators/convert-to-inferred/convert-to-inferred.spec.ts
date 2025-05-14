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
  detectPackageManager,
} from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { join } from 'node:path';
import { getRelativeProjectJsonSchemaPath } from 'nx/src/generators/utils/project-configuration';
import type { RspackPluginOptions } from '../../plugins/plugin';
import { convertToInferred } from './convert-to-inferred';
import { getLockFileName } from '@nx/js';

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
        .getExecutorInformation('@nx/rspack', ...args)
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
  buildExecutor: '@nx/rspack:rspack',
  serveTargetName: 'serve',
  serveExecutor: '@nx/rspack:dev-server',
};

const defaultRspackConfig = `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
const { useLegacyNxPlugin } = require('@nx/rspack');

// This file was migrated using @nx/rspack:convert-config-to-rspack-plugin from your './rspack.config.old.js'
// Please check that the options here are correct as they were moved from the old rspack.config.js to this file.
const options = {};

/**
 * @type{import('@rspack/core').RspackOptionsNormalized}
 */
module.exports = async () => ({
  plugins: [
    new NxAppRspackPlugin(options),
    new NxReactRspackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await useLegacyNxPlugin(require('./rspack.config.old'), options),
  ],
});
`;

function writeRspackConfig(
  tree: Tree,
  projectRoot: string,
  rspackConfig = defaultRspackConfig
) {
  tree.write(`${projectRoot}/rspack.config.js`, rspackConfig);
  fs.createFileSync(`${projectRoot}/rspack.config.js`, rspackConfig);
  jest.doMock(join(fs.tempDir, projectRoot, 'rspack.config.js'), () => ({}), {
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
          rspackConfig: `${projectOpts.appRoot}/rspack.config.js`,
          outputPath: `dist/${projectOpts.appRoot}`,
          index: `${projectOpts.appRoot}/src/index.html`,
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

  writeRspackConfig(tree, projectOpts.appRoot, `module.exports = {};`);

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
    fs = new TempFs('rspack');
    tree = createTreeWithEmptyWorkspace();
    tree.root = fs.tempDir;
    const lockFileName = getLockFileName(detectPackageManager(fs.tempDir));
    fs.createFileSync(lockFileName, '');
    tree.write(lockFileName, '');

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
    it('should not convert projects without the "rspackConfig" option set', async () => {
      const project = createProject(tree);
      delete project.targets.build.options.rspackConfig;
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
      writeRspackConfig(
        tree,
        project.root,
        `const { composePlugins, withNx } = require('@nx/rspack');
        const { withReact } = require('@nx/react');

        // Nx plugins for rspack.
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
      ).rejects.toThrow(/@nx\/rspack:convert-config-to-rspack-plugin"/);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should not convert projects not using "NxAppRspackPlugin"', async () => {
      const project = createProject(tree);
      writeRspackConfig(
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
      ).rejects.toThrow(/rspack config/);
      // assert other projects were not modified
      const updatedProject2 = readProjectConfiguration(tree, project2.name);
      expect(updatedProject2.targets.build).toStrictEqual(project2BuildTarget);
    });

    it('should register plugin in nx.json', async () => {
      const project = createProject(tree);
      writeRspackConfig(tree, project.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // assert plugin was added to nx.json
      const nxJsonPlugins = readNxJson(tree).plugins;
      const rspackPlugin = nxJsonPlugins.find(
        (plugin): plugin is ExpandedPluginConfiguration =>
          typeof plugin !== 'string' &&
          plugin.plugin === '@nx/rspack/plugin' &&
          plugin.include?.length === 1
      );
      expect(rspackPlugin).toBeTruthy();
      expect(rspackPlugin.include).toEqual([`${project.root}/**/*`]);
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
      writeRspackConfig(tree, project1.root);
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/rspack/plugin',
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
      writeRspackConfig(tree, project2.root);

      await convertToInferred(tree, { project: project2.name });

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const rspackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<RspackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/rspack/plugin'
      );
      expect(rspackPluginRegistrations.length).toBe(1);
      expect(rspackPluginRegistrations[0].include).toBeUndefined();
    });

    it('should not add to "includes" when existing matching registration does not have it set', async () => {
      const project1 = createProject(tree);
      writeRspackConfig(tree, project1.root);
      const nxJson = readNxJson(tree);
      nxJson.plugins ??= [];
      nxJson.plugins.push({
        plugin: '@nx/rspack/plugin',
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
      writeRspackConfig(tree, project2.root);
      const project3 = createProject(tree, {
        appName: 'app3',
        appRoot: 'apps/app3',
      });
      writeRspackConfig(tree, project3.root);

      await convertToInferred(tree, { project: project2.name });

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const rspackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<RspackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/rspack/plugin'
      );
      expect(rspackPluginRegistrations.length).toBe(1);
      expect(rspackPluginRegistrations[0].include).toBeUndefined();
    });

    it('should move options to the rspack config file', async () => {
      const project = createProject(tree);
      writeRspackConfig(tree, project.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // check the updated rspack config
      expect(tree.read(`${project.root}/rspack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
        const { useLegacyNxPlugin } = require('@nx/rspack');

        // These options were migrated by @nx/rspack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              outputPath: '../../dist/apps/app1',
              index: './src/index.html',
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
              hmr: true,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hmr: false },
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
         * @type{import('@rspack/core').RspackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppRspackPlugin(buildOptions),
            new NxReactRspackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./rspack.config.old'), buildOptions),
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

    it('should merge options into the options object in the rspack config file', async () => {
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
      writeRspackConfig(
        tree,
        project.root,
        `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
        const { useLegacyNxPlugin } = require('@nx/rspack');
        
        // This file was migrated using @nx/rspack:convert-config-to-rspack-plugin from your './rspack.config.old.js'
        // Please check that the options here are correct as they were moved from the old rspack.config.js to this file.
        const options = {
          assets: ['./src/favicon.ico', './src/assets'],
          styles: ['./src/styles.scss'],
          memoryLimit: 4096,
        };
        
        /**
         * @type{import('@rspack/core').RspackOptionsNormalized}
         */
        module.exports = async () => ({
          plugins: [
            new NxAppRspackPlugin(options),
            new NxReactRspackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./rspack.config.old'), options),
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

      // check the updated rspack config
      expect(tree.read(`${project.root}/rspack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
        const { useLegacyNxPlugin } = require('@nx/rspack');

        // These options were migrated by @nx/rspack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              assets: ['./src/favicon.ico', './src/assets'],
              styles: ['./src/styles.scss'],
              memoryLimit: 4096,
              outputPath: '../../dist/apps/app1',
              index: './src/index.html',
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
              hmr: true,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hmr: false },
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
         * @type{import('@rspack/core').RspackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppRspackPlugin(buildOptions),
            new NxReactRspackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./rspack.config.old'), buildOptions),
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
      writeRspackConfig(
        tree,
        project.root,
        `const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
        const { useLegacyNxPlugin } = require('@nx/rspack');
        
        // This file was migrated using @nx/rspack:convert-config-to-rspack-plugin from your './rspack.config.old.js'
        // Please check that the options here are correct as they were moved from the old rspack.config.js to this file.
        const options = {};
        
        /**
         * @type{import('@rspack/core').RspackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: { hot: true },
          plugins: [
            new NxAppRspackPlugin(options),
            new NxReactRspackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./rspack.config.old'), options),
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

      // check the updated rspack config
      expect(tree.read(`${project.root}/rspack.config.js`, 'utf-8')).toEqual(
        expect.stringContaining(`// This is the untouched "devServer" option from the original rspack config. Please review it and make any necessary changes manually.
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
      writeRspackConfig(tree, project.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
      });
      const project2BuildTarget = project2.targets.build;

      await convertToInferred(tree, { project: project.name });

      // check the updated rspack config
      expect(tree.read(`${project.root}/rspack.config.js`, 'utf-8')).toContain(
        'port: 1234,'
      );
      expect(
        tree.read(`${project.root}/rspack.config.js`, 'utf-8')
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
    it('should migrate all projects using the rspack executors', async () => {
      const project1 = createProject(tree);
      writeRspackConfig(tree, project1.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
        buildExecutor: '@nrwl/rspack:rspack',
        serveExecutor: '@nrwl/rspack:dev-server',
      });
      writeRspackConfig(tree, project2.root);
      const project3 = createProject(tree, {
        appName: 'app3',
        appRoot: 'apps/app3',
        buildTargetName: 'build-rspack',
        serveTargetName: 'serve-rspack',
      });
      writeRspackConfig(tree, project3.root);
      const project4 = createProject(tree, {
        appName: 'app4',
        appRoot: 'apps/app4',
        buildTargetName: 'build',
        serveTargetName: 'serve-rspack',
      });
      writeRspackConfig(tree, project4.root);
      const project5 = createProject(tree, {
        appName: 'app5',
        appRoot: 'apps/app5',
        buildTargetName: 'build-rspack',
        serveTargetName: 'serve',
      });
      writeRspackConfig(tree, project5.root);
      const projectWithComposePlugins = createProject(tree, {
        appName: 'app6',
        appRoot: 'apps/app6',
      });
      const projectWithComposePluginsInitialTargets =
        projectWithComposePlugins.targets;
      const initialProjectWithComposePluginsRspackConfig = `const { composePlugins, withNx } = require('@nx/rspack');
const { withReact } = require('@nx/react');

// Nx plugins for rspack.
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
      writeRspackConfig(
        tree,
        projectWithComposePlugins.root,
        initialProjectWithComposePluginsRspackConfig
      );
      const projectWithNoNxAppRspackPlugin = createProject(tree, {
        appName: 'app7',
        appRoot: 'apps/app7',
      });
      const projectWithNoNxAppRspackPluginInitialTargets =
        projectWithNoNxAppRspackPlugin.targets;
      const initialProjectWithNoNxAppRspackPluginRspackConfig = `module.exports = {
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.bundle.js',
  },
};
`;
      writeRspackConfig(
        tree,
        projectWithNoNxAppRspackPlugin.root,
        initialProjectWithNoNxAppRspackPluginRspackConfig
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
        'build-rspack': {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'production',
        },
        'serve-rspack': {
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
        'serve-rspack': {
          configurations: { development: {}, production: {} },
          defaultConfiguration: 'development',
        },
      });
      const updatedProject5 = readProjectConfiguration(tree, project5.name);
      expect(updatedProject5.targets).toStrictEqual({
        'build-rspack': {
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
      const updatedProjectWithNoNxAppRspackPlugin = readProjectConfiguration(
        tree,
        projectWithNoNxAppRspackPlugin.name
      );
      expect(updatedProjectWithNoNxAppRspackPlugin.targets).toStrictEqual(
        projectWithNoNxAppRspackPluginInitialTargets
      );
      // rspack config files
      const project1RspackConfig = tree.read(
        `${project1.root}/rspack.config.js`,
        'utf-8'
      );
      expect(project1RspackConfig).toMatchSnapshot();
      const project2RspackConfig = tree.read(
        `${project2.root}/rspack.config.js`,
        'utf-8'
      );
      expect(project2RspackConfig).toMatchSnapshot();
      const project3RspackConfig = tree.read(
        `${project3.root}/rspack.config.js`,
        'utf-8'
      );
      expect(project3RspackConfig).toMatchSnapshot();
      const updatedProjectWithComposePluginsRspackConfig = tree.read(
        `${projectWithComposePlugins.root}/rspack.config.js`,
        'utf-8'
      );
      expect(updatedProjectWithComposePluginsRspackConfig).toBe(
        initialProjectWithComposePluginsRspackConfig
      );
      const updatedProjectWithNoNxAppRspackPluginRspackConfig = tree.read(
        `${projectWithNoNxAppRspackPlugin.root}/rspack.config.js`,
        'utf-8'
      );
      expect(updatedProjectWithNoNxAppRspackPluginRspackConfig).toBe(
        initialProjectWithNoNxAppRspackPluginRspackConfig
      );
      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const rspackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<RspackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/rspack/plugin'
      );
      expect(rspackPluginRegistrations.length).toBe(4);
      expect(rspackPluginRegistrations[0].options.buildTargetName).toBe(
        'build'
      );
      expect(rspackPluginRegistrations[0].options.serveTargetName).toBe(
        'serve'
      );
      expect(rspackPluginRegistrations[0].include).toEqual([
        `${project1.root}/**/*`,
        `${project2.root}/**/*`,
      ]);
      expect(rspackPluginRegistrations[1].options.buildTargetName).toBe(
        'build'
      );
      expect(rspackPluginRegistrations[1].options.serveTargetName).toBe(
        'serve-rspack'
      );
      expect(rspackPluginRegistrations[1].include).toEqual([
        `${project4.root}/**/*`,
      ]);
      expect(rspackPluginRegistrations[2].options.buildTargetName).toBe(
        'build-rspack'
      );
      expect(rspackPluginRegistrations[2].options.serveTargetName).toBe(
        'serve-rspack'
      );
      expect(rspackPluginRegistrations[2].include).toEqual([
        `${project3.root}/**/*`,
      ]);
      expect(rspackPluginRegistrations[3].options.buildTargetName).toBe(
        'build-rspack'
      );
      expect(rspackPluginRegistrations[3].options.serveTargetName).toBe(
        'serve'
      );
      expect(rspackPluginRegistrations[3].include).toEqual([
        `${project5.root}/**/*`,
      ]);
    });

    it('should remove "includes" from the plugin registration when all projects are included', async () => {
      const project1 = createProject(tree);
      writeRspackConfig(tree, project1.root);
      const project2 = createProject(tree, {
        appName: 'app2',
        appRoot: 'apps/app2',
        buildExecutor: '@nrwl/rspack:rspack',
        serveExecutor: '@nrwl/rspack:dev-server',
      });
      writeRspackConfig(tree, project2.root);

      await convertToInferred(tree, {});

      // nx.json modifications
      const nxJsonPlugins = readNxJson(tree).plugins;
      const rspackPluginRegistrations = nxJsonPlugins.filter(
        (plugin): plugin is ExpandedPluginConfiguration<RspackPluginOptions> =>
          typeof plugin !== 'string' && plugin.plugin === '@nx/rspack/plugin'
      );
      expect(rspackPluginRegistrations.length).toBe(1);
      expect(rspackPluginRegistrations[0].include).toBeUndefined();
    });

    it('should keep the higher "memoryLimit" value in the build configuration', async () => {
      const project = createProject(tree, undefined, {
        build: { memoryLimit: 4096 },
        serve: { memoryLimit: 8192 }, // higher value, should be set in the build configuration
      });
      writeRspackConfig(tree, project.root);
      const project2 = createProject(
        tree,
        { appName: 'app2', appRoot: 'apps/app2' },
        {
          build: { memoryLimit: 8192 }, // higher value, should be kept in the build configuration
          serve: { memoryLimit: 4096 },
        }
      );
      writeRspackConfig(tree, project2.root);

      await convertToInferred(tree, {});

      // check the updated rspack config
      expect(tree.read(`${project.root}/rspack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
        const { useLegacyNxPlugin } = require('@nx/rspack');

        // These options were migrated by @nx/rspack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              outputPath: '../../dist/apps/app1',
              index: './src/index.html',
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
              hmr: true,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              memoryLimit: 8192,
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hmr: false },
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
         * @type{import('@rspack/core').RspackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppRspackPlugin(buildOptions),
            new NxReactRspackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./rspack.config.old'), buildOptions),
          ],
        });
        "
      `);
      expect(tree.read(`${project2.root}/rspack.config.js`, 'utf-8'))
        .toMatchInlineSnapshot(`
        "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
        const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
        const { useLegacyNxPlugin } = require('@nx/rspack');

        // These options were migrated by @nx/rspack:convert-to-inferred from
        // the project.json file and merged with the options in this file
        const configValues = {
          build: {
            default: {
              outputPath: '../../dist/apps/app2',
              index: './src/index.html',
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
              hmr: true,
              server: {
                type: 'https',
                options: { cert: './server.crt', key: './server.key' },
              },
              memoryLimit: 4096,
              port: 4200,
              headers: { 'Access-Control-Allow-Origin': '*' },
              historyApiFallback: {
                index: '/index.html',
                disableDotRule: true,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
              },
            },
            development: { open: true },
            production: { hmr: false },
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
         * @type{import('@rspack/core').RspackOptionsNormalized}
         */
        module.exports = async () => ({
          devServer: devServerOptions,
          plugins: [
            new NxAppRspackPlugin(buildOptions),
            new NxReactRspackPlugin({
              // Uncomment this line if you don't want to use SVGR
              // See: https://react-svgr.com/
              // svgr: false
            }),
            // eslint-disable-next-line react-hooks/rules-of-hooks
            await useLegacyNxPlugin(require('./rspack.config.old'), buildOptions),
          ],
        });
        "
      `);
    });
  });
});
