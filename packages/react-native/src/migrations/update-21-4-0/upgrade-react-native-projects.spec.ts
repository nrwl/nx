import { Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import update from './upgrade-react-native-projects';
import * as nxDevkitConfigUtils from '@nx/devkit/src/utils/config-utils';
import * as path from 'path';

// Mock execSync
jest.mock('child_process', () => ({
  execSync: jest.fn(),
  exec: jest.fn(),
}));

describe('upgrade-react-native-projects', () => {
  let tree: Tree;
  const { execSync } = require('child_process');

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();

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

  function createReactNativeProject(
    tree: Tree,
    projectName: string,
    projectRoot: string
  ) {
    addProjectConfiguration(tree, projectName, {
      root: projectRoot,
      projectType: 'application',
    });

    // Create required files for React Native project
    tree.write(`${projectRoot}/metro.config.js`, `module.exports = {};`);
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: projectName,
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      `${projectRoot}/app.json`,
      JSON.stringify({
        name: projectName,
        displayName: projectName,
      })
    );
  }

  function createExpoProject(
    tree: Tree,
    projectName: string,
    projectRoot: string
  ) {
    addProjectConfiguration(tree, projectName, {
      root: projectRoot,
      projectType: 'application',
    });

    // Create required files for Expo project (should be excluded)
    tree.write(`${projectRoot}/metro.config.js`, `module.exports = {};`);
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: projectName,
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
          name: projectName,
          slug: projectName,
        },
      })
    );
  }

  function createWebProject(
    tree: Tree,
    projectName: string,
    projectRoot: string
  ) {
    addProjectConfiguration(tree, projectName, {
      root: projectRoot,
      projectType: 'application',
    });

    // Create files for web project (should be excluded)
    tree.write(
      `${projectRoot}/package.json`,
      JSON.stringify({
        name: projectName,
        dependencies: {
          react: '18.0.0',
        },
      })
    );
  }

  it('should upgrade React Native projects', async () => {
    createReactNativeProject(tree, 'mobile-app', 'apps/mobile-app');
    createWebProject(tree, 'web-app', 'apps/web-app');

    await update(tree);

    expect(execSync).toHaveBeenCalledWith(
      'npx --ignore-scripts nx upgrade mobile-app',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('should upgrade multiple React Native projects', async () => {
    createReactNativeProject(tree, 'mobile-app-1', 'apps/mobile-app-1');
    createReactNativeProject(tree, 'mobile-app-2', 'apps/mobile-app-2');
    createWebProject(tree, 'web-app', 'apps/web-app');

    await update(tree);

    expect(execSync).toHaveBeenCalledWith(
      'npx --ignore-scripts nx upgrade mobile-app-1',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );
    expect(execSync).toHaveBeenCalledWith(
      'npx --ignore-scripts nx upgrade mobile-app-2',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );
    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it('should not upgrade Expo projects', async () => {
    createExpoProject(tree, 'expo-app', 'apps/expo-app');
    createWebProject(tree, 'web-app', 'apps/web-app');

    await update(tree);

    expect(execSync).not.toHaveBeenCalled();
  });

  it('should handle no React Native projects', async () => {
    createWebProject(tree, 'web-app', 'apps/web-app');

    await update(tree);

    expect(execSync).not.toHaveBeenCalled();
  });

  it('should continue upgrading other projects when one fails', async () => {
    createReactNativeProject(tree, 'mobile-app-1', 'apps/mobile-app-1');
    createReactNativeProject(tree, 'mobile-app-2', 'apps/mobile-app-2');

    // Make the first call fail
    execSync
      .mockImplementationOnce(() => {
        throw new Error('Upgrade failed');
      })
      .mockImplementationOnce(() => {
        // Second call succeeds
      });

    await update(tree);

    expect(execSync).toHaveBeenCalledTimes(2);
  });

  it('should not upgrade projects missing required files', async () => {
    // Create project with missing metro.config.js
    addProjectConfiguration(tree, 'incomplete-app', {
      root: 'apps/incomplete-app',
      projectType: 'application',
    });
    tree.write(
      'apps/incomplete-app/package.json',
      JSON.stringify({
        name: 'incomplete-app',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      'apps/incomplete-app/app.json',
      JSON.stringify({
        name: 'incomplete-app',
      })
    );
    // Missing metro.config.js

    await update(tree);

    expect(execSync).not.toHaveBeenCalled();
  });

  it('should handle React Native projects with app.config.js', async () => {
    addProjectConfiguration(tree, 'rn-config-js', {
      root: 'apps/rn-config-js',
      projectType: 'application',
    });

    tree.write('apps/rn-config-js/metro.config.js', `module.exports = {};`);
    tree.write(
      'apps/rn-config-js/package.json',
      JSON.stringify({
        name: 'rn-config-js',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      'apps/rn-config-js/app.config.js',
      `module.exports = { name: 'rn-config-js' };`
    );

    await update(tree);

    expect(execSync).toHaveBeenCalledWith(
      'npx --ignore-scripts nx upgrade rn-config-js',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it('should handle React Native projects with app.config.ts', async () => {
    addProjectConfiguration(tree, 'rn-config-ts', {
      root: 'apps/rn-config-ts',
      projectType: 'application',
    });

    tree.write('apps/rn-config-ts/metro.config.js', `module.exports = {};`);
    tree.write(
      'apps/rn-config-ts/package.json',
      JSON.stringify({
        name: 'rn-config-ts',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      'apps/rn-config-ts/app.config.ts',
      `export default { name: 'rn-config-ts' };`
    );

    await update(tree);

    expect(execSync).toHaveBeenCalledWith(
      'npx --ignore-scripts nx upgrade rn-config-ts',
      {
        stdio: 'inherit',
        cwd: process.cwd(),
      }
    );
    expect(execSync).toHaveBeenCalledTimes(1);
  });
});
