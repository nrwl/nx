import { CreateNodesContext } from '@nx/devkit';
import { join } from 'path';

import { createNodes } from './plugin';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';

describe('@nx/jest/plugin', () => {
  let createNodesFunction = createNodes[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
    };

    await tempFs.createFiles({
      'proj/jest.config.js': '',
      'proj/project.json': '{}',
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should create nodes based on jest.config.ts', async () => {
    mockJestConfig(
      {
        coverageDirectory: '../coverage',
      },
      context
    );
    const nodes = await createNodesFunction(
      'proj/jest.config.js',
      {
        targetName: 'test',
      },
      context
    );

    expect(nodes.projects.proj).toMatchInlineSnapshot(`
      {
        "root": "proj",
        "targets": {
          "test": {
            "cache": true,
            "command": "jest",
            "inputs": [
              "default",
              "^production",
              {
                "externalDependencies": [
                  "jest",
                ],
              },
            ],
            "options": {
              "cwd": "proj",
            },
            "outputs": [
              "{workspaceRoot}/coverage",
            ],
          },
        },
      }
    `);
  });
});

function mockJestConfig(config: any, context: CreateNodesContext) {
  jest.mock(join(context.workspaceRoot, 'proj/jest.config.js'), () => config, {
    virtual: true,
  });
}
