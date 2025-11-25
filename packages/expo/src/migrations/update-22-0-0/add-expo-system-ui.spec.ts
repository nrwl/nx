import { Tree, addProjectConfiguration, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './add-expo-system-ui';

describe('add-expo-system-ui migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add expo-system-ui to expo projects', () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
    });

    writeJson(tree, 'apps/my-app/package.json', {
      name: 'my-app',
      dependencies: {
        expo: '~53.0.10',
      },
    });

    update(tree);

    const packageJson = JSON.parse(
      tree.read('apps/my-app/package.json', 'utf-8')
    );
    expect(packageJson.dependencies['expo-system-ui']).toBe('~6.0.0');
  });

  it('should not add expo-system-ui if already present', () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
    });

    writeJson(tree, 'apps/my-app/package.json', {
      name: 'my-app',
      dependencies: {
        expo: '~53.0.10',
        'expo-system-ui': '~5.0.0',
      },
    });

    update(tree);

    const packageJson = JSON.parse(
      tree.read('apps/my-app/package.json', 'utf-8')
    );
    // Should not update existing version
    expect(packageJson.dependencies['expo-system-ui']).toBe('~5.0.0');
  });

  it('should skip non-expo projects', () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
    });

    writeJson(tree, 'apps/my-app/package.json', {
      name: 'my-app',
      dependencies: {
        react: '^19.0.0',
      },
    });

    update(tree);

    const packageJson = JSON.parse(
      tree.read('apps/my-app/package.json', 'utf-8')
    );
    expect(packageJson.dependencies['expo-system-ui']).toBeUndefined();
  });

  it('should skip library projects', () => {
    addProjectConfiguration(tree, 'my-lib', {
      root: 'libs/my-lib',
      projectType: 'library',
    });

    writeJson(tree, 'libs/my-lib/package.json', {
      name: 'my-lib',
      dependencies: {
        expo: '~53.0.10',
      },
    });

    update(tree);

    const packageJson = JSON.parse(
      tree.read('libs/my-lib/package.json', 'utf-8')
    );
    expect(packageJson.dependencies['expo-system-ui']).toBeUndefined();
  });

  it('should handle projects without package.json', () => {
    addProjectConfiguration(tree, 'my-app', {
      root: 'apps/my-app',
      projectType: 'application',
    });

    // No package.json

    expect(() => update(tree)).not.toThrow();
  });
});
