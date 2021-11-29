import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { updateScriptType } from './update-mfe-webpack-config';
import updateMfeWebpackConfig from './update-mfe-webpack-config';

describe('update-mfe-webpack-config migration', () => {
  it('should migrate the webpack config for one app', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app', {
      root: 'apps/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: { path: 'apps/testing/webpack.config.js' },
          },
        },
      },
    });

    const webpackConfig = `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
    const mf = require('@angular-architects/module-federation/webpack');
    const path = require('path');
    
    /**
     * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
     * builder as it will generate a temporary tsconfig file which contains any required remappings of
     * shred libraries.
     * A remapping will occur when a library is buildable, as webpack needs to know the location of the
     * built files for the buildable library.
     * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
     * the location of the generated temporary tsconfig file.
     */
    const tsConfigPath =
      process.env.NX_TSCONFIG_PATH ??
      path.join(__dirname, '../../tsconfig.base.json');
    
    const workspaceRootPath = path.join(__dirname, '../../');
    const sharedMappings = new mf.SharedMappings();
    sharedMappings.register(
      tsConfigPath,
      [
        /* mapped paths to share */
      ],
      workspaceRootPath
    );
    
    module.exports = {
      output: {
        uniqueName: 'login',
        publicPath: 'auto',
      },
      optimization: {
        runtimeChunk: false,
        minimize: false,
      },
      resolve: {
        alias: {
          ...sharedMappings.getAliases(),
        },
      },
      plugins: [
        new ModuleFederationPlugin({
          name: 'login',
          filename: 'remoteEntry.mjs',
          exposes: {
            './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
          },
          shared: {
            '@angular/core': { singleton: true, strictVersion: true },
            '@angular/common': { singleton: true, strictVersion: true },
            '@angular/common/http': { singleton: true, strictVersion: true },
            '@angular/router': { singleton: true, strictVersion: true },
            ...sharedMappings.getDescriptors(),
          },
        }),
        sharedMappings.getPlugin(),
      ],
    };
    `;

    tree.write('apps/testing/webpack.config.js', webpackConfig);

    // ACT
    await updateMfeWebpackConfig(tree);

    // ASSERT
    const updatedWebpackFile = tree.read(
      'apps/testing/webpack.config.js',
      'utf-8'
    );
    expect(updatedWebpackFile).toMatchInlineSnapshot(`
      "const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
          const mf = require('@angular-architects/module-federation/webpack');
          const path = require('path');
          
          /**
           * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
           * builder as it will generate a temporary tsconfig file which contains any required remappings of
           * shred libraries.
           * A remapping will occur when a library is buildable, as webpack needs to know the location of the
           * built files for the buildable library.
           * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
           * the location of the generated temporary tsconfig file.
           */
          const tsConfigPath =
            process.env.NX_TSCONFIG_PATH ??
            path.join(__dirname, '../../tsconfig.base.json');
          
          const workspaceRootPath = path.join(__dirname, '../../');
          const sharedMappings = new mf.SharedMappings();
          sharedMappings.register(
            tsConfigPath,
            [
              /* mapped paths to share */
            ],
            workspaceRootPath
          );
          
          module.exports = {
            output: {
              uniqueName: 'login',
              publicPath: 'auto',
      scriptType: 'text/javascript',
            },
            optimization: {
              runtimeChunk: false,
              minimize: false,
            },
            resolve: {
              alias: {
                ...sharedMappings.getAliases(),
              },
            },
            plugins: [
              new ModuleFederationPlugin({
                name: 'login',
                filename: 'remoteEntry.mjs',
                exposes: {
                  './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
                },
                shared: {
                  '@angular/core': { singleton: true, strictVersion: true },
                  '@angular/common': { singleton: true, strictVersion: true },
                  '@angular/common/http': { singleton: true, strictVersion: true },
                  '@angular/router': { singleton: true, strictVersion: true },
                  ...sharedMappings.getDescriptors(),
                },
              }),
              sharedMappings.getPlugin(),
            ],
          };
          "
    `);
  });

  it('should migrate the webpack config for multiple apps', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app', {
      root: 'apps/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: { path: 'apps/testing/webpack.config.js' },
          },
        },
      },
    });
    addProjectConfiguration(tree, 'other', {
      root: 'apps/other',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: { path: 'apps/other/webpack.config.js' },
          },
        },
      },
    });

    const webpackConfig = `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
    const mf = require('@angular-architects/module-federation/webpack');
    const path = require('path');
    
    /**
     * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
     * builder as it will generate a temporary tsconfig file which contains any required remappings of
     * shred libraries.
     * A remapping will occur when a library is buildable, as webpack needs to know the location of the
     * built files for the buildable library.
     * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
     * the location of the generated temporary tsconfig file.
     */
    const tsConfigPath =
      process.env.NX_TSCONFIG_PATH ??
      path.join(__dirname, '../../tsconfig.base.json');
    
    const workspaceRootPath = path.join(__dirname, '../../');
    const sharedMappings = new mf.SharedMappings();
    sharedMappings.register(
      tsConfigPath,
      [
        /* mapped paths to share */
      ],
      workspaceRootPath
    );
    
    module.exports = {
      output: {
        uniqueName: 'login',
        publicPath: 'auto',
      },
      optimization: {
        runtimeChunk: false,
        minimize: false,
      },
      resolve: {
        alias: {
          ...sharedMappings.getAliases(),
        },
      },
      plugins: [
        new ModuleFederationPlugin({
          name: 'login',
          filename: 'remoteEntry.mjs',
          exposes: {
            './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
          },
          shared: {
            '@angular/core': { singleton: true, strictVersion: true },
            '@angular/common': { singleton: true, strictVersion: true },
            '@angular/common/http': { singleton: true, strictVersion: true },
            '@angular/router': { singleton: true, strictVersion: true },
            ...sharedMappings.getDescriptors(),
          },
        }),
        sharedMappings.getPlugin(),
      ],
    };
    `;

    tree.write('apps/testing/webpack.config.js', webpackConfig);
    tree.write('apps/other/webpack.config.js', webpackConfig);

    // ACT
    await updateMfeWebpackConfig(tree);

    // ASSERT
    const updatedApp1WebpackFile = tree.read(
      'apps/testing/webpack.config.js',
      'utf-8'
    );
    expect(updatedApp1WebpackFile).toMatchInlineSnapshot(`
      "const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
          const mf = require('@angular-architects/module-federation/webpack');
          const path = require('path');
          
          /**
           * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
           * builder as it will generate a temporary tsconfig file which contains any required remappings of
           * shred libraries.
           * A remapping will occur when a library is buildable, as webpack needs to know the location of the
           * built files for the buildable library.
           * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
           * the location of the generated temporary tsconfig file.
           */
          const tsConfigPath =
            process.env.NX_TSCONFIG_PATH ??
            path.join(__dirname, '../../tsconfig.base.json');
          
          const workspaceRootPath = path.join(__dirname, '../../');
          const sharedMappings = new mf.SharedMappings();
          sharedMappings.register(
            tsConfigPath,
            [
              /* mapped paths to share */
            ],
            workspaceRootPath
          );
          
          module.exports = {
            output: {
              uniqueName: 'login',
              publicPath: 'auto',
      scriptType: 'text/javascript',
            },
            optimization: {
              runtimeChunk: false,
              minimize: false,
            },
            resolve: {
              alias: {
                ...sharedMappings.getAliases(),
              },
            },
            plugins: [
              new ModuleFederationPlugin({
                name: 'login',
                filename: 'remoteEntry.mjs',
                exposes: {
                  './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
                },
                shared: {
                  '@angular/core': { singleton: true, strictVersion: true },
                  '@angular/common': { singleton: true, strictVersion: true },
                  '@angular/common/http': { singleton: true, strictVersion: true },
                  '@angular/router': { singleton: true, strictVersion: true },
                  ...sharedMappings.getDescriptors(),
                },
              }),
              sharedMappings.getPlugin(),
            ],
          };
          "
    `);
    const updatedApp2WebpackFile = tree.read(
      'apps/other/webpack.config.js',
      'utf-8'
    );
    expect(updatedApp2WebpackFile).toMatchInlineSnapshot(`
      "const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
          const mf = require('@angular-architects/module-federation/webpack');
          const path = require('path');
          
          /**
           * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
           * builder as it will generate a temporary tsconfig file which contains any required remappings of
           * shred libraries.
           * A remapping will occur when a library is buildable, as webpack needs to know the location of the
           * built files for the buildable library.
           * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
           * the location of the generated temporary tsconfig file.
           */
          const tsConfigPath =
            process.env.NX_TSCONFIG_PATH ??
            path.join(__dirname, '../../tsconfig.base.json');
          
          const workspaceRootPath = path.join(__dirname, '../../');
          const sharedMappings = new mf.SharedMappings();
          sharedMappings.register(
            tsConfigPath,
            [
              /* mapped paths to share */
            ],
            workspaceRootPath
          );
          
          module.exports = {
            output: {
              uniqueName: 'login',
              publicPath: 'auto',
      scriptType: 'text/javascript',
            },
            optimization: {
              runtimeChunk: false,
              minimize: false,
            },
            resolve: {
              alias: {
                ...sharedMappings.getAliases(),
              },
            },
            plugins: [
              new ModuleFederationPlugin({
                name: 'login',
                filename: 'remoteEntry.mjs',
                exposes: {
                  './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
                },
                shared: {
                  '@angular/core': { singleton: true, strictVersion: true },
                  '@angular/common': { singleton: true, strictVersion: true },
                  '@angular/common/http': { singleton: true, strictVersion: true },
                  '@angular/router': { singleton: true, strictVersion: true },
                  ...sharedMappings.getDescriptors(),
                },
              }),
              sharedMappings.getPlugin(),
            ],
          };
          "
    `);
  });

  it('should add liveReload=false to the serve commands', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app', {
      root: 'apps/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: { path: 'apps/testing/webpack.config.js' },
          },
        },
        'serve-mfe': {
          executor: '@nrwl/workspace:run-commands',
          options: {
            commands: ['nx serve app1'],
          },
        },
      },
    });

    const webpackConfig = `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
    const mf = require('@angular-architects/module-federation/webpack');
    const path = require('path');
    
    /**
     * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
     * builder as it will generate a temporary tsconfig file which contains any required remappings of
     * shred libraries.
     * A remapping will occur when a library is buildable, as webpack needs to know the location of the
     * built files for the buildable library.
     * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
     * the location of the generated temporary tsconfig file.
     */
    const tsConfigPath =
      process.env.NX_TSCONFIG_PATH ??
      path.join(__dirname, '../../tsconfig.base.json');
    
    const workspaceRootPath = path.join(__dirname, '../../');
    const sharedMappings = new mf.SharedMappings();
    sharedMappings.register(
      tsConfigPath,
      [
        /* mapped paths to share */
      ],
      workspaceRootPath
    );
    
    module.exports = {
      output: {
        uniqueName: 'login',
        publicPath: 'auto',
      },
      optimization: {
        runtimeChunk: false,
        minimize: false,
      },
      resolve: {
        alias: {
          ...sharedMappings.getAliases(),
        },
      },
      plugins: [
        new ModuleFederationPlugin({
          name: 'login',
          filename: 'remoteEntry.mjs',
          exposes: {
            './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
          },
          shared: {
            '@angular/core': { singleton: true, strictVersion: true },
            '@angular/common': { singleton: true, strictVersion: true },
            '@angular/common/http': { singleton: true, strictVersion: true },
            '@angular/router': { singleton: true, strictVersion: true },
            ...sharedMappings.getDescriptors(),
          },
        }),
        sharedMappings.getPlugin(),
      ],
    };
    `;

    tree.write('apps/testing/webpack.config.js', webpackConfig);

    // ACT
    await updateMfeWebpackConfig(tree);

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    expect(updatedProject.targets['serve-mfe'].options.commands).toEqual([
      'nx serve app1 --liveReload=false',
    ]);
  });
});

