import migrateMFEConfigs, {
  modifyConfigToUseShareHelper,
  modifyConfigToUseMinimizeOptimization,
  replaceBrowserModuleWithCommonFromRemoteEntry,
} from './update-mfe-configs';
import {
  correctConfig,
  shareConfig,
  optimizationConfig,
  remoteEntryModule,
} from './update-mfe-config.test-data';
import { addProjectConfiguration, readJson, stripIndents } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('migrateMFEConfigs', () => {
  it('should do nothing for correct setups', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'test', {
      root: 'apps/test',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackPath: 'apps/test/webpack.config.js',
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

    tree.write('apps/test/webpack.config.js', correctConfig);
    tree.write(
      'apps/test/src/app/remote-entry/entry.module.ts',
      remoteEntryModule.correct
    );
    tree.write(
      'apps/test/tsconfig.app.json',
      `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc",
        "types": [],
        "target": "ES2020"
      },
      "files": ["src/main.ts", "src/polyfills.ts"],
      "include": ["src/**/*.d.ts"],
      "exclude": ["**/*.test.ts", "**/*.spec.ts"]
    }`
    );

    // ACT
    await migrateMFEConfigs(tree);

    // ASSERT
    expect(tree.read('apps/test/webpack.config.js', 'utf-8')).toEqual(
      correctConfig
    );
    expect(
      tree.read('apps/test/src/app/remote-entry/entry.module.ts', 'utf-8')
    ).toEqual(remoteEntryModule.correct);
    expect(
      readJson(tree, 'apps/test/tsconfig.app.json').compilerOptions.target
    ).toEqual('ES2020');
  });

  it('should fix incorrect setups', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'test', {
      root: 'apps/test',
      sourceRoot: 'apps/test/src',
      targets: {
        build: {
          executor: '@nrwl/angular:webpack-browser',
          options: {
            customWebpackConfig: { path: 'apps/test/webpack.config.js' },
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

    tree.write('apps/test/webpack.config.js', shareConfig.incorrect);
    tree.write(
      'apps/test/src/app/remote-entry/entry.module.ts',
      remoteEntryModule.onlyBrowserModule
    );
    tree.write(
      'apps/test/tsconfig.app.json',
      `{
      "extends": "./tsconfig.json",
      "compilerOptions": {
        "outDir": "../../dist/out-tsc",
        "types": []
      },
      "files": ["src/main.ts", "src/polyfills.ts"],
      "include": ["src/**/*.d.ts"],
      "exclude": ["**/*.test.ts", "**/*.spec.ts"]
    }`
    );

    // ACT
    await migrateMFEConfigs(tree);

    // ASSERT
    expect(
      stripIndents`${tree.read('apps/test/webpack.config.js', 'utf-8')}`
    ).toEqual(stripIndents`${correctConfig}`);
    expect(
      stripIndents`${tree.read(
        'apps/test/src/app/remote-entry/entry.module.ts',
        'utf-8'
      )}`
    ).toEqual(
      stripIndents`${remoteEntryModule.correctBrowserModuleWithCommonImportedInFile}`
    );
    expect(
      readJson(tree, 'apps/test/tsconfig.app.json').compilerOptions.target
    ).toEqual('ES2020');
  });
});

describe('replaceBrowserModuleWithCommonFromRemoteEntry', () => {
  it('should not modify correct module', () => {
    // ARRANGE
    const remoteEntry = remoteEntryModule.correct;

    // ACT
    const updatedRemoteEntry =
      replaceBrowserModuleWithCommonFromRemoteEntry(remoteEntry);

    // ASSERT
    expect(stripIndents`${updatedRemoteEntry}`).toEqual(
      stripIndents`${remoteEntryModule.correct}`
    );
  });

  it('should modify module with only browser module', () => {
    // ARRANGE
    const remoteEntry = remoteEntryModule.onlyBrowserModule;

    // ACT
    const updatedRemoteEntry =
      replaceBrowserModuleWithCommonFromRemoteEntry(remoteEntry);

    // ASSERT
    expect(stripIndents`${updatedRemoteEntry}`).toEqual(
      stripIndents`${remoteEntryModule.correctBrowserModuleWithCommonImportedInFile}`
    );
  });

  it('should modify module with browser module and common module imported in file', () => {
    // ARRANGE
    const remoteEntry = remoteEntryModule.browserModuleWithCommonImportedInFile;

    // ACT
    const updatedRemoteEntry =
      replaceBrowserModuleWithCommonFromRemoteEntry(remoteEntry);

    // ASSERT
    expect(stripIndents`${updatedRemoteEntry}`).toEqual(
      stripIndents`${remoteEntryModule.correctBrowserModuleWithCommonImportedInFile}`
    );
  });

  it('should modify module with browser module and common module imported in array', () => {
    // ARRANGE
    const remoteEntry =
      remoteEntryModule.browserModuleWithCommonImportedInArray;

    // ACT
    const updatedRemoteEntry =
      replaceBrowserModuleWithCommonFromRemoteEntry(remoteEntry);

    // ASSERT
    expect(stripIndents`${updatedRemoteEntry}`).toEqual(
      stripIndents`${remoteEntryModule.correctBrowserModuleWithCommonImportedInArray}`
    );
  });

  it('should modify module when no browser or common module', () => {
    // ARRANGE
    const remoteEntry = remoteEntryModule.noBrowserOrCommonModule;

    // ACT
    const updatedRemoteEntry =
      replaceBrowserModuleWithCommonFromRemoteEntry(remoteEntry);

    // ASSERT
    expect(stripIndents`${updatedRemoteEntry}`).toEqual(
      stripIndents`${remoteEntryModule.correctWithNoBrowserOrCommonModule}`
    );
  });
});

describe('modifyConfigToUseShareHelper', () => {
  it('should not modify correct config', () => {
    // ARRANGE
    const webpackConfig = correctConfig;
    // ACT
    const updatedWebpackConfig = modifyConfigToUseShareHelper(webpackConfig);

    // ASSERT
    expect(updatedWebpackConfig).toEqual(correctConfig);
  });

  it('should fix incorrect config', () => {
    // ARRANGE
    const webpackConfig = shareConfig.incorrect;
    // ACT
    const updatedWebpackConfig = modifyConfigToUseShareHelper(webpackConfig);

    // ASSERT
    expect(updatedWebpackConfig).toEqual(shareConfig.correct);
  });
});

describe('modifyConfigToUseMinimizeOptimization', () => {
  it('should not modify correct config', () => {
    // ARRANGE
    const webpackConfig = correctConfig;
    // ACT
    const updatedWebpackConfig =
      modifyConfigToUseMinimizeOptimization(webpackConfig);

    // ASSERT
    expect(updatedWebpackConfig).toEqual(correctConfig);
  });

  it('should fix incorrect config when the property is set to false', () => {
    // ARRANGE
    const webpackConfig = optimizationConfig.incorrectFalse;
    // ACT
    const updatedWebpackConfig =
      modifyConfigToUseMinimizeOptimization(webpackConfig);

    // ASSERT
    expect(stripIndents`${updatedWebpackConfig}`).toEqual(
      stripIndents`${optimizationConfig.correct}`
    );
  });
});
