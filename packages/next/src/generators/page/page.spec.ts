import { applicationGenerator } from '../application/application';
import { pageGenerator } from './page';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree } from '@nrwl/devkit';

describe('component', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-app';
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, {
      name: projectName,
      style: 'css',
      standaloneConfig: false,
    });
  });

  it('should generate component in pages directory', async () => {
    await pageGenerator(tree, {
      name: 'hello',
      project: projectName,
      style: 'css',
    });

    expect(tree.exists('apps/my-app/pages/hello.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/pages/hello.module.css')).toBeTruthy();
  });

  it('should support dynamic routes and directories', async () => {
    await pageGenerator(tree, {
      name: '[dynamic]',
      directory: 'posts',
      project: projectName,
      style: 'css',
    });

    expect(tree.exists('apps/my-app/pages/posts/[dynamic].tsx')).toBeTruthy();
    expect(
      tree.exists('apps/my-app/pages/posts/[dynamic].module.css')
    ).toBeTruthy();

    const content = tree
      .read('apps/my-app/pages/posts/[dynamic].tsx')
      .toString();
    expect(content).toMatch(/DynamicProps/);
  });
});
