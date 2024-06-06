import { applicationGenerator } from '../application/application';
import { pageGenerator } from './page';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree } from '@nx/devkit';

describe('component', () => {
  let tree: Tree;
  let projectName: string;
  let appRouterProjectName;

  beforeEach(async () => {
    projectName = 'my-app';
    appRouterProjectName = 'my-app-router';
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      name: projectName,
      style: 'css',
      appDir: false,
      projectNameAndRootFormat: 'as-provided',
    });

    await applicationGenerator(tree, {
      name: appRouterProjectName,
      style: 'css',
      projectNameAndRootFormat: 'as-provided',
    });
  });

  describe('page router', () => {
    it('should generate component in pages directory', async () => {
      await pageGenerator(tree, {
        name: 'hello',
        project: projectName,
        style: 'css',
      });

      expect(tree.exists('my-app/pages/hello/index.tsx')).toBeTruthy();
      expect(tree.exists('my-app/pages/hello/index.module.css')).toBeTruthy();
    });

    it('should support dynamic routes and directories', async () => {
      await pageGenerator(tree, {
        name: '[dynamic]',
        directory: 'posts',
        project: projectName,
        style: 'css',
      });

      expect(
        tree.exists('my-app/pages/posts/[dynamic]/index.tsx')
      ).toBeTruthy();
      expect(
        tree.exists('my-app/pages/posts/[dynamic]/index.module.css')
      ).toBeTruthy();

      const content = tree
        .read('my-app/pages/posts/[dynamic]/index.tsx')
        .toString();
    });
  });

  describe('app router', () => {
    it('should generate component in app directory', async () => {
      await pageGenerator(tree, {
        name: 'about',
        directory: `${appRouterProjectName}/app/about`,
        style: 'css',
        nameAndDirectoryFormat: 'as-provided',
      });

      expect(
        tree.exists(`${appRouterProjectName}/app/about/page.tsx`)
      ).toBeTruthy();
      expect(
        tree.exists(`${appRouterProjectName}/app/about/page.module.css`)
      ).toBeTruthy();
    });

    it('should support dynamic routes and directories', async () => {
      await pageGenerator(tree, {
        name: '[dynamic]',
        project: appRouterProjectName,
        directory: 'posts',
        style: 'css',
      });

      expect(
        tree.exists(`${appRouterProjectName}/app/posts/[dynamic]/page.tsx`)
      ).toBeTruthy();
      expect(
        tree.exists(
          `${appRouterProjectName}/app/posts/[dynamic]/page.module.css`
        )
      ).toBeTruthy();

      const content = tree
        .read(`${appRouterProjectName}/app/posts/[dynamic]/page.tsx`)
        .toString();
    });
  });
});
