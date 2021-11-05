import { Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { libraryGenerator } from '@nrwl/workspace/generators';
import configurationGenerator from '../configuration/configuration';
import { compositionGenerator } from './composition';

let tree: Tree;

describe('composition generator', () => {
  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      name: 'test-ui-one',
      standaloneConfig: false,
    });
    await libraryGenerator(tree, {
      name: 'test-ui-two',
      standaloneConfig: false,
    });
    await libraryGenerator(tree, {
      name: 'test-ui-three',
      standaloneConfig: false,
    });
    await libraryGenerator(tree, {
      name: 'main-host-lib',
      standaloneConfig: false,
    });
    writeJson(tree, 'package.json', {
      devDependencies: {
        '@storybook/addon-essentials': '~6.3.0',
        '@storybook/react': '~6.3.0',
      },
    });

    await configurationGenerator(tree, {
      name: 'test-ui-one',
      uiFramework: '@storybook/react',
      standaloneConfig: false,
    });

    await configurationGenerator(tree, {
      name: 'test-ui-two',
      uiFramework: '@storybook/react',
      standaloneConfig: false,
    });

    await configurationGenerator(tree, {
      name: 'test-ui-three',
      uiFramework: '@storybook/react',
      standaloneConfig: false,
    });

    await configurationGenerator(tree, {
      name: 'main-host-lib',
      uiFramework: '@storybook/react',
      standaloneConfig: false,
    });
  });

  it("should change the ports on workspace.json if useExistingPorts is false and update the main project's main.js accordingly", async () => {
    await compositionGenerator(tree, {
      mainProject: 'main-host-lib',
      all: true,
    });
    const workspaceJson = JSON.parse(tree.read('workspace.json', 'utf-8'));
    expect(
      tree.read('libs/main-host-lib/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
    expect(
      workspaceJson?.projects?.['test-ui-one']?.architect?.storybook?.options
        ?.port
    ).toBe(4401);
    expect(
      workspaceJson?.projects?.['test-ui-two']?.architect?.storybook?.options
        ?.port
    ).toBe(4403);
    expect(
      workspaceJson?.projects?.['test-ui-three']?.architect?.storybook?.options
        ?.port
    ).toBe(4402);
  });

  it("should not change ports on workspace.json if useExistingPorts is true and update the main project's main.js accordingly", async () => {
    await compositionGenerator(tree, {
      mainProject: 'main-host-lib',
      all: true,
      useExistingPorts: true,
    });
    const workspaceJson = JSON.parse(tree.read('workspace.json', 'utf-8'));
    expect(
      tree.read('libs/main-host-lib/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
    expect(
      workspaceJson?.projects?.['test-ui-one']?.architect?.storybook?.options
        ?.port
    ).toBe(4400);
    expect(
      workspaceJson?.projects?.['test-ui-two']?.architect?.storybook?.options
        ?.port
    ).toBe(4400);
    expect(
      workspaceJson?.projects?.['test-ui-three']?.architect?.storybook?.options
        ?.port
    ).toBe(4400);
  });

  it('should only generate composition for selected projects', async () => {
    await compositionGenerator(tree, {
      mainProject: 'main-host-lib',
      projects: 'test-ui-one,test-ui-two',
    });

    const workspaceJson = JSON.parse(tree.read('workspace.json', 'utf-8'));
    expect(
      tree.read('libs/main-host-lib/.storybook/main.js', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.read('workspace.json', 'utf-8')).toMatchSnapshot();
    expect(
      workspaceJson?.projects?.['test-ui-one']?.architect?.storybook?.options
        ?.port
    ).toBe(4401);
    expect(
      workspaceJson?.projects?.['test-ui-two']?.architect?.storybook?.options
        ?.port
    ).toBe(4402);
    expect(
      workspaceJson?.projects?.['test-ui-three']?.architect?.storybook?.options
        ?.port
    ).toBe(4400);
  });
});
