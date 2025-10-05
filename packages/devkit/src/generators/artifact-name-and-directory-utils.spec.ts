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

  it('should throw an error when the resolved directory is not under any project root', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });
    setCwd('some/path');

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        path: 'myComponent',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The provided directory resolved relative to the current working directory "some/path" does not exist under any project root. Please make sure to navigate to a location or provide a directory that exists under a project root."`
    );

    restoreCwd();
  });

  it('should return the normalized options when there is a project at the cwd', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });
    setCwd('apps/app1');

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      path: 'myComponent',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });

    restoreCwd();
  });

  it('should not duplicate the cwd when the provided directory starts with the cwd', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });
    setCwd('apps/app1');

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      path: 'apps/app1/myComponent',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });

    restoreCwd();
  });

  it(`should handle window's style paths correctly`, async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      path: 'apps\\app1\\myComponent',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });
  });

  it('should support receiving a suffix', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      suffix: 'component',
      path: 'apps/app1/myComponent',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent.component',
      filePath: 'apps/app1/myComponent.component.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });
  });

  it('should support receiving a suffix separator', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      suffix: 'component',
      suffixSeparator: '-',
      path: 'apps/app1/myComponent',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent-component',
      filePath: 'apps/app1/myComponent-component.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });
  });

  it('should support receiving the full file path including the file extension', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      path: 'apps/app1/myComponent.ts',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });
  });

  it('should ignore specified suffix when receiving the full file path including the file extension', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      path: 'apps/app1/myComponent.ts',
      suffix: 'component',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.ts',
      fileExtension: 'ts',
      fileExtensionType: 'ts',
      project: 'app1',
    });
  });

  it('should support receiving a different file extension', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      fileExtension: 'tsx',
      path: 'apps/app1/myComponent',
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.tsx',
      fileExtension: 'tsx',
      fileExtensionType: 'ts',
      project: 'app1',
    });
  });

  it('should support receiving a file path with a non-default file extension', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    const result = await determineArtifactNameAndDirectoryOptions(tree, {
      path: 'apps/app1/myComponent.astro',
      allowedFileExtensions: ['astro'],
    });

    expect(result).toStrictEqual({
      artifactName: 'myComponent',
      directory: 'apps/app1',
      fileName: 'myComponent',
      filePath: 'apps/app1/myComponent.astro',
      fileExtension: 'astro',
      fileExtensionType: 'other',
      project: 'app1',
    });
  });

  it('should throw an error when the file extension is not supported', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        path: 'apps/app1/myComponent.ts',
        allowedFileExtensions: ['jsx', 'tsx'],
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
      "The provided file path has an extension (.ts) that is not supported by this generator.
      The supported extensions are: .jsx, .tsx."
    `);
  });

  it('should throw an error when having a TypeScript file extension and the --js option is used', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        path: 'apps/app1/myComponent.tsx',
        js: true,
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The provided file path has an extension (.tsx) that conflicts with the provided "--js" option."`
    );
  });

  it('should throw an error when having a JavaScript file extension and the --js=false option is used', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        path: 'apps/app1/myComponent.jsx',
        js: false,
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The provided file path has an extension (.jsx) that conflicts with the provided "--js" option."`
    );
  });

  it('should support customizing the --js option name', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      projectType: 'application',
    });

    await expect(
      determineArtifactNameAndDirectoryOptions(tree, {
        path: 'apps/app1/myComponent.tsx',
        js: true,
        jsOptionName: 'language',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"The provided file path has an extension (.tsx) that conflicts with the provided "--language" option."`
    );
  });
});
