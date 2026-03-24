import {
  ProjectGraph,
  readJson,
  readNxJson,
  Tree,
  updateJson,
  NxJsonConfiguration,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { initGenerator } from './init';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/vitest:init', () => {
  let tree: Tree;

  beforeEach(() => {
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
    tree = createTreeWithEmptyWorkspace();
  });

  it('should add the plugin by default when addPlugin is not provided', async () => {
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: true,
    });
    const nxJson = readNxJson(tree);
    expect(nxJson.plugins).toContainEqual(
      expect.objectContaining({ plugin: '@nx/vitest' })
    );
  });

  it('should update namedInputs for production', async () => {
    updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
      json.namedInputs ??= {};
      json.namedInputs.production = ['default'];
      return json;
    });

    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: true,
    });

    const nxJson = readNxJson(tree);
    expect(nxJson.namedInputs.production).toContain(
      '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)'
    );
    expect(nxJson.namedInputs.production).toContain(
      '!{projectRoot}/tsconfig.spec.json'
    );
  });

  it('should add required packages to package.json', async () => {
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: false,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['vitest']).toBeDefined();
    expect(packageJson.devDependencies['vite']).toBeDefined();
    expect(packageJson.devDependencies['@nx/vitest']).toBeDefined();
  });

  it('should not add packages when skipPackageJson is true', async () => {
    await initGenerator(tree, {
      skipFormat: true,
      skipPackageJson: true,
    });

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['vitest']).toBeUndefined();
  });

  it('should not add the plugin when NX_ADD_PLUGINS is false', async () => {
    const original = process.env.NX_ADD_PLUGINS;
    process.env.NX_ADD_PLUGINS = 'false';

    try {
      await initGenerator(tree, {
        skipFormat: true,
        skipPackageJson: true,
      });
      const nxJson = readNxJson(tree);
      expect(nxJson.plugins).toBeUndefined();
    } finally {
      process.env.NX_ADD_PLUGINS = original;
    }
  });

  describe('with addPlugin: true', () => {
    it('should add the vitest plugin to nx.json', async () => {
      await initGenerator(tree, {
        skipFormat: true,
        addPlugin: true,
        skipPackageJson: true,
      });

      const nxJson = readNxJson(tree);
      expect(nxJson.plugins).toContainEqual(
        expect.objectContaining({ plugin: '@nx/vitest' })
      );
    });

    it('should not add plugin if already in array', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.plugins = ['@nx/vitest'];
        return json;
      });

      await initGenerator(tree, {
        skipFormat: true,
        addPlugin: true,
        skipPackageJson: true,
      });

      const nxJson = readNxJson(tree);
      expect(nxJson.plugins).toEqual(['@nx/vitest']);
    });

    it('should not add target defaults when plugin is registered', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.production = ['default'];
        return json;
      });

      await initGenerator(tree, {
        skipFormat: true,
        addPlugin: true,
        skipPackageJson: true,
      });

      const nxJson = readNxJson(tree);
      expect(nxJson.targetDefaults?.['@nx/vitest:test']).toBeUndefined();
    });
  });

  describe('with addPlugin: false', () => {
    it('should not add the vitest plugin to nx.json', async () => {
      await initGenerator(tree, {
        skipFormat: true,
        addPlugin: false,
        skipPackageJson: true,
      });

      const nxJson = readNxJson(tree);
      expect(nxJson.plugins).toBeUndefined();
    });

    it('should add target defaults for @nx/vitest:test', async () => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs ??= {};
        json.namedInputs.production = ['default'];
        return json;
      });

      await initGenerator(tree, {
        skipFormat: true,
        addPlugin: false,
        skipPackageJson: true,
      });

      const nxJson = readNxJson(tree);
      expect(nxJson.targetDefaults['@nx/vitest:test']).toEqual({
        cache: true,
        inputs: ['default', '^production'],
      });
    });
  });
});
