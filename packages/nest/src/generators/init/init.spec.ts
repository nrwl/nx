import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  nestJsSchematicsVersion,
  nestJsVersion8,
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
    expect(packageJson.dependencies['@nestjs/common']).toBe(nestJsVersion8);
    expect(packageJson.dependencies['@nestjs/core']).toBe(nestJsVersion8);
    expect(packageJson.dependencies['@nestjs/platform-express']).toBe(
      nestJsVersion8
    );
    expect(packageJson.dependencies['reflect-metadata']).toBeDefined();
    expect(packageJson.dependencies['rxjs']).toBeDefined();
    expect(packageJson.dependencies['tslib']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/nest']).toBeUndefined();
    expect(packageJson.devDependencies['@nestjs/schematics']).toBe(
      nestJsSchematicsVersion
    );
    expect(packageJson.devDependencies['@nestjs/testing']).toBe(nestJsVersion8);
    expect(packageJson.devDependencies['@nrwl/nest']).toBe(nxVersion);
  });

  it('should add jest config when unitTestRunner is jest', async () => {
    await initGenerator(tree, { unitTestRunner: 'jest' });

    expect(tree.exists('jest.config.ts')).toBe(true);
  });

  it('should not add jest config when unitTestRunner is none', async () => {
    await initGenerator(tree, { unitTestRunner: 'none' });

    expect(tree.exists('jest.config.ts')).toBe(false);
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
