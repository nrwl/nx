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

  it('should generate component in components directory', async () => {
    const tree = await runSchematic(
      'component',
      { name: 'hello', project: projectName },
      appTree
    );

    expect(
      tree.exists('apps/my-app/src/components/hello/hello.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('apps/my-app/src/components/hello/hello.spec.tsx')
    ).toBeTruthy();
    expect(
      tree.exists('apps/my-app/src/components/hello/hello.css')
    ).toBeTruthy();
  });

  it('should allow directory override', async () => {
    const tree = await runSchematic(
      'component',
      { name: 'hello', project: projectName, directory: 'lib' },
      appTree
    );

    expect(tree.exists('apps/my-app/src/lib/hello/hello.tsx')).toBeTruthy();
    expect(
      tree.exists('apps/my-app/src/lib/hello/hello.spec.tsx')
    ).toBeTruthy();
    expect(tree.exists('apps/my-app/src/lib/hello/hello.css')).toBeTruthy();
  });
});
