import * as enquirer from 'enquirer';
import type { Tree } from 'nx/src/generators/tree';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import { determineProjectNameDirectory } from './project-name-directory-utils';

describe('determineProjectNameDirectory', () => {
  let tree: Tree;

  describe('no layout', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      jest.clearAllMocks();
    });

    it('should return the project name and directory as provided', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: 'shared',
        projectDirectoryWithoutLayout: 'shared',
      });
    });

    it('should support using a scoped package name as the project name when format is as-provided', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        projectDirectory: 'shared',
        projectDirectoryWithoutLayout: 'shared',
      });
    });

    it('should return the directory as root when directory is not provided and format is as-provided', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: '.',
        projectDirectoryWithoutLayout: '.',
      });
    });

    it('should return the project name and directory as provided for root projects', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: '.',
        projectDirectoryWithoutLayout: '.',
      });
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNameDirectory(tree, {
          name: '!scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'as-provided',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        projectDirectory: 'shared/lib-name',
        projectDirectoryWithoutLayout: 'shared/lib-name',
      });
    });

    it('should throw when using a scoped package name as the project name and format is derived', async () => {
      await expect(
        determineProjectNameDirectory(tree, {
          name: '@scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'derived',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory for root projects', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: '.',
        projectDirectoryWithoutLayout: '.',
      });
    });

    it('should prompt for the project name and directory format', async () => {
      // simulate interactive mode
      const originalInteractiveValue = process.env.NX_INTERACTIVE;
      process.env.NX_INTERACTIVE = 'true';
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineProjectNameDirectory(tree, {
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
              message: 'lib-name @ shared (preferred)',
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

      // restore original interactive value
      process.env.NX_INTERACTIVE = originalInteractiveValue;
    });

    it('should directly use format as-provided and not prompt when the name is a scoped package name', async () => {
      // simulate interactive mode
      const originalInteractiveValue = process.env.NX_INTERACTIVE;
      process.env.NX_INTERACTIVE = 'true';
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNameDirectory(tree, {
        name: '@scope/libName',
        projectType: 'library',
        directory: 'shared',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        projectName: '@scope/lib-name',
        projectDirectory: 'shared',
        projectDirectoryWithoutLayout: 'shared',
      });

      // restore original interactive value
      process.env.NX_INTERACTIVE = originalInteractiveValue;
    });
  });

  describe('with layout', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      jest.clearAllMocks();
    });

    it('should return the project name and directory as provided', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: 'shared',
        projectDirectoryWithoutLayout: 'shared',
      });
    });

    it('should support using a scoped package name as the project name when format is as-provided', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: '@scope/libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: '@scope/lib-name',
        projectDirectory: 'shared',
        projectDirectoryWithoutLayout: 'shared',
      });
    });

    it('should return the directory as root when directory is not provided and format is as-provided', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: '.',
        projectDirectoryWithoutLayout: '.',
      });
    });

    it('should return the project name and directory as provided for root projects', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'as-provided',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: '.',
        projectDirectoryWithoutLayout: '.',
      });
    });

    it('should throw when an invalid name is provided', async () => {
      await expect(
        determineProjectNameDirectory(tree, {
          name: '!scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'as-provided',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        directory: 'shared',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
      });

      expect(result).toEqual({
        projectName: 'shared-lib-name',
        projectDirectory: 'libs/shared/lib-name',
        projectDirectoryWithoutLayout: 'shared/lib-name',
      });
    });

    it('should throw when using a scoped package name as the project name and format is derived', async () => {
      await expect(
        determineProjectNameDirectory(tree, {
          name: '@scope/libName',
          directory: 'shared',
          projectType: 'library',
          nameDirectoryFormat: 'derived',
        })
      ).rejects.toThrowError();
    });

    it('should return the derived project name and directory for root projects', async () => {
      const result = await determineProjectNameDirectory(tree, {
        name: 'libName',
        projectType: 'library',
        nameDirectoryFormat: 'derived',
        rootProject: true,
      });

      expect(result).toEqual({
        projectName: 'lib-name',
        projectDirectory: '.',
        projectDirectoryWithoutLayout: '.',
      });
    });

    it('should prompt for the project name and directory format', async () => {
      // simulate interactive mode
      const originalInteractiveValue = process.env.NX_INTERACTIVE;
      process.env.NX_INTERACTIVE = 'true';
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineProjectNameDirectory(tree, {
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
              message: 'lib-name @ shared (preferred)',
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

      // restore original interactive value
      process.env.NX_INTERACTIVE = originalInteractiveValue;
    });

    it('should directly use format as-provided and not prompt when the name is a scoped package name', async () => {
      // simulate interactive mode
      const originalInteractiveValue = process.env.NX_INTERACTIVE;
      process.env.NX_INTERACTIVE = 'true';
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineProjectNameDirectory(tree, {
        name: '@scope/libName',
        projectType: 'library',
        directory: 'shared',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result).toEqual({
        projectName: '@scope/lib-name',
        projectDirectory: 'shared',
        projectDirectoryWithoutLayout: 'shared',
      });

      // restore original interactive value
      process.env.NX_INTERACTIVE = originalInteractiveValue;
    });
  });
});
