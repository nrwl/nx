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
        // These defaults should be overridden by plugin
        targetDefaults: {
          lint: {
            cache: false,
            inputs: ['foo', '^foo'],
          },
        },
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
      'apps/my-app/project.json',
      {
        targetName: 'lint',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          "apps/my-app": {
            "targets": {
              "lint": {
                "cache": true,
                "command": "eslint .",
                "inputs": [
                  "default",
                  "{workspaceRoot}/.eslintrc.json",
                  "{workspaceRoot}/apps/my-app/.eslintrc.json",
                  "{workspaceRoot}/tools/eslint-rules/**/*",
                  {
                    "externalDependencies": [
                      "eslint",
                    ],
                  },
                ],
                "options": {
                  "cwd": "apps/my-app",
                },
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
      'src/index.ts': `console.log('hello world')`,
      'package.json': `{}`,
    };
    vol.fromJSON(fileSys, '');
    const nodes = createNodesFunction(
      'package.json',
      {
        targetName: 'lint',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "targets": {
              "lint": {
                "cache": true,
                "command": "eslint ./src",
                "inputs": [
                  "default",
                  "{workspaceRoot}/eslint.config.js",
                  "{workspaceRoot}/tools/eslint-rules/**/*",
                  {
                    "externalDependencies": [
                      "eslint",
                    ],
                  },
                ],
                "options": {
                  "cwd": ".",
                  "env": {
                    "ESLINT_USE_FLAT_CONFIG": "true",
                  },
                },
              },
            },
          },
        },
      }
    `);
  });

  it('should not create nodes if no src folder for root', () => {
    const fileSys = {
      'apps/my-app/eslint.config.js': `module.exports = []`,
      'apps/my-app/project.json': `{}`,
      'eslint.config.js': `module.exports = []`,
      'package.json': `{}`,
    };
    vol.fromJSON(fileSys, '');
    const nodes = createNodesFunction(
      'package.json',
      {
        targetName: 'lint',
      },
      context
    );

    expect(nodes).toMatchInlineSnapshot(`{}`);
  });
});
