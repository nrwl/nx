import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  getProjects,
  readJson,
  readNxJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { expoApplicationGenerator } from './application';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
  });

  it('should update workspace', async () => {
    await expoApplicationGenerator(appTree, {
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: false,
      unitTestRunner: 'none',
    });
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await expoApplicationGenerator(appTree, {
      directory: 'my-app',
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
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: false,
      unitTestRunner: 'jest',
    });
    expect(appTree.exists('my-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('my-app/src/app/App.spec.tsx')).toBeTruthy();

    const tsconfig = readJson(appTree, 'my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../tsconfig.base.json');

    expect(appTree.exists('my-app/.eslintrc.json')).toBe(true);
  });

  it('should generate js files', async () => {
    await expoApplicationGenerator(appTree, {
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      skipFormat: false,
      js: true,
      unitTestRunner: 'jest',
    });
    expect(appTree.exists('my-app/src/app/App.js')).toBeTruthy();
    expect(appTree.exists('my-app/src/app/App.spec.js')).toBeTruthy();

    const tsconfig = readJson(appTree, 'my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../tsconfig.base.json');

    expect(appTree.exists('my-app/.eslintrc.json')).toBe(true);
  });

  describe('detox', () => {
    it('should create e2e app with directory', async () => {
      await expoApplicationGenerator(appTree, {
        name: 'my-app',
        directory: 'my-dir',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
      });

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
        'android.local': {
          binaryPath: '../my-dir/dist/MyApp.apk',
          build:
            'npx nx run my-app:build --platform android --profile preview --wait --local --no-interactive --output=../my-dir/dist/MyApp.apk',
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
            "cd ../my-dir/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../my-dir/dist/MyApp.app',
          build:
            'npx nx run my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../my-dir/dist/MyApp.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-dir/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../my-dir/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should create e2e app without directory', async () => {
      await expoApplicationGenerator(appTree, {
        directory: 'my-app',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
      });

      expect(appTree.exists('my-app-e2e/.detoxrc.json')).toBeTruthy();
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
        'android.local': {
          binaryPath: '../my-app/dist/MyApp.apk',
          build:
            'npx nx run my-app:build --platform android --profile preview --wait --local --no-interactive --output=../my-app/dist/MyApp.apk',
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
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../my-app/dist/MyApp.app',
          build:
            'npx nx run my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../my-app/dist/MyApp.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });

    it('should create e2e app with display name', async () => {
      await expoApplicationGenerator(appTree, {
        directory: 'my-app',
        displayName: 'my app name',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
      });

      const projects = getProjects(appTree);
      expect(projects.get('my-app').root).toEqual('my-app');

      expect(appTree.exists('my-app-e2e/.detoxrc.json')).toBeTruthy();
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
        'android.local': {
          binaryPath: '../my-app/dist/myappname.apk',
          build:
            'npx nx run my-app:build --platform android --profile preview --wait --local --no-interactive --output=../my-app/dist/myappname.apk',
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
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.local': {
          binaryPath: '../my-app/dist/myappname.app',
          build:
            'npx nx run my-app:build --platform ios --profile preview --wait --local --no-interactive --output=../my-app/dist/myappname.tar.gz',
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-app/ios/build/Build/Products/Release-iphonesimulator/MyApp.app',
          build:
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
    });
  });

  describe('cypress', () => {
    it('should create e2e app with e2e-ci targetDefaults', async () => {
      await expoApplicationGenerator(appTree, {
        name: 'my-app',
        directory: 'my-dir',
        linter: Linter.EsLint,
        e2eTestRunner: 'cypress',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
        addPlugin: true,
      });

      // ASSERT
      const nxJson = readNxJson(appTree);
      expect(nxJson.targetDefaults['e2e-ci--**/*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^export",
          ],
        }
      `);
    });
  });

  describe('playwright', () => {
    it('should create e2e app with e2e-ci targetDefaults', async () => {
      await expoApplicationGenerator(appTree, {
        name: 'my-app',
        directory: 'my-dir',
        linter: Linter.EsLint,
        e2eTestRunner: 'playwright',
        js: false,
        skipFormat: false,
        unitTestRunner: 'none',
        addPlugin: true,
      });

      // ASSERT
      const nxJson = readNxJson(appTree);
      expect(nxJson.targetDefaults['e2e-ci--**/*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^export",
          ],
        }
      `);
    });
  });

  describe('TS solution setup', () => {
    it('should add project references when using TS solution', async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write('.gitignore', '');
      updateJson(tree, 'package.json', (json) => {
        json.workspaces = ['packages/*', 'apps/*'];
        return json;
      });
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          composite: true,
          declaration: true,
        },
      });
      writeJson(tree, 'tsconfig.json', {
        extends: './tsconfig.base.json',
        files: [],
        references: [],
      });

      await expoApplicationGenerator(tree, {
        directory: 'my-app',
        displayName: 'myApp',
        linter: Linter.EsLint,
        e2eTestRunner: 'none',
        skipFormat: false,
        js: false,
        unitTestRunner: 'jest',
        addPlugin: true,
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./my-app",
          },
        ]
      `);
      expect(readJson(tree, 'my-app/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
            {
              "path": "./tsconfig.spec.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'my-app/tsconfig.app.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "noUnusedLocals": false,
            "outDir": "out-tsc/my-app",
            "rootDir": "src",
            "tsBuildInfoFile": "out-tsc/my-app/tsconfig.app.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "**/*.test.ts",
            "**/*.spec.ts",
            "**/*.test.tsx",
            "**/*.spec.tsx",
            "**/*.test.js",
            "**/*.spec.js",
            "**/*.test.jsx",
            "**/*.spec.jsx",
            "src/test-setup.ts",
            "jest.config.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "files": [
            "../node_modules/@nx/expo/typings/svg.d.ts",
          ],
          "include": [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx",
          ],
        }
      `);
      expect(readJson(tree, 'my-app/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "module": "esnext",
            "moduleResolution": "bundler",
            "noUnusedLocals": false,
            "outDir": "./out-tsc/jest",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "files": [
            "src/test-setup.ts",
          ],
          "include": [
            "jest.config.ts",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/**/*.d.ts",
          ],
          "references": [
            {
              "path": "./tsconfig.app.json",
            },
          ],
        }
      `);
    });
  });
});
