const mockFormatFiles = jest
  .fn()
  .mockImplementation(jest.requireActual('@nx/devkit').formatFiles);
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  formatFiles: mockFormatFiles,
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return {
      nodes: {},
      dependencies: {},
    };
  }),
}));

import type { Tree } from '@nx/devkit';
import { runNestSchematic } from './run-nest-schematic';
import { createTreeWithNestApplication } from './testing';
import type { NestSchematic, NormalizedOptions } from './types';

describe('runNestSchematic utility', () => {
  let tree: Tree;
  const directory = 'api';
  const options: NormalizedOptions = {
    name: 'test',
    sourceRoot: `apps/${directory}/src`,
    spec: true,
  };

  beforeEach(() => {
    tree = createTreeWithNestApplication(directory);
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
    await expect(runNestSchematic(tree, type, options)).resolves.not.toThrow();
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      await runNestSchematic(tree, 'class', options);

      expect(mockFormatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      await runNestSchematic(tree, 'class', { ...options, skipFormat: true });

      expect(mockFormatFiles).not.toHaveBeenCalled();
    });
  });
});