describe('add script type to webpack mfe config', () => {
  it('should add scriptType to webpack config', () => {
    // ARRANGE
    const webpackFile = `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
        const mf = require('@angular-architects/module-federation/webpack');
        const path = require('path');
        
        /**
         * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
         * builder as it will generate a temporary tsconfig file which contains any required remappings of
         * shred libraries.
         * A remapping will occur when a library is buildable, as webpack needs to know the location of the
         * built files for the buildable library.
         * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
         * the location of the generated temporary tsconfig file.
         */
        const tsConfigPath =
          process.env.NX_TSCONFIG_PATH ??
          path.join(__dirname, '../../tsconfig.base.json');
        
        const workspaceRootPath = path.join(__dirname, '../../');
        const sharedMappings = new mf.SharedMappings();
        sharedMappings.register(
          tsConfigPath,
          [
            /* mapped paths to share */
          ],
          workspaceRootPath
        );
        
        module.exports = {
          output: {
            uniqueName: 'login',
            publicPath: 'auto',
          },
          optimization: {
            runtimeChunk: false,
            minimize: false,
          },
          resolve: {
            alias: {
              ...sharedMappings.getAliases(),
            },
          },
          plugins: [
            new ModuleFederationPlugin({
              name: 'login',
              filename: 'remoteEntry.mjs',
              exposes: {
                './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
              },
              shared: {
                '@angular/core': { singleton: true, strictVersion: true },
                '@angular/common': { singleton: true, strictVersion: true },
                '@angular/common/http': { singleton: true, strictVersion: true },
                '@angular/router': { singleton: true, strictVersion: true },
                ...sharedMappings.getDescriptors(),
              },
            }),
            sharedMappings.getPlugin(),
          ],
        };
        `;
    // ACT
    const updatedFile = updateScriptType(webpackFile);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
              const mf = require('@angular-architects/module-federation/webpack');
              const path = require('path');
              
              /**
               * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
               * builder as it will generate a temporary tsconfig file which contains any required remappings of
               * shred libraries.
               * A remapping will occur when a library is buildable, as webpack needs to know the location of the
               * built files for the buildable library.
               * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
               * the location of the generated temporary tsconfig file.
               */
              const tsConfigPath =
                process.env.NX_TSCONFIG_PATH ??
                path.join(__dirname, '../../tsconfig.base.json');
              
              const workspaceRootPath = path.join(__dirname, '../../');
              const sharedMappings = new mf.SharedMappings();
              sharedMappings.register(
                tsConfigPath,
                [
                  /* mapped paths to share */
                ],
                workspaceRootPath
              );
              
              module.exports = {
                output: {
                  uniqueName: 'login',
                  publicPath: 'auto',
      scriptType: 'text/javascript',
                },
                optimization: {
                  runtimeChunk: false,
                  minimize: false,
                },
                resolve: {
                  alias: {
                    ...sharedMappings.getAliases(),
                  },
                },
                plugins: [
                  new ModuleFederationPlugin({
                    name: 'login',
                    filename: 'remoteEntry.mjs',
                    exposes: {
                      './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
                    },
                    shared: {
                      '@angular/core': { singleton: true, strictVersion: true },
                      '@angular/common': { singleton: true, strictVersion: true },
                      '@angular/common/http': { singleton: true, strictVersion: true },
                      '@angular/router': { singleton: true, strictVersion: true },
                      ...sharedMappings.getDescriptors(),
                    },
                  }),
                  sharedMappings.getPlugin(),
                ],
              };
              "
    `);
  });

  it('should keep file as is when scriptType exists', () => {
    // ARRANGE
    const webpackFile = `const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
        const mf = require('@angular-architects/module-federation/webpack');
        const path = require('path');
        
        /**
         * We use the NX_TSCONFIG_PATH environment variable when using the @nrwl/angular:webpack-browser
         * builder as it will generate a temporary tsconfig file which contains any required remappings of
         * shred libraries.
         * A remapping will occur when a library is buildable, as webpack needs to know the location of the
         * built files for the buildable library.
         * This NX_TSCONFIG_PATH environment variable is set by the @nrwl/angular:webpack-browser and it contains
         * the location of the generated temporary tsconfig file.
         */
        const tsConfigPath =
          process.env.NX_TSCONFIG_PATH ??
          path.join(__dirname, '../../tsconfig.base.json');
        
        const workspaceRootPath = path.join(__dirname, '../../');
        const sharedMappings = new mf.SharedMappings();
        sharedMappings.register(
          tsConfigPath,
          [
            /* mapped paths to share */
          ],
          workspaceRootPath
        );
        
        module.exports = {
          output: {
            uniqueName: 'login',
            publicPath: 'auto',
            scriptType: 'text/javascript',
          },
          optimization: {
            runtimeChunk: false,
            minimize: false,
          },
          resolve: {
            alias: {
              ...sharedMappings.getAliases(),
            },
          },
          plugins: [
            new ModuleFederationPlugin({
              name: 'login',
              filename: 'remoteEntry.mjs',
              exposes: {
                './Module': 'apps/login/src/app/remote-entry/entry.module.ts',
              },
              shared: {
                '@angular/core': { singleton: true, strictVersion: true },
                '@angular/common': { singleton: true, strictVersion: true },
                '@angular/common/http': { singleton: true, strictVersion: true },
                '@angular/router': { singleton: true, strictVersion: true },
                ...sharedMappings.getDescriptors(),
              },
            }),
            sharedMappings.getPlugin(),
          ],
        };
        `;
    // ACT
    const updatedFile = updateScriptType(webpackFile);

    // ASSERT
    expect(updatedFile).toEqual(webpackFile);
  });
});
