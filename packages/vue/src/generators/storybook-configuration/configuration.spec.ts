import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import applicationGenerator from '../application/application';
import componentGenerator from '../component/component';
import libraryGenerator from '../library/library';
import storybookConfigurationGenerator from './configuration';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));
const componentContent = `<script setup lang="ts">
defineProps<{
  name: string;
  displayAge: boolean;
  age: number;
}>();
</script>

<template>
  <p>Welcome to Vlv!</p>
</template>

<style scoped>
</style>
`;

describe('vue:storybook-configuration', () => {
  let appTree;
  beforeEach(async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should configure everything and install correct dependencies', async () => {
    appTree = await createTestUILib('test-ui-lib');
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-lib',
    });

    expect(
      appTree.read('test-ui-lib/.storybook/main.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(appTree.exists('test-ui-lib/tsconfig.storybook.json')).toBeTruthy();

    const packageJson = JSON.parse(appTree.read('package.json', 'utf-8'));
    expect(packageJson.devDependencies['@storybook/vue3-vite']).toBeDefined();
    expect(packageJson.devDependencies['@storybook/vue3']).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-interactions']
    ).toBeDefined();
    expect(packageJson.devDependencies['@storybook/test-runner']).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/testing-library']
    ).toBeDefined();
  });

  it('should generate stories for components', async () => {
    appTree = await createTestUILib('test-ui-lib');
    appTree.write(
      'test-ui-lib/src/lib/my-component/my-component.vue',
      componentContent
    );

    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-lib',
      generateStories: true,
    });

    expect(
      appTree.exists('test-ui-lib/src/lib/test-ui-lib.stories.ts')
    ).toBeTruthy();
    expect(
      appTree.read(
        'test-ui-lib/src/lib/my-component/my-component.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should configure everything at once', async () => {
    appTree = await createTestAppLib('test-ui-app');
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(appTree.exists('test-ui-app/.storybook/main.ts')).toBeTruthy();
    expect(appTree.exists('test-ui-app/tsconfig.storybook.json')).toBeTruthy();
  });

  it('should generate stories for components for app', async () => {
    appTree = await createTestAppLib('test-ui-app');
    appTree.write(
      'test-ui-app/src/app/my-component/my-component.vue',
      componentContent
    );
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-app',
      generateStories: true,
    });

    expect(
      appTree.read(
        'test-ui-app/src/app/my-component/my-component.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });

  it('should generate stories for components without interaction tests', async () => {
    appTree = await createTestAppLib('test-ui-app');
    appTree.write(
      'test-ui-app/src/app/my-component/my-component.vue',
      componentContent
    );
    await storybookConfigurationGenerator(appTree, {
      project: 'test-ui-app',
      generateStories: true,
      interactionTests: false,
    });

    expect(
      appTree.read(
        'test-ui-app/src/app/my-component/my-component.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
  });
});

export async function createTestUILib(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await libraryGenerator(appTree, {
    linter: Linter.EsLint,
    component: true,
    skipFormat: true,
    skipTsConfig: false,
    unitTestRunner: 'none',
    name: libName,
    projectNameAndRootFormat: 'as-provided',
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
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    js: plainJS,
    projectNameAndRootFormat: 'as-provided',
  });

  await componentGenerator(appTree, {
    name: 'my-component',
    project: libName,
    directory: 'app',
  });

  return appTree;
}
