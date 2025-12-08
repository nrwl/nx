import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration } from '@nx/devkit';
import updateJestForExpo54 from './update-jest-for-expo-54';

describe('update-jest-for-expo-54 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // Create a minimal tsconfig.base.json at the workspace root
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
  });

  it('should update jest config for expo projects with jest.resolver.js', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.cts',
          },
        },
      },
    });

    // Create required files for Expo project
    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '54.0.0',
        },
      })
    );

    // Create jest config with expo preset and resolver
    tree.write(
      'apps/my-expo-app/jest.config.cts',
      `/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: 'my-expo-app',
  resolver: require.resolve('./jest.resolver.js'),
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
  },
  coverageDirectory: '../../coverage/apps/my-expo-app'
};`
    );

    // Create jest resolver file
    tree.write(
      'apps/my-expo-app/jest.resolver.js',
      `const defaultResolver = require('@nx/jest/plugins/resolver');

module.exports = (request, options) => {
  if (options.basedir && options.basedir.includes('expo/src/winter') && request === './runtime') {
    return defaultResolver('./runtime.ts', options);
  }
  return defaultResolver(request, options);
};`
    );

    // Create existing test-setup.ts
    tree.write('apps/my-expo-app/src/test-setup.ts', '');

    // Create tsconfig files
    tree.write(
      'apps/my-expo-app/tsconfig.app.json',
      JSON.stringify({
        compilerOptions: {},
        exclude: ['jest.config.ts', 'jest.resolver.js', 'src/**/*.spec.ts'],
      })
    );

    tree.write(
      'apps/my-expo-app/tsconfig.spec.json',
      JSON.stringify({
        compilerOptions: {},
        include: [
          'jest.config.ts',
          'jest.resolver.js',
          'src/**/*.test.ts',
          'src/**/*.spec.ts',
        ],
      })
    );

    await updateJestForExpo54(tree);

    // Check that resolver line was removed from jest.config
    const updatedConfig = tree.read(
      'apps/my-expo-app/jest.config.cts',
      'utf-8'
    );
    expect(updatedConfig).not.toContain('jest.resolver.js');
    expect(updatedConfig).toContain('jest-expo');

    // Check that jest.resolver.js was deleted
    expect(tree.exists('apps/my-expo-app/jest.resolver.js')).toBe(false);

    // Check that test-setup.ts was updated with new mocks
    const testSetupContent = tree.read(
      'apps/my-expo-app/src/test-setup.ts',
      'utf-8'
    );
    expect(testSetupContent).toContain('ImportMetaRegistry');
    expect(testSetupContent).toContain('structuredClone');

    // Check that tsconfig files were updated
    const appTsConfig = JSON.parse(
      tree.read('apps/my-expo-app/tsconfig.app.json', 'utf-8')
    );
    expect(appTsConfig.exclude).not.toContain('jest.resolver.js');

    const specTsConfig = JSON.parse(
      tree.read('apps/my-expo-app/tsconfig.spec.json', 'utf-8')
    );
    expect(specTsConfig.include).not.toContain('jest.resolver.js');
  });

  it('should not modify non-expo projects', async () => {
    addProjectConfiguration(tree, 'my-react-app', {
      root: 'apps/my-react-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-react-app/jest.config.cts',
          },
        },
      },
    });

    // Create required files for non-Expo project
    tree.write(
      'apps/my-react-app/package.json',
      JSON.stringify({
        name: 'my-react-app',
        dependencies: {
          react: '18.0.0',
        },
      })
    );

    // Create jest config without expo preset
    tree.write(
      'apps/my-react-app/jest.config.cts',
      `module.exports = {
  displayName: 'my-react-app',
  preset: '@nx/react/jest',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  coverageDirectory: '../../coverage/apps/my-react-app'
};`
    );

    await updateJestForExpo54(tree);

    // Check that jest.config does not have jest-expo changes (no ImportMetaRegistry mock needed)
    const config = tree.read('apps/my-react-app/jest.config.cts', 'utf-8');
    expect(config).toContain('@nx/react/jest');
    expect(config).not.toContain('jest-expo');
  });

  it('should not modify expo projects without jest.resolver.js in config', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.cts',
          },
        },
      },
    });

    // Create required files for Expo project
    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '54.0.0',
        },
      })
    );

    // Create jest config with expo preset but no resolver
    tree.write(
      'apps/my-expo-app/jest.config.cts',
      `/// <reference types="jest" />
/// <reference types="node" />
module.exports = {
  displayName: 'my-expo-app',
  preset: 'jest-expo',
  moduleFileExtensions: ['ts', 'js', 'html', 'tsx', 'jsx'],
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/my-expo-app'
};`
    );

    await updateJestForExpo54(tree);

    // Check that jest.config still has jest-expo preset (was not changed since no resolver)
    const config = tree.read('apps/my-expo-app/jest.config.cts', 'utf-8');
    expect(config).toContain('jest-expo');
    expect(config).not.toContain('jest.resolver.js');
  });

  it('should preserve existing content in test-setup.ts', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.cts',
          },
        },
      },
    });

    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '54.0.0',
        },
      })
    );

    tree.write(
      'apps/my-expo-app/jest.config.cts',
      `module.exports = {
  displayName: 'my-expo-app',
  resolver: require.resolve('./jest.resolver.js'),
  preset: 'jest-expo',
};`
    );

    tree.write(
      'apps/my-expo-app/jest.resolver.js',
      `const defaultResolver = require('@nx/jest/plugins/resolver');
module.exports = defaultResolver;`
    );

    // Create test-setup with existing content
    const existingContent = `// Existing setup code
import '@testing-library/jest-dom';

beforeAll(() => {
  console.log('Test setup');
});
`;
    tree.write('apps/my-expo-app/src/test-setup.ts', existingContent);

    await updateJestForExpo54(tree);

    const testSetupContent = tree.read(
      'apps/my-expo-app/src/test-setup.ts',
      'utf-8'
    );

    // Should contain new mocks
    expect(testSetupContent).toContain('ImportMetaRegistry');
    expect(testSetupContent).toContain('structuredClone');

    // Should preserve existing content
    expect(testSetupContent).toContain('@testing-library/jest-dom');
    expect(testSetupContent).toContain('beforeAll');
  });

  it('should handle js projects correctly', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.js',
          },
        },
      },
    });

    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '54.0.0',
        },
      })
    );

    tree.write(
      'apps/my-expo-app/jest.config.js',
      `module.exports = {
  displayName: 'my-expo-app',
  resolver: require.resolve('./jest.resolver.js'),
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.js'],
};`
    );

    tree.write(
      'apps/my-expo-app/jest.resolver.js',
      `const defaultResolver = require('@nx/jest/plugins/resolver');
module.exports = defaultResolver;`
    );

    tree.write('apps/my-expo-app/src/test-setup.js', '');

    await updateJestForExpo54(tree);

    // Check that resolver was removed
    const config = tree.read('apps/my-expo-app/jest.config.js', 'utf-8');
    expect(config).not.toContain('jest.resolver.js');

    // Check that jest.resolver.js was deleted
    expect(tree.exists('apps/my-expo-app/jest.resolver.js')).toBe(false);

    // Check that test-setup.js was updated
    const testSetupContent = tree.read(
      'apps/my-expo-app/src/test-setup.js',
      'utf-8'
    );
    expect(testSetupContent).toContain('ImportMetaRegistry');
  });

  it('should not duplicate mocks if already present', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.cts',
          },
        },
      },
    });

    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '54.0.0',
        },
      })
    );

    tree.write(
      'apps/my-expo-app/jest.config.cts',
      `module.exports = {
  displayName: 'my-expo-app',
  resolver: require.resolve('./jest.resolver.js'),
  preset: 'jest-expo',
};`
    );

    tree.write(
      'apps/my-expo-app/jest.resolver.js',
      `const defaultResolver = require('@nx/jest/plugins/resolver');
module.exports = defaultResolver;`
    );

    // Create test-setup with mocks already present
    const existingContent = `jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
  ImportMetaRegistry: {
    get url() {
      return null;
    },
  },
}));

if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (object) => JSON.parse(JSON.stringify(object));
}
`;
    tree.write('apps/my-expo-app/src/test-setup.ts', existingContent);

    await updateJestForExpo54(tree);

    const testSetupContent = tree.read(
      'apps/my-expo-app/src/test-setup.ts',
      'utf-8'
    );

    // Should not duplicate mocks - ImportMetaRegistry should appear only once
    // (the mock should not be added again since it already exists)
    const importMetaMockCount = (
      testSetupContent.match(
        /jest\.mock\('expo\/src\/winter\/ImportMetaRegistry'/g
      ) || []
    ).length;
    expect(importMetaMockCount).toBe(1);

    // structuredClone check should appear only once
    const structuredCloneCheckCount = (
      testSetupContent.match(/typeof global\.structuredClone/g) || []
    ).length;
    expect(structuredCloneCheckCount).toBe(1);
  });

  it('should create test-setup.ts if it does not exist', async () => {
    addProjectConfiguration(tree, 'my-expo-app', {
      root: 'apps/my-expo-app',
      projectType: 'application',
      targets: {
        test: {
          executor: '@nx/jest:jest',
          options: {
            jestConfig: 'apps/my-expo-app/jest.config.cts',
          },
        },
      },
    });

    tree.write(
      'apps/my-expo-app/package.json',
      JSON.stringify({
        name: 'my-expo-app',
        dependencies: {
          expo: '54.0.0',
        },
      })
    );

    tree.write(
      'apps/my-expo-app/jest.config.cts',
      `module.exports = {
  displayName: 'my-expo-app',
  resolver: require.resolve('./jest.resolver.js'),
  preset: 'jest-expo',
};`
    );

    tree.write(
      'apps/my-expo-app/jest.resolver.js',
      `const defaultResolver = require('@nx/jest/plugins/resolver');
module.exports = defaultResolver;`
    );

    // Don't create test-setup.ts - it should be created by the migration

    await updateJestForExpo54(tree);

    // Check that test-setup.ts was created
    expect(tree.exists('apps/my-expo-app/src/test-setup.ts')).toBe(true);

    const testSetupContent = tree.read(
      'apps/my-expo-app/src/test-setup.ts',
      'utf-8'
    );
    expect(testSetupContent).toContain('ImportMetaRegistry');
    expect(testSetupContent).toContain('structuredClone');
  });
});
