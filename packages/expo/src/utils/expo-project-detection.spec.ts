import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { isExpoProject } from './expo-project-detection';
import * as nxDevkitConfigUtils from '@nx/devkit/src/utils/config-utils';
import * as path from 'path';

describe('isExpoProject', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Create a minimal tsconfig.base.json at the workspace root for loadConfigFile
    tree.write(
      'tsconfig.base.json',
      JSON.stringify({
        compilerOptions: {
          rootDir: '.',
          baseUrl: '.',
          paths: {},
        },
      })
    );

    // Mock loadConfigFile to read from the in-memory tree
    jest
      .spyOn(nxDevkitConfigUtils, 'loadConfigFile')
      .mockImplementation(async (filePath: string) => {
        // Convert absolute path to relative path for tree.read
        const relativePath = path.relative(tree.root, filePath);

        // Check if file exists in the tree first
        if (!tree.exists(relativePath)) {
          throw new Error('File not found or empty');
        }

        const content = tree.read(relativePath, 'utf-8');

        if (content === null || content === undefined) {
          // Simulate file not found or empty content leading to parse error in real scenario
          throw new Error('File not found or empty');
        }

        if (filePath.endsWith('.json')) {
          try {
            return JSON.parse(content);
          } catch (e) {
            // Return null to indicate parse failure, the main function will handle this
            return null;
          }
        } else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
          // For JS/TS files, if they contain 'expo:', we mock them to have an expo field.
          if (content.includes('expo:')) {
            return { expo: {} };
          } else {
            return {};
          }
        }
        return null; // Should not reach here for valid app config files
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return true when both Expo dependency and app config with expo field exist', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        expo: {
          name: 'expo-app',
          slug: 'expo-app',
        },
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(true);
    expect(result.reason).toBe(
      'Project has Expo dependency and Expo configuration in app config'
    );
  });

  it('should return false when Expo dependency exists but no expo field in app.json', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        name: 'expo-app',
        displayName: 'Expo App',
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('No Expo dependency or configuration found');
  });

  it('should return false when expo field exists in app.json but no Expo dependency', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        expo: {
          name: 'expo-app',
          slug: 'expo-app',
        },
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('No Expo dependency or configuration found');
  });

  it('should return false if missing metro.config.js', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        expo: {
          name: 'expo-app',
          slug: 'expo-app',
        },
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('Missing required file: metro.config.js');
  });

  it('should return false if missing package.json', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        expo: {
          name: 'expo-app',
          slug: 'expo-app',
        },
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('Missing required file: package.json');
  });

  it('should return false if missing app config file', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          expo: '49.0.0',
        },
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe(
      'Missing app config file (app.json, app.config.js, or app.config.ts)'
    );
  });

  it('should return false if no expo dependency and no expo config in app.json', async () => {
    const projectRoot = 'apps/non-expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'non-expo-app',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        name: 'non-expo-app',
        displayName: 'Non Expo App',
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('No Expo dependency or configuration found');
  });

  it('should handle app.config.js (now false if it contains expo field but no dependency)', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.config.js`,
      'module.exports = { expo: { name: "expo-app" } };'
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('No Expo dependency or configuration found');
  });

  it('should handle app.config.ts (now false if it contains expo field but no dependency)', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.config.ts`,
      'export default { expo: { name: "expo-app" } };'
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('No Expo dependency or configuration found');
  });

  it('should return true when both Expo dependency and expo field exist in app.config.js', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.config.js`,
      'module.exports = { expo: { name: "expo-app" } };'
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(true);
    expect(result.reason).toBe(
      'Project has Expo dependency and Expo configuration in app config'
    );
  });

  it('should return true when both Expo dependency and expo field exist in app.config.ts', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.config.ts`,
      'export default { expo: { name: "expo-app" } };'
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(true);
    expect(result.reason).toBe(
      'Project has Expo dependency and Expo configuration in app config'
    );
  });

  it('should return false for invalid package.json', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(`${projectRoot}/package.json`, 'invalid json');
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        expo: {
          name: 'expo-app',
          slug: 'expo-app',
        },
      })
    );

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('Failed to parse package.json');
  });

  it('should return false for invalid app.json', async () => {
    const projectRoot = 'apps/expo-app';

    tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: 'expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(`${projectRoot}/app.json`, 'invalid json');

    const result = await isExpoProject(tree, projectRoot);

    expect(result.isExpo).toBe(false);
    expect(result.reason).toBe('Failed to parse app config file');
  });
});
