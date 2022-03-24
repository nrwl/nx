import { logger, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { applicationGenerator, libraryGenerator } from '@nrwl/next';
import { storybookConfigurationGenerator } from './configuration';

describe('next:storybook-configuration', () => {
  let appTree: Tree;

  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    appTree = undefined;
  });

  it('should configure .storybook directory file', async () => {
    const libName = 'test-lib';
    appTree = createTreeWithEmptyWorkspace();
    await createTestLib(appTree, libName);

    await storybookConfigurationGenerator(appTree, {
      name: libName,
      generateStories: false,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(appTree.exists('libs/test-lib/.storybook/main.js')).toBeTruthy();
    expect(
      appTree.exists('libs/test-lib/.storybook/tsconfig.json')
    ).toBeTruthy();
  });

  it('should include stories files for libs', async () => {
    const libName = 'test-lib';
    appTree = createTreeWithEmptyWorkspace();
    await createTestLib(appTree, libName);

    await storybookConfigurationGenerator(appTree, {
      name: libName,
      generateStories: false,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(
      appTree
        .read('libs/test-lib/.storybook/main.js')
        .includes('../**/*.stories.mdx')
    ).toBe(true);
    expect(
      appTree
        .read('libs/test-lib/.storybook/main.js')
        .includes('../**/*.stories.@(js|jsx|ts|tsx)')
    ).toBe(true);
  });

  it('should include stories files for apps', async () => {
    const appName = 'test-app';
    appTree = createTreeWithEmptyWorkspace();
    await createTestApp(appTree, appName);

    await storybookConfigurationGenerator(appTree, {
      name: appName,
      generateStories: false,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(
      appTree
        .read('apps/test-app/.storybook/main.js')
        .includes('../**/*.stories.mdx')
    ).toBe(true);
    expect(
      appTree
        .read('apps/test-app/.storybook/main.js')
        .includes('../**/*.stories.@(js|jsx|ts|tsx)')
    ).toBe(true);
  });

  it('should create app pages stories', async () => {
    const appName = 'test-app';
    appTree = createTreeWithEmptyWorkspace();
    await createTestApp(appTree, appName);

    await storybookConfigurationGenerator(appTree, {
      name: appName,
      generateStories: true,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(appTree.exists('apps/test-app/pages/index.stories.tsx')).toBe(true);
  });

  it('should configure babel if not configured already', async () => {
    const appName = 'test-app';
    appTree = createTreeWithEmptyWorkspace();
    await createTestApp(appTree, appName);

    await storybookConfigurationGenerator(appTree, {
      name: appName,
      generateStories: true,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(appTree.exists('apps/test-app/.babelrc')).toBe(true);
    expect(appTree.read('apps/test-app/.babelrc', 'utf-8')).toEqual(
      JSON.stringify({
        presets: ['@nrwl/next/babel'],
      })
    );
  });

  it('should not generate stories files for _app and _document files', async () => {
    const appName = 'test-app';
    appTree = createTreeWithEmptyWorkspace();
    await createTestApp(appTree, appName);

    await storybookConfigurationGenerator(appTree, {
      name: appName,
      generateStories: true,
      configureCypress: false,
      standaloneConfig: false,
    });

    expect(appTree.exists('apps/test-app/pages/_app.stories.tsx')).toBe(false);
    expect(appTree.exists('apps/test-app/pages/_document.stories.tsx')).toBe(
      false
    );
  });
});

async function createTestLib(tree: Tree, name: string) {
  await libraryGenerator(tree, {
    name,
    style: 'css',
    skipTsConfig: false,
    skipFormat: true,
    unitTestRunner: 'none',
    linter: Linter.EsLint,
  });
  return tree;
}

async function createTestApp(tree: Tree, name: string) {
  await applicationGenerator(tree, {
    name,
    style: 'css',
    skipFormat: true,
    unitTestRunner: 'none',
    linter: Linter.EsLint,
  });
  return tree;
}
