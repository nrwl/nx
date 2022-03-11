import {
  Tree,
  readWorkspaceConfiguration,
  getProjects,
  readJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Linter } from '@nrwl/linter';
import { reactNativeApplicationGenerator } from './application';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace();
    appTree.write('.gitignore', '');
  });

  it('should update workspace.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
    });
    const workspaceJson = readWorkspaceConfiguration(appTree);
    const projects = getProjects(appTree);

    expect(projects.get('my-app').root).toEqual('apps/my-app');
    expect(workspaceJson.defaultProject).toEqual('my-app');
  });

  it('should update nx.json', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      tags: 'one,two',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
    });

    const { projects } = readJson(appTree, '/workspace.json');
    expect(projects).toMatchObject({
      'my-app': {
        tags: ['one', 'two'],
      },
    });
  });

  it('should generate files', async () => {
    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
    });
    expect(appTree.exists('apps/my-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('apps/my-app/src/main.tsx')).toBeTruthy();

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.base.json');

    expect(appTree.exists('apps/my-app/.eslintrc.json')).toBe(true);
  });

  it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
    appTree.rename('tsconfig.base.json', 'tsconfig.json');

    await reactNativeApplicationGenerator(appTree, {
      name: 'myApp',
      displayName: 'myApp',
      linter: Linter.EsLint,
      e2eTestRunner: 'none',
    });

    const tsconfig = readJson(appTree, 'apps/my-app/tsconfig.json');
    expect(tsconfig.extends).toEqual('../../tsconfig.json');
  });
});
