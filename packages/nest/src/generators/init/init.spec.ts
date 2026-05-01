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
    let formatFilesSpy: jest.SpyInstance;

    beforeEach(() => {
      const devkitModule = require('@nx/devkit');
      formatFilesSpy = jest
        .spyOn(devkitModule, 'formatFiles')
        .mockImplementation(() => Promise.resolve());
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    it('should format files by default', async () => {
      await initGenerator(tree, {});

      expect(formatFilesSpy).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      await initGenerator(tree, { skipFormat: true });

      expect(formatFilesSpy).not.toHaveBeenCalled();
    });
  });
});
