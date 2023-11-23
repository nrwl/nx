import { CreateNodesContext } from '@nx/devkit';
import { createNodes } from './plugin';
import { vol } from 'memfs';

jest.mock('fs', () => {
  const memFs = require('memfs').fs;
  return {
    ...memFs,
    existsSync: (p) => (p.endsWith('.node') ? true : memFs.existsSync(p)),
  };
});

describe('@nx/eslint/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;

  beforeEach(async () => {
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: '',
    };
  });

  afterEach(() => {
    vol.reset();
    jest.resetModules();
  });

  it('should create nodes with default configuration for nested project', () => {
    const fileSys = {
      'apps/my-app/.eslintrc.json': `{}`,
      'apps/my-app/project.json': `{}`,
      '.eslintrc.json': `{}`,
      'package.json': `{}`,
    };
    vol.fromJSON(fileSys, '');
    const nodes = createNodesFunction(
      'apps/my-app/.eslintrc.json',
      {
        targetName: 'lint',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          "my-app": {
            "root": "apps/my-app",
            "targets": {
              "lint": {
                "cache": true,
                "command": "eslint .",
                "inputs": [
                  "default",
                  "{workspaceRoot}/.eslintrc.json",
                  "{workspaceRoot}/tools/eslint-rules/**/*",
                ],
                "options": {
                  "cwd": "apps/my-app",
                },
                "outputs": [
                  "{options.outputFile}",
                ],
              },
            },
          },
        },
      }
    `);
  });

  it('should create nodes with default configuration for standalone project', () => {
    const fileSys = {
      'apps/my-app/eslint.config.js': `module.exports = []`,
      'apps/my-app/project.json': `{}`,
      'eslint.config.js': `module.exports = []`,
      'package.json': `{}`,
    };
    vol.fromJSON(fileSys, '');
    const nodes = createNodesFunction(
      'eslint.config.js',
      {
        targetName: 'lint',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "root": ".",
            "targets": {
              "lint": {
                "cache": true,
                "command": "ESLINT_USE_FLAT_CONFIG=true eslint ./src",
                "inputs": [
                  "default",
                  "{workspaceRoot}/eslint.config.js",
                  "{workspaceRoot}/tools/eslint-rules/**/*",
                ],
                "options": {
                  "cwd": ".",
                },
                "outputs": [
                  "{options.outputFile}",
                ],
              },
            },
          },
        },
      }
    `);
  });
});
