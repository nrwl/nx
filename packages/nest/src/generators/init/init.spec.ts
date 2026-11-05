import * as devkit from '@nx/devkit';
import type { MockInstance } from 'vitest';
import { readJson, type Tree, updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { typescriptVersion } from '@nx/js/internal';
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

  describe('typescript', () => {
    const declareDevDependencies = (deps: Record<string, string>) =>
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = { ...json.devDependencies, ...deps };
        return json;
      });

    it('should upgrade typescript 5 when installing @nestjs/schematics 12', async () => {
      declareDevDependencies({ typescript: '~5.9.2' });

      await initGenerator(tree, {});

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@nestjs/schematics']).toBe('^12.0.0');
      expect(devDependencies.typescript).toBe(typescriptVersion);
    });

    it('should keep typescript 5 when the workspace keeps @nestjs/schematics 11', async () => {
      declareDevDependencies({
        typescript: '~5.9.2',
        '@nestjs/schematics': '^11.0.0',
      });

      await initGenerator(tree, {});

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies['@nestjs/schematics']).toBe('^11.0.0');
      expect(devDependencies.typescript).toBe('~5.9.2');
    });

    it('should keep typescript 6', async () => {
      declareDevDependencies({ typescript: '~6.0.0' });

      await initGenerator(tree, {});

      expect(readJson(tree, 'package.json').devDependencies.typescript).toBe(
        '~6.0.0'
      );
    });
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
