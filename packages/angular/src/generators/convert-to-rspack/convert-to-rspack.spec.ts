import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { convertToRspack } from './convert-to-rspack';
import {
  addProjectConfiguration,
  readJson,
  readNxJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
} from '@nx/devkit';
import * as _configUtils from '@nx/devkit/src/utils/config-utils';

jest.mock('@nx/devkit/src/utils/config-utils', () => ({
  ...jest.requireActual('@nx/devkit/src/utils/config-utils'),
  loadConfigFile: jest.fn().mockImplementation(async (path) => {
    return () => {
      return {};
    };
  }),
}));

describe('convert-to-rspack', () => {
  it('should convert a basic angular webpack application to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'], // zone.js is not in nx repo's node_modules so simulating it with a package that is
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});
    updateJson(tree, 'package.json', (json) => {
      json.scripts ??= {};
      json.scripts.build = 'nx build';
      return json;
    });

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { createConfig } from '@nx/angular-rspack';

      export default createConfig({
        options: {
          root: __dirname,

          outputPath: {
            base: '../../dist/apps/app',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          polyfills: ['tslib'],
          tsConfig: './tsconfig.app.json',
          assets: [
            './src/favicon.ico',
            './src/assets',
            {
              input: './public',
              glob: '**/*',
            },
          ],
          styles: ['./src/styles.scss'],
          scripts: [],
        },
      });
      "
    `);
    expect(pkgJson.devDependencies['@nx/angular-rspack']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(pkgJson.scripts?.build).toBeUndefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });

  it('should convert a ssr angular webpack application to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'], // zone.js is not in nx repo's node_modules so simulating it with a package that is
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
        server: {
          executor: '@angular-devkit/build-angular:server',
          options: {
            main: 'apps/app/src/server.ts',
          },
        },
      },
    });

    writeJson(tree, 'apps/app/tsconfig.json', {});
    updateJson(tree, 'package.json', (json) => {
      json.scripts ??= {};
      json.scripts.build = 'nx build';
      return json;
    });

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { createConfig } from '@nx/angular-rspack';

      export default createConfig({
        options: {
          root: __dirname,

          outputPath: {
            base: '../../dist/apps/app',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          polyfills: ['tslib'],
          tsConfig: './tsconfig.app.json',
          assets: [
            './src/favicon.ico',
            './src/assets',
            {
              input: './public',
              glob: '**/*',
            },
          ],
          styles: ['./src/styles.scss'],
          scripts: [],
          ssr: {
            entry: './src/server.ts',
          },
          server: './src/main.server.ts',
        },
      });
      "
    `);
    expect(pkgJson.devDependencies['@nx/angular-rspack']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(pkgJson.scripts?.build).toBeUndefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });

  it('should normalize paths to libs in workspace correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib', 'apps/app/src/polyfills.ts'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: ['libs/mylib/src/favicon.ico'],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});
    updateJson(tree, 'package.json', (json) => {
      json.scripts ??= {};
      json.scripts.build = 'nx build';
      return json;
    });
    tree.write('libs/mylib/src/favicon.ico', 'libs/mylib/src/favicon.ico');

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { createConfig } from '@nx/angular-rspack';

      export default createConfig({
        options: {
          root: __dirname,

          outputPath: {
            base: '../../dist/apps/app',
          },
          index: './src/index.html',
          browser: './src/main.ts',
          polyfills: ['tslib', './src/polyfills.ts'],
          tsConfig: './tsconfig.app.json',
          assets: ['../../libs/mylib/src/favicon.ico'],
          styles: ['./src/styles.scss'],
          scripts: [],
        },
      });
      "
    `);
    expect(pkgJson.devDependencies['@nx/angular-rspack']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(pkgJson.scripts?.build).toBeUndefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });

  it('should convert a basic angular webpack application with configurations to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
          configurations: {
            production: {
              outputPath: 'dist/apps/app-prod',
              index: 'apps/app/src/index.prod.html',
              main: 'apps/app/src/main.prod.ts',
              tsConfig: 'apps/app/tsconfig.prod.json',
            },
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    const pkgJson = readJson(tree, 'package.json');
    const nxJson = readNxJson(tree);
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { createConfig } from '@nx/angular-rspack';

      export default createConfig(
        {
          options: {
            root: __dirname,

            outputPath: {
              base: '../../dist/apps/app',
            },
            index: './src/index.html',
            browser: './src/main.ts',
            polyfills: ['tslib'],
            tsConfig: './tsconfig.app.json',
            assets: [
              './src/favicon.ico',
              './src/assets',
              {
                input: './public',
                glob: '**/*',
              },
            ],
            styles: ['./src/styles.scss'],
            scripts: [],
          },
        },
        {
          production: {
            options: {
              outputPath: {
                base: '../../dist/apps/app-prod',
              },
              index: './src/index.prod.html',
              browser: './src/main.prod.ts',
              tsConfig: './tsconfig.prod.json',
            },
          },
        }
      );
      "
    `);
    expect(pkgJson.devDependencies['@nx/angular-rspack']).toBeDefined();
    expect(
      nxJson.plugins.find((p) =>
        typeof p === 'string' ? false : p.plugin === '@nx/rspack/plugin'
      )
    ).toBeDefined();
    expect(updatedProject.targets.build).not.toBeDefined();
    expect(updatedProject.targets.serve).not.toBeDefined();
  });

  it('should convert an angular webpack application with custom webpack config function to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:webpack-browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
            customWebpackConfig: {
              path: 'apps/app/webpack.config.js',
            },
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});
    tree.write(
      'apps/app/module-federation.config.js',
      `
    module.exports = {
      name: 'app',
      exposes: {
        './app': './src/app/index.ts',
      },
      remotes: ['remote1', 'remote2'],
    };
    `
    );
    tree.write(
      'apps/app/webpack.config.js',
      `
    const { withModuleFederation } = require('@nx/module-federation/angular');
    const config = require('./module-federation.config');
    module.exports = withModuleFederation(config, { dts: false });
    `
    );

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { createConfig } from '@nx/angular-rspack';
      import baseWebpackConfig from './webpack.config';
      import webpackMerge from 'webpack-merge';

      export default async () => {
        const baseConfig = await createConfig({
          options: {
            root: __dirname,

            outputPath: {
              base: '../../dist/apps/app',
            },
            index: './src/index.html',
            browser: './src/main.ts',
            polyfills: ['tslib'],
            tsConfig: './tsconfig.app.json',
            assets: [
              './src/favicon.ico',
              './src/assets',
              {
                input: './public',
                glob: '**/*',
              },
            ],
            styles: ['./src/styles.scss'],
            scripts: [],
          },
        });
        return webpackMerge(baseConfig[0], baseWebpackConfig);
      };
      "
    `);
    expect(tree.read('apps/app/webpack.config.js', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const {
        NxModuleFederationPlugin,
        NxModuleFederationDevServerPlugin,
      } = require('@nx/module-federation/rspack');
      const config = require('./module-federation.config');

      module.exports = {
        plugins: [
          new NxModuleFederationPlugin(
            { config },
            {
              dts: false,
            }
          ),
          new NxModuleFederationDevServerPlugin({ config }),
        ],
      };
      "
    `);
  });

  it('should convert an angular webpack application with custom webpack config to rspack', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();

    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@nx/angular:webpack-browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'],
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
            customWebpackConfig: {
              path: 'apps/app/webpack.config.js',
            },
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});
    tree.write(
      'apps/app/module-federation.config.js',
      `
    module.exports = {
      name: 'app',
      exposes: {
        './app': './src/app/index.ts',
      },
      remotes: ['remote1', 'remote2'],
    };
    `
    );
    tree.write('apps/app/webpack.config.js', ``);

    jest
      .spyOn(_configUtils, 'loadConfigFile')
      .mockImplementation(async (path) => {
        return {
          default: {
            module: {
              rules: [
                {
                  test: /\.css$/,
                  use: ['style-loader', 'css-loader'],
                },
              ],
            },
          },
        };
      });

    // ACT
    await convertToRspack(tree, { project: 'app' });

    // ASSERT
    const updatedProject = readProjectConfiguration(tree, 'app');
    expect(tree.read('apps/app/rspack.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { createConfig } from '@nx/angular-rspack';
      import baseWebpackConfig from './webpack.config';
      import webpackMerge from 'webpack-merge';

      export default async () => {
        const baseConfig = await createConfig({
          options: {
            root: __dirname,

            outputPath: {
              base: '../../dist/apps/app',
            },
            index: './src/index.html',
            browser: './src/main.ts',
            polyfills: ['tslib'],
            tsConfig: './tsconfig.app.json',
            assets: [
              './src/favicon.ico',
              './src/assets',
              {
                input: './public',
                glob: '**/*',
              },
            ],
            styles: ['./src/styles.scss'],
            scripts: [],
          },
        });
        return webpackMerge(baseConfig[0], baseWebpackConfig);
      };
      "
    `);
  });

  it('should configure ts-node in the tsconfig.json file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'], // zone.js is not in nx repo's node_modules so simulating it with a package that is
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});
    updateJson(tree, 'package.json', (json) => {
      json.scripts ??= {};
      json.scripts.build = 'nx build';
      return json;
    });

    await convertToRspack(tree, { project: 'app', skipFormat: true });

    expect(tree.read('apps/app/tsconfig.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "ts-node": {
          "compilerOptions": {
            "module": "CommonJS",
            "moduleResolution": "Node10"
          }
        }
      }
      "
    `);
  });

  it('should configure ts-node in the tsconfig.json file to unset "customConditions" when it is defined in the root tsconfig.json file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'tsconfig.base.json', (json) => {
      json.compilerOptions ??= {};
      json.compilerOptions.customConditions = ['development'];
      return json;
    });
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'], // zone.js is not in nx repo's node_modules so simulating it with a package that is
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {});
    updateJson(tree, 'package.json', (json) => {
      json.scripts ??= {};
      json.scripts.build = 'nx build';
      return json;
    });

    await convertToRspack(tree, { project: 'app', skipFormat: true });

    expect(tree.read('apps/app/tsconfig.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "ts-node": {
          "compilerOptions": {
            "module": "CommonJS",
            "moduleResolution": "Node10",
            "customConditions": null
          }
        }
      }
      "
    `);
  });

  it('should configure ts-node in the tsconfig.json file to unset "customConditions" when it is defined in the project tsconfig.json file', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app', {
      root: 'apps/app',
      sourceRoot: 'apps/app/src',
      projectType: 'application',
      targets: {
        build: {
          executor: '@angular-devkit/build-angular:browser',
          options: {
            outputPath: 'dist/apps/app',
            index: 'apps/app/src/index.html',
            main: 'apps/app/src/main.ts',
            polyfills: ['tslib'], // zone.js is not in nx repo's node_modules so simulating it with a package that is
            tsConfig: 'apps/app/tsconfig.app.json',
            assets: [
              'apps/app/src/favicon.ico',
              'apps/app/src/assets',
              { input: 'apps/app/public', glob: '**/*' },
            ],
            styles: ['apps/app/src/styles.scss'],
            scripts: [],
          },
        },
      },
    });
    writeJson(tree, 'apps/app/tsconfig.json', {
      compilerOptions: {
        customConditions: ['development'],
      },
    });
    updateJson(tree, 'package.json', (json) => {
      json.scripts ??= {};
      json.scripts.build = 'nx build';
      return json;
    });

    await convertToRspack(tree, { project: 'app', skipFormat: true });

    expect(tree.read('apps/app/tsconfig.json', 'utf-8')).toMatchInlineSnapshot(`
      "{
        "compilerOptions": {
          "customConditions": [
            "development"
          ]
        },
        "ts-node": {
          "compilerOptions": {
            "module": "CommonJS",
            "moduleResolution": "Node10",
            "customConditions": null
          }
        }
      }
      "
    `);
  });

  describe('top-level target options', () => {
    describe('build target', () => {
      it('should remove the target when there are no relevant top-level options', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).not.toBeDefined();
      });

      it('should remove the target when all the top-level options match what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        updateJson(tree, 'nx.json', (json) => {
          json.namedInputs = {
            ...json.namedInputs,
            production: [
              'default',
              '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
            ],
          };
          return json;
        });
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              dependsOn: ['^build'],
              cache: true,
              inputs: ['production', '^production'],
              outputs: ['{options.outputPath}'],
              syncGenerators: ['@nx/js:typescript-sync'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).not.toBeDefined();
      });

      it('should remove the target when the normalized output matches what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              outputs: ['{workspaceRoot}/dist/{projectRoot}'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).not.toBeDefined();
      });

      it('should remove the target when the transformed output matches what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              outputs: ['{workspaceRoot}/dist/{projectRoot}/browser'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).not.toBeDefined();
      });

      it('should keep the target with updated outputs when they would not match what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              outputs: [
                // will be replaced with a explicit output path because the
                // inferred task won't have an outputPath option
                '{options.outputPath}',
                '{workspaceRoot}/some-other-output',
              ],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).toStrictEqual({
          outputs: [
            '{workspaceRoot}/dist/apps/app',
            '{workspaceRoot}/some-other-output',
          ],
        });
      });

      it('should remove the target when the dependsOn option matches what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              dependsOn: ['^build'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).not.toBeDefined();
      });

      it('should keep the target with dependsOn when they would not match what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              dependsOn: ['pre-build', '^build'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).toStrictEqual({
          dependsOn: ['pre-build', '^build'],
        });
      });

      it('should remove the target when the syncGenerators option matches what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              syncGenerators: ['@nx/js:typescript-sync'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).not.toBeDefined();
      });

      it('should keep the target with syncGenerators when they would not match what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              syncGenerators: ['@foo/bar:baz'],
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).toStrictEqual({
          syncGenerators: ['@foo/bar:baz', '@nx/js:typescript-sync'],
        });
      });

      it('should keep the target with any other extra top-level option that would not be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              parallelism: false,
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.build).toStrictEqual({
          parallelism: false,
        });
      });
    });

    describe('serve target', () => {
      it('should remove the target when there are no relevant top-level options', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
            serve: {
              executor: '@angular-devkit/build-angular:dev-server',
              options: {},
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.serve).not.toBeDefined();
      });

      it('should remove the target when all the top-level options match what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
            serve: {
              continuous: true,
              syncGenerators: ['@nx/js:typescript-sync'],
              executor: '@angular-devkit/build-angular:dev-server',
              options: {},
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.serve).not.toBeDefined();
      });

      it('should remove the target when the syncGenerators option matches what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
            serve: {
              syncGenerators: ['@nx/js:typescript-sync'],
              executor: '@angular-devkit/build-angular:dev-server',
              options: {},
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.serve).not.toBeDefined();
      });

      it('should keep the target with syncGenerators when they would not match what would be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
            serve: {
              syncGenerators: ['@foo/bar:baz'],
              executor: '@angular-devkit/build-angular:dev-server',
              options: {},
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.serve).toStrictEqual({
          syncGenerators: ['@foo/bar:baz', '@nx/js:typescript-sync'],
        });
      });

      it('should keep the target with any other extra top-level option that would not be inferred', async () => {
        const tree = createTreeWithEmptyWorkspace();
        addProjectConfiguration(tree, 'app', {
          root: 'apps/app',
          sourceRoot: 'apps/app/src',
          projectType: 'application',
          targets: {
            build: {
              executor: '@angular-devkit/build-angular:browser',
              options: {
                outputPath: 'dist/apps/app/browser',
                index: 'apps/app/src/index.html',
                main: 'apps/app/src/main.ts',
                tsConfig: 'apps/app/tsconfig.app.json',
              },
            },
            serve: {
              parallelism: false,
              executor: '@angular-devkit/build-angular:dev-server',
              options: {},
            },
          },
        });
        writeJson(tree, 'apps/app/tsconfig.json', {});

        await convertToRspack(tree, { project: 'app' });

        const updatedProject = readProjectConfiguration(tree, 'app');
        expect(updatedProject.targets.serve).toStrictEqual({
          parallelism: false,
        });
      });
    });
  });
});
