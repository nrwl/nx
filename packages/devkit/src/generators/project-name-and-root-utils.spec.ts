import * as enquirer from 'enquirer';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { updateJson } from 'nx/src/generators/utils/json';
import { workspaceRoot } from 'nx/src/utils/workspace-root';
import { join } from 'path';
import { determineProjectNameAndRootOptions } from './project-name-and-root-utils';
import { setCwd } from '../../internal-testing-utils';

describe('determineProjectNameAndRootOptions', () => {
  let tree: Tree;
  let originalInteractiveValue;
  let originalCIValue;
  let originalIsTTYValue;

  function ensureInteractiveMode() {
    process.env.NX_INTERACTIVE = 'true';
    process.env.CI = 'false';
    process.stdout.isTTY = true;
  }

  function restoreOriginalInteractiveMode() {
    process.env.NX_INTERACTIVE = originalInteractiveValue;
    process.env.CI = originalCIValue;
    process.stdout.isTTY = originalIsTTYValue;
  }

  beforeEach(() => {
    originalInteractiveValue = process.env.NX_INTERACTIVE;
    originalCIValue = process.env.CI;
    originalIsTTYValue = process.stdout.isTTY;
  });

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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
          callingGenerator: '',
        })
      ).rejects.toThrowError();
    });

    it('should handle providing a path as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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

    it('should return the derived project name and directory', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        callingGenerator: '',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-lib-name',
        },
        importPath: '@proj/shared/lib-name',
        projectRoot: 'shared/lib-name',
        projectNameAndRootFormat: 'derived',
      });
    });

    it('should handle providing a path as the project name when format is "derived"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        callingGenerator: '',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-lib-name',
        },
        importPath: '@proj/shared/lib-name',
        projectRoot: 'shared/lib-name',
        projectNameAndRootFormat: 'derived',
      });
    });

    it('should throw when using a scoped package name as the project name and format is "derived"', async () => {
      await expect(
        determineProjectNameAndRootOptions(tree, {
          name: '@scope/libName',
          directory: 'shared',
          projectType: 'library',
          projectNameAndRootFormat: 'derived',
          callingGenerator: '',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        rootProject: true,
        callingGenerator: '',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectRoot: '.',
        projectNameAndRootFormat: 'derived',
      });
    });

    it(`should handle window's style paths correctly when format is "derived"`, async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared\\sub-dir',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        callingGenerator: '',
      });

      expect(result).toStrictEqual({
        projectName: 'shared-sub-dir-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-sub-dir-lib-name',
        },
        importPath: '@proj/shared/sub-dir/lib-name',
        projectRoot: 'shared/sub-dir/lib-name',
        projectNameAndRootFormat: 'derived',
      });
    });

    it('should prompt for the project name and root format', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        directory: 'shared',
        callingGenerator: '',
      });

      expect(promptSpy).toHaveBeenCalled();
      const promptCallOptions = promptSpy.mock.calls[0][0] as any;
      expect(promptCallOptions.choices).toStrictEqual([
        {
          message: `As provided:
    Name: libName
    Root: shared`,
          name: 'libName @ shared',
        },
        {
          message: `Derived:
    Name: shared-lib-name
    Root: shared/lib-name`,
          name: 'shared-lib-name @ shared/lib-name',
        },
      ]);

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should directly use format as-provided and not prompt when the name is a scoped package name', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        projectType: 'library',
        directory: 'shared',
        callingGenerator: '',
      });

      expect(promptSpy).not.toHaveBeenCalled();
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

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should not prompt when the resulting name and root are the same for both formats', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'lib-name',
        projectType: 'library',
        callingGenerator: '',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectRoot: 'lib-name',
        projectNameAndRootFormat: 'as-provided',
      });

      // restore original interactive mode
      restoreOriginalInteractiveMode();
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
          callingGenerator: '',
        })
      ).rejects.toThrowError();
    });

    it('should handle providing a path as the project name when format is "as-provided"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'as-provided',
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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
        callingGenerator: '',
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

    it('should return the derived project name and directory', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        callingGenerator: '',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-lib-name',
        },
        importPath: '@proj/shared/lib-name',
        projectRoot: 'libs/shared/lib-name',
        projectNameAndRootFormat: 'derived',
      });
    });

    it('should handle providing a path as the project name when format is "derived"', async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'shared/libName',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        callingGenerator: '',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-lib-name',
        },
        importPath: '@proj/shared/lib-name',
        projectRoot: 'libs/shared/lib-name',
        projectNameAndRootFormat: 'derived',
      });
    });

    it(`should handle window's style paths correctly when format is "derived"`, async () => {
      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        directory: 'shared\\sub-dir',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        callingGenerator: '',
      });

      expect(result).toStrictEqual({
        projectName: 'shared-sub-dir-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-sub-dir-lib-name',
        },
        importPath: '@proj/shared/sub-dir/lib-name',
        projectRoot: 'libs/shared/sub-dir/lib-name',
        projectNameAndRootFormat: 'derived',
      });
    });

    it('should throw when using a scoped package name as the project name and format is derived', async () => {
      await expect(
        determineProjectNameAndRootOptions(tree, {
          name: '@scope/libName',
          directory: 'shared',
          projectType: 'library',
          projectNameAndRootFormat: 'derived',
          callingGenerator: '',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });

      const result = await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        projectNameAndRootFormat: 'derived',
        rootProject: true,
        callingGenerator: '',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectRoot: '.',
        projectNameAndRootFormat: 'derived',
      });
    });

    it('should prompt for the project name and root format', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineProjectNameAndRootOptions(tree, {
        name: 'libName',
        projectType: 'library',
        directory: 'shared',
        callingGenerator: '',
      });

      expect(promptSpy).toHaveBeenCalled();
      const promptCallOptions = promptSpy.mock.calls[0][0] as any;
      expect(promptCallOptions.choices).toStrictEqual([
        {
          message: `As provided:
    Name: libName
    Root: shared`,
          name: 'libName @ shared',
        },
        {
          message: `Derived:
    Name: shared-lib-name
    Root: libs/shared/lib-name`,
          name: 'shared-lib-name @ libs/shared/lib-name',
        },
      ]);

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should directly use format as-provided and not prompt when the name is a scoped package name', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNameAndRootOptions(tree, {
        name: '@scope/libName',
        projectType: 'library',
        directory: 'shared',
        callingGenerator: '',
      });

      expect(promptSpy).not.toHaveBeenCalled();
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

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });
  });
});
