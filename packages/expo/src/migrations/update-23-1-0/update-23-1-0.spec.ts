import { addProjectConfiguration, readJson, Tree, writeJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import updateMetroConfig from './update-metro-config-for-expo-56';
import replaceStandaloneMetro from './replace-standalone-metro-for-expo-56';
import updateJestWinterRuntime from './update-jest-winter-runtime-for-expo-56';

const OLD_METRO_CONFIG = `const { withNxMetro } = require('@nx/expo');
const { getDefaultConfig } = require('@expo/metro-config');
const { mergeConfig } = require('metro-config');

const defaultConfig = getDefaultConfig(__dirname);
module.exports = withNxMetro(mergeConfig(defaultConfig, {}), {});
`;

const OLD_TEST_SETUP = `jest.mock('expo/src/winter/ImportMetaRegistry', () => ({
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

describe('Expo SDK 56 migrations', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    writeJson(tree, 'package.json', {
      name: 'root',
      dependencies: {
        expo: '~56.0.0',
        'metro-config': '~0.84.3',
        'metro-resolver': '~0.84.3',
      },
    });
    addProjectConfiguration(tree, 'myapp', {
      root: 'apps/myapp',
      projectType: 'application',
    });
    writeJson(tree, 'apps/myapp/package.json', {
      name: 'myapp',
      dependencies: {
        expo: '*',
        'metro-config': '*',
        'metro-resolver': '*',
      },
    });
    tree.write('apps/myapp/metro.config.js', OLD_METRO_CONFIG);
    tree.write('apps/myapp/src/test-setup.ts', OLD_TEST_SETUP);
  });

  describe('update-metro-config', () => {
    it('rewrites the generated metro.config.js to @expo/metro', () => {
      updateMetroConfig(tree);
      const content = tree.read('apps/myapp/metro.config.js', 'utf-8');
      expect(content).toContain("require('expo/metro-config')");
      expect(content).toContain("require('@expo/metro/metro-config')");
      expect(content).not.toContain("require('metro-config')");
    });

    it('leaves a customized metro.config.js untouched', () => {
      const custom = `const { getDefaultConfig } = require('expo/metro-config');\n`;
      tree.write('apps/myapp/metro.config.js', custom);
      updateMetroConfig(tree);
      expect(tree.read('apps/myapp/metro.config.js', 'utf-8')).toBe(custom);
    });
  });

  describe('replace-standalone-metro', () => {
    it('swaps standalone metro packages for @expo/metro in root and app', () => {
      replaceStandaloneMetro(tree);
      const root = readJson(tree, 'package.json');
      expect(root.dependencies['metro-config']).toBeUndefined();
      expect(root.dependencies['metro-resolver']).toBeUndefined();
      expect(root.dependencies['@expo/metro']).toBeDefined();

      const app = readJson(tree, 'apps/myapp/package.json');
      expect(app.dependencies['metro-config']).toBeUndefined();
      expect(app.dependencies['metro-resolver']).toBeUndefined();
      expect(app.dependencies['@expo/metro']).toBe('*');
    });
  });

  describe('update-jest-winter-runtime', () => {
    it('adds the winter-globals block to the generated test-setup', () => {
      updateJestWinterRuntime(tree);
      const content = tree.read('apps/myapp/src/test-setup.ts', 'utf-8');
      expect(content).toContain('defineGlobal(');
      expect(content).toContain("defineGlobal('fetch', globalThis.fetch)");
      // still keeps the existing content
      expect(content).toContain('ImportMetaRegistry');
      expect(content).toContain('structuredClone');
    });

    it('is idempotent', () => {
      updateJestWinterRuntime(tree);
      updateJestWinterRuntime(tree);
      const content = tree.read('apps/myapp/src/test-setup.ts', 'utf-8');
      expect((content.match(/const defineGlobal =/g) ?? []).length).toBe(1);
    });
  });
});
