import {
  addProjectConfiguration,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateMfeConfig, { removeRemoteName } from './update-mfe-webpack-config';

describe('update-mfe-webpack-config', () => {
  describe('run the migration', () => {
    it('should skip the migration when there is no MFE config', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'app', {
        root: 'apps/testing',
        targets: {
          build: {
            executor: '@nrwl/angular:webpack-browser',
            options: {},
          },
          serve: {
            executor: '@nrwl/angular:webpack-server',
            options: {
              port: 4201,
            },
          },
        },
      });

      // ACT
      let error = undefined;
      try {
        await updateMfeConfig(tree);
      } catch (err) {
        error = err;
      }

      // ASSERT
      expect(error).toBeUndefined();
    });

    it('should skip the migration when using a different executor', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace(2);
      addProjectConfiguration(tree, 'app', {
        root: 'apps/testing',
        targets: {
          build: {
            executor: '@angular-devkit/build-angular',
          },
        },
      });

      // ACT
      let error = undefined;
      try {
        await updateMfeConfig(tree);
      } catch (err) {
        error = err;
      }

      // ASSERT
      expect(error).toBeUndefined();
    });

    it('shouldnt run for non mfe configs', async () => {
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
          serve: {
            executor: '@nrwl/angular:webpack-server',
            options: {
              port: 4201,
            },
          },
        },
      });

      const webpackConfig = `// const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
      module.exports = {
        optimization: {
          runtimeChunk: false,
          minimize: false,
        },
      };`;
      tree.write('apps/testing/webpack.config.js', webpackConfig);

      // ACT
      await updateMfeConfig(tree);

      // ASSERT
      const updatedConfig = tree.read(
        'apps/testing/webpack.config.js',
        'utf-8'
      );
      expect(updatedConfig).toMatchInlineSnapshot(`
        "// const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
              module.exports = {
                optimization: {
                  runtimeChunk: false,
                  minimize: false,
                },
              };"
      `);
    });

    it('should run the migration successfully for a host config', async () => {
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
          serve: {
            executor: '@nrwl/angular:webpack-server',
            options: {
              port: 4201,
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
            remotes: {
              login: 'login@http://localhost:4201/remoteEnrry.js',
              todo: 'todo@http://localhost:4202/remoteEntry.js',
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
      };`;
      tree.write('apps/testing/webpack.config.js', webpackConfig);

      // ACT
      await updateMfeConfig(tree);

      // ASSERT
      const updatedConfig = tree.read(
        'apps/testing/webpack.config.js',
        'utf-8'
      );
      expect(updatedConfig).toMatchInlineSnapshot(`
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
          experiments: {
            outputModule: true  
          },
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
          library: {
              type: 'module'
          },
                    remotes: {
            login: 'http://localhost:4201/remoteEnrry.js',
        todo: 'http://localhost:4202/remoteEntry.js'
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
              };"
      `);
      const project = readProjectConfiguration(tree, 'app');
      expect(project.targets.serve.options.publicHost).toEqual(
        'http://localhost:4201'
      );
    });

    it('should add outputModule to experiments object when something else exists in experiments', async () => {
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
          serve: {
            executor: '@nrwl/angular:webpack-server',
            options: {
              port: 4201,
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
        experiments: {
          something: true
        },
        plugins: [
          new ModuleFederationPlugin({
            remotes: {
              login: 'login@http://localhost:4201/remoteEnrry.js',
              todo: 'todo@http://localhost:4202/remoteEntry.js',
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
      };`;
      tree.write('apps/testing/webpack.config.js', webpackConfig);

      // ACT
      await updateMfeConfig(tree);

      // ASSERT
      const updatedConfig = tree.read(
        'apps/testing/webpack.config.js',
        'utf-8'
      );
      expect(updatedConfig).toMatchInlineSnapshot(`
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
                experiments: {
        outputModule: true,
                  something: true
                },
                plugins: [
                  new ModuleFederationPlugin({
          library: {
              type: 'module'
          },
                    remotes: {
            login: 'http://localhost:4201/remoteEnrry.js',
        todo: 'http://localhost:4202/remoteEntry.js'
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
              };"
      `);
    });

    it('should run the migration successfully for a remote config', async () => {
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
          serve: {
            executor: '@nrwl/angular:webpack-server',
            options: {
              port: 4201,
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
      };`;
      tree.write('apps/testing/webpack.config.js', webpackConfig);

      // ACT
      await updateMfeConfig(tree);

      // ASSERT
      const updatedConfig = tree.read(
        'apps/testing/webpack.config.js',
        'utf-8'
      );
      expect(updatedConfig).toMatchInlineSnapshot(`
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
          experiments: {
            outputModule: true  
          },
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
          library: {
              type: 'module'
          },
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
              };"
      `);
      const project = readProjectConfiguration(tree, 'app');
      expect(project.targets.serve.options.publicHost).toEqual(
        'http://localhost:4201'
      );
    });
  });
  describe('removeRemoteName', () => {
    it('should remove the names correctly', () => {
      // ARRANGE
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
              remotes: {
                login: "login@http://localhost:4201/remoteEnrry.js",
                todo: "todo@http://localhost:4202/remoteEntry.js",
              },
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
        };`;

      // ACT
      const updatedConfig = removeRemoteName(webpackConfig);

      // ASSERT
      expect(updatedConfig).toMatchInlineSnapshot(`
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
                                remotes: {
                      login: 'http://localhost:4201/remoteEnrry.js',
                  todo: 'http://localhost:4202/remoteEntry.js'
                    },
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
                          };"
              `);
    });
  });
});
