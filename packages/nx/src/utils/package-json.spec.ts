import { join } from 'path';
import { workspaceRoot } from './workspace-root';
import { readJsonFile } from './fileutils';
import {
  buildTargetFromScript,
  PackageJson,
  readModulePackageJson,
  readTargetsFromPackageJson,
} from './package-json';
import { getPackageManagerCommand } from './package-manager';

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

describe('readTargetsFromPackageJson', () => {
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

  it('should read targets from project.json and package.json', () => {
    const result = readTargetsFromPackageJson(packageJson);
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
    const result = readTargetsFromPackageJson({
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
    });
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
    const result = readTargetsFromPackageJson({
      name: 'included-scripts-test',
      version: '',
      scripts: {
        test: 'echo testing',
        fail: 'exit 1',
      },
      nx: {
        includedScripts: ['test'],
      },
    });

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
    const result = readTargetsFromPackageJson({
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
    });
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

  it('should override scripts if provided an executor', () => {
    const result = readTargetsFromPackageJson({
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
    });
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

  it('should override script if provided in options', () => {
    const result = readTargetsFromPackageJson({
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
    });
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
    const result = readTargetsFromPackageJson({
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
    });
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
    const result = readTargetsFromPackageJson({
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
    });
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
]);

describe('readModulePackageJson', () => {
  it.each(dependencies.filter((x) => !exclusions.has(x)))(
    `should be able to find %s`,
    (s) => {
      expect(() => readModulePackageJson(s)).not.toThrow();
    }
  );
});
