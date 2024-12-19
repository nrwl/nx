import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { updateJson } from 'nx/src/generators/utils/json';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { join } from 'path';
import { setCwd } from '../../internal-testing-utils';
import { determineProjectNameAndRootOptions } from './project-name-and-root-utils';

describe('determineProjectNameAndRootOptions', () => {
  let tree: Tree;

  describe('no layout', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();

      setCwd('');

      jest.clearAllMocks();
    });

    it('should return the last part of the directory as name', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'shared/lib-name',
        projectType: 'library',
      });

      expect(result).toStrictEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectRoot: 'shared/lib-name',
      });
    });

    it('should use "@" scoped directory as the project name and import path', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'packages/@scope/lib-name',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectRoot: 'packages/@scope/lib-name',
      });
    });

    it('should use "@" scoped directory as the project name and import path in deeply nested directory', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'packages/shared/@scope/lib-name',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectRoot: 'packages/shared/@scope/lib-name',
      });
    });

    it('should handle Windows path correctly', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'shared\\lib-name',
        projectType: 'library',
      });

      expect(result).toStrictEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectRoot: 'shared/lib-name',
      });
    });

    it('should use provided import path over scoped name', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/lib-name',
        directory: 'shared',
        projectType: 'library',
        importPath: '@custom-scope/lib-name',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@custom-scope/lib-name',
        projectRoot: 'shared',
      });
    });

    it('should append the directory to the cwd when the provided directory does not start with the cwd and format is "as-provided"', async () => {
      // simulate running in a subdirectory
      const originalInitCwd = process.env.INIT_CWD;
      process.env.INIT_CWD = join(workspaceRoot, 'some/path');

      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'nested/lib-name',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectRoot: 'some/path/nested/lib-name',
      });

      // restore original cwd
      if (originalInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = originalInitCwd;
      }
    });

    it('should not duplicate the cwd when the provided directory starts with the cwd and format is "as-provided"', async () => {
      // simulate running in a subdirectory
      const originalInitCwd = process.env.INIT_CWD;
      process.env.INIT_CWD = join(workspaceRoot, 'some/path');

      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'some/path/nested/lib-name',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectRoot: 'some/path/nested/lib-name',
      });

      // restore original cwd
      if (originalInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = originalInitCwd;
      }
    });

    it('should return the directory considering the cwd', async () => {
      // simulate running in a subdirectory
      const originalInitCwd = process.env.INIT_CWD;
      process.env.INIT_CWD = join(workspaceRoot, 'some/path');

      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'lib-name',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectRoot: 'some/path/lib-name',
      });

      // restore original cwd
      if (originalInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = originalInitCwd;
      }
    });

    it('should return the project name and directory as provided for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'lib-name',
        directory: '.',
        projectType: 'library',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectRoot: '.',
      });
    });

    it('should throw when an invalid directory is provided', async () => {
      await expect(
        determineProjectNameAndRootOptions(tree, {
          directory: '!scope/lib-name',
          projectType: 'library',
        })
      ).rejects.toThrow(/directory should match/);
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNameAndRootOptions(tree, {
          name: '!scope/lib-name',
          directory: 'shared',
          projectType: 'library',
        })
      ).rejects.toThrow(/name should match/);
    });

    it('should handle providing a path including "@" with multiple segments as the project name', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'shared/@scope/lib-name/testing',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name/testing',
        names: {
          projectSimpleName: 'testing',
          projectFileName: 'lib-name-testing',
        },
        importPath: '@scope/lib-name/testing',
        projectRoot: 'shared/@scope/lib-name/testing',
      });
    });

    it('should handle providing a path including multiple "@" as the project name', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        directory: 'shared/@foo/@scope/libName',
        projectType: 'library',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared/@foo/@scope/libName',
      });
    });
  });
});
