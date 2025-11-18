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

import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nestJsSchematicsVersion, nxVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  it('should add dependencies', async () => {
    await initGenerator(tree, {});

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nestjs/schematics']).toBe(
      nestJsSchematicsVersion
    );
    expect(packageJson.devDependencies['@nx/nest']).toBe(nxVersion);
  });

  describe('--skipFormat', () => {
    it('should format files by default', async () => {
      await initGenerator(tree, {});

      expect(mockFormatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      await initGenerator(tree, { skipFormat: true });

      expect(mockFormatFiles).not.toHaveBeenCalled();
    });
  });
});
