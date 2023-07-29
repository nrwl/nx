import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/linter';
import { logger } from '@nx/devkit';

import libraryGenerator from '../library/library';
import applicationGenerator from '../application/application';
import componentGenerator from '../component/component';
import storybookConfigurationGenerator from './configuration';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('react-native:storybook-configuration', () => {
  let appTree;

  beforeEach(async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('should generate files for an app', () => {
    it('should configure everything at once', async () => {
      appTree = await createTestUILib('test-ui-lib');
      appTree.write('.gitignore', '');
      await storybookConfigurationGenerator(appTree, {
        name: 'test-ui-lib',
      });

      expect(
        appTree.exists('libs/test-ui-lib/.storybook/main.js')
      ).toBeTruthy();
      expect(
        appTree.exists('libs/test-ui-lib/tsconfig.storybook.json')
      ).toBeTruthy();
    });

    it('should generate stories for components', async () => {
      appTree = await createTestUILib('test-ui-lib');
      await componentGenerator(appTree, {
        name: 'test-ui-lib',
        project: 'test-ui-lib',
      });
      await storybookConfigurationGenerator(appTree, {
        name: 'test-ui-lib',
        generateStories: true,
      });

      expect(
        appTree.exists(
          'libs/test-ui-lib/src/lib/test-ui-lib/test-ui-lib.stories.tsx'
        )
      ).toBeTruthy();
    });
  });

  describe('should generate files for lib', () => {
    it('should configure everything at once', async () => {
      appTree = await createTestAppLib('test-ui-app');
      await storybookConfigurationGenerator(appTree, {
        name: 'test-ui-app',
      });

      expect(
        appTree.exists('apps/test-ui-app/.storybook/main.js')
      ).toBeTruthy();
      expect(
        appTree.exists('apps/test-ui-app/tsconfig.storybook.json')
      ).toBeTruthy();
    });

    it('should generate stories for components', async () => {
      appTree = await createTestAppLib('test-ui-app');
      await storybookConfigurationGenerator(appTree, {
        name: 'test-ui-app',
        generateStories: true,
      });

      // Currently the auto-generate stories feature only picks up components under the 'lib' directory.
      // In our 'createTestAppLib' function, we call @nx/react-native:component to generate a component
      // under the specified 'lib' directory
      expect(
        appTree.exists(
          'apps/test-ui-app/src/app/my-component/my-component.stories.tsx'
        )
      ).toBeTruthy();
    });
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'none',
    name: libName,
  });
  return appTree;
}

export async function createTestAppLib(
  libName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    js: plainJS,
    install: false,
  });

  await componentGenerator(appTree, {
    name: 'my-component',
    project: libName,
    directory: 'app',
  });

  return appTree;
}
