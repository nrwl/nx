import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from '../application/application';
import { e2eProjectGenerator } from './e2e-project';

describe('e2eProjectGenerator', () => {
  let tree: Tree;
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate default spec for server app (integrated)', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'express',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
    });

    expect(tree.exists(`api-e2e/src/api/api.spec.ts`)).toBeTruthy();
  });

  it('should generate default spec for server app (standalone)', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'express',
      e2eTestRunner: 'none',
      rootProject: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
      rootProject: true,
    });

    expect(tree.exists(`e2e/src/server/server.spec.ts`)).toBeTruthy();
  });

  it('should generate jest test config with ts-jest for server app', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'none',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
    });

    expect(tree.read('api-e2e/jest.config.cts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'api-e2e',
          preset: '../jest.preset.js',
          globalSetup: '<rootDir>/src/support/global-setup.ts',
          globalTeardown: '<rootDir>/src/support/global-teardown.ts',
          setupFiles: ['<rootDir>/src/support/test-setup.ts'],
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': [
              'ts-jest',
              {
                tsconfig: '<rootDir>/tsconfig.spec.json',
              },
            ],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/api-e2e',
        };
        "
      `);
    expect(tree.exists('api-e2e/.spec.swcrc')).toBeFalsy();
  });

  it('should run the root app build output in a cli project', async () => {
    await applicationGenerator(tree, {
      directory: '.',
      name: 'my-cli',
      framework: 'none',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'cli',
      project: 'my-cli',
      rootProject: true,
    });

    expect(tree.read('e2e/src/cli/cli.spec.ts', 'utf-8')).toContain(
      'dist/my-cli/main.js'
    );
  });

  it('should depend on the given build target', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'express',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
      buildTarget: 'bundle',
    });

    expect(
      readProjectConfiguration(tree, 'api-e2e').targets.e2e.dependsOn
    ).toEqual(['api:bundle', 'api:serve']);
  });

  it('should generate cli project', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'none',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'cli',
      project: 'api',
    });
    expect(tree.read('api-e2e/src/api/api.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { execSync } from 'child_process';
      import { join } from 'path';

      describe('CLI tests', () => {
        it('should print a message', () => {
          const cliPath = join(process.cwd(), 'dist/api/main.js');

          const output = execSync(\`node \${cliPath}\`).toString();

          expect(output).toMatch(/Hello World/);
        });
      });
      "
    `);
  });

  it('should generate jest test config with ts-jest for cli project', async () => {
    await applicationGenerator(tree, {
      directory: 'cli',
      framework: 'none',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'cli',
      project: 'cli',
    });

    expect(tree.read('cli-e2e/jest.config.cts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "module.exports = {
          displayName: 'cli-e2e',
          preset: '../jest.preset.js',
          setupFiles: ['<rootDir>/src/test-setup.ts'],
          testEnvironment: 'node',
          transform: {
            '^.+\\\\.[tj]s$': [
              'ts-jest',
              {
                tsconfig: '<rootDir>/tsconfig.spec.json',
              },
            ],
          },
          moduleFileExtensions: ['ts', 'js', 'html'],
          coverageDirectory: '../coverage/cli-e2e',
        };
        "
      `);
    expect(tree.exists('cli-e2e/.spec.swcrc')).toBeFalsy();
  });

  describe('TS solution setup', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
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
      await applicationGenerator(tree, {
        directory: 'api',
        framework: 'none',
        e2eTestRunner: 'none',
        useProjectJson: false,
      });
      await e2eProjectGenerator(tree, {
        projectType: 'server',
        project: '@proj/api',
      });

      expect(readJson(tree, 'tsconfig.json').references).toMatchInlineSnapshot(`
        [
          {
            "path": "./api",
          },
          {
            "path": "./api-e2e",
          },
        ]
      `);
      expect(readJson(tree, 'api-e2e/tsconfig.json')).toMatchInlineSnapshot(`
        {
          "compilerOptions": {
            "esModuleInterop": true,
            "noImplicitAny": false,
            "noUnusedLocals": false,
            "outDir": "out-tsc/api-e2e",
            "types": [
              "jest",
              "node",
            ],
          },
          "extends": "../tsconfig.base.json",
          "include": [
            "jest.config.ts",
            "src/**/*.ts",
          ],
          "references": [],
        }
      `);
    });

    it('should generate jest test config with @swc/jest for server app', async () => {
      await applicationGenerator(tree, {
        directory: 'api',
        framework: 'none',
        e2eTestRunner: 'none',
        useProjectJson: false,
      });
      await e2eProjectGenerator(tree, {
        projectType: 'server',
        project: '@proj/api',
      });

      expect(tree.read('api-e2e/jest.config.cts', 'utf-8'))
        .toMatchInlineSnapshot(`
          "/* eslint-disable */
          const { readFileSync } = require('fs');

          // Reading the SWC compilation config for the spec files
          const swcJestConfig = JSON.parse(readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8'));

          // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
          swcJestConfig.swcrc = false;

          module.exports = {
            displayName: 'api-e2e',
            preset: '../jest.preset.js',
            globalSetup: '<rootDir>/src/support/global-setup.ts',
            globalTeardown: '<rootDir>/src/support/global-teardown.ts',
            setupFiles: ['<rootDir>/src/support/test-setup.ts'],
            testEnvironment: 'node',
            transform: {
              '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
            },
            moduleFileExtensions: ['ts', 'js', 'html'],
            coverageDirectory: 'test-output/jest/coverage',
          };
          "
        `);
      expect(tree.read('api-e2e/.spec.swcrc', 'utf-8')).toMatchInlineSnapshot(`
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

    it('should generate jest test config with @swc/jest for cli project', async () => {
      await applicationGenerator(tree, {
        directory: 'cli',
        framework: 'none',
        e2eTestRunner: 'none',
        useProjectJson: false,
      });
      await e2eProjectGenerator(tree, {
        projectType: 'cli',
        project: '@proj/cli',
        useProjectJson: false,
      });

      expect(tree.read('cli-e2e/jest.config.cts', 'utf-8'))
        .toMatchInlineSnapshot(`
          "/* eslint-disable */
          const { readFileSync } = require('fs');

          // Reading the SWC compilation config for the spec files
          const swcJestConfig = JSON.parse(readFileSync(\`\${__dirname}/.spec.swcrc\`, 'utf-8'));

          // Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
          swcJestConfig.swcrc = false;

          module.exports = {
            displayName: 'cli-e2e',
            preset: '../jest.preset.js',
            setupFiles: ['<rootDir>/src/test-setup.ts'],
            testEnvironment: 'node',
            transform: {
              '^.+\\\\.[tj]s$': ['@swc/jest', swcJestConfig],
            },
            moduleFileExtensions: ['ts', 'js', 'html'],
            coverageDirectory: 'test-output/jest/coverage',
          };
          "
        `);
      expect(tree.read('cli-e2e/.spec.swcrc', 'utf-8')).toMatchInlineSnapshot(`
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
  });
  it('should enable the jest oxlint plugin for the e2e project', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      devDependencies: { oxlint: '^1.70.0' },
    });
    writeJson(tree, 'nx.json', { plugins: ['@nx/oxlint'] });

    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'express',
      linter: 'oxlint',
      e2eTestRunner: 'none',
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
    });

    // The e2e specs are Jest, so the project needs its own config to turn the
    // Jest rules on; inheriting the root config alone would not.
    expect(readJson(tree, 'api-e2e/.oxlintrc.json').plugins).toContain('jest');
  });
});
