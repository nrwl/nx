import { addProjectConfiguration } from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import {
  determineArtifactNameAndDirectoryOptions,
  setCwd,
} from './artifact-name-and-directory-utils';

describe('determineArtifactNameAndDirectoryOptions', () => {
  let tree: Tree;
  let originalInitCwd;

  function restoreCwd() {
    if (originalInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = originalInitCwd;
    }
  }

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    setCwd('');
    jest.clearAllMocks();

    originalInitCwd = process.env.INIT_CWD;
  });

  it('should throw an error when the resolver directory is not under any project root', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });
    setCwd('some/path');

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The current working directory "some/path" does not exist under any project root. Please make sure to navigate to a location or provide a directory that exists under a project root."`
    );

    restoreCwd();
  });

  it('should throw when receiving a path as the name and a directory', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        name: 'apps/app1/foo/bar/myComponent',
        directory: 'foo/bar',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"You can't specify both a directory (foo/bar) and a name with a directory path (apps/app1/foo/bar/myComponent). Please specify either a directory or a name with a directory path."`
    );
  });

  describe('as-provided', () => {
    it('should return options as provided when there is a project at the cwd', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      setCwd('apps/app1');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent',
        filePath: 'apps/app1/myComponent.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      restoreCwd();
    });

    it('should not duplicate the cwd when the provided directory starts with the cwd and format is "as-provided"', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      setCwd('apps/app1');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent',
        filePath: 'apps/app1/myComponent.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      restoreCwd();
    });

    it('should return the options as provided when directory is provided', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent',
        filePath: 'apps/app1/myComponent.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });
    });

    it(`should handle window's style paths correctly`, async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        directory: 'apps\\app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent',
        filePath: 'apps/app1/myComponent.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });
    });

    it('should support receiving a path as the name', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'apps/app1/foo/bar/myComponent',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/foo/bar',
        fileName: 'myComponent',
        filePath: 'apps/app1/foo/bar/myComponent.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });
    });

    it('should support receiving a suffix', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        suffix: 'component',
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent.component',
        filePath: 'apps/app1/myComponent.component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });
    });

    it('should support receiving a fileName', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        fileName: 'myComponent.component',
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent.component',
        filePath: 'apps/app1/myComponent.component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });
    });

    it('should support receiving a different file extension', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        fileExtension: 'tsx',
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1',
        fileName: 'myComponent',
        filePath: 'apps/app1/myComponent.tsx',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });
    });
  });
});
