const mockLoggerWarn = jest.fn();
const mockLoggerDebug = jest.fn();

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('@nx/devkit', () => {
  const actual = jest.requireActual<any>('@nx/devkit');
  return {
    ...actual,
    createProjectGraphAsync: jest
      .fn()
      .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
    logger: {
      ...actual.logger,
      warn: mockLoggerWarn,
      debug: mockLoggerDebug,
    },
  };
});

import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application';
import componentGenerator from '../component/component';
import libraryGenerator from '../library/library';
import storybookConfigurationGenerator from './configuration';

describe('react:storybook-configuration', () => {
  let appTree;

  beforeEach(async () => {
    mockLoggerWarn.mockReset();
    mockLoggerDebug.mockReset();
    mockLoggerWarn.mockImplementation(() => {});
    mockLoggerDebug.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('should configure everything and install correct dependencies', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-lib',
      addPlugin: true,
    });

    expect(
      appTree.read('test-ui-lib/.storybook/main.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(appTree.exists('test-ui-lib/tsconfig.storybook.json')).toBeTruthy();

    const packageJson = JSON.parse(appTree.read('package.json', 'utf-8'));
    expect(packageJson.devDependencies['@storybook/react-vite']).toBeDefined();
  });

  it('should generate stories for components', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-lib',
      generateStories: true,
      addPlugin: true,
    });

    expect(
      appTree.exists('test-ui-lib/src/lib/test-ui-lib.stories.tsx')
    ).toBeTruthy();
  });

  it('should generate stories for components written in plain JS', async () => {
    appTree = await createTestUILib('test-ui-lib', true);

    appTree.write(
      'test-ui-lib/src/lib/test-ui-libplain.js',
      `import React from 'react';

      import './test.scss';

      export const Test = (props) => {
        return (
          <div>
            <h1>Welcome to test component</h1>
          </div>
        );
      };

      export default Test;
      `
    );
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-lib',
      generateStories: true,
      js: true,
      addPlugin: true,
    });

    expect(
      appTree.read('test-ui-lib/src/lib/test-ui-libplain.stories.jsx', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should configure everything at once', async () => {
    appTree = await createTestAppLib('test-ui-app');
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-app',
      addPlugin: true,
    });

    expect(appTree.exists('test-ui-app/.storybook/main.ts')).toBeTruthy();
    expect(appTree.exists('test-ui-app/tsconfig.storybook.json')).toBeTruthy();
  });

  it('should generate stories for components', async () => {
    appTree = await createTestAppLib('test-ui-app');
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-app',
      generateStories: true,
      addPlugin: true,
    });

    // Currently the auto-generate stories feature only picks up components under the 'lib' directory.
    // In our 'createTestAppLib' function, we call @nx/react:component to generate a component
    // under the specified 'lib' directory
    expect(
      appTree.read(
        'test-ui-app/src/app/my-component/my-component.stories.tsx',
        'utf-8'
      )
    ).toMatchSnapshot();
  });
});

export async function createTestUILib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await libraryGenerator(appTree, {
    linter: 'eslint',
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    style: 'css',
    unitTestRunner: 'none',
    directory: libName,
    addPlugin: true,
  });
  return appTree;
}

export async function createTestAppLib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: 'eslint',
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    directory: libName,
    js: plainJS,
    addPlugin: true,
  });

  await componentGenerator(appTree, {
    name: 'my-component',
    path: `${libName}/src/app/my-component/my-component`,
    style: 'css',
  });

  return appTree;
}
