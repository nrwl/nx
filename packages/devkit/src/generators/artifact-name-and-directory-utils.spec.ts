import * as enquirer from 'enquirer';
import { addProjectConfiguration } from 'nx/src/devkit-exports';
import { createTreeWithEmptyWorkspace } from 'nx/src/generators/testing-utils/create-tree-with-empty-workspace';
import type { Tree } from 'nx/src/generators/tree';
import {
  determineArtifactNameAndDirectoryOptions,
  setCwd,
} from './artifact-name-and-directory-utils';

describe('determineArtifactNameAndDirectoryOptions', () => {
  let tree: Tree;
  let originalInteractiveValue;
  let originalCIValue;
  let originalIsTTYValue;
  let originalInitCwd;

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

    originalInteractiveValue = process.env.NX_INTERACTIVE;
    originalCIValue = process.env.CI;
    originalIsTTYValue = process.stdout.isTTY;
    originalInitCwd = process.env.INIT_CWD;
  });

  it('should accept a derivedDirectory which is relative to the project source root', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      sourceRoot: 'apps/app1/src',
      projectType: 'application',
    });

    const res = await determineArtifactNameAndDirectoryOptions(tree, {
      name: 'myComponent',
      artifactType: 'component',
      callingGenerator: '@my-org/my-plugin:component',
      directory: 'components',
      derivedDirectory: 'components',
      project: 'app1',
      nameAndDirectoryFormat: 'derived',
    });

    expect(res.filePath).toEqual(
      'apps/app1/src/components/my-component/my-component.ts'
    );
  });

  it('should accept a derivedDirectory which is relative to the project root', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const res = await determineArtifactNameAndDirectoryOptions(tree, {
      name: 'myComponent',
      artifactType: 'component',
      callingGenerator: '@my-org/my-plugin:component',
      directory: 'components',
      derivedDirectory: 'components',
      project: 'app1',
      nameAndDirectoryFormat: 'derived',
    });

    expect(res.filePath).toEqual(
      'apps/app1/components/my-component/my-component.ts'
    );
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The current working directory "some/path" does not exist under any project root. Please make sure to navigate to a location or provide a directory that exists under a project root."`
    );

    restoreCwd();
  });

  it('should throw an error when the provided project does not exist', async () => {
    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        project: 'app1',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The provided project "app1" does not exist! Please provide an existing project name."`
    );
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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

    it('should ignore the project and use the provided directory', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      addProjectConfiguration(tree, 'app2', {
        root: 'apps/app2',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        project: 'app2',
        directory: 'apps/app1/foo/bar',
        nameAndDirectoryFormat: 'as-provided',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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

    it('should support receiving a path as the name', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'apps/app1/foo/bar/myComponent',
        nameAndDirectoryFormat: 'as-provided',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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

    it('should ignore "--pascalCaseFile"', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        pascalCaseFile: true,
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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

    it('should ignore "--pascalCaseDirectory"', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        pascalCaseDirectory: true,
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'as-provided',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
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

  describe('derived', () => {
    it('should infer project and return options when project is not provided and there is a project at the cwd', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      setCwd('apps/app1');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/my-component',
        fileName: 'my-component',
        filePath: 'apps/app1/src/app/my-component/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });

      restoreCwd();
    });

    it('should support receiving a directory correctly under the inferred project root', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        directory: 'apps/app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/my-component',
        fileName: 'my-component',
        filePath: 'apps/app1/my-component/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
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
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/my-component',
        fileName: 'my-component',
        filePath: 'apps/app1/my-component/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });
    });

    it('should support receiving a project', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/my-component',
        fileName: 'my-component',
        filePath: 'apps/app1/src/app/my-component/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });
    });

    it('should throw when the provided directory is not under the provided project root', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      await expect(
        determineArtifactNameAndDirectoryOptions(tree, {
          name: 'myComponent',
          project: 'app1',
          directory: 'foo/bar',
          nameAndDirectoryFormat: 'derived',
          artifactType: 'component',
          callingGenerator: '@my-org/my-plugin:component',
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"The provided directory "foo/bar" is not under the provided project root "apps/app1". Please provide a directory that is under the provided project root or use the "as-provided" format and only provide the directory."`
      );
    });

    it('should support receiving a path as the name', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'foo/bar/myComponent',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/foo/bar/my-component',
        fileName: 'my-component',
        filePath: 'apps/app1/src/app/foo/bar/my-component/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });
    });

    it('should throw when `--disallowPathInNameForDerived` and receiving a path as the name', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      await expect(
        determineArtifactNameAndDirectoryOptions(tree, {
          name: 'apps/app1/foo/bar/myComponent',
          disallowPathInNameForDerived: true,
          nameAndDirectoryFormat: 'derived',
          artifactType: 'component',
          callingGenerator: '@my-org/my-plugin:component',
        })
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"The provided name "apps/app1/foo/bar/myComponent" contains a path and this is not supported by the "@my-org/my-plugin:component" when using the "derived" format. Please provide a name without a path or use the "as-provided" format."`
      );
    });

    it('should support "--flat"', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        flat: true,
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app',
        fileName: 'my-component',
        filePath: 'apps/app1/src/app/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
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
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/my-component',
        fileName: 'my-component.component',
        filePath: 'apps/app1/src/app/my-component/my-component.component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
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
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/my-component',
        fileName: 'myComponent.component',
        filePath: 'apps/app1/src/app/my-component/myComponent.component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });
    });

    it('should support "--pascalCaseFile"', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        pascalCaseFile: true,
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/my-component',
        fileName: 'MyComponent',
        filePath: 'apps/app1/src/app/my-component/MyComponent.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });
    });

    it('should support "--pascalCaseDirectory"', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        pascalCaseDirectory: true,
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/MyComponent',
        fileName: 'my-component',
        filePath: 'apps/app1/src/app/MyComponent/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
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
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(result).toStrictEqual({
        artifactName: 'myComponent',
        directory: 'apps/app1/src/app/my-component',
        fileName: 'my-component',
        filePath: 'apps/app1/src/app/my-component/my-component.tsx',
        project: 'app1',
        nameAndDirectoryFormat: 'derived',
      });
    });
  });

  describe('no format', () => {
    it('should prompt for the format to use', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      const promptSpy = jest
        .spyOn(enquirer, 'prompt')
        .mockImplementation(() => Promise.resolve({ format: 'as-provided' }));

      await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        project: 'app1',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(promptSpy).toHaveBeenCalled();
      const promptCallOptions = promptSpy.mock.calls[0][0] as any;
      expect(promptCallOptions.choices).toStrictEqual([
        {
          message: 'As provided: myComponent.ts',
          // as-provided ignores the project and uses cwd + directory
          // in this case, both are empty
          name: 'myComponent.ts',
        },
        {
          message:
            'Derived:     apps/app1/src/app/my-component/my-component.ts',
          name: 'apps/app1/src/app/my-component/my-component.ts',
        },
      ]);

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should not prompt and default to "derived" format when running in a non-interactive env', async () => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        project: 'app1',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result.nameAndDirectoryFormat).toBe('derived');
    });

    it('should not prompt and default to "as-provided" format when providing a directory in the name is disallowed', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'apps/app1/myComponent',
        project: 'app1',
        disallowPathInNameForDerived: true,
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result.nameAndDirectoryFormat).toBe('as-provided');

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should not prompt and default to "as-provided" format when the directory is not under the provided project root', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        projectType: 'application',
      });
      addProjectConfiguration(tree, 'app2', {
        root: 'apps/app2',
        projectType: 'application',
      });
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'myComponent',
        project: 'app1',
        directory: 'apps/app2',
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result.nameAndDirectoryFormat).toBe('as-provided');

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });

    it('should not prompt when the resulting name and directory are the same for both formats', async () => {
      // simulate interactive mode
      ensureInteractiveMode();
      addProjectConfiguration(tree, 'app1', {
        root: '.',
        projectType: 'application',
      });
      const promptSpy = jest.spyOn(enquirer, 'prompt');

      const result = await determineArtifactNameAndDirectoryOptions(tree, {
        name: 'my-component',
        directory: 'src/app',
        flat: true,
        artifactType: 'component',
        callingGenerator: '@my-org/my-plugin:component',
      });

      expect(promptSpy).not.toHaveBeenCalled();
      expect(result).toStrictEqual({
        artifactName: 'my-component',
        directory: 'src/app',
        fileName: 'my-component',
        filePath: 'src/app/my-component.ts',
        project: 'app1',
        nameAndDirectoryFormat: 'as-provided',
      });

      // restore original interactive mode
      restoreOriginalInteractiveMode();
    });
  });
});
