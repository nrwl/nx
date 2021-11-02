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
    tree.write('.gitignore', '# empty');
    tree.write('.prettierignore', '# empty');
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

    expect(tree.exists('apps/my-app/src/pages/hello.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/hello.module.css')).toBeTruthy();
  });
});
