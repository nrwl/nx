import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { fastifyVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  it('should add dependencies', async () => {
    await initGenerator(tree, {});

    const packageJson = devkit.readJson(tree, 'package.json');
    expect(packageJson.dependencies['fastify']).toBe(fastifyVersion);
  });

  it('should set @nrwl/fastify as the default collection when none was set before', async () => {
    await initGenerator(tree, {});

    const { cli } = devkit.readJson<devkit.NxJsonConfiguration>(
      tree,
      'nx.json'
    );
    expect(cli.defaultCollection).toEqual('@nrwl/fastify');
  });

  it('should not set @nrwl/fastify as the default collection when another one was set before', async () => {
    devkit.updateJson(tree, 'nx.json', (json) => ({
      ...json,
      cli: { defaultCollection: '@nrwl/node' },
    }));

    await initGenerator(tree, {});

    const workspaceJson = devkit.readJson(tree, 'nx.json');
    expect(workspaceJson.cli.defaultCollection).toEqual('@nrwl/node');
  });

  it('should add jest config when unitTestRunner is jest', async () => {
    await initGenerator(tree, { unitTestRunner: 'jest' });

    expect(tree.exists('jest.config.js')).toBe(true);
  });

  it('should not add jest config when unitTestRunner is none', async () => {
    await initGenerator(tree, { unitTestRunner: 'none' });

    expect(tree.exists('jest.config.js')).toBe(false);
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await initGenerator(tree, {});

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await initGenerator(tree, { skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });
});
