import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { writeJson, readJson, Tree } from '@nrwl/devkit';
import migrate from './update-13-10-0';

describe('Update tsconfig for React apps', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update to React 18 if React Native is not installed', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        react: '17.0.2',
      },
    });

    const installTask = await migrate(tree);
    expect(installTask).toBeDefined();
  });

  it('should update to React 18 if React Native 0.68.0-rc.4 is installed', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        react: '17.0.2',
        'react-native': '0.68.0-rc.4',
      },
    });

    await migrate(tree);

    const installTask = await migrate(tree);
    expect(installTask).toBeDefined();
  });

  it('should skip update to React 18 if React Native 0.67.0 is installed', async () => {
    writeJson(tree, 'package.json', {
      dependencies: {
        react: '17.0.2',
        'react-native': '0.67.0',
      },
    });

    await migrate(tree);

    const installTask = await migrate(tree);
    expect(installTask).not.toBeDefined();
  });
});
