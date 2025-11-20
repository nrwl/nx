import {
  ProjectConfiguration,
  Tree,
  addProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import convertConfigToRspackPluginGenerator from './convert-config-to-rspack-plugin';

interface CreateProjectOptions {
  name: string;
  root: string;
  targetName: string;
  targetOptions: Record<string, unknown>;
  additionalTargets?: Record<string, unknown>;
}

const defaultOptions: CreateProjectOptions = {
  name: 'my-app',
  root: 'my-app',
  targetName: 'build',
  targetOptions: {},
};

function createProject(tree: Tree, options: Partial<CreateProjectOptions>) {
  const projectOpts = {
    ...defaultOptions,
    ...options,
    targetOptions: {
      ...defaultOptions.targetOptions,
      ...options?.targetOptions,
    },
  };
  const project: ProjectConfiguration = {
    name: projectOpts.name,
    root: projectOpts.root,
    targets: {
      build: {
        executor: '@nx/rspack:rspack',
        options: {
          rspackConfig: `${projectOpts.root}/rspack.config.js`,
          ...projectOpts.targetOptions,
        },
      },
      ...options.additionalTargets,
    },
  };

  addProjectConfiguration(tree, project.name, project);

  return project;
}

describe('convertConfigToRspackPluginGenerator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should migrate the rspack config of the specified project', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
    });

    createProject(tree, {
      name: 'another-app',
      root: 'another-app',
    });

    tree.write(
      'another-app/rspack.config.js',
      `
      const { composePlugins, withNx } = require('@nx/rspack');
      const { withReact } = require('@nx/rspack');

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

    tree.write(
      `${project.name}/rspack.config.js`,
      `
      const { composePlugins, withNx } = require('@nx/rspack');
      const { withReact } = require('@nx/rspack');

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

    await convertConfigToRspackPluginGenerator(tree, {
      project: project.name,
    });
    expect(tree.read(`${project.name}/rspack.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
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
          new NxAppRspackPlugin(),
          new NxReactRspackPlugin({
            // Uncomment this line if you don't want to use SVGR
            // See: https://react-svgr.com/
            // svgr: false
          }),
          // NOTE: useLegacyNxPlugin ensures that the non-standard Rspack configuration file previously used still works.
          // To remove its usage, move options such as "plugins" into this file as standard Rspack configuration options.
          // To enhance configurations after Nx plugins have applied, you can add a new plugin with the \\\`apply\\\` method.
          // e.g. \\\`{ apply: (compiler) => { /* modify compiler.options */ }\\\`
          // eslint-disable-next-line react-hooks/rules-of-hooks
          await useLegacyNxPlugin(require('./rspack.config.old'), options),
        ],
      });
      "
    `);

    expect(tree.read(`${project.name}/rspack.config.old.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { composePlugins } = require('@nx/rspack');
      // Nx plugins for rspack.
      module.exports = composePlugins((config) => {
        return config;
      });
      "
    `);

    expect(tree.read(`another-app/rspack.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { composePlugins, withNx } = require('@nx/rspack');
      const { withReact } = require('@nx/rspack');

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
      "
    `);

    expect(tree.exists(`${project.name}/rspack.config.old.js`)).toBe(true);
    expect(tree.exists(`another-app/rspack.config.old.js`)).toBe(false);
  });

  it('should update project.json adding the standardRspackConfigFunction option', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
    });

    tree.write(
      `${project.name}/rspack.config.js`,
      `
      const { composePlugins, withNx } = require('@nx/rspack');
      const { withReact } = require('@nx/rspack');

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

    await convertConfigToRspackPluginGenerator(tree, {
      project: project.name,
    });

    expect(tree.read(`${project.name}/project.json`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "{
        "name": "my-app",
        "$schema": "../node_modules/nx/schemas/project-schema.json",
        "targets": {
          "build": {
            "executor": "@nx/rspack:rspack",
            "options": {
              "rspackConfig": "my-app/rspack.config.js",
              "standardRspackConfigFunction": true
            }
          }
        }
      }
      "
    `);
  });

  it('should throw an error if no projects are found', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
    });

    await expect(
      convertConfigToRspackPluginGenerator(tree, {
        project: project.name,
      })
    ).rejects.toThrow('Could not find any projects to migrate.');
  });

  it('should not migrate a rspack config that does not use withNx', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
    });

    tree.write(`${project.name}/rspack.config.js`, `module.exports = {};`);

    await expect(
      convertConfigToRspackPluginGenerator(tree, {
        project: project.name,
      })
    ).rejects.toThrow('Could not find any projects to migrate.');

    expect(
      tree.read(`${project.name}/rspack.config.js`, 'utf-8')
    ).toMatchInlineSnapshot(`"module.exports = {};"`);
  });

  it('should throw an error if the project is using Module federation', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
      additionalTargets: {
        serve: {
          executor: '@nx/rspack:module-federation-dev-server',
          options: {
            buildTarget: 'my-app:build',
          },
        },
      },
    });

    await expect(
      convertConfigToRspackPluginGenerator(tree, { project: project.name })
    ).rejects.toThrow(
      `The project ${project.name} is using Module Federation. At the moment, we don't support migrating projects that use Module Federation.`
    );
  });

  it('should throw an error if the project is a Nest project', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
      additionalTargets: {
        serve: {
          executor: '@nx/js:node',
          options: {
            buildTarget: 'my-app:build',
          },
        },
      },
    });

    await expect(
      convertConfigToRspackPluginGenerator(tree, { project: project.name })
    ).rejects.toThrow(
      `The project ${project.name} is using the '@nx/js:node' executor. At the moment, we do not support migrating such projects.`
    );
  });

  it('should not migrate a rspack config that is already using NxAppRspackPlugin', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'my-app',
    });

    tree.write(
      `${project.name}/rspack.config.js`,
      `
      const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');

      module.exports = {
        plugins: [
          new NxAppRspackPlugin(),
        ],
      };
    `
    );

    await expect(
      convertConfigToRspackPluginGenerator(tree, { project: project.name })
    ).rejects.toThrow(`Could not find any projects to migrate.`);
    expect(tree.read(`${project.name}/rspack.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "
            const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');

            module.exports = {
              plugins: [
                new NxAppRspackPlugin(),
              ],
            };
          "
    `);
    expect(tree.exists(`${project.name}/rspack.config.old.js`)).toBe(false);
  });

  it('should convert absolute options paths to relative paths during the conversion', async () => {
    const project = createProject(tree, {
      name: 'my-app',
      root: 'apps/my-app',
    });

    tree.write(
      `${project.root}/rspack.config.js`,
      `
      const { composePlugins, withNx } = require('@nx/rspack');
      const { withReact } = require('@nx/rspack');

      // Nx plugins for rspack.
      module.exports = composePlugins(
        withNx({
          assets: ["apps/${project.name}/src/favicon.ico","apps/${project.name}/src/assets"],
          styles: ["apps/${project.name}/src/styles.scss"],
          scripts: ["apps/${project.name}/src/scripts.js"],
          tsConfig: "apps/${project.name}/tsconfig.app.json",
          fileReplacements: [
            {
              replace: "apps/${project.name}/src/environments/environment.ts",
              with: "apps/${project.name}/src/environments/environment.prod.ts"
            }
          ],
          additionalEntryPoints: [
            {
              entryPath: "apps/${project.name}/src/polyfills.ts",
            }
          ]
        }),
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

    await convertConfigToRspackPluginGenerator(tree, {
      project: project.name,
    });
    expect(tree.read(`${project.root}/rspack.config.js`, 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { NxAppRspackPlugin } = require('@nx/rspack/app-plugin');
      const { NxReactRspackPlugin } = require('@nx/rspack/react-plugin');
      const { useLegacyNxPlugin } = require('@nx/rspack');

      // This file was migrated using @nx/rspack:convert-config-to-rspack-plugin from your './rspack.config.old.js'
      // Please check that the options here are correct as they were moved from the old rspack.config.js to this file.
      const options = {
        assets: ['./src/favicon.ico', './src/assets'],
        styles: ['./src/styles.scss'],
        scripts: ['./src/scripts.js'],
        tsConfig: './tsconfig.app.json',
        fileReplacements: [
          {
            replace: './src/environments/environment.ts',
            with: './src/environments/environment.prod.ts',
          },
        ],
        additionalEntryPoints: [
          {
            entryPath: './src/polyfills.ts',
          },
        ],
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
          // NOTE: useLegacyNxPlugin ensures that the non-standard Rspack configuration file previously used still works.
          // To remove its usage, move options such as "plugins" into this file as standard Rspack configuration options.
          // To enhance configurations after Nx plugins have applied, you can add a new plugin with the \\\`apply\\\` method.
          // e.g. \\\`{ apply: (compiler) => { /* modify compiler.options */ }\\\`
          // eslint-disable-next-line react-hooks/rules-of-hooks
          await useLegacyNxPlugin(require('./rspack.config.old'), options),
        ],
      });
      "
    `);
  });
});
