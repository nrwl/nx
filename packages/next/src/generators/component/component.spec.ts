import { applicationGenerator } from '../application/application';
import { componentGenerator } from './component';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree } from '@nrwl/devkit';

describe('component', () => {
  let tree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-app';
    tree = createTreeWithEmptyWorkspace();
    await applicationGenerator(tree, { name: projectName, style: 'css' });
  });

  it('should generate component in components directory', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      project: projectName,
      style: 'css',
    });

    expect(tree.exists('apps/my-app/components/hello/hello.tsx')).toBeTruthy();
    expect(
      tree.exists('apps/my-app/components/hello/hello.spec.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('apps/my-app/components/hello/hello.module.css')
    ).toBeTruthy();
  });

  it('should allow directory override', async () => {
    await componentGenerator(tree, {
      name: 'hello',
      project: projectName,
      directory: 'lib',
      style: 'css',
    });

    expect(tree.exists('apps/my-app/lib/hello/hello.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/lib/hello/hello.spec.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/lib/hello/hello.module.css')).toBeTruthy();
  });
});
