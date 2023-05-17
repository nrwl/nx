import {
  getProjects,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { expoApplicationGenerator } from './application';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    appTree.write('.gitignore', '');
  });

  it('should update workspace', async () => {
    await expoApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: false,
      unitTestRunner: 'none',
    });
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('apps/my-app');
  });

  it('should update nx.json', async () => {
    await expoApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      tags: 'one,two',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: false,
      unitTestRunner: 'none',
    });

    const projectConfiguration = readProjectConfiguration(appTree, 'my-app');
    expect(projectConfiguration).toMatchObject({
      tags: ['one', 'two'],
    });
  });

  it('should generate files', async () => {
    await expoApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: false,
      unitTestRunner: 'jest',
    });
    expect(appTree.exists('apps/my-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('apps/my-app/src/app/App.spec.tsx')).toBeTruthy();

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.base.json');

    expect(appTree.exists('apps/my-app/.eslintrc.json')).toBe(true);
  });

  it('should generate js files', async () => {
    await expoApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    });
    expect(appTree.exists('apps/my-app/src/app/App.js')).toBeTruthy();
    expect(appTree.exists('apps/my-app/src/app/App.spec.js')).toBeTruthy();

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.base.json');

    expect(appTree.exists('apps/my-app/.eslintrc.json')).toBe(true);
  });

  describe('detox', () => {
    it('should create e2e app with directory', async () => {
      await expoApplicationGenerator(appTree, {
        name: 'myApp',
        directory: 'myDir',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
      });

      const projects = getProjects(appTree);
      expect(projects.get('my-dir-my-app').root).toEqual('apps/my-dir/my-app');

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
        'android.eas': {
          binaryPath: '../../../apps/my-dir/my-app/dist/MyApp.apk',
          build:
            'npx nx run my-app:download --platform android --distribution simulator --output=../../../apps/my-dir/my-app/dist/',
          type: 'android.apk',
        },
        'android.local': {
          binaryPath: '../../../apps/my-dir/my-app/dist/MyApp.apk',
          build:
            'npx nx run my-app:build --platform android --profile preview --wait --local --no-interactive --output=../../../apps/my-dir/my-app/dist/MyApp.apk',
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
            "cd ../../../apps/my-dir/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.eas': {
          binaryPath: '../../../apps/my-dir/my-app/dist/MyApp.app',
          build:
            'npx nx run my-app:download --platform ios --distribution simulator --output=../../../apps/my-dir/my-app/dist/',
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../../../apps/my-dir/my-app/dist/MyApp.app',
          build:
            'npx nx run my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../../../apps/my-dir/my-app/dist/MyApp.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../../apps/my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../../../apps/my-dir/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should create e2e app without directory', async () => {
      await expoApplicationGenerator(appTree, {
        name: 'myApp',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
      });

      const projects = getProjects(appTree);
      expect(projects.get('my-app').root).toEqual('apps/my-app');

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
        'android.eas': {
          binaryPath: '../../apps/my-app/dist/MyApp.apk',
          build:
            'npx nx run my-app:download --platform android --distribution simulator --output=../../apps/my-app/dist/',
          type: 'android.apk',
        },
        'android.local': {
          binaryPath: '../../apps/my-app/dist/MyApp.apk',
          build:
            'npx nx run my-app:build --platform android --profile preview --wait --local --no-interactive --output=../../apps/my-app/dist/MyApp.apk',
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
            "cd ../../apps/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.eas': {
          binaryPath: '../../apps/my-app/dist/MyApp.app',
          build:
            'npx nx run my-app:download --platform ios --distribution simulator --output=../../apps/my-app/dist/',
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../../apps/my-app/dist/MyApp.app',
          build:
            'npx nx run my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../../apps/my-app/dist/MyApp.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../apps/my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../../apps/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should create e2e app with display name', async () => {
      await expoApplicationGenerator(appTree, {
        name: 'myApp',
        displayName: 'my app name',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
      });

      const projects = getProjects(appTree);
      expect(projects.get('my-app').root).toEqual('apps/my-app');

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
        'android.eas': {
          binaryPath: '../../apps/my-app/dist/myappname.apk',
          build:
            'npx nx run my-app:download --platform android --distribution simulator --output=../../apps/my-app/dist/',
          type: 'android.apk',
        },
        'android.local': {
          binaryPath: '../../apps/my-app/dist/myappname.apk',
          build:
            'npx nx run my-app:build --platform android --profile preview --wait --local --no-interactive --output=../../apps/my-app/dist/myappname.apk',
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
            "cd ../../apps/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.eas': {
          binaryPath: '../../apps/my-app/dist/myappname.app',
          build:
            'npx nx run my-app:download --platform ios --distribution simulator --output=../../apps/my-app/dist/',
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../../apps/my-app/dist/myappname.app',
          build:
            'npx nx run my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../../apps/my-app/dist/myappname.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../apps/my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../../apps/my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 14' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });
  });
});
