import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
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

    const packageJson = devkit.readJson(tree, 'package.json');
    expect(packageJson.devDependencies['@nestjs/schematics']).toBe(
      nestJsSchematicsVersion
    );
    expect(packageJson.devDependencies['@nx/nest']).toBe(nxVersion);
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
