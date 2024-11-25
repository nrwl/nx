import { CreateNodesContext, readJsonFile } from '@nx/devkit';
import { join } from 'path';
import { TempFs } from 'nx/src/internal-testing-utils/temp-fs';
import { type NodesReport } from './utils/get-nodes-from-gradle-plugin';

let gradleReport: NodesReport;
jest.mock('./utils/get-nodes-from-gradle-plugin', () => {
  return {
    GRADLE_BUILD_FILES: new Set(['build.gradle', 'build.gradle.kts']),
    populateNodes: jest.fn().mockImplementation(() => void 0),
    getCurrentNodesReport: jest.fn().mockImplementation(() => gradleReport),
  };
});

import { createNodesV2 } from './nodes';

describe('@nx/gradle/plugin/nodes', () => {
  let createNodesFunction = createNodesV2[1];
  let context: CreateNodesContext;
  let tempFs: TempFs;
  let cwd: string;

  beforeEach(async () => {
    tempFs = new TempFs('test');
    gradleReport = readJsonFile(
      join(__dirname, 'utils/__mocks__/gradle_tutorial.json')
    );
    cwd = process.cwd();
    process.chdir(tempFs.tempDir);
    context = {
      nxJsonConfiguration: {
        namedInputs: {
          default: ['{projectRoot}/**/*'],
          production: ['!{projectRoot}/**/*.spec.ts'],
        },
      },
      workspaceRoot: tempFs.tempDir,
      configFiles: [],
    };

    await tempFs.createFiles({
      'proj/build.gradle': ``,
      gradlew: '',
    });
  });

  afterEach(() => {
    jest.resetModules();
    process.chdir(cwd);
  });

  it('should create nodes based on gradle', async () => {
    const results = await createNodesFunction(
      ['proj/build.gradle'],
      {
        buildTargetName: 'build',
      },
      context
    );

    expect(results).toMatchSnapshot();
  });

  it('should create nodes based on gradle for nested project root', async () => {
    gradleReport = readJsonFile(
      join(__dirname, '/utils/__mocks__/gradle_composite.json')
    );
    await tempFs.createFiles({
      'nested/nested/proj/build.gradle': ``,
    });

    const results = await createNodesFunction(
      ['nested/nested/proj/build.gradle'],
      {
        buildTargetName: 'build',
      },
      context
    );

    expect(results).toMatchSnapshot();
  });

  it('should create nodes with atomized tests targets based on gradle if ciTargetName is specified', async () => {
    const results = await createNodesFunction(
      ['proj/application/build.gradle'],
      {
        buildTargetName: 'build',
        ciTargetName: 'test-ci',
      },
      context
    );

    expect(results).toMatchSnapshot();
  });

  it('should not create nodes with atomized tests targets based on gradle if ciTargetName is not specified', async () => {
    const results = await createNodesFunction(
      ['proj/application/build.gradle'],
      {
        buildTargetName: 'build',
      },
      context
    );
    expect(results).toMatchSnapshot();
  });
});
