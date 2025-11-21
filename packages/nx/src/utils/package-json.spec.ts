import { join } from 'path';
import { createTreeWithEmptyWorkspace } from '../generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from '../generators/tree';
import { writeJson } from '../generators/utils/json';
import { readJsonFile } from './fileutils';
import {
  buildTargetFromScript,
  getDependencyVersionFromPackageJson,
  PackageJson,
  readModulePackageJson,
  readTargetsFromPackageJson,
} from './package-json';
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
      '/root'
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
      '/root'
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
  });

  it('should read targets from project.json and package.json', () => {
    const result = readTargetsFromPackageJson(
      packageJson,
      {},
      workspaceRoot,
      '/root'
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
      '/root'
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
      '/root'
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
      '/root'
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
      '/root'
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
      '/root'
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
      '/root'
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
      '/root'
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

describe('readModulePackageJson', () => {
  it.each(dependencies.filter((x) => !exclusions.has(x)))(
    `should be able to find %s`,
    (s) => {
      expect(() => readModulePackageJson(s)).not.toThrow();
    }
  );
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
