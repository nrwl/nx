import 'nx/src/internal-testing-utils/mock-project-graph';

import { readJson, Tree, updateJson, writeJson } from '@nx/devkit';
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
      addPlugin: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
      addPlugin: true,
    });

    expect(tree.exists(`api-e2e/src/api/api.spec.ts`)).toBeTruthy();
  });

  it('should generate default spec for server app (standalone)', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'express',
      e2eTestRunner: 'none',
      rootProject: true,
      addPlugin: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
      rootProject: true,
      addPlugin: true,
    });

    expect(tree.exists(`e2e/src/server/server.spec.ts`)).toBeTruthy();
  });

  it('should generate jest test config with ts-jest for server app', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'none',
      e2eTestRunner: 'none',
      addPlugin: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'server',
      project: 'api',
      addPlugin: true,
    });

    expect(tree.read('api-e2e/jest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "export default {
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

  it('should generate cli project', async () => {
    await applicationGenerator(tree, {
      directory: 'api',
      framework: 'none',
      e2eTestRunner: 'none',
      addPlugin: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'cli',
      project: 'api',
      addPlugin: true,
    });
    expect(tree.read('api-e2e/src/api/api.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { execSync } from 'child_process';
      import { join } from 'path';

      describe('CLI tests', () => {
        it('should print a message', () => {
          const cliPath = join(process.cwd(), 'dist/api');

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
      addPlugin: true,
    });
    await e2eProjectGenerator(tree, {
      projectType: 'cli',
      project: 'cli',
      addPlugin: true,
    });

    expect(tree.read('cli-e2e/jest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "export default {
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
        addPlugin: true,
        useProjectJson: false,
      });
      await e2eProjectGenerator(tree, {
        projectType: 'server',
        project: '@proj/api',
        addPlugin: true,
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
        addPlugin: true,
        useProjectJson: false,
      });
      await e2eProjectGenerator(tree, {
        projectType: 'server',
        project: '@proj/api',
        addPlugin: true,
      });

      expect(tree.read('api-e2e/jest.config.ts', 'utf-8'))
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
        addPlugin: true,
        useProjectJson: false,
      });
      await e2eProjectGenerator(tree, {
        projectType: 'cli',
        project: '@proj/cli',
        addPlugin: true,
        useProjectJson: false,
      });

      expect(tree.read('cli-e2e/jest.config.ts', 'utf-8'))
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
});
