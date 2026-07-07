jest.mock('child_process');

import { dirname, join } from 'path';
import * as childProcess from 'child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { createTreeWithEmptyWorkspace } from '../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../generators/tree';
import { writeJson } from '../generators/utils/json';
import { readJsonFile } from './fileutils';
import { logger } from './logger';
import {
  buildTargetFromScript,
  emitPrunedPnpmInstallAssets,
  getDependencyVersionFromPackageJson,
  getPrunedPnpmInstallSettingsYaml,
  getPrunedPnpmPackageJsonBuildSettings,
  getPrunedPnpmPatchArtifacts,
  getPrunedPnpmLocalPathArtifacts,
  installPackageToTmp,
  normalizePrunedPatchPath,
  PackageJson,
  readModulePackageJson,
  readNxMigrateConfig,
  readTargetsFromPackageJson,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLinkClosure,
  writePrunedPnpmInstallSettings,
} from './package-json';
import * as catalog from './catalog';
import * as pacakgeManager from './package-manager';
import { getPackageManagerCommand } from './package-manager';
import { workspaceRoot } from './workspace-root';

describe('buildTargetFromScript', () => {
  it('should use nx:run-script', () => {
    const target = buildTargetFromScript(
      'build',
      {},
      getPackageManagerCommand()
    );
    expect(target.executor).toEqual('nx:run-script');
  });
});

describe('installPackageToTmp', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('should always disable lifecycle scripts via environment variables', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'nx-install-test-'));
    const cleanup = jest.fn(() =>
      rmSync(tempDir, { recursive: true, force: true })
    );
    jest.spyOn(pacakgeManager, 'createTempNpmDirectory').mockReturnValue({
      dir: tempDir,
      cleanup,
    });
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue('4.0.0');
    jest.spyOn(pacakgeManager, 'getPackageManagerCommand').mockReturnValue({
      preInstall: 'yarn set version 4.0.0',
      addDev: 'yarn add -D',
      ignoreScriptsFlag: undefined,
    } as any);
    const execSyncSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue('' as any);

    installPackageToTmp('nx', 'latest', 'yarn');

    expect(execSyncSpy).toHaveBeenCalledTimes(2);
    for (const [, options] of execSyncSpy.mock.calls) {
      expect(options).toEqual(
        expect.objectContaining({
          env: expect.objectContaining({
            YARN_ENABLE_SCRIPTS: 'false',
          }),
        })
      );
    }

    cleanup();
  });

  it('should use the workspace `addDev` verbatim for pnpm (preserves `-w` when pnpm-workspace.yaml is present)', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'nx-install-test-'));
    const cleanup = jest.fn(() =>
      rmSync(tempDir, { recursive: true, force: true })
    );
    jest.spyOn(pacakgeManager, 'createTempNpmDirectory').mockReturnValue({
      dir: tempDir,
      cleanup,
    });
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue('9.0.0');
    jest.spyOn(pacakgeManager, 'getPackageManagerCommand').mockReturnValue({
      addDev: 'pnpm add -Dw --config.frozen-lockfile=false',
      ignoreScriptsFlag: '--ignore-scripts',
    } as any);
    const execSyncSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue('' as any);

    installPackageToTmp('nx', 'latest', 'pnpm');

    expect(execSyncSpy).toHaveBeenCalledTimes(1);
    expect(execSyncSpy.mock.calls[0][0]).toBe(
      'pnpm add -Dw --config.frozen-lockfile=false nx@latest --config.auto-install-peers=false --ignore-scripts'
    );

    cleanup();
  });

  it('should omit peer dependencies so peers resolve from the workspace, not the temp dir', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'nx-install-test-'));
    const cleanup = jest.fn(() =>
      rmSync(tempDir, { recursive: true, force: true })
    );
    jest.spyOn(pacakgeManager, 'createTempNpmDirectory').mockReturnValue({
      dir: tempDir,
      cleanup,
    });
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue('10.0.0');
    jest.spyOn(pacakgeManager, 'getPackageManagerCommand').mockReturnValue({
      addDev: 'npm install -D',
      ignoreScriptsFlag: '--ignore-scripts',
    } as any);
    const execSyncSpy = jest
      .spyOn(childProcess, 'execSync')
      .mockReturnValue('' as any);

    // npm: peers are omitted via `--omit=peer`
    installPackageToTmp('@nx/cypress', '1.0.0', 'npm');
    expect(execSyncSpy.mock.calls[0][0]).toBe(
      'npm install -D @nx/cypress@1.0.0 --omit=peer --ignore-scripts'
    );

    // bun: also accepts `--omit=peer`
    execSyncSpy.mockClear();
    jest.spyOn(pacakgeManager, 'getPackageManagerCommand').mockReturnValue({
      addDev: 'bun add -D',
      ignoreScriptsFlag: undefined,
    } as any);
    installPackageToTmp('@nx/cypress', '1.0.0', 'bun');
    expect(execSyncSpy.mock.calls[0][0]).toBe(
      'bun add -D @nx/cypress@1.0.0 --omit=peer'
    );

    // pnpm: peers are omitted by disabling auto-install
    execSyncSpy.mockClear();
    jest.spyOn(pacakgeManager, 'getPackageManagerCommand').mockReturnValue({
      addDev: 'pnpm add -Dw --config.frozen-lockfile=false',
      ignoreScriptsFlag: '--ignore-scripts',
    } as any);
    installPackageToTmp('@nx/cypress', '1.0.0', 'pnpm');
    expect(execSyncSpy.mock.calls[0][0]).toBe(
      'pnpm add -Dw --config.frozen-lockfile=false @nx/cypress@1.0.0 --config.auto-install-peers=false --ignore-scripts'
    );

    // yarn: Berry does not auto-install peers, so no flag is added
    execSyncSpy.mockClear();
    jest.spyOn(pacakgeManager, 'getPackageManagerCommand').mockReturnValue({
      addDev: 'yarn add -D',
      ignoreScriptsFlag: undefined,
    } as any);
    installPackageToTmp('@nx/cypress', '1.0.0', 'yarn');
    expect(execSyncSpy.mock.calls[0][0]).toBe('yarn add -D @nx/cypress@1.0.0');

    cleanup();
  });
});

