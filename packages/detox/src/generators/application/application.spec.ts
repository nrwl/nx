import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint/src/generators/utils/linter';

import detoxApplicationGenerator from './application';

describe('detox application generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    tree.write('.gitignore', '');
  });

  describe('app at root', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-app', {
        root: 'my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eName: 'my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('my-app-e2e/src/app.spec.ts')).toBeTruthy();

      const detoxrc = tree.read('my-app-e2e/.detoxrc.json').toString();
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      const appsDetoxrcJson = detoxrcJson['apps'];
      expect(appsDetoxrcJson).toEqual({
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

    it('should update configuration', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');

      expect(project.root).toEqual('my-app-e2e');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-app']);
    });
  });

  describe('with directory specified that is same as e2e project', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-dir-my-app', {
        root: 'my-dir/my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eName: 'my-app-e2e',
        e2eDirectory: 'my-dir',
        appProject: 'my-dir-my-app',
        linter: Linter.None,
        framework: 'react-native',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('my-dir/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('my-dir/src/app.spec.ts')).toBeTruthy();

      const detoxrc = tree.read('my-dir/.detoxrc.json').toString();
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      const appsDetoxrcJson = detoxrcJson['apps'];
      expect(appsDetoxrcJson).toEqual({
        'android.debug': {
          binaryPath:
            '../my-dir/my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../my-dir/my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../my-dir/my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../my-dir/my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../my-dir/my-app/ios/build/Build/Products/Debug-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should update configuration', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');

      expect(project.root).toEqual('my-dir');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });
  });

  describe('with directory specified that is different from as e2e project', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-dir-my-app', {
        root: 'my-dir/my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eName: 'my-app-e2e',
        e2eDirectory: 'e2e-dir',
        appProject: 'my-dir-my-app',
        linter: Linter.None,
        framework: 'react-native',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('e2e-dir/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('e2e-dir/src/app.spec.ts')).toBeTruthy();

      const detoxrc = tree.read('e2e-dir/.detoxrc.json').toString();
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      const appsDetoxrcJson = detoxrcJson['apps'];
      expect(appsDetoxrcJson).toEqual({
        'android.debug': {
          binaryPath:
            '../my-dir/my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../my-dir/my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../my-dir/my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../my-dir/my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../my-dir/my-app/ios/build/Build/Products/Debug-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should update configuration', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');

      expect(project.root).toEqual('e2e-dir');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });
  });

  describe('with directory in name', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-dir-my-app', {
        root: 'my-dir/my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eName: 'my-dir/my-app-e2e',
        appProject: 'my-dir-my-app',
        linter: Linter.None,
        framework: 'react-native',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('my-dir/my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('my-dir/my-app-e2e/src/app.spec.ts')).toBeTruthy();

      const detoxrc = tree.read('my-dir/my-app-e2e/.detoxrc.json').toString();
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      const appsDetoxrcJson = detoxrcJson['apps'];
      expect(appsDetoxrcJson).toEqual({
        'android.debug': {
          binaryPath:
            '../../my-dir/my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../../my-dir/my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../../my-dir/my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../../my-dir/my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../../my-dir/my-app/ios/build/Build/Products/Debug-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should update configuration', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.root).toEqual('my-dir/my-app-e2e');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });
  });

  describe('expo', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-dir-my-app', {
        root: 'my-dir/my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eName: 'my-dir/my-app-e2e',
        appProject: 'my-dir-my-app',
        linter: Linter.None,
        framework: 'expo',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('my-dir/my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('my-dir/my-app-e2e/src/app.spec.ts')).toBeTruthy();

      const detoxrc = tree.read('my-dir/my-app-e2e/.detoxrc.json').toString();
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      const appsDetoxrcJson = detoxrcJson['apps'];
      expect(appsDetoxrcJson).toEqual({
        'android.debug': {
          binaryPath:
            '../../my-dir/my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../../my-dir/my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.local': {
          binaryPath: '../../my-dir/my-app/dist/MyDirMyApp.apk',
          build:
            'npx nx run my-dir-my-app:build --platform android --profile preview --wait --local --no-interactive --output=../../my-dir/my-app/dist/MyDirMyApp.apk',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../../my-dir/my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../../my-dir/my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../../my-dir/my-app/ios/build/Build/Products/Debug-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../../my-dir/my-app/dist/MyDirMyApp.app',
          build:
            'npx nx run my-dir-my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../../my-dir/my-app/dist/MyDirMyApp.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should update configuration', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');

      expect(project.root).toEqual('my-dir/my-app-e2e');
    });

    it('should update nx.json', async () => {
      const project = readProjectConfiguration(tree, 'my-app-e2e');
      expect(project.tags).toEqual([]);
      expect(project.implicitDependencies).toEqual(['my-dir-my-app']);
    });
  });

  describe('tsconfig', () => {
    beforeEach(async () => {
      addProjectConfiguration(tree, 'my-app', { root: 'my-app' });
    });

    it('should extend from tsconfig.base.json', async () => {
      await detoxApplicationGenerator(tree, {
        e2eName: 'my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
      });

      const tsConfig = readJson(tree, 'my-app-e2e/tsconfig.json');
      expect(tsConfig.extends).toEqual('../tsconfig.base.json');
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await detoxApplicationGenerator(tree, {
        e2eName: 'my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
      });

      const tsConfig = readJson(tree, 'my-app-e2e/tsconfig.json');
      expect(tsConfig.extends).toEqual('../tsconfig.json');
    });
  });
});
