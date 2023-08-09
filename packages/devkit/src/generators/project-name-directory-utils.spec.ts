import * as enquirer from 'enquirer';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import { updateJson } from 'nx/src/generators/utils/json';
import { determineProjectNamesAndDirectories } from './project-name-directory-utils';

describe('determineProjectNamesAndDirectories', () => {
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
      jest.clearAllMocks();
    });

    it('should return the project name and directory as provided', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectDirectory: 'shared',
      });
    });

    it('should use a scoped package name as the project name and import path when format is "as-provided"', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectDirectory: 'shared',
      });
    });

    it('should use provided import path over scoped name when format is "as-provided"', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        importPath: '@custom-scope/lib-name',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@custom-scope/lib-name',
        projectDirectory: 'shared',
      });
    });

    it('should return the directory as the project name when directory is not provided and format is "as-provided"', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });
      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectDirectory: '@scope/lib-name',
      });
    });

    it('should return the project name and directory as provided for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectDirectory: '.',
      });
    });

    it('should derive import path for root projects when package.json does not have a name and format is as-provided', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = undefined;
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result.importPath).toBe('@proj/lib-name');
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNamesAndDirectories(tree, {
          name: '!scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'as-provided',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-lib-name',
        },
        importPath: '@proj/shared/lib-name',
        projectDirectory: 'shared/lib-name',
      });
    });

    it('should throw when using a scoped package name as the project name and format is "derived"', async () => {
      await expect(
        determineProjectNamesAndDirectories(tree, {
          name: '@scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'derived',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });
      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectDirectory: '.',
      });
    });

    it('should derive import path for root projects when package.json does not have a name and format is "derived"', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = undefined;
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result.importPath).toBe('@proj/lib-name');
    });

    it('should prompt for the project name and directory format', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        directory: 'shared',
      });

      expect(promptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          name: 'format',
          message:
            'What project name and directory format would you like to use?',
          choices: [
            {
              message: 'lib-name @ shared (recommended)',
              name: 'as-provided',
            },
            {
              message: 'shared-lib-name @ shared/lib-name (legacy)',
              name: 'derived',
            },
          ],
          initial: 'as-provided',
        })
      );

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should directly use format as-provided and not prompt when the name is a scoped package name', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        projectType: 'library',
        directory: 'shared',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectDirectory: 'shared',
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
      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@proj/lib-name',
        projectDirectory: 'shared',
      });
    });

    it('should use a scoped package name as the project name and import path when format is "as-provided"', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectDirectory: 'shared',
      });
    });

    it('should use provided import path over scoped name when format is "as-provided"', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        importPath: '@custom-scope/lib-name',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@custom-scope/lib-name',
        projectDirectory: 'shared',
      });
    });

    it('should return the directory as the project name when directory is not provided and format is "as-provided"', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectDirectory: '@scope/lib-name',
      });
    });

    it('should return the project name and directory as provided for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectDirectory: '.',
      });
    });

    it('should derive import path for root projects when package.json does not have a name and format is "as-provided"', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = undefined;
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result.importPath).toBe('@proj/lib-name');
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNamesAndDirectories(tree, {
          name: '!scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'as-provided',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory', async () => {
      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'shared-lib-name',
        },
        importPath: '@proj/shared/lib-name',
        projectDirectory: 'libs/shared/lib-name',
      });
    });

    it('should throw when using a scoped package name as the project name and format is derived', async () => {
      await expect(
        determineProjectNamesAndDirectories(tree, {
          name: '@scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'derived',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory for root projects', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = 'lib-name';
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: 'lib-name',
        projectDirectory: '.',
      });
    });

    it('should derive import path for root projects when package.json does not have a name and format is "derived"', async () => {
      updateJson(tree, 'package.json', (json) => {
        json.name = undefined;
        return json;
      });

      const result = await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result.importPath).toBe('@proj/lib-name');
    });

    it('should prompt for the project name and directory format', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineProjectNamesAndDirectories(tree, {
        name: 'libName',
        projectType: 'library',
        directory: 'shared',
      });

      expect(promptSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'select',
          name: 'format',
          message:
            'What project name and directory format would you like to use?',
          choices: [
            {
              message: 'lib-name @ shared (recommended)',
              name: 'as-provided',
            },
            {
              message: 'shared-lib-name @ libs/shared/lib-name (legacy)',
              name: 'derived',
            },
          ],
          initial: 'as-provided',
        })
      );

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should directly use format as-provided and not prompt when the name is a scoped package name', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNamesAndDirectories(tree, {
        name: '@scope/libName',
        projectType: 'library',
        directory: 'shared',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        projectName: '@scope/lib-name',
        names: {
          projectSimpleName: 'lib-name',
          projectFileName: 'lib-name',
        },
        importPath: '@scope/lib-name',
        projectDirectory: 'shared',
      });

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });
  });
});