describe('readTargetsFromPackageJson', () => {
  const packageManagerCommand = {
    run: (script: string) => `npm run ${script}`,
  } as any;

  const packageJson: PackageJson = {
    name: 'my-app',
    version: '0.0.0',
    scripts: {
      build: 'echo 1',
    },
  };

  const packageJsonBuildTarget = {
    executor: 'nx:run-script',
    options: {
      script: 'build',
    },
    metadata: {
      runCommand: 'npm run build',
      scriptContent: 'echo 1',
    },
  };

  it('should take targetDefaults for nx-release-publish into account when building the implicit target', () => {
    const nxJson1 = {
      targetDefaults: {
        'nx-release-publish': {
          dependsOn: ['build', 'lint'],
        },
      },
    };
    const result1 = readTargetsFromPackageJson(
      packageJson,
      nxJson1,
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result1['nx-release-publish']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^nx-release-publish",
          "build",
          "lint",
        ],
        "executor": "@nx/js:release-publish",
        "options": {},
      }
    `);

    const nxJson2 = {
      targetDefaults: {
        'nx-release-publish': {
          dependsOn: ['^something'],
          executor: 'totally-different-executor',
        },
      },
    };
    const result2 = readTargetsFromPackageJson(
      packageJson,
      nxJson2,
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result2['nx-release-publish']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^nx-release-publish",
          "^something",
        ],
        "executor": "totally-different-executor",
        "options": {},
      }
    `);

    const nxJson3 = {
      targetDefaults: {
        'nx-release-publish': [
          {
            filter: { executor: '@nx/js:release-publish' },
            dependsOn: ['build'],
            options: {
              dryRun: true,
            },
          },
        ],
      },
    };
    const result3 = readTargetsFromPackageJson(
      packageJson,
      nxJson3,
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result3['nx-release-publish']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^nx-release-publish",
          "build",
        ],
        "executor": "@nx/js:release-publish",
        "options": {
          "dryRun": true,
        },
      }
    `);
  });

  it('should read targets from project.json and package.json', () => {
    const result = readTargetsFromPackageJson(
      packageJson,
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "build": {
          "executor": "nx:run-script",
          "metadata": {
            "runCommand": "npm run build",
            "scriptContent": "echo 1",
          },
          "options": {
            "script": "build",
          },
        },
        "nx-release-publish": {
          "dependsOn": [
            "^nx-release-publish",
          ],
          "executor": "@nx/js:release-publish",
          "options": {},
        },
      }
    `);
  });

  it('should contain extended options from nx property in package.json', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              outputs: ['custom'],
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result).toEqual({
      build: { ...packageJsonBuildTarget, outputs: ['custom'] },
      'nx-release-publish': {
        dependsOn: ['^nx-release-publish'],
        executor: '@nx/js:release-publish',
        options: {},
      },
    });
  });

  it('should ignore scripts that are not in includedScripts', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'included-scripts-test',
        version: '',
        scripts: {
          test: 'echo testing',
          fail: 'exit 1',
        },
        nx: {
          includedScripts: ['test'],
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "nx-release-publish": {
          "dependsOn": [
            "^nx-release-publish",
          ],
          "executor": "@nx/js:release-publish",
          "options": {},
        },
        "test": {
          "executor": "nx:run-script",
          "metadata": {
            "runCommand": "npm run test",
            "scriptContent": "echo testing",
          },
          "options": {
            "script": "test",
          },
        },
      }
    `);
  });

  it('should extend script based targets if matching config', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              outputs: ['custom'],
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.build).toMatchInlineSnapshot(`
      {
        "executor": "nx:run-script",
        "metadata": {
          "runCommand": "npm run build",
          "scriptContent": "echo 1",
        },
        "options": {
          "script": "build",
        },
        "outputs": [
          "custom",
        ],
      }
    `);
  });

  it('should preserve unresolved spread tokens when extending script based targets', () => {
    // https://github.com/nrwl/nx/issues/36235 — the script-derived target has
    // no `inputs`, so the `'...'` cannot resolve here. It must survive into
    // the plugin result so the graph pipeline can expand it against
    // targetDefaults / specified plugin values.
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              inputs: ['...', '{projectRoot}/package.json'],
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.build.inputs).toEqual(['...', '{projectRoot}/package.json']);
  });

  it('should override scripts if provided an executor', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                commands: ['echo 2'],
              },
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.build).toMatchInlineSnapshot(`
      {
        "executor": "nx:run-commands",
        "options": {
          "commands": [
            "echo 2",
          ],
        },
      }
    `);
  });

  it('should override script target when nx target uses command shorthand', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              command: 'echo 2',
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.build).toMatchInlineSnapshot(`
      {
        "command": "echo 2",
      }
    `);
  });

  it('should override script if provided in options', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        scripts: {
          build: 'echo 1',
        },
        nx: {
          targets: {
            build: {
              executor: 'nx:run-script',
              options: {
                script: 'echo 2',
              },
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.build).toMatchInlineSnapshot(`
      {
        "executor": "nx:run-script",
        "options": {
          "script": "echo 2",
        },
      }
    `);
  });

  it('should support targets without scripts', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-other-app',
        version: '',
        nx: {
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                commands: ['echo 2'],
              },
            },
          },
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.build).toMatchInlineSnapshot(`
      {
        "executor": "nx:run-commands",
        "options": {
          "commands": [
            "echo 2",
          ],
        },
      }
    `);
  });

  it('should support partial target info without including script', () => {
    const result = readTargetsFromPackageJson(
      {
        name: 'my-remix-app-8cce',
        version: '',
        scripts: {
          build: 'run-s build:*',
          'build:icons': 'tsx ./other/build-icons.ts',
          'build:remix': 'remix build --sourcemap',
          'build:server': 'tsx ./other/build-server.ts',
          predev: 'npm run build:icons --silent',
          dev: 'remix dev -c "node ./server/dev-server.js" --manual',
          'prisma:studio': 'prisma studio',
          format: 'prettier --write .',
          lint: 'eslint .',
          setup:
            'npm run build && prisma generate && prisma migrate deploy && prisma db seed && playwright install',
          start: 'cross-env NODE_ENV=production node .',
          'start:mocks': 'cross-env NODE_ENV=production MOCKS=true tsx .',
          test: 'vitest',
          coverage: 'nx test --coverage',
          'test:e2e': 'npm run test:e2e:dev --silent',
          'test:e2e:dev': 'playwright test --ui',
          'pretest:e2e:run': 'npm run build',
          'test:e2e:run': 'cross-env CI=true playwright test',
          'test:e2e:install': 'npx playwright install --with-deps chromium',
          typecheck: 'tsc',
          validate: 'run-p "test -- --run" lint typecheck test:e2e:run',
        },
        nx: {
          targets: {
            'build:icons': {
              outputs: ['{projectRoot}/app/components/ui/icons'],
            },
            'build:remix': {
              outputs: ['{projectRoot}/build'],
            },
            'build:server': {
              outputs: ['{projectRoot}/server-build'],
            },
            test: {
              outputs: ['{projectRoot}/test-results'],
            },
            'test:e2e': {
              outputs: ['{projectRoot}/playwright-report'],
            },
            'test:e2e:run': {
              outputs: ['{projectRoot}/playwright-report'],
            },
          },
          includedScripts: [],
        },
      },
      {},
      workspaceRoot,
      '/root',
      packageManagerCommand
    );
    expect(result.test).toMatchInlineSnapshot(`
      {
        "outputs": [
          "{projectRoot}/test-results",
        ],
      }
    `);
  });
});

const rootPackageJson: PackageJson = readJsonFile(
  join(workspaceRoot, 'package.json')
);

const dependencies = [
  ...Object.keys(rootPackageJson.dependencies),
  ...Object.keys(rootPackageJson.devDependencies),
];

const exclusions = new Set([
  // @types/js-yaml doesn't define a main field, but does define exports.
  // exports doesn't contain 'package.json', and main is an empty line.
  // This means the function fails.
  '@types/js-yaml',
  '@webcontainer/api',
]);

// Skip packages this monorepo publishes — pnpm symlinks them into
// `node_modules/<name>` from `packages/<name>`, so resolving them counts as
// a cross-project read in CI's sandbox even though it would be a normal
// install in any consumer workspace. The smoke-test still validates every
// third-party dep's `package.json` exports.
const isPublishedHere = (name: string) =>
  name === 'nx' || name.startsWith('@nx/') || name.startsWith('create-nx-');

describe('readModulePackageJson', () => {
  it.each(
    dependencies.filter((x) => !exclusions.has(x) && !isPublishedHere(x))
  )(`should be able to find %s`, (s) => {
    expect(() => readModulePackageJson(s)).not.toThrow();
  });
});

describe('getDependencyVersionFromPackageJson', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should get single package version from root package.json', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.2.0' },
      devDependencies: { jest: '^29.0.0' },
    });

    const reactVersion = getDependencyVersionFromPackageJson(tree, 'react');
    const jestVersion = getDependencyVersionFromPackageJson(tree, 'jest');

    expect(reactVersion).toBe('^18.2.0');
    expect(jestVersion).toBe('^29.0.0');
  });

  it('should return null for non-existent package', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.2.0' },
    });

    const version = getDependencyVersionFromPackageJson(tree, 'non-existent');
    expect(version).toBeNull();
  });

  it('should prioritize dependencies over devDependencies', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.0.0' },
      devDependencies: { react: '^18.2.0' },
    });

    const version = getDependencyVersionFromPackageJson(tree, 'react');
    expect(version).toBe('^18.0.0');
  });

  it('should read from specific package.json path', () => {
    writeJson(tree, 'packages/my-lib/package.json', {
      dependencies: { '@my/util': '^1.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      '@my/util',
      'packages/my-lib/package.json'
    );
    expect(version).toBe('^1.0.0');
  });

  it('should work with pre-loaded package.json object', () => {
    const packageJson: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.2.0' },
      devDependencies: { jest: '^29.0.0' },
    };
    writeJson(tree, 'package.json', packageJson);

    const reactVersion = getDependencyVersionFromPackageJson(
      tree,
      'react',
      packageJson
    );
    const jestVersion = getDependencyVersionFromPackageJson(
      tree,
      'jest',
      packageJson
    );

    expect(reactVersion).toBe('^18.2.0');
    expect(jestVersion).toBe('^29.0.0');
  });

  it('should check only dependencies section when specified', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.0.0' },
      devDependencies: { react: '^17.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      'react',
      'package.json',
      ['dependencies']
    );
    expect(version).toBe('^18.0.0');
  });

  it('should check only devDependencies section when specified', () => {
    writeJson(tree, 'package.json', {
      dependencies: { jest: '^28.0.0' },
      devDependencies: { jest: '^29.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      'jest',
      'package.json',
      ['devDependencies']
    );
    expect(version).toBe('^29.0.0');
  });

  it('should return null when package not in specified section', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.0.0' },
      devDependencies: { jest: '^29.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      'react',
      'package.json',
      ['devDependencies']
    );
    expect(version).toBeNull();
  });

  it('should respect custom lookup order', () => {
    writeJson(tree, 'package.json', {
      dependencies: { pkg: '^1.0.0' },
      devDependencies: { pkg: '^2.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      'pkg',
      'package.json',
      ['devDependencies', 'dependencies']
    );
    expect(version).toBe('^2.0.0');
  });

  it('should check peerDependencies when specified', () => {
    writeJson(tree, 'package.json', {
      dependencies: { react: '^18.0.0' },
      peerDependencies: { react: '^17.0.0' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      'react',
      'package.json',
      ['peerDependencies']
    );
    expect(version).toBe('^17.0.0');
  });

  it('should check optionalDependencies when specified', () => {
    writeJson(tree, 'package.json', {
      dependencies: { fsevents: '^2.3.0' },
      optionalDependencies: { fsevents: '^2.3.2' },
    });

    const version = getDependencyVersionFromPackageJson(
      tree,
      'fsevents',
      'package.json',
      ['optionalDependencies']
    );
    expect(version).toBe('^2.3.2');
  });

  it('should check multiple sections in order', () => {
    writeJson(tree, 'package.json', {
      devDependencies: { jest: '^29.0.0' },
      peerDependencies: { react: '^18.0.0' },
    });

    const jestVersion = getDependencyVersionFromPackageJson(
      tree,
      'jest',
      'package.json',
      ['dependencies', 'devDependencies', 'peerDependencies']
    );
    const reactVersion = getDependencyVersionFromPackageJson(
      tree,
      'react',
      'package.json',
      ['dependencies', 'devDependencies', 'peerDependencies']
    );

    expect(jestVersion).toBe('^29.0.0');
    expect(reactVersion).toBe('^18.0.0');
  });

  it('should work with pre-loaded package.json object', () => {
    const packageJson: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      devDependencies: { react: '^17.0.0' },
    };
    writeJson(tree, 'package.json', packageJson);

    const version = getDependencyVersionFromPackageJson(
      tree,
      'react',
      packageJson,
      ['devDependencies']
    );
    expect(version).toBe('^17.0.0');
  });

  describe('with catalog references', () => {
    beforeEach(() => {
      jest
        .spyOn(pacakgeManager, 'detectPackageManager')
        .mockReturnValue('pnpm');
      tree.write(
        'pnpm-workspace.yaml',
        `
packages:
  - packages/*
catalog:
  react: "^18.2.0"
  lodash: "^4.17.21"
catalogs:
  frontend:
    vue: "^3.3.0"
`
      );
    });

    it('should resolve catalog reference for single package', () => {
      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
      });

      const version = getDependencyVersionFromPackageJson(tree, 'react');
      expect(version).toBe('^18.2.0');
    });

    it('should resolve named catalog reference', () => {
      writeJson(tree, 'package.json', {
        dependencies: { vue: 'catalog:frontend' },
      });

      const version = getDependencyVersionFromPackageJson(tree, 'vue');
      expect(version).toBe('^3.3.0');
    });

    it('should return null when catalog reference cannot be resolved', () => {
      writeJson(tree, 'package.json', {
        dependencies: { unknown: 'catalog:' },
      });

      const version = getDependencyVersionFromPackageJson(tree, 'unknown');
      expect(version).toBeNull();
    });

    it('should work with pre-loaded package.json', () => {
      const packageJson: PackageJson = {
        name: 'test',
        version: '1.0.0',
        dependencies: { react: 'catalog:' },
      };
      writeJson(tree, 'package.json', packageJson);

      const version = getDependencyVersionFromPackageJson(
        tree,
        'react',
        packageJson
      );

      expect(version).toBe('^18.2.0');
    });

    it('should resolve catalog reference with section-specific lookup', () => {
      writeJson(tree, 'package.json', {
        dependencies: { react: 'catalog:' },
        devDependencies: { lodash: 'catalog:' },
      });

      const reactVersion = getDependencyVersionFromPackageJson(
        tree,
        'react',
        'package.json',
        ['dependencies']
      );
      const lodashVersion = getDependencyVersionFromPackageJson(
        tree,
        'lodash',
        'package.json',
        ['devDependencies']
      );

      expect(reactVersion).toBe('^18.2.0');
      expect(lodashVersion).toBe('^4.17.21');
    });
  });
});

describe('normalizePrunedPatchPath', () => {
  it.each([
    // the default patches/ layout is unchanged
    ['patches/is-number.patch', 'patches/is-number.patch'],
    // a custom directory keeps its subpath under patches/
    ['tools/patches/is-number.patch', 'patches/tools/patches/is-number.patch'],
    // a leading parent-relative segment is dropped, not carried outside patches/
    ['../shared/is-number.patch', 'patches/shared/is-number.patch'],
    // backslash separators (Windows-authored config) are normalized
    [
      'tools\\patches\\is-number.patch',
      'patches/tools/patches/is-number.patch',
    ],
    // an absolute path does not produce a double slash
    ['/abs/is-number.patch', 'patches/abs/is-number.patch'],
    // embedded ../ segments are dropped so the result cannot escape patches/
    ['a/../../../etc/passwd.patch', 'patches/a/etc/passwd.patch'],
  ])('maps %j to %j under patches/', (input, expected) => {
    expect(normalizePrunedPatchPath(input)).toBe(expected);
  });

  it('never lets a normalized patch path escape patches/', () => {
    for (const input of [
      '../../../etc/passwd.patch',
      'a/../../b/../../../x.patch',
      './patches/../../../x.patch',
    ]) {
      const result = normalizePrunedPatchPath(input);
      expect(result.startsWith('patches/')).toBe(true);
      expect(result.split('/')).not.toContain('..');
    }
  });
});

describe('getPrunedPnpmInstallSettingsYaml', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-settings-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function mockPnpmVersion(version: string) {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue(version);
  }

  function writeRootWorkspaceYaml(content: string) {
    writeFileSync(join(tempDir, 'pnpm-workspace.yaml'), content);
  }

  it('carries allowBuilds and supportedArchitectures on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'packages:',
        '  - packages/*',
        'allowBuilds:',
        '  esbuild: true',
        'supportedArchitectures:',
        '  os:',
        '    - linux',
        '',
      ].join('\n')
    );

    const yaml = getPrunedPnpmInstallSettingsYaml(tempDir);

    expect(yaml).not.toBeNull();
    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      allowBuilds: { esbuild: true },
      supportedArchitectures: { os: ['linux'] },
    });
    // Never carry the packages glob: it flips pnpm into workspace mode and pnpm
    // 9 rejects it outright.
    expect(yaml).not.toContain('packages:');
  });

  it('returns null on pnpm 10 (those settings are read from package.json)', () => {
    mockPnpmVersion('10.5.0');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('carries settings on pnpm 12 and above (same behavior as pnpm 11)', () => {
    mockPnpmVersion('12.0.0');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    const yaml = getPrunedPnpmInstallSettingsYaml(tempDir);

    expect(yaml).not.toBeNull();
    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({ allowBuilds: { esbuild: true } });
  });

  it('returns null when the workspace has no root pnpm-workspace.yaml', () => {
    mockPnpmVersion('11.2.2');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('returns null when pnpm 11 declares no install-time settings', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('packages:\n  - packages/*\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('fails open (null) when the pnpm version cannot be determined', () => {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockImplementation(() => {
        throw new Error('no pnpm on PATH');
      });
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('fails open (null) when the root pnpm-workspace.yaml is malformed', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds: { esbuild: true');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('returns null when the root pnpm-workspace.yaml is empty', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('returns null when the root pnpm-workspace.yaml has only comments', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('# no install-time settings here\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('writes the settings file on pnpm 11 and skips it on pnpm 10', () => {
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    const outputFile = join(outputDir, 'pnpm-workspace.yaml');

    mockPnpmVersion('10.5.0');
    writePrunedPnpmInstallSettings(outputDir, tempDir);
    expect(existsSync(outputFile)).toBe(false);

    jest.restoreAllMocks();
    mockPnpmVersion('11.2.2');
    writePrunedPnpmInstallSettings(outputDir, tempDir);
    expect(existsSync(outputFile)).toBe(true);
    const { load } = require('@zkochan/js-yaml');
    expect(load(readFileSync(outputFile, 'utf-8'))).toEqual({
      allowBuilds: { esbuild: true },
    });
  });

  const prunedLockfileWith = (...packageKeys: string[]) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      ...packageKeys.flatMap((key) => [
        // pnpm quotes keys that start with `@` (a reserved YAML indicator)
        `  ${key.startsWith('@') ? `'${key}'` : key}:`,
        '    resolution: {integrity: sha512-abc}',
        '',
      ]),
    ].join('\n');

  it('scopes allowBuilds to the packages present in the pruned lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'allowBuilds:',
        '  esbuild: true',
        "  '@parcel/watcher': true",
        '  some-absent-native-dep: true',
        '',
      ].join('\n')
    );

    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      prunedLockfileWith('esbuild@0.21.5', '@parcel/watcher@2.4.1')
    );

    const { load } = require('@zkochan/js-yaml');
    // the entry for the package the prune dropped is left out
    expect(load(yaml)).toEqual({
      allowBuilds: { esbuild: true, '@parcel/watcher': true },
    });
  });

  it('drops allowBuilds when no approved package is in the pruned lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  some-absent-native-dep: true\n');

    expect(
      getPrunedPnpmInstallSettingsYaml(
        tempDir,
        prunedLockfileWith('lodash@4.17.21')
      )
    ).toBeNull();
  });

  it('scopes allowBuilds using the pruned lockfile written to the output dir', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'allowBuilds:\n  esbuild: true\n  some-absent-native-dep: true\n'
    );
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'pnpm-lock.yaml'),
      prunedLockfileWith('esbuild@0.21.5')
    );

    writePrunedPnpmInstallSettings(outputDir, tempDir);

    const { load } = require('@zkochan/js-yaml');
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({ allowBuilds: { esbuild: true } });
  });

  it('removes a stale settings file when the pruned output no longer has settings', () => {
    mockPnpmVersion('11.2.2');
    // Root once approved a build script, so a prior deploy wrote settings out.
    writeRootWorkspaceYaml('allowBuilds:\n  some-absent-native-dep: true\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    const outputFile = join(outputDir, 'pnpm-workspace.yaml');
    // Leftover from that earlier deploy (a cache replay restores only the files
    // the newer entry holds, so an emptied settings set leaves this behind).
    writeFileSync(outputFile, 'allowBuilds:\n  some-absent-native-dep: true\n');

    // The current pruned lockfile approves nothing, so there are no settings.
    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('lodash@4.17.21')
    );

    expect(existsSync(outputFile)).toBe(false);
  });

  it('prefers passed lockfile content over re-reading it from disk', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      ['allowBuilds:', '  esbuild: true', "  '@parcel/watcher': true", ''].join(
        '\n'
      )
    );
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    // A stale on-disk lockfile the caller's in-memory content supersedes.
    writeFileSync(
      join(outputDir, 'pnpm-lock.yaml'),
      prunedLockfileWith('esbuild@0.21.5')
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('@parcel/watcher@2.4.1')
    );

    const { load } = require('@zkochan/js-yaml');
    // Scoped to the passed content (@parcel/watcher), not the on-disk esbuild.
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({ allowBuilds: { '@parcel/watcher': true } });
  });

  // A pruned lockfile carrying a patchedDependencies section (values are the
  // patch hashes; only the keys drive scoping).
  const prunedLockfileWithPatches = (
    packageKeys: string[],
    patchKeys: string[]
  ) =>
    [
      prunedLockfileWith(...packageKeys),
      'patchedDependencies:',
      ...patchKeys.map(
        (key) => `  ${key.startsWith('@') ? `'${key}'` : key}: hash-${key}`
      ),
      '',
    ].join('\n');

  function writeRootPatch(patchPath: string, content = 'PATCH\n') {
    const full = join(tempDir, patchPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  it('carries patchedDependencies in the pnpm 11 yaml, scoped to surviving packages', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/is-number@7.0.0.patch',
        '  left-pad@1.0.0: patches/left-pad@1.0.0.patch',
        '',
      ].join('\n')
    );

    // only is-number survives the prune
    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      patchedDependencies: {
        'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
      },
    });
  });

  it('carries a name-only (unversioned) patch key scoped to the surviving package', () => {
    mockPnpmVersion('11.2.2');
    // A name-only key patches every version; the lockfile records it under the
    // bare name while the package key stays versioned. The scope must still
    // match the two against the shared root config key.
    writeRootWorkspaceYaml(
      ['patchedDependencies:', '  is-number: patches/is-number.patch', ''].join(
        '\n'
      )
    );
    writeRootPatch('patches/is-number.patch', 'THE PATCH\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number'])
    );

    expect(patchFiles).toEqual([
      { path: 'patches/is-number.patch', content: 'THE PATCH\n' },
    ]);
  });

  it('carries a semver-range patch key scoped to the surviving package', () => {
    mockPnpmVersion('11.2.2');
    // A range key patches every matching version; the pruned lockfile keeps the
    // range key verbatim, so the scope matches it against the shared root config
    // key.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@^7.0.0: patches/is-number@7.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number@7.patch', 'THE PATCH\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@^7.0.0'])
    );

    expect(patchFiles).toEqual([
      { path: 'patches/is-number@7.patch', content: 'THE PATCH\n' },
    ]);
  });

  it('ships patch files and keeps patchedDependencies out of package.json on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toEqual([
      { path: 'patches/is-number@7.0.0.patch', content: 'THE PATCH\n' },
    ]);
    // pnpm 11 carries the declaration in pnpm-workspace.yaml, not package.json
    expect(packageJsonPatchedDependencies).toBeNull();
  });

  it('declares patchedDependencies in package.json on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    // pnpm <=10 reads the config from the package.json pnpm field
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    writeRootPatch('patches/is-number@7.0.0.patch');

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toHaveLength(1);
    expect(packageJsonPatchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
    });
  });

  it('relocates a custom patch path under patches/ preserving its subpath in the pnpm 11 yaml and files', () => {
    mockPnpmVersion('11.2.2');
    // A workspace can keep patches outside patches/ (custom or shared dir). The
    // pruned output relocates them under patches/ with their subpath preserved,
    // so the prune target's declared `patches` output covers them; otherwise a
    // cache replay drops the file and the standalone install fails on the
    // missing patch.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: tools/patches/is-number.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('tools/patches/is-number.patch', 'THE PATCH\n');

    const lockfile = prunedLockfileWithPatches(
      ['is-number@7.0.0'],
      ['is-number@7.0.0']
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(getPrunedPnpmInstallSettingsYaml(tempDir, lockfile))).toEqual({
      patchedDependencies: {
        'is-number@7.0.0': 'patches/tools/patches/is-number.patch',
      },
    });

    const { patchFiles } = getPrunedPnpmPatchArtifacts(tempDir, lockfile);
    // Read from the custom source, shipped under patches/ with its subpath kept.
    expect(patchFiles).toEqual([
      {
        path: 'patches/tools/patches/is-number.patch',
        content: 'THE PATCH\n',
      },
    ]);
  });

  it('ships a patch referenced by an absolute config path', () => {
    mockPnpmVersion('11.2.2');
    // pnpm accepts an absolute patchedDependencies path even though its own
    // patch-commit writes relative ones. The config/lockfile side already maps
    // it under patches/, so the file must ship from its absolute source or the
    // standalone install would reference a patch that was never copied in.
    const absolutePatchPath = join(tempDir, 'patches', 'is-number@7.0.0.patch');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        `  is-number@7.0.0: ${absolutePatchPath}`,
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    expect(patchFiles).toHaveLength(1);
    expect(patchFiles[0].content).toBe('THE PATCH\n');
    expect(patchFiles[0].path.startsWith('patches/')).toBe(true);
    expect(patchFiles[0].path.endsWith('/is-number@7.0.0.patch')).toBe(true);
  });

  it('relocates a custom patch path under patches/ preserving its subpath in the package.json declaration on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'custom/is-number.patch',
          },
        },
      })
    );
    writeRootPatch('custom/is-number.patch');

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toEqual([
      { path: 'patches/custom/is-number.patch', content: 'PATCH\n' },
    ]);
    expect(packageJsonPatchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/custom/is-number.patch',
    });
  });

  it('keeps same-named patches in different directories from colliding under patches/', () => {
    mockPnpmVersion('11.2.2');
    // Two patches sharing a file name in different source directories must land
    // at distinct paths under patches/, or one would overwrite the other and the
    // install would apply the wrong patch (or fail the hash check).
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: a/fix.patch',
        '  is-odd@3.0.1: b/fix.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('a/fix.patch', 'PATCH A\n');
    writeRootPatch('b/fix.patch', 'PATCH B\n');

    const lockfile = prunedLockfileWithPatches(
      ['is-number@7.0.0', 'is-odd@3.0.1'],
      ['is-number@7.0.0', 'is-odd@3.0.1']
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(getPrunedPnpmInstallSettingsYaml(tempDir, lockfile))).toEqual({
      patchedDependencies: {
        'is-number@7.0.0': 'patches/a/fix.patch',
        'is-odd@3.0.1': 'patches/b/fix.patch',
      },
    });

    const { patchFiles } = getPrunedPnpmPatchArtifacts(tempDir, lockfile);
    expect(patchFiles).toEqual([
      { path: 'patches/a/fix.patch', content: 'PATCH A\n' },
      { path: 'patches/b/fix.patch', content: 'PATCH B\n' },
    ]);
  });

  it('scopes patch artifacts to the packages in the pruned lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/is-number@7.0.0.patch',
        '  left-pad@1.0.0: patches/left-pad@1.0.0.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number@7.0.0.patch');
    writeRootPatch('patches/left-pad@1.0.0.patch');

    // left-pad is not present in the pruned lockfile
    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    expect(patchFiles.map((file) => file.path)).toEqual([
      'patches/is-number@7.0.0.patch',
    ]);
  });

  it('warns but keeps the declaration when a patch source file is missing', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    // The patch file is intentionally NOT written to disk.
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toEqual([]);
    // The declaration is kept: dropping only it would mismatch the pruned
    // lockfile, which still lists the patch.
    expect(packageJsonPatchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('patches/is-number@7.0.0.patch')
    );
    warn.mockRestore();
  });

  it('returns no patch artifacts when the pruned lockfile has no patches', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWith('is-number@7.0.0')
      );

    expect(patchFiles).toEqual([]);
    expect(packageJsonPatchedDependencies).toBeNull();
  });

  it('copies patch files and declares them in package.json on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'PATCH BODY\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', version: '0.0.1' })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    // pnpm 10 reads no pnpm-workspace.yaml
    expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(false);
    // the patch file is copied preserving its relative path
    expect(
      readFileSync(join(outputDir, 'patches/is-number@7.0.0.patch'), 'utf-8')
    ).toBe('PATCH BODY\n');
    // and the declaration lands in the emitted package.json
    const manifest = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(manifest.pnpm.patchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
    });
  });

  it('carries patches in the yaml and leaves package.json untouched on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', version: '0.0.1' })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    const { load } = require('@zkochan/js-yaml');
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({
      patchedDependencies: {
        'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
      },
    });
    expect(existsSync(join(outputDir, 'patches/is-number@7.0.0.patch'))).toBe(
      true
    );
    // pnpm 11 ignores the package.json pnpm field, so it stays as emitted
    const manifest = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(manifest.pnpm).toBeUndefined();
  });

  // emitPrunedPnpmInstallAssets is the sink-based sibling the bundler plugins
  // (webpack, rspack) use: it emits the same artifacts writePrunedPnpmInstallSettings
  // writes, but through a caller callback and mutating the in-memory manifest.
  it('emits the pnpm-workspace.yaml and patch files and leaves package.json untouched on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');
    const packageJson: PackageJson = { name: 'app', version: '0.0.1' };
    const emitted: Array<{ path: string; content: string }> = [];

    emitPrunedPnpmInstallAssets(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0']),
      packageJson,
      (path, content) => emitted.push({ path, content })
    );

    const { load } = require('@zkochan/js-yaml');
    const yamlAsset = emitted.find((a) => a.path === 'pnpm-workspace.yaml');
    expect(load(yamlAsset.content)).toEqual({
      patchedDependencies: {
        'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
      },
    });
    expect(emitted).toContainEqual({
      path: 'patches/is-number@7.0.0.patch',
      content: 'THE PATCH\n',
    });
    // pnpm 11 carries the declaration in pnpm-workspace.yaml, not package.json
    expect(packageJson.pnpm).toBeUndefined();
  });

  it('ships the patch file and folds patchedDependencies into the in-memory manifest on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');
    // an existing pnpm field must survive the fold, not be replaced
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      pnpm: { onlyBuiltDependencies: ['esbuild'] },
    };
    const emitted: Array<{ path: string; content: string }> = [];

    emitPrunedPnpmInstallAssets(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0']),
      packageJson,
      (path, content) => emitted.push({ path, content })
    );

    // pnpm <=10 has no pnpm-workspace.yaml; only the patch file is emitted
    expect(emitted).toEqual([
      { path: 'patches/is-number@7.0.0.patch', content: 'THE PATCH\n' },
    ]);
    expect(packageJson.pnpm).toEqual({
      onlyBuiltDependencies: ['esbuild'],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
      },
    });
  });

  it('emits nothing and leaves package.json untouched when there are no pnpm install settings', () => {
    mockPnpmVersion('11.2.2');
    const packageJson: PackageJson = { name: 'app', version: '0.0.1' };
    const emitted: Array<{ path: string; content: string }> = [];

    emitPrunedPnpmInstallAssets(
      tempDir,
      prunedLockfileWith('is-number@7.0.0'),
      packageJson,
      (path, content) => emitted.push({ path, content })
    );

    expect(emitted).toEqual([]);
    expect(packageJson.pnpm).toBeUndefined();
  });

  it('throws when two patch sources would ship to the same path', () => {
    mockPnpmVersion('11.2.2');
    // `patches/dupe.patch` and `dupe.patch` are different files but both
    // normalize to `patches/dupe.patch`; shipping one for both would apply the
    // wrong patch, so fail loudly instead.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/dupe.patch',
        '  is-odd@3.0.1: dupe.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/dupe.patch', 'A\n');
    writeRootPatch('dupe.patch', 'B\n');

    expect(() =>
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(
          ['is-number@7.0.0', 'is-odd@3.0.1'],
          ['is-number@7.0.0', 'is-odd@3.0.1']
        )
      )
    ).toThrow(/both ship to "patches\/dupe\.patch"/);
  });

  it('ships a single file when two keys reference the same patch', () => {
    mockPnpmVersion('11.2.2');
    // Two keys sharing one patch file is not a collision: the same source ships
    // once.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/shared.patch',
        '  is-number@7.0.1: patches/shared.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/shared.patch', 'SHARED\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(
        ['is-number@7.0.0', 'is-number@7.0.1'],
        ['is-number@7.0.0', 'is-number@7.0.1']
      )
    );

    expect(patchFiles).toEqual([
      { path: 'patches/shared.patch', content: 'SHARED\n' },
    ]);
  });

  it('prefers the pnpm-workspace.yaml patch path over a stale package.json one', () => {
    mockPnpmVersion('11.2.2');
    // The same key in both root sources with different paths. pnpm-workspace.yaml
    // is authoritative on pnpm 11, so its path (and file) must win.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/current.patch',
        '',
      ].join('\n')
    );
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: { 'is-number@7.0.0': 'patches/stale.patch' },
        },
      })
    );
    writeRootPatch('patches/current.patch', 'CURRENT\n');
    writeRootPatch('patches/stale.patch', 'STALE\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    expect(patchFiles).toEqual([
      { path: 'patches/current.patch', content: 'CURRENT\n' },
    ]);
  });

  it('resolves the pnpm version once per write even when shipping patches', () => {
    const versionSpy = jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number.patch\n'
    );
    writeRootPatch('patches/is-number.patch');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    // The pnpm major is resolved once at the entry point and threaded into both
    // builders, not re-detected inside each.
    expect(versionSpy).toHaveBeenCalledTimes(1);
  });
});

describe('getPrunedPnpmPackageJsonBuildSettings', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-build-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function mockPnpmVersion(version: string) {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue(version);
  }
  function writeRootWorkspaceYaml(content: string) {
    writeFileSync(join(tempDir, 'pnpm-workspace.yaml'), content);
  }
  function writeRootPackageJson(pnpm: Record<string, unknown>) {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ pnpm }));
  }
  const prunedLockfileWith = (...packageKeys: string[]) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      ...packageKeys.flatMap((key) => [
        `  ${key.startsWith('@') ? `'${key}'` : key}:`,
        '    resolution: {integrity: sha512-abc}',
        '',
      ]),
    ].join('\n');

  it('returns null on pnpm 11 (build approvals go to pnpm-workspace.yaml)', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toBeNull();
  });

  it('carries onlyBuiltDependencies from pnpm-workspace.yaml on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
    });
  });

  it('carries onlyBuiltDependencies from the root package.json pnpm field on pnpm 9', () => {
    mockPnpmVersion('9.15.9');
    // pnpm 9 reads build approvals only from the package.json pnpm field.
    writeRootPackageJson({ onlyBuiltDependencies: ['esbuild'] });

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
    });
  });

  it('folds a root allowBuilds map into on/never-built lists (pnpm 10.26+)', () => {
    mockPnpmVersion('10.26.0');
    writeRootWorkspaceYaml(
      'allowBuilds:\n  esbuild: true\n  telemetry-dep: false\n'
    );

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
      neverBuiltDependencies: ['telemetry-dep'],
    });
  });

  it('scopes approvals to the packages present in the pruned lockfile', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml(
      'onlyBuiltDependencies:\n  - esbuild\n  - some-absent-native-dep\n'
    );

    expect(
      getPrunedPnpmPackageJsonBuildSettings(
        tempDir,
        prunedLockfileWith('esbuild@0.21.5')
      )
    ).toEqual({ onlyBuiltDependencies: ['esbuild'] });
  });

  it('carries supportedArchitectures', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml(
      'supportedArchitectures:\n  os:\n    - linux\n  cpu:\n    - x64\n'
    );

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      supportedArchitectures: { os: ['linux'], cpu: ['x64'] },
    });
  });

  it('lets pnpm-workspace.yaml win over the root package.json per field', () => {
    mockPnpmVersion('10.13.1');
    writeRootPackageJson({ onlyBuiltDependencies: ['from-package-json'] });
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - from-workspace-yaml\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['from-workspace-yaml'],
    });
  });

  it('returns null when the workspace declares no build approvals', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('packages:\n  - packages/*\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toBeNull();
  });

  it('fails open (null) when the pnpm version cannot be determined', () => {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockImplementation(() => {
        throw new Error('no pnpm on PATH');
      });
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toBeNull();
  });

  it('folds build approvals into the emitted package.json on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { esbuild: '0.21.5' } })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('esbuild@0.21.5')
    );

    const pkg = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(pkg.pnpm).toEqual({ onlyBuiltDependencies: ['esbuild'] });
    // pnpm <=10 reads these from package.json, so no workspace file is written.
    expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('keeps build approvals out of the emitted package.json on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { esbuild: '0.21.5' } })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('esbuild@0.21.5')
    );

    const pkg = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(pkg.pnpm).toBeUndefined();
    const { load } = require('@zkochan/js-yaml');
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({ allowBuilds: { esbuild: true } });
  });

  it('unions a project-level approval with the carried one', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({
        name: 'app',
        pnpm: { onlyBuiltDependencies: ['app-native'] },
        dependencies: { esbuild: '0.21.5', 'app-native': '1.0.0' },
      })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('esbuild@0.21.5', 'app-native@1.0.0')
    );

    const pkg = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(new Set(pkg.pnpm.onlyBuiltDependencies)).toEqual(
      new Set(['app-native', 'esbuild'])
    );
  });
});

describe('getPrunedPnpmLocalPathArtifacts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-tarball-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const lockfileWithTarball = (tarballSpec: string) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      `  vendored-lib@${tarballSpec}:`,
      `    resolution: {integrity: sha512-abc, tarball: ${tarballSpec}}`,
      '',
    ].join('\n');

  it('ships a file: tarball vendored inside the workspace', () => {
    mkdirSync(join(tempDir, 'vendor'));
    const bytes = Buffer.from([0, 1, 2, 3]);
    writeFileSync(join(tempDir, 'vendor/vendored-lib-1.0.0.tgz'), bytes);

    const artifacts = getPrunedPnpmLocalPathArtifacts(
      tempDir,
      lockfileWithTarball('file:vendor/vendored-lib-1.0.0.tgz')
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].path).toBe('vendor/vendored-lib-1.0.0.tgz');
    expect(readFileSync(artifacts[0].sourcePath).equals(bytes)).toBe(true);
  });

  it('does not ship an https tarball', () => {
    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        lockfileWithTarball('https://example.com/vendored-lib-1.0.0.tgz')
      )
    ).toEqual([]);
  });

  it('does not ship a copied workspace module (directory resolution)', () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      "  '@scope/lib@file:workspace_modules/@scope/lib':",
      '    resolution: {directory: workspace_modules/@scope/lib, type: directory}',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
  });

  it('warns and skips a tarball resolved outside the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        lockfileWithTarball('file:../external/vendored-lib-1.0.0.tgz')
      )
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('warns and skips a tarball missing on disk', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        lockfileWithTarball('file:vendor/missing.tgz')
      )
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('was not found'));
  });

  it('ships a file: directory tree and filters node_modules', () => {
    mkdirSync(join(tempDir, 'vendor/dir/nested'), { recursive: true });
    mkdirSync(join(tempDir, 'vendor/dir/node_modules'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/dir/index.js'), 'module.exports={}');
    writeFileSync(join(tempDir, 'vendor/dir/nested/util.js'), 'exports.x=1');
    writeFileSync(join(tempDir, 'vendor/dir/node_modules/junk.js'), 'junk');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  vendored-dir@file:vendor/dir:',
      '    resolution: {directory: vendor/dir, type: directory}',
      '',
    ].join('\n');

    const paths = getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)
      .map((a) => a.path)
      .sort();
    expect(paths).toEqual(['vendor/dir/index.js', 'vendor/dir/nested/util.js']);
  });

  it('ships a root importer link: target tree', () => {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/linked',
      '        version: link:vendor/linked',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([
      {
        path: 'vendor/linked/index.js',
        sourcePath: join(tempDir, 'vendor/linked/index.js'),
      },
    ]);
  });

  it('ships a copied module link: snapshot target', () => {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    resolution: {directory: workspace_modules/mylib, type: directory}',
      '',
      'snapshots:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    dependencies:',
      '      linked-lib: link:../../vendor/linked',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmLocalPathArtifacts(tempDir, lockfile).map((a) => a.path)
    ).toEqual(['vendor/linked/index.js']);
  });

  it('does not ship a link: that points into workspace_modules', () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      my-workspace-lib:',
      '        specifier: link:workspace_modules/my-workspace-lib',
      '        version: link:workspace_modules/my-workspace-lib',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
  });

  it('dedups a target referenced by both the importer and a copied module', () => {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/linked',
      '        version: link:vendor/linked',
      '',
      'packages:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    resolution: {directory: workspace_modules/mylib, type: directory}',
      '',
      'snapshots:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    dependencies:',
      '      linked-lib: link:../../vendor/linked',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmLocalPathArtifacts(tempDir, lockfile).map((a) => a.path)
    ).toEqual(['vendor/linked/index.js']);
  });

  it('warns and skips a link: target resolved outside the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:../external/linked',
      '        version: link:../external/linked',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('warns and skips a link: target missing on disk', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/ghost',
      '        version: link:vendor/ghost',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('was not found'));
  });

  it('warns and skips an absolute link: target instead of rebasing it under the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    // A same-named directory inside the workspace must not be shipped in its place.
    mkdirSync(join(tempDir, 'opt/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'opt/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:/opt/linked',
      '        version: link:/opt/linked',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('warns and skips a link: target that resolves to the workspace root itself', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    writeFileSync(join(tempDir, 'file-at-root.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      root-pkg:',
      '        specifier: link:.',
      '        version: link:.',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('workspace root itself')
    );
  });

  it('ships a link: target referenced from a vendored file: directory snapshot', () => {
    mkdirSync(join(tempDir, 'vendor/dir'), { recursive: true });
    mkdirSync(join(tempDir, 'vendor/helper'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/dir/index.js'), 'module.exports={}');
    writeFileSync(join(tempDir, 'vendor/helper/index.js'), 'exports.h=1');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  vendored-dir@file:vendor/dir:',
      '    resolution: {directory: vendor/dir, type: directory}',
      '',
      'snapshots:',
      '',
      '  vendored-dir@file:vendor/dir:',
      '    dependencies:',
      '      helper: link:../helper',
      '',
    ].join('\n');

    const paths = getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)
      .map((a) => a.path)
      .sort();
    expect(paths).toEqual(['vendor/dir/index.js', 'vendor/helper/index.js']);
  });

  it('warns about a symbolic link inside a shipped directory instead of silently dropping it', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');
    symlinkSync(
      join(tempDir, 'vendor/linked/index.js'),
      join(tempDir, 'vendor/linked/alias.js')
    );

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/linked',
      '        version: link:vendor/linked',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmLocalPathArtifacts(tempDir, lockfile).map((a) => a.path)
    ).toEqual(['vendor/linked/index.js']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('symbolic link'));
  });

  it('returns [] when there is no pruned lockfile content', () => {
    expect(getPrunedPnpmLocalPathArtifacts(tempDir)).toEqual([]);
  });
});

describe('rewritePrunedLocalPathSpecifiers', () => {
  const WS = '/ws';

  beforeEach(() => {
    // Isolate from any real catalog config; the catalog test overrides this.
    jest.spyOn(catalog, 'getCatalogManager').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rewrites a file: directory specifier to be workspace-root-relative', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { vendored: 'file:./vendor/pkg' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.vendored).toBe('file:apps/api/vendor/pkg');
  });

  it('rewrites a link: specifier to be workspace-root-relative', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { shared: 'link:../shared' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.shared).toBe('link:apps/shared');
  });

  it('resolves the path from a nested project root', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { lib: 'link:../../lib' },
    };

    rewritePrunedLocalPathSpecifiers(
      packageJson,
      'apps/nested/api',
      WS,
      new Set()
    );

    expect(packageJson.dependencies.lib).toBe('link:apps/lib');
  });

  it('moves a file:/link: peer dependency into dependencies and drops its meta', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      peerDependencies: { shared: 'link:../shared' },
      peerDependenciesMeta: { shared: { optional: true } },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies).toEqual({ shared: 'link:apps/shared' });
    expect(packageJson.peerDependencies.shared).toBeUndefined();
    expect(packageJson.peerDependenciesMeta.shared).toBeUndefined();
  });

  it('leaves a target that escapes the workspace root as-is with a warning', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { external: 'file:../../../outside/pkg' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.external).toBe('file:../../../outside/pkg');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('leaves an absolute local-path specifier as-is with a warning', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { vendored: 'link:/opt/thing' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.vendored).toBe('link:/opt/thing');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('leaves a link: to the workspace root itself as-is with a warning', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { 'root-pkg': 'link:../..' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies['root-pkg']).toBe('link:../..');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('workspace root itself')
    );
  });

  it('still moves an unshippable local-path peer into dependencies', () => {
    // pnpm rejects any file:/link: spec under peerDependencies, so even a
    // warned-about target must move or the whole install fails.
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      peerDependencies: { external: 'link:../../../outside/shared' },
      peerDependenciesMeta: { external: { optional: true } },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies).toEqual({
      external: 'link:../../../outside/shared',
    });
    expect(packageJson.peerDependencies.external).toBeUndefined();
    expect(packageJson.peerDependenciesMeta.external).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('skips a workspace package declared via link:', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { '@scope/lib': 'link:../../libs/lib' },
    };

    rewritePrunedLocalPathSpecifiers(
      packageJson,
      'apps/api',
      WS,
      new Set(['@scope/lib'])
    );

    expect(packageJson.dependencies['@scope/lib']).toBe('link:../../libs/lib');
  });

  it('leaves a registry specifier untouched', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.lodash).toBe('^4.17.21');
  });

  it('resolves a catalog: reference before rewriting the local path', () => {
    jest.spyOn(catalog, 'getCatalogManager').mockReturnValue({
      isCatalogReference: (spec: string) => spec === 'catalog:',
      resolveCatalogReference: () => 'link:../shared',
    } as any);
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { shared: 'catalog:' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.shared).toBe('link:apps/shared');
  });
});

describe('validatePrunedLinkClosure', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-link-closure-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  // A pruned lockfile whose root importer links a vendored package.
  const lockfileLinking = (linkPath: string) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      `        specifier: link:${linkPath}`,
      `        version: link:${linkPath}`,
      '',
    ].join('\n');

  function writeLinkedManifest(manifest: Record<string, unknown>) {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(
      join(tempDir, 'vendor/linked/package.json'),
      JSON.stringify({ name: 'linked-lib', version: '1.0.0', ...manifest })
    );
  }

  it('passes when the linked package required deps are app direct dependencies', () => {
    writeLinkedManifest({ dependencies: { lodash: '^4.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfileLinking('vendor/linked'))
    ).not.toThrow();
  });

  it('passes when the required dep is an app optionalDependency', () => {
    writeLinkedManifest({ dependencies: { fsevents: '^2.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      optionalDependencies: { fsevents: '^2.3.0' },
    };

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfileLinking('vendor/linked'))
    ).not.toThrow();
  });

  it('passes when the required dep is an app peerDependency', () => {
    // The pruned lockfile's root importer folds app peers into dependencies,
    // so the deploy install provides them.
    writeLinkedManifest({ dependencies: { react: '^18.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      peerDependencies: { react: '^18.0.0' },
    };

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfileLinking('vendor/linked'))
    ).not.toThrow();
  });

  it('fails when a linked package requires a dep absent from the app direct deps', () => {
    writeLinkedManifest({ dependencies: { 'missing-dep': '^1.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfileLinking('vendor/linked'))
    ).toThrow(
      /linked package linked-lib requires missing-dep.*Convert linked-lib to a file: dependency.*add missing-dep to app/s
    );
  });

  it('warns (not fails) when the required dep is only an app devDependency', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    writeLinkedManifest({ dependencies: { typescript: '^5.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      devDependencies: { typescript: '^5.4.0' },
    };

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfileLinking('vendor/linked'))
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('only a devDependency')
    );
  });

  it('warns (not fails) on a link target peer dependency not visible to the app', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    writeLinkedManifest({ peerDependencies: { react: '^18.0.0' } });
    const app: PackageJson = { name: 'app', version: '0.0.1' };

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfileLinking('vendor/linked'))
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('may need react')
    );
  });

  it('does nothing when the pruned lockfile has no link: targets', () => {
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  lodash@4.17.21:',
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    expect(() =>
      validatePrunedLinkClosure(app, tempDir, lockfile)
    ).not.toThrow();
  });
});

describe('readNxMigrateConfig', () => {
  it('should carry supportsOptionalMigrations from the nx-migrations config', () => {
    const config = readNxMigrateConfig({
      'nx-migrations': {
        migrations: './migrations.json',
        supportsOptionalMigrations: true,
      },
    });

    expect(config).toMatchObject({
      migrations: './migrations.json',
      supportsOptionalMigrations: true,
    });
  });

  it('should carry supportsOptionalMigrations from the ng-update config', () => {
    const config = readNxMigrateConfig({
      'ng-update': {
        migrations: './migrations.json',
        supportsOptionalMigrations: true,
      },
    });

    expect(config).toMatchObject({
      migrations: './migrations.json',
      supportsOptionalMigrations: true,
    });
  });

  it('should not set supportsOptionalMigrations when the config omits it', () => {
    const config = readNxMigrateConfig({
      'nx-migrations': { migrations: './migrations.json' },
    });

    expect(config.supportsOptionalMigrations).toBeUndefined();
  });

  it('should not set supportsOptionalMigrations when the config sets it to false', () => {
    const config = readNxMigrateConfig({
      'nx-migrations': {
        migrations: './migrations.json',
        supportsOptionalMigrations: false,
      },
    });

    expect(config.supportsOptionalMigrations).toBeUndefined();
  });
});
