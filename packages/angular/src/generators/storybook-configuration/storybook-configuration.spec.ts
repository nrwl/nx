import type { Tree } from '@nx/devkit';
import { readJson, writeJson } from '@nx/devkit';
import { Linter } from '@nx/eslint/src/generators/utils/linter';
import { componentGenerator } from '../component/component';
import { librarySecondaryEntryPointGenerator } from '../library-secondary-entry-point/library-secondary-entry-point';
import {
  createStorybookTestWorkspaceForLib,
  generateTestApplication,
} from '../utils/testing';
import type { StorybookConfigurationOptions } from './schema';
import { storybookConfigurationGenerator } from './storybook-configuration';

// nested code imports graph from the repo, which might have inaccurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

function listFiles(tree: Tree): string[] {
  const files = new Set<string>();
  tree.listChanges().forEach((change) => {
    if (change.type !== 'DELETE') {
      files.add(change.path);
    }
  });

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}

describe('StorybookConfiguration generator', () => {
  let tree: Tree;
  const libName = 'test-ui-lib';

  beforeEach(async () => {
    tree = await createStorybookTestWorkspaceForLib(libName);

    jest.resetModules();
  });

  it('should only configure storybook', async () => {
    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      project: libName,
      generateStories: false,
      skipFormat: true,
    });

    expect(tree.exists('test-ui-lib/.storybook/main.ts')).toBeTruthy();
    expect(tree.exists('test-ui-lib/.storybook/tsconfig.json')).toBeTruthy();
    expect(
      tree.exists(
        'test-ui-lib/src/lib/test-button/test-button.component.stories.ts'
      )
    ).toBeFalsy();
    expect(
      tree.exists(
        'test-ui-lib/src/lib/test-other/test-other.component.stories.ts'
      )
    ).toBeFalsy();
  });

  it('should configure storybook to use webpack 5', async () => {
    await storybookConfigurationGenerator(tree, {
      project: libName,
      generateStories: false,
      linter: Linter.None,
      skipFormat: true,
    });

    expect(
      tree.read('test-ui-lib/.storybook/main.ts', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should configure storybook with interaction tests and install dependencies', async () => {
    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      project: libName,
      generateStories: true,
    });

    expect(tree.exists('test-ui-lib/.storybook/main.ts')).toBeTruthy();
    expect(tree.exists('test-ui-lib/.storybook/tsconfig.json')).toBeTruthy();
    expect(
      tree.read(
        'test-ui-lib/src/lib/test-button/test-button.component.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();
    expect(
      tree.read(
        'test-ui-lib/src/lib/test-other/test-other.component.stories.ts',
        'utf-8'
      )
    ).toMatchSnapshot();

    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    expect(packageJson.devDependencies['@storybook/angular']).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-interactions']
    ).toBeDefined();
    expect(packageJson.devDependencies['@storybook/test-runner']).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/testing-library']
    ).toBeDefined();
  });

  it('should generate the right files', async () => {
    // add standalone component
    await componentGenerator(tree, {
      name: 'standalone',
      path: `${libName}/src/lib/standalone/standalone`,
      standalone: true,
      skipFormat: true,
    });
    // add secondary entrypoint
    writeJson(tree, `${libName}/package.json`, { name: libName });
    await librarySecondaryEntryPointGenerator(tree, {
      library: libName,
      name: 'secondary-entry-point',
      skipFormat: true,
    });
    // add a regular component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-button',
      path: `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button`,
      export: true,
      skipFormat: true,
    });
    // add a standalone component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-standalone',
      path: `${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone`,
      standalone: true,
      export: true,
      skipFormat: true,
    });

    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      project: libName,
      generateStories: true,
      skipFormat: true,
    });

    expect(listFiles(tree)).toMatchSnapshot();
  });

  it('should generate in the correct folder', async () => {
    // add standalone component
    await componentGenerator(tree, {
      name: 'standalone',
      path: `${libName}/src/lib/standalone/standalone`,
      standalone: true,
      skipFormat: true,
    });
    // add secondary entrypoint
    writeJson(tree, `${libName}/package.json`, { name: libName });
    await librarySecondaryEntryPointGenerator(tree, {
      library: libName,
      name: 'secondary-entry-point',
      skipFormat: true,
    });
    // add a regular component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-button',
      path: `${libName}/secondary-entry-point/src/lib/secondary-button/secondary-button`,
      export: true,
      skipFormat: true,
    });
    // add a standalone component to the secondary entrypoint
    await componentGenerator(tree, {
      name: 'secondary-standalone',
      path: `${libName}/secondary-entry-point/src/lib/secondary-standalone/secondary-standalone`,
      standalone: true,
      export: true,
      skipFormat: true,
    });

    await storybookConfigurationGenerator(tree, <StorybookConfigurationOptions>{
      project: libName,
      generateStories: true,
      skipFormat: true,
    });

    expect(listFiles(tree)).toMatchSnapshot();
  });

  it('should exclude Storybook-related files from tsconfig.editor.json for applications', async () => {
    await generateTestApplication(tree, { directory: 'test-app' });

    await storybookConfigurationGenerator(tree, {
      project: 'test-app',
      generateStories: false,
      skipFormat: true,
      linter: Linter.EsLint,
    });

    const tsConfig = readJson(tree, 'test-app/tsconfig.editor.json');
    expect(tsConfig.exclude).toStrictEqual(
      expect.arrayContaining(['**/*.stories.ts', '**/*.stories.js'])
    );
  });
});
