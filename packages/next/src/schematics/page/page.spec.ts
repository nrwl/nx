import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { createApp, runSchematic } from '../../utils/testing';

describe('component', () => {
  let appTree: Tree;
  let projectName: string;

  beforeEach(async () => {
    projectName = 'my-app';
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await createApp(appTree, projectName);
  });

  it('should generate component in pages directory', async () => {
    const tree = await runSchematic(
      'page',
      { name: 'hello', project: projectName },
      appTree
    );

    expect(tree.exists('apps/my-app/src/pages/hello.tsx')).toBeTruthy();
    expect(tree.exists('apps/my-app/src/pages/hello.css')).toBeTruthy();
  });
});
