import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import { applicationGenerator } from '../application/application';
import { getDirectory, pageGenerator } from './page';

describe('page', () => {
  let tree: Tree;
  const name = 'my-app';

  describe('getDirectory', () => {
    it('should return "pages" if no directory is provided', () => {
      expect(getDirectory(undefined)).toEqual('pages');
    });

    it('should return the directory unchanged if it already starts with "pages/"', () => {
      expect(getDirectory('pages/someDir')).toEqual('pages/someDir');
    });

    it('should prepend "pages/" to the directory if it does not start with "pages/"', () => {
      expect(getDirectory('someDir')).toEqual('pages/someDir');
    });

    it('should work with an empty string', () => {
      expect(getDirectory('')).toEqual('pages');
    });
  });
  describe('generated files content - as-provided', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace();
      await applicationGenerator(tree, {
        name,
        projectNameAndRootFormat: 'as-provided',
      });
    });
    it('should create a new page in the correct location', async () => {
      await pageGenerator(tree, {
        name: 'about',
        project: name,
      });

      expect(tree.exists('my-app/src/pages/about.vue')).toBeTruthy();
    });

    it('should create a new page in the correct location for nested directory', async () => {
      await pageGenerator(tree, {
        name: 'about',
        project: name,
      });

      expect(tree.exists('my-app/src/pages/about.vue')).toBeTruthy();
    });
  });
});
