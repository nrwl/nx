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

    it('should return the project name and directory as provided', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'shared',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it(`should handle window's style paths correctly when format is "as-provided"`, async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared\\libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'shared/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should use a scoped package name as the project name and import path when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should use provided import path over scoped name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
        importPath: '@custom-scope/lib-name',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@custom-scope/lib-name',
        projectRoot: 'shared',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should return the directory as the project name when directory is not provided and format is "as-provided"', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: '@scope/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should append the directory to the cwd when the provided directory does not start with the cwd and format is "as-provided"', async () => {
      // simulate running in a subdirectory
      const originalInitCwd = process.env.INIT_CWD;
      process.env.INIT_CWD = join(workspaceRoot, 'some/path');

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'nested/lib-name',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'some/path/nested/lib-name',
        projectNameAndRootFormat: 'as-provided',
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
        name: 'libName',
        directory: 'some/path/nested/lib-name',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'some/path/nested/lib-name',
        projectNameAndRootFormat: 'as-provided',
      });

      // restore original cwd
      if (originalInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = originalInitCwd;
      }
    });

    it('should return the directory considering the cwd when directory is not provided and format is "as-provided"', async () => {
      // simulate running in a subdirectory
      const originalInitCwd = process.env.INIT_CWD;
      process.env.INIT_CWD = join(workspaceRoot, 'some/path');

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'some/path/libName',
        projectNameAndRootFormat: 'as-provided',
      });

      // restore original cwd
      if (originalInitCwd === undefined) {
        delete process.env.INIT_CWD;
      } else {
        process.env.INIT_CWD = originalInitCwd;
      }
    });

    it('should not duplicate project name in the directory when directory is not provided and format is "as-provided"', async () => {
      // simulate running in a subdirectory
      const originalInitCwd = process.env.INIT_CWD;
      process.env.INIT_CWD = join(workspaceRoot, 'some/path/libName');

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'some/path/libName',
        projectNameAndRootFormat: 'as-provided',
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
        json.name = 'libName';
        return json;
      });

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: 'libName',
        projectRoot: '.',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNameAndRootOptions(tree, {
          name: '!scope/libName',
          directory: 'shared',
          projectType: 'library',
          projectNameAndRootFormat: 'as-provided',
        })
      ).rejects.toThrowError();
    });

    it('should handle providing a path as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'shared/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should handle providing a path including "@" as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/@scope/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared/@scope/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should handle providing a path including "@" with multiple segments as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/@scope/libName/testing',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName/testing',
        names: {
          projectSimpleName: 'testing',
          projectFileName: 'libName-testing',
        },
        importPath: '@scope/libName/testing',
        projectRoot: 'shared/@scope/libName/testing',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should handle providing a path including multiple "@" as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/@foo/@scope/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared/@foo/@scope/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });
  });

  describe('with layout', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      jest.clearAllMocks();
    });

    it('should return the project name and directory as provided', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'shared',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it(`should handle window's style paths correctly when format is "as-provided"`, async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared\\libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'shared/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should use a scoped package name as the project name and import path when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should use provided import path over scoped name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
        importPath: '@custom-scope/lib-name',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@custom-scope/lib-name',
        projectRoot: 'shared',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should return the directory as the project name when directory is not provided and format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: '@scope/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should return the project name and directory as provided for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'libName';
        return json;
      });

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: 'libName',
        projectRoot: '.',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNameAndRootOptions(tree, {
          name: '!scope/libName',
          directory: 'shared',
          projectType: 'library',
          projectNameAndRootFormat: 'as-provided',
        })
      ).rejects.toThrowError();
    });

    it('should handle providing a path as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@proj/libName',
        projectRoot: 'shared/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should handle providing a path including "@" as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/@scope/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared/@scope/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should handle providing a path including "@" with multiple segments as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/@scope/libName/testing',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName/testing',
        names: {
          projectSimpleName: 'testing',
          projectFileName: 'libName-testing',
        },
        importPath: '@scope/libName/testing',
        projectRoot: 'shared/@scope/libName/testing',
        projectNameAndRootFormat: 'as-provided',
      });
    });

    it('should handle providing a path including multiple "@" as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/@foo/@scope/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/libName',
        names: {
          projectSimpleName: 'libName',
          projectFileName: 'libName',
        },
        importPath: '@scope/libName',
        projectRoot: 'shared/@foo/@scope/libName',
        projectNameAndRootFormat: 'as-provided',
      });
    });
  });
});
