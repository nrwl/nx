import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  getProjects,
} from 'packages/devkit/src/generators/project-configuration';
import { writeJson } from 'packages/devkit/src/utils/json';
import createWorkspaceJson from './create-workspace-json';

describe('workspace-json', () => {
  it('should work for package.json inferred projects', async () => {
    // Arrange
    const tree = createTreeWithEmptyWorkspace(2);
    tree.delete('workspace.json');

    writeJson(tree, 'libs/my-package/package.json', {
      name: '@proj/my-package',
      scripts: {
        build: 'echo 1',
      },
    });

    const opts = {
      skipFormat: true,
    };

    // Act
    await createWorkspaceJson(tree, opts);

    // Asset
    expect(tree.exists('workspace.json')).toBeTruthy();
    const pkg = getProjects(tree).get('my-package');
    expect(pkg).toBeDefined();
    expect(pkg.targets).not.toBeDefined();
    expect(tree.exists('libs/my-package/project.json')).toBeTruthy();
    expect(tree.exists('libs/my-package/package.json')).toBeTruthy();
  });

  it('should work for project.json inferred projects', async () => {
    // Arrange
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      targets: {
        run: {
          executor: '@nrwl/workspace:run-commands',
          options: {
            command: 'echo 1',
          },
        },
      },
    });
    tree.delete('workspace.json');

    const opts = {
      skipFormat: true,
    };

    // Act
    await createWorkspaceJson(tree, opts);

    // Asset
    expect(tree.exists('workspace.json')).toBeTruthy();
    const pkg = getProjects(tree).get('my-app');
    expect(pkg).toBeDefined();
    expect(pkg.targets).toBeDefined();
    expect(tree.exists('apps/my-app/project.json')).toBeTruthy();
  });
});
