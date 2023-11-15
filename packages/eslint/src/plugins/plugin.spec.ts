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
    const fileSys = {
      'apps/my-app/.eslintrc.json': `{}`,
      'apps/my-app/project.json': `{}`,
      '.eslintrc.json': `{}`,
      'package.json': `{}`,
    };
    vol.fromJSON(fileSys, '');
  });

  afterEach(() => {
    vol.reset();
    jest.resetModules();
  });

  it('should create nodes with default configuration', () => {
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
                "executor": "@nx/eslint:lint",
                "inputs": [
                  "default",
                  "{workspaceRoot}/.eslintrc.json",
                  "{workspaceRoot}/tools/eslint-rules/**/*",
                ],
                "options": {
                  "config": "apps/my-app/.eslintrc.json",
                  "lintFilePatterns": [
                    "apps/my-app",
                  ],
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
