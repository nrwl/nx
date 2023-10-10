import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';
import { applicationGenerator } from './application';

describe('app', () => {
  let tree: Tree;
  const name = 'my-app';

  describe('generated files content - as-provided', () => {
    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace();
      await applicationGenerator(tree, {
        name,
        projectNameAndRootFormat: 'as-provided',
      });
    });
    it('should create all new files in the correct location', async () => {
      const newFiles = tree.listChanges().map((change) => change.path);
      expect(newFiles).toMatchSnapshot();
    });

    it('should add nuxt entries in .gitignore', () => {
      expect(tree.read('.gitignore', 'utf-8')).toMatchSnapshot();
    });

    it('should configure nuxt correctly', () => {
      expect(tree.read('my-app/nuxt.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should configure eslint correctly', () => {
      expect(tree.read('my-app/.eslintrc.json', 'utf-8')).toMatchSnapshot();
    });

    it('should configure tsconfig and project.json correctly', () => {
      expect(tree.read('my-app/project.json', 'utf-8')).toMatchSnapshot();
      expect(tree.read('my-app/tsconfig.json', 'utf-8')).toMatchSnapshot();
    });
  });
});
