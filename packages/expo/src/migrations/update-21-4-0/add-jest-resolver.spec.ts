import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration } from '@nx/devkit';
import addJestResolver from './add-jest-resolver';
import * as nxDevkitConfigUtils from '@nx/devkit/src/utils/config-utils';
import * as path from 'path';

describe('add-jest-resolver migration', () => {
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

  it('should add jest resolver to expo projects', async () => {
    // Add an Expo project with Jest configuration
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.ts',
          },
        },
      },
    });

    // Create required files for Expo project detection
    tree.write('apps/my-expo-app/metro.config.js', 'module.exports = {};');
    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      'apps/my-expo-app/app.json',
      JSON.stringify({
        expo: {
          name: 'my-expo-app',
          slug: 'my-expo-app',
        },
      })
    );

    // Create jest config with expo preset
    tree.write(
      'apps/my-expo-app/jest.config.ts',
      `module.exports = {
  displayName: 'my-expo-app',
  resolver: '@nx/jest/plugins/resolver',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '\\.svg$': '@nx/expo/plugins/jest/svg-mock'
  },
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      {
        configFile: __dirname + '/.babelrc.js',
      },
    ],
    '^.+\\\.(bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp|ttf|otf|m4v|mov|mp4|mpeg|mpg|webm|aac|aiff|caf|m4a|mp3|wav|html|pdf|obj)$': require.resolve(
      'jest-expo/src/preset/assetFileTransformer.js'
    ),
  },
  coverageDirectory: '../coverage/my-expo-app'
};`
    );

    await addJestResolver(tree);

    // Check that the resolver file was created
    expect(tree.exists('apps/my-expo-app/jest.resolver.js')).toBe(true);

    const resolverContent = tree.read(
      'apps/my-expo-app/jest.resolver.js',
      'utf-8'
    );
    expect(resolverContent).toContain(
      "const defaultResolver = require('@nx/jest/plugins/resolver');"
    );
    expect(resolverContent).toContain('expo/src/winter');
    expect(resolverContent).toContain('./runtime.ts');

    // Check that the jest config was updated
    const updatedConfig = tree.read('apps/my-expo-app/jest.config.ts', 'utf-8');
    expect(updatedConfig).toContain(
      "resolver: require.resolve('./jest.resolver.js')"
    );
    expect(updatedConfig).not.toContain('transformIgnorePatterns'); // Should not add transformIgnorePatterns since jest-expo handles it
  });

  it('should not affect non-expo projects', async () => {
    // Add a regular React project
    addProjectConfiguration(tree, 'my-react-app', {
      root: 'apps/my-react-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-react-app/jest.config.ts',
          },
        },
      },
    });

    // Create required files for a non-Expo project
    tree.write('apps/my-react-app/metro.config.js', 'module.exports = {};');
    tree.write(
      'apps/my-react-app/package.json',
      JSON.stringify({
        name: 'my-react-app',
        dependencies: {
          'react-native': '0.72.0',
        },
      })
    );
    tree.write(
      'apps/my-react-app/app.json',
      JSON.stringify({
        name: 'my-react-app',
      })
    );

    // Create jest config without expo preset
    tree.write(
      'apps/my-react-app/jest.config.ts',
      `module.exports = {
        displayName: 'my-react-app',
        resolver: '@nx/jest/plugins/resolver',
        preset: '@nx/react/jest',
        moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
        setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
        transform: {
          '\\.[jt]sx?$': 'babel-jest',
        },
        coverageDirectory: '../coverage/my-react-app',
      };`
    );

    await addJestResolver(tree);

    // Check that the resolver file was NOT created
    expect(tree.exists('apps/my-react-app/jest.resolver.js')).toBe(false);

    // Check that the jest config was NOT modified
    const config = tree.read('apps/my-react-app/jest.config.ts', 'utf-8');
    expect(config).toContain("resolver: '@nx/jest/plugins/resolver'");
    expect(config).not.toContain('transformIgnorePatterns');
  });

  it('should handle existing custom resolver', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.ts',
          },
        },
      },
    });

    // Create required files for Expo project detection
    tree.write('apps/my-expo-app/metro.config.js', 'module.exports = {};');
    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          'react-native': '0.72.0',
          expo: '49.0.0',
        },
      })
    );
    tree.write(
      'apps/my-expo-app/app.json',
      JSON.stringify({
        expo: {
          name: 'my-expo-app',
          slug: 'my-expo-app',
        },
      })
    );

    // Create jest config with expo preset and existing custom resolver
    tree.write(
      'apps/my-expo-app/jest.config.ts',
      `module.exports = {
        displayName: 'my-expo-app',
        resolver: './my-custom-resolver.js',
        preset: 'jest-expo',
        moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
        setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
        moduleNameMapper: {
          '\\.svg$': '@nx/expo/plugins/jest/svg-mock',
        },
        transform: {
          '\\.[jt]sx?$': [
            'babel-jest',
            {
              configFile: __dirname + '/.babelrc.js',
            },
          ],
        },
        coverageDirectory: '../coverage/my-expo-app',
      };`
    );

    // Create existing resolver file
    tree.write(
      'apps/my-expo-app/jest.resolver.js',
      "module.exports = require('@nx/jest/plugins/resolver');"
    );

    await addJestResolver(tree);

    // Check that the existing resolver file was not overwritten
    const resolverContent = tree.read(
      'apps/my-expo-app/jest.resolver.js',
      'utf-8'
    );
    expect(resolverContent.trim()).toBe(
      "module.exports = require('@nx/jest/plugins/resolver');"
    );
  });
});
