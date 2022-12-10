import {
  Tree,
  readWorkspaceConfiguration,
  getProjects,
  readJson,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { reactNativeApplicationGenerator } from './application';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    appTree.write('.gitignore', '');
  });

  it('should update workspace.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });
    const workspaceJson = readWorkspaceConfiguration(appTree);
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('apps/my-app');
    expect(workspaceJson.defaultProject).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      tags: 'one,two',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });

    const projectConfiguration = readProjectConfiguration(appTree, 'my-app');
    expect(projectConfiguration).toMatchObject({
      tags: ['one', 'two'],
    });
  });

  it('should generate files', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });
    expect(appTree.exists('apps/my-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('apps/my-app/src/main.tsx')).toBeTruthy();

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.base.json');

    expect(appTree.exists('apps/my-app/.eslintrc.json')).toBe(true);
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    appTree.rename('tsconfig.base.json', 'tsconfig.json');

    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
    });

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.json');
  });

  describe('detox', () => {
    it('should create e2e app with directory', async () => {
      await reactNativeApplicationGenerator(appTree, {
        name: 'myApp',
        directory: 'myDir',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        install: false,
      });

      const workspaceJson = readWorkspaceConfiguration(appTree);
      const projects = getProjects(appTree);
      expect(projects.get('my-dir-my-app').root).toEqual('apps/my-dir/my-app');
      expect(workspaceJson.defaultProject).toEqual('my-dir-my-app');

      expect(
        appTree.exists('apps/my-dir/my-app-e2e/.detoxrc.json')
      ).toBeTruthy();
      const detoxrc = appTree.read(
        'apps/my-dir/my-app-e2e/.detoxrc.json',
        'utf-8'
      );
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      expect(detoxrcJson.apps).toEqual({
        'android.debug': {
          binaryPath:
            '../../../apps/my-dir/my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../../../apps/my-dir/my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../../../apps/my-dir/my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../../../apps/my-dir/my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../../../apps/my-dir/my-app/ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
          build:
            "cd ../../../apps/my-dir/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 13' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../../apps/my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../../../apps/my-dir/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 13' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should create e2e app without directory', async () => {
      await reactNativeApplicationGenerator(appTree, {
        name: 'myApp',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        install: false,
      });

      const workspaceJson = readWorkspaceConfiguration(appTree);
      const projects = getProjects(appTree);
      expect(projects.get('my-app').root).toEqual('apps/my-app');
      expect(workspaceJson.defaultProject).toEqual('my-app');

      expect(appTree.exists('apps/my-app-e2e/.detoxrc.json')).toBeTruthy();
      const detoxrc = appTree.read('apps/my-app-e2e/.detoxrc.json', 'utf-8');
      // Strip trailing commas
      const detoxrcJson = JSON.parse(
        detoxrc.replace(/(?<=(true|false|null|["\d}\]])\s*),(?=\s*[}\]])/g, '')
      );
      expect(detoxrcJson.apps).toEqual({
        'android.debug': {
          binaryPath:
            '../../apps/my-app/android/app/build/outputs/apk/debug/app-debug.apk',
          build:
            'cd ../../apps/my-app/android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
          type: 'android.apk',
        },
        'android.release': {
          binaryPath:
            '../../apps/my-app/android/app/build/outputs/apk/release/app-release.apk',
          build:
            'cd ../../apps/my-app/android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
          type: 'android.apk',
        },
        'ios.debug': {
          binaryPath:
            '../../apps/my-app/ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
          build:
            "cd ../../apps/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 13' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../apps/my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../../apps/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 13' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });
  });

  describe('--skipPackageJson', () => {
    it('should not add or update dependencies when true', async () => {
      const packageJsonBefore = appTree.read('package.json', 'utf-8');

      await reactNativeApplicationGenerator(appTree, {
        name: 'myApp',
        displayName: 'myApp',
        linter: Linter.EsLint,
        e2eTestRunner: 'none',
        install: false,
        skipPackageJson: true,
      });

      expect(appTree.read('package.json', 'utf-8')).toEqual(packageJsonBefore);
    });
  });
});
