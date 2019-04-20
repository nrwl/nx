import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('app', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  it('should generate files', async () => {
    const tree = await runSchematic('app', { name: 'myNodeApp' }, appTree);
    expect(tree.readContent('apps/my-node-app/src/main.ts')).toContain(
      `await NestFactory.create(AppModule);`
    );
    expect(tree.exists('apps/my-node-app/src/app/app.module.ts')).toBeTruthy();
  });
});
