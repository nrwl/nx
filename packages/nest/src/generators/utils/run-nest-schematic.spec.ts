import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { runNestSchematic } from './run-nest-schematic';
import { createTreeWithNestApplication } from './testing';
import type { NestSchematic, NormalizedOptions } from './types';

describe('runNestSchematic utility', () => {
  let tree: Tree;
  const project = 'api';
  const options: NormalizedOptions = {
    name: 'test',
    sourceRoot: `apps/${project}/src`,
    flat: true,
    spec: true,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(project);
    jest.clearAllMocks();
  });

  const testTypes: NestSchematic[] = [
    'class',
    'controller',
    'decorator',
    'filter',
    'gateway',
    'guard',
    'interceptor',
    'interface',
    'middleware',
    'module',
    'pipe',
    'provider',
    'resolver',
    'service',
  ];

  test.each(testTypes)('%p should run successfully', async (type) => {
    await expect(
      runNestSchematic(tree, type, options)
    ).resolves.not.toThrowError();
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await runNestSchematic(tree, 'class', options);

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await runNestSchematic(tree, 'class', { ...options, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });
});
