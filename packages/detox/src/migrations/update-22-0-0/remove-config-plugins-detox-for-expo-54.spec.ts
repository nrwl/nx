import { Tree, readJson, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './remove-config-plugins-detox-for-expo-54';

describe('remove-config-plugins-detox-for-expo-54 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should remove @config-plugins/detox for Expo 54+ projects', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: '~54.0.0',
      },
      devDependencies: {
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(
      packageJson.devDependencies['@config-plugins/detox']
    ).toBeUndefined();
  });

  it('should remove @config-plugins/detox from dependencies if present there', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: '~54.0.0',
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.dependencies['@config-plugins/detox']).toBeUndefined();
  });

  it('should NOT remove @config-plugins/detox for Expo 53 projects', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: '~53.0.0',
      },
      devDependencies: {
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@config-plugins/detox']).toBe(
      '~11.0.0'
    );
  });

  it('should skip if @config-plugins/detox is not installed', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: '~54.0.0',
      },
      devDependencies: {
        detox: '~20.43.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['detox']).toBe('~20.43.0');
  });

  it('should skip if expo is not installed (React Native project)', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        'react-native': '~0.81.0',
      },
      devDependencies: {
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    // Should keep @config-plugins/detox for React Native projects
    expect(packageJson.devDependencies['@config-plugins/detox']).toBe(
      '~11.0.0'
    );
  });

  it('should handle caret version ranges for Expo 54+', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: '^54.0.0',
      },
      devDependencies: {
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(
      packageJson.devDependencies['@config-plugins/detox']
    ).toBeUndefined();
  });

  it('should handle exact version for Expo 54+', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: '54.0.25',
      },
      devDependencies: {
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    expect(
      packageJson.devDependencies['@config-plugins/detox']
    ).toBeUndefined();
  });

  it('should handle missing package.json gracefully', async () => {
    tree.delete('package.json');

    await expect(update(tree)).resolves.not.toThrow();
  });

  it('should handle unparseable expo version gracefully', async () => {
    writeJson(tree, 'package.json', {
      name: '@proj/source',
      dependencies: {
        expo: 'invalid-version',
      },
      devDependencies: {
        '@config-plugins/detox': '~11.0.0',
      },
    });

    await update(tree);

    const packageJson = readJson(tree, 'package.json');
    // Should keep @config-plugins/detox when version can't be parsed
    expect(packageJson.devDependencies['@config-plugins/detox']).toBe(
      '~11.0.0'
    );
  });
});
