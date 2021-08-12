import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  nestJsSchematicsVersion,
  nestJsVersion,
  nxVersion,
} from '../../utils/versions';
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
    expect(packageJson.dependencies['@nestjs/common']).toBe(nestJsVersion);
    expect(packageJson.dependencies['@nestjs/core']).toBe(nestJsVersion);
    expect(packageJson.dependencies['@nestjs/platform-express']).toBe(
      nestJsVersion
    );
    expect(packageJson.dependencies['reflect-metadata']).toBeDefined();
    expect(packageJson.dependencies['rxjs']).toBeDefined();
    expect(packageJson.dependencies['tslib']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/nest']).toBeUndefined();
    expect(packageJson.devDependencies['@nestjs/schematics']).toBe(
      nestJsSchematicsVersion
    );
    expect(packageJson.devDependencies['@nestjs/testing']).toBe(nestJsVersion);
    expect(packageJson.devDependencies['@nrwl/nest']).toBe(nxVersion);
  });

  it('should set @nrwl/nest as the default collection when none was set before', async () => {
    await initGenerator(tree, {});

    const { cli } = devkit.readNxJson(tree);
    expect(cli.defaultCollection).toEqual('@nrwl/nest');
  });

  it('should not set @nrwl/nest as the default collection when another one was set before', async () => {
    devkit.updateJson(tree, 'workspace.json', (json) => ({
      ...json,
      cli: { defaultCollection: '@nrwl/node' },
    }));

    await initGenerator(tree, {});

    const workspaceJson = devkit.readJson(tree, 'workspace.json');
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
