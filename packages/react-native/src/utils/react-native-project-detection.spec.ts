import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  isReactNativeProject,
  getAllReactNativeProjects,
} from './react-native-project-detection';
import * as nxDevkitConfigUtils from '@nx/devkit/src/utils/config-utils';
import * as path from 'path';

describe('React Native Project Detection', () => {
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

  describe('isReactNativeProject (Tree-based)', () => {
    it('should return true for valid React Native project', async () => {
      const projectRoot = 'apps/mobile-app';

      // Create required files
      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );
      tree.write(
        `${projectRoot}/app.json`,
        JSON.stringify({
          name: 'mobile-app',
          displayName: 'Mobile App',
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return false when missing metro.config.js', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );
      tree.write(
        `${projectRoot}/app.json`,
        JSON.stringify({
          name: 'mobile-app',
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe('Missing required file: metro.config.js');
    });

    it('should return false when missing package.json', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/app.json`,
        JSON.stringify({
          name: 'mobile-app',
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe('Missing required file: package.json');
    });

    it('should return false when missing app config files', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe(
        'Missing app config file (app.json, app.config.js, or app.config.ts)'
      );
    });

    it('should return false when project has Expo dependency', async () => {
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
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe(
        'Project has Expo dependency - this is an Expo project'
      );
    });

    it('should return false when project has Expo devDependency', async () => {
      const projectRoot = 'apps/expo-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'expo-app',
          dependencies: {
            'react-native': '0.72.0',
          },
          devDependencies: {
            expo: '49.0.0',
          },
        })
      );
      tree.write(
        `${projectRoot}/app.json`,
        JSON.stringify({
          name: 'expo-app',
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe(
        'Project has Expo dependency - this is an Expo project'
      );
    });

    it('should return false when app config has Expo configuration', async () => {
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

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe('App config has Expo configuration');
    });

    it('should work with app.config.js', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );
      tree.write(
        `${projectRoot}/app.config.js`,
        'module.exports = { name: "mobile-app" };'
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(true);
    });

    it('should work with app.config.ts', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );
      tree.write(
        `${projectRoot}/app.config.ts`,
        'export default { name: "mobile-app" };'
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(true);
    });

    it('should handle invalid package.json', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(`${projectRoot}/package.json`, 'invalid json');
      tree.write(
        `${projectRoot}/app.json`,
        JSON.stringify({
          name: 'mobile-app',
        })
      );

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe('Failed to parse package.json');
    });

    it('should handle invalid app.json', async () => {
      const projectRoot = 'apps/mobile-app';

      tree.write(`${projectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${projectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );
      tree.write(`${projectRoot}/app.json`, 'invalid json');

      const result = await isReactNativeProject(tree, projectRoot);

      expect(result.isReactNative).toBe(false);
      expect(result.reason).toBe('Failed to parse app config file');
    });
  });

  describe('getAllReactNativeProjects', () => {
    it('should return all React Native projects', async () => {
      // Create React Native project
      const rnProjectRoot = 'apps/mobile-app';
      tree.write(`${rnProjectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${rnProjectRoot}/package.json`,
        JSON.stringify({
          name: 'mobile-app',
          dependencies: {
            'react-native': '0.72.0',
          },
        })
      );
      tree.write(
        `${rnProjectRoot}/app.json`,
        JSON.stringify({
          name: 'mobile-app',
        })
      );

      // Create Expo project (should be excluded)
      const expoProjectRoot = 'apps/expo-app';
      tree.write(`${expoProjectRoot}/metro.config.js`, 'module.exports = {};');
      tree.write(
        `${expoProjectRoot}/package.json`,
        JSON.stringify({
          name: 'expo-app',
          dependencies: {
            'react-native': '0.72.0',
            expo: '49.0.0',
          },
        })
      );
      tree.write(
        `${expoProjectRoot}/app.json`,
        JSON.stringify({
          expo: {
            name: 'expo-app',
          },
        })
      );

      // Create web project (should be excluded)
      const webProjectRoot = 'apps/web-app';
      tree.write(
        `${webProjectRoot}/package.json`,
        JSON.stringify({
          name: 'web-app',
          dependencies: {
            react: '18.0.0',
          },
        })
      );

      const projects = new Map();
      projects.set('mobile-app', { root: rnProjectRoot });
      projects.set('expo-app', { root: expoProjectRoot });
      projects.set('web-app', { root: webProjectRoot });

      const result = await getAllReactNativeProjects(tree, projects);

      expect(result).toEqual(['mobile-app']);
    });

    it('should return empty array when no React Native projects exist', async () => {
      const projects = new Map();
      projects.set('web-app', { root: 'apps/web-app' });

      const result = await getAllReactNativeProjects(tree, projects);

      expect(result).toEqual([]);
    });
  });
});
