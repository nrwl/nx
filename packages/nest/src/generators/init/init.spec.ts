import * as devkit from '@nx/devkit';
import type { MockInstance } from 'vitest';
import { readJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { nestJsSchematicsVersion, nxVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('init generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    vi.clearAllMocks();
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
    let formatFilesSpy: MockInstance;

    beforeEach(() => {
      formatFilesSpy = vi
        .spyOn(devkit, 'formatFiles')
        .mockImplementation(() => Promise.resolve());
    });

    afterAll(() => {
      vi.restoreAllMocks();
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
