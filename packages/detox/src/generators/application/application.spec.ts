import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
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
        e2eDirectory: 'my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
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
            "cd ../my-app/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
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
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
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
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
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
        e2eDirectory: 'my-dir/my-app-e2e',
        appProject: 'my-dir-my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
      });
    });

    it('should generate files', () => {
      expect(tree.exists('my-dir/my-app-e2e/.detoxrc.json')).toBeTruthy();
      expect(tree.exists('my-dir/my-app-e2e/src/app.spec.ts')).toBeTruthy();

      const detoxrcJson = readJson(tree, 'my-dir/my-app-e2e/.detoxrc.json');
      expect(detoxrcJson.testRunner.args.config).toEqual('./jest.config.json');
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
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
        'ios.release': {
          binaryPath:
            '../../my-dir/my-app/ios/build/Build/Products/Release-iphonesimulator/MyDirMyApp.app',
          build:
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
          type: 'ios.app',
        },
      });
      expect(tree.read('my-dir/my-app-e2e/jest.config.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "preset": "../../jest.preset",
          "rootDir": ".",
          "testMatch": [
            "<rootDir>/src/**/*.test.ts?(x)",
            "<rootDir>/src/**/*.spec.ts?(x)"
          ],
          "testTimeout": 120000,
          "maxWorkers": 1,
          "globalSetup": "detox/runners/jest/globalSetup",
          "globalTeardown": "detox/runners/jest/globalTeardown",
          "reporters": ["detox/runners/jest/reporter"],
          "testEnvironment": "detox/runners/jest/testEnvironment",
          "verbose": true,
          "setupFilesAfterEnv": ["<rootDir>/test-setup.ts"],
          "transform": {
            "^.+\\\\.(ts|js|html)$": [
              "ts-jest",
              { "tsconfig": "<rootDir>/tsconfig.e2e.json" }
            ]
          }
        }
        "
      `);
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
        e2eDirectory: 'my-dir/my-app-e2e',
        appProject: 'my-dir-my-app',
        linter: Linter.None,
        framework: 'expo',
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
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
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
            "cd ../../my-dir/my-app/ios && xcodebuild -workspace MyDirMyApp.xcworkspace -scheme MyDirMyApp -configuration Release -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
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
        e2eDirectory: 'my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
      });

      expect(readJson(tree, 'my-app-e2e/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.base.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.e2e.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'my-app-e2e/tsconfig.e2e.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "outDir": "../dist/out-tsc",
            "sourceMap": false,
            "types": [
              "node",
              "jest",
              "detox",
            ],
          },
          "extends": "./tsconfig.json",
          "include": [
            "src/**/*.ts",
            "src/**/*.js",
          ],
        }
      `);
    });

    it('should support a root tsconfig.json instead of tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await detoxApplicationGenerator(tree, {
        e2eDirectory: 'my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
      });

      expect(readJson(tree, 'my-app-e2e/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "extends": "../tsconfig.json",
          "files": [],
          "include": [],
          "references": [
            {
              "path": "./tsconfig.e2e.json",
            },
          ],
        }
      `);
      expect(readJson(tree, 'my-app-e2e/tsconfig.e2e.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "allowJs": true,
            "outDir": "../dist/out-tsc",
            "sourceMap": false,
            "types": [
              "node",
              "jest",
              "detox",
            ],
          },
          "extends": "./tsconfig.json",
          "include": [
            "src/**/*.ts",
            "src/**/*.js",
          ],
        }
      `);
    });
  });

  describe('TS Solution Setup', () => {
    beforeEach(() => {
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
    });

    it('should create tsconfig.json and update project references', async () => {
      writeJson(tree, 'apps/my-app/package.json', {
        name: 'my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eDirectory: 'apps/my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(tree.read('tsconfig.json', 'utf-8')).toMatchInlineSnapshot(`
        "{
          "extends": "./tsconfig.base.json",
          "files": [],
          "references": [
            {
              "path": "./apps/my-app-e2e"
            }
          ]
        }
        "
      `);
      expect(tree.read('apps/my-app-e2e/package.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "name": "@proj/my-app-e2e",
          "version": "0.0.1",
          "private": true,
          "nx": {
            "implicitDependencies": [
              "my-app"
            ]
          }
        }
        "
      `);
      expect(tree.read('apps/my-app-e2e/tsconfig.json', 'utf-8'))
        .toMatchInlineSnapshot(`
        "{
          "extends": "../../tsconfig.base.json",
          "compilerOptions": {
            "sourceMap": false,
            "outDir": "out-tsc/detox",
            "allowJs": true,
            "types": ["node", "jest", "detox"],
            "rootDir": "src",
            "module": "esnext",
            "moduleResolution": "bundler",
            "tsBuildInfoFile": "out-tsc/detox/tsconfig.tsbuildinfo"
          },
          "include": ["src/**/*.ts", "src/**/*.js"],
          "exclude": ["out-tsc", "dist", "test-output"]
        }
        "
      `);
    });

    it('should generate jest test config with @swc/jest', async () => {
      writeJson(tree, 'apps/my-app/package.json', {
        name: 'my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eDirectory: 'apps/my-app-e2e',
        appProject: 'my-app',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
        skipFormat: true,
        useProjectJson: false,
      });

      expect(tree.exists('apps/my-app-e2e/test-setup.ts')).toBeTruthy();
      const detoxrc = readJson(tree, 'apps/my-app-e2e/.detoxrc.json');
      expect(detoxrc.testRunner.args.config).toEqual('./jest.config.ts');
      expect(tree.read('apps/my-app-e2e/jest.config.ts', 'utf-8'))
        .toMatchInlineSnapshot(`
        "/* eslint-disable */
        import { readFileSync } from 'fs';

        // Reading the SWC compilation config for the spec files
        const swcJestConfig = JSON.parse(
          readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8')
        );

        // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
        swcJestConfig.swcrc = false;

        export default {
          preset: "../../jest.preset",
          rootDir: ".",
          testMatch: [
            "<rootDir>/src/**/*.test.ts?(x)",
            "<rootDir>/src/**/*.spec.ts?(x)"
          ],
          testTimeout: 120000,
          maxWorkers: 1,
          globalSetup: "detox/runners/jest/globalSetup",
          globalTeardown: "detox/runners/jest/globalTeardown",
          reporters: ["detox/runners/jest/reporter"],
          testEnvironment: "detox/runners/jest/testEnvironment",
          verbose: true,
          setupFilesAfterEnv: ["<rootDir>/test-setup.ts"],
          transform: {
            "^.+\\\\.(ts|js|html)$": ['@swc/jest', swcJestConfig]
          }
        };
        "
      `);
      expect(tree.read('apps/my-app-e2e/.spec.swcrc', 'utf-8'))
        .toMatchInlineSnapshot(`
          "{
            "jsc": {
              "target": "es2017",
              "parser": {
                "syntax": "typescript",
                "decorators": true,
                "dynamicImport": true
              },
              "transform": {
                "decoratorMetadata": true,
                "legacyDecorator": true
              },
              "keepClassNames": true,
              "externalHelpers": true,
              "loose": true
            },
            "module": {
              "type": "es6"
            },
            "sourceMaps": true,
            "exclude": []
          }
          "
        `);
    });

    it('should respect the provided e2e name', async () => {
      writeJson(tree, 'apps/my-app/package.json', {
        name: 'my-app',
      });

      await detoxApplicationGenerator(tree, {
        e2eDirectory: 'apps/my-app-e2e',
        appProject: 'my-app',
        e2eName: 'my-app-e2e',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
        skipFormat: true,
        useProjectJson: false,
      });

      const packageJson = readJson(tree, 'apps/my-app-e2e/package.json');
      expect(packageJson.name).toBe('@proj/my-app-e2e');
      expect(packageJson.nx.name).toBe('my-app-e2e');
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
        ]
      `);
    });

    it('should generate project.json if useProjectJson is true', async () => {
      writeJson(tree, 'apps/my-app/package.json', { name: 'my-app' });

      await detoxApplicationGenerator(tree, {
        e2eDirectory: 'apps/my-app-e2e',
        appProject: 'my-app',
        e2eName: 'my-app-e2e',
        linter: Linter.None,
        framework: 'react-native',
        addPlugin: true,
        skipFormat: true,
        useProjectJson: true,
      });

      expect(tree.exists('apps/my-app-e2e/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, 'my-app-e2e'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../../node_modules/nx/schemas/project-schema.json",
          "implicitDependencies": [
            "my-app",
          ],
          "name": "my-app-e2e",
          "projectType": "application",
          "root": "apps/my-app-e2e",
          "sourceRoot": "apps/my-app-e2e/src",
          "tags": [],
          "targets": {},
        }
      `);
      expect(readJson(tree, 'apps/my-app-e2e/package.json').nx).toBeUndefined();
    });
  });
});
