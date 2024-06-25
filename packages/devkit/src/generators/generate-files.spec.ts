import * as FileType from 'file-type';
import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import type { Tree } from 'nx/src/generators/tree';
import { join } from 'path';
import { OverwriteStrategy, generateFiles } from './generate-files';

describe('generateFiles', () => {
  let tree: Tree;
  beforeAll(() => {
    tree = createTree();
    generateFiles(tree, join(__dirname, './test-files'), '.', {
      foo: 'bar',
      name: 'my-project',
      projectName: 'my-project-name',
      dot: '.',
    });
  });

  it('should copy files from a directory into a tree', () => {
    expect(tree.exists('file.txt')).toBeTruthy();
    expect(tree.read('file.txt', 'utf-8')).toMatchSnapshot();
  });

  it('should copy files from a directory into the tree', () => {
    expect(tree.exists('directory/file-in-directory.txt')).toBeTruthy();
    expect(
      tree.read('directory/file-in-directory.txt', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should remove ".template" from paths', () => {
    expect(
      tree.exists('file-with-template-suffix.txt.template')
    ).not.toBeTruthy();
    expect(tree.exists('file-with-template-suffix.txt')).toBeTruthy();
    expect(
      tree.read('file-with-template-suffix.txt', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should substitute properties in paths', () => {
    expect(tree.exists('file-with-property-foo-__foo__.txt')).not.toBeTruthy();
    expect(tree.exists('file-with-property-foo-bar.txt')).toBeTruthy();
    expect(
      tree.read('file-with-property-foo-bar.txt', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should substitute properties in directory names', () => {
    expect(
      tree.exists('directory-foo-__foo__/file-in-directory-foo-__foo__.txt')
    ).not.toBeTruthy();
    expect(
      tree.exists('directory-foo-bar/file-in-directory-foo-bar.txt')
    ).toBeTruthy();
    expect(
      tree.read('directory-foo-bar/file-in-directory-foo-bar.txt', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should generate files from template in a directory', () => {
    expect(tree.exists(`src/common-util.ts`)).toBeTruthy();
    expect(
      tree.exists(`src/my-project-name/create-my-project.input.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(
        `src/my-project-name/my-project/my-project-name.my-project.model.ts`
      )
    ).toBeTruthy();
    expect(tree.exists(`src/my-project-name/output/.gitkeep`)).toBeTruthy();
    expect(tree.exists(`src/my-project.module.ts`)).toBeTruthy();
  });

  it('should preserve image files', async () => {
    expect(tree.exists('image.png')).toBeTruthy();
    await expect(FileType.fromBuffer(tree.read('image.png'))).resolves.toEqual({
      ext: 'png',
      mime: 'image/png',
    });
  });

  it('should throw if overwrite is treated as an error', async () => {
    expect(() => {
      generateFiles(
        tree,
        join(__dirname, './test-files'),
        '.',
        {
          foo: 'bar',
          name: 'my-project',
          projectName: 'my-project-name',
          dot: '.',
        },
        { overwriteStrategy: OverwriteStrategy.ThrowIfExisting }
      );
    }).toThrowError(
      'Generated file already exists, not allowed by overwrite strategy in generator (directory/file-in-directory.txt)'
    );
  });

  it('should overwrite files when option is overwrite', async () => {
    // Write a custom file that will be overwritten
    tree.write(
      'directory/file-in-directory.txt',
      'placeholder text to overwrite'
    );

    // Run generation again
    generateFiles(
      tree,
      join(__dirname, './test-files'),
      '.',
      {
        foo: 'bar',
        name: 'my-project',
        projectName: 'my-project-name',
        dot: '.',
      },
      { overwriteStrategy: OverwriteStrategy.Overwrite }
    );

    // File must have been overwritten
    expect(
      tree.read('directory/file-in-directory.txt', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should keep files when option is to keep existing files', async () => {
    // Write a custom file that will stay the same
    const placeholder = 'placeholder text to keep';
    tree.write('directory/file-in-directory.txt', placeholder);

    // Run generation again
    generateFiles(
      tree,
      join(__dirname, './test-files'),
      '.',
      {
        foo: 'bar',
        name: 'my-project',
        projectName: 'my-project-name',
        dot: '.',
      },
      { overwriteStrategy: OverwriteStrategy.KeepExisting }
    );

    // File must have been kept
    expect(tree.read('directory/file-in-directory.txt', 'utf-8')).toEqual(
      placeholder
    );
  });
});
