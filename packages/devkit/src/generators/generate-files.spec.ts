import type { Tree } from 'nx/src/shared/tree';
import { createTree } from '../tests/create-tree';
import { generateFiles } from './generate-files';
import { join } from 'path';
import * as FileType from 'file-type';

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
});
