import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  Tree,
  getProjects,
  readJson,
  readProjectConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { reactNativeApplicationGenerator } from './application';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
  });

  it('should update configuration', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
      unitTestRunner: 'none',
      bundler: 'vite',
    });
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'my-app',
      displayName: 'myApp',
      tags: 'one,two',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
      unitTestRunner: 'none',
      bundler: 'vite',
    });

    const projectConfiguration = readProjectConfiguration(appTree, 'my-app');
    expect(projectConfiguration).toMatchObject({
      tags: ['one', 'two'],
    });
  });

  it('should generate files', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
      unitTestRunner: 'jest',
      bundler: 'vite',
    });
    expect(appTree.exists('my-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('my-app/src/main.tsx')).toBeTruthy();

    const tsconfig = readJson(appTree, 'my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../tsconfig.base.json');

    expect(appTree.exists('my-app/.eslintrc.json')).toBe(true);
    expect(appTree.read('my-app/jest.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "module.exports = {
        displayName: 'my-app',
        preset: 'react-native',
        resolver: '@nx/jest/plugins/resolver',
        moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
        setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
        moduleNameMapper: {
          '\\\\.svg$': '@nx/react-native/plugins/jest/svg-mock',
        },
        transform: {
          '^.+.(js|ts|tsx)$': [
            'babel-jest',
            {
              configFile: __dirname + '/.babelrc.js',
            },
          ],
          '^.+.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp)$': require.resolve(
            'react-native/jest/assetFileTransformer.js'
          ),
        },
        coverageDirectory: '../coverage/my-app',
      };
      "
    `);
  });

  it('should generate targets', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
      unitTestRunner: 'jest',
      bundler: 'vite',
    });

    expect(appTree.exists('my-app/jest.config.ts')).toBeTruthy();
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    appTree.rename('tsconfig.base.json', 'tsconfig.json');

    await reactNativeApplicationGenerator(appTree, {
      name: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      projectNameAndRootFormat: 'as-provided',
      unitTestRunner: 'none',
      bundler: 'vite',
    });

    const tsconfig = readJson(appTree, 'my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../tsconfig.json');
  });

  describe('detox', () => {
    it('should create e2e app with directory', async () => {
      await reactNativeApplicationGenerator(appTree, {
        name: 'my-app',
        directory: 'my-dir',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        install: false,
        projectNameAndRootFormat: 'as-provided',
        bundler: 'vite',
        unitTestRunner: 'none',
      });

      const projects = getProjects(appTree);
      expect(projects.get('my-app').root).toEqual('my-dir');

      expect(appTree.exists('my-dir-e2e/.detoxrc.json')).toBeTruthy();
      const detoxrc = appTree.read('my-dir-e2e/.detoxrc.json', 'utf-8');
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      expect(detoxrcJson.apps).toEqual({
        'android.debug': {
          binaryPath:
            '../my-dir/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../my-dir/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../my-dir/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../my-dir/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../my-dir/ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
          build:
            "cd ../my-dir/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-dir/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../my-dir/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should create e2e app without directory', async () => {
      await reactNativeApplicationGenerator(appTree, {
        name: 'my-app',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        install: false,
        projectNameAndRootFormat: 'as-provided',
        bundler: 'vite',
        unitTestRunner: 'none',
      });

      const projects = getProjects(appTree);
      expect(projects.get('my-app').root).toEqual('my-app');

      const detoxrc = appTree.read('my-app-e2e/.detoxrc.json', 'utf-8');
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      expect(detoxrcJson.apps).toEqual({
        'android.debug': {
          binaryPath:
            '../my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../my-app/ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
          build:
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });
  });

  describe('--skipPackageJson', () => {
    it('should not add or update dependencies when true', async () => {
      const packageJsonBefore = readJson(appTree, 'package.json');

      await reactNativeApplicationGenerator(appTree, {
        name: 'my-app',
        displayName: 'myApp',
        linter: Linter.EsLint,
        e2eTestRunner: 'none',
        install: false,
        skipPackageJson: true,
        projectNameAndRootFormat: 'as-provided',
        unitTestRunner: 'none',
        bundler: 'webpack',
      });

      expect(readJson(appTree, 'package.json')).toEqual(packageJsonBefore);
    });
  });
});
