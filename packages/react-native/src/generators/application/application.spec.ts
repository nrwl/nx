import 'nx/src/internal-testing-utils/mock-project-graph';

import {
  Tree,
  getProjects,
  readJson,
  readProjectConfiguration,
  updateJson,
  writeJson,
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
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      unitTestRunner: 'none',
      bundler: 'vite',
    });
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      directory: 'my-app',
      displayName: 'myApp',
      tags: 'one,two',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
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
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
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
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
      unitTestRunner: 'jest',
      bundler: 'vite',
    });

    expect(appTree.exists('my-app/jest.config.ts')).toBeTruthy();
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    appTree.rename('tsconfig.base.json', 'tsconfig.json');

    await reactNativeApplicationGenerator(appTree, {
      directory: 'my-app',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
      install: false,
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
            "cd ../my-dir/ios && xcodebuild -workspace MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 15 Plus' -derivedDataPath ./build -quiet",
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
      await reactNativeApplicationGenerator(appTree, {
        directory: 'my-app',
        linter: Linter.EsLint,
        e2eTestRunner: 'detox',
        install: false,
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
  });

  describe('--skipPackageJson', () => {
    it('should not add or update dependencies when true', async () => {
      const packageJsonBefore = readJson(appTree, 'package.json');

      await reactNativeApplicationGenerator(appTree, {
        directory: 'my-app',
        displayName: 'myApp',
        linter: Linter.EsLint,
        e2eTestRunner: 'none',
        install: false,
        skipPackageJson: true,
        unitTestRunner: 'none',
        bundler: 'webpack',
      });

      expect(readJson(appTree, 'package.json')).toEqual(packageJsonBefore);
    });
  });

  describe('TS solution setup', () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
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
    });

    it('should add project references when using TS solution', async () => {
      await reactNativeApplicationGenerator(tree, {
        directory: 'my-app',
        displayName: 'myApp',
        tags: 'one,two',
        linter: Linter.EsLint,
        e2eTestRunner: 'none',
        install: false,
        unitTestRunner: 'jest',
        bundler: 'vite',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./my-app",
          },
        ]
      `);
      const packageJson = readJson(tree, 'my-app/package.json');
      expect(packageJson.name).toBe('@proj/my-app');
      expect(packageJson.nx.name).toBeUndefined();
      // Make sure keys are in idiomatic order
      expect(Object.keys(packageJson)).toMatchInlineSnapshot(`
        [
          "name",
          "version",
          "private",
          "nx",
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
            "lib": [
              "dom",
            ],
            "module": "esnext",
            "moduleResolution": "bundler",
            "noUnusedLocals": false,
            "outDir": "dist",
            "rootDir": "src",
            "tsBuildInfoFile": "dist/tsconfig.app.tsbuildinfo",
            "types": [
              "node",
            ],
          },
          "exclude": [
            "out-tsc",
            "dist",
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "src/**/*.test.tsx",
            "src/**/*.spec.tsx",
            "src/**/*.test.js",
            "src/**/*.spec.js",
            "src/**/*.test.jsx",
            "src/**/*.spec.jsx",
            "src/test-setup.ts",
            "jest.config.ts",
            "eslint.config.js",
            "eslint.config.cjs",
            "eslint.config.mjs",
          ],
          "extends": "../tsconfig.base.json",
          "files": [
            "../node_modules/@nx/react-native/typings/svg.d.ts",
          ],
          "include": [
            "src/**/*.ts",
            "src/**/*.tsx",
            "src/**/*.js",
            "src/**/*.jsx",
          ],
        }
      `);
      expect(readJson(tree, 'my-app/tsconfig.spec.json'))
        .toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "jsx": "react-jsx",
            "lib": [
              "dom",
            ],
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

    it('should respect the provided name', async () => {
      await reactNativeApplicationGenerator(tree, {
        directory: 'my-app',
        name: 'my-app',
        displayName: 'myApp',
        tags: 'one,two',
        linter: Linter.EsLint,
        e2eTestRunner: 'none',
        install: false,
        unitTestRunner: 'jest',
        bundler: 'vite',
        addPlugin: true,
        useProjectJson: false,
      });

      const packageJson = readJson(tree, 'my-app/package.json');
      expect(packageJson.name).toBe('@proj/my-app');
      expect(packageJson.nx.name).toBe('my-app');
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
      await reactNativeApplicationGenerator(tree, {
        directory: 'my-app',
        linter: Linter.EsLint,
        e2eTestRunner: 'cypress',
        install: false,
        unitTestRunner: 'jest',
        bundler: 'vite',
        addPlugin: true,
        useProjectJson: true,
        skipFormat: true,
      });

      expect(tree.exists('my-app/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/my-app'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "name": "@proj/my-app",
          "projectType": "application",
          "root": "my-app",
          "sourceRoot": "my-app/src",
          "tags": [],
          "targets": {},
        }
      `);
      expect(readJson(tree, 'my-app/package.json').nx).toBeUndefined();
      expect(tree.exists('my-app-e2e/project.json')).toBeTruthy();
      expect(readProjectConfiguration(tree, '@proj/my-app-e2e'))
        .toMatchInlineSnapshot(`
        {
          "$schema": "../node_modules/nx/schemas/project-schema.json",
          "implicitDependencies": [
            "@proj/my-app",
          ],
          "name": "@proj/my-app-e2e",
          "projectType": "application",
          "root": "my-app-e2e",
          "sourceRoot": "my-app-e2e/src",
          "tags": [],
          "targets": {},
        }
      `);
      expect(readJson(tree, 'my-app-e2e/package.json').nx).toBeUndefined();
    });
  });
});
