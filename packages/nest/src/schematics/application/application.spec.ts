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
    const tree = await runSchematic('app', { name: 'myNestApp' }, appTree);
    expect(tree.readContent('apps/my-nest-app/src/main.ts')).toContain(
      `await NestFactory.create(AppModule);`
    );
    expect(tree.exists('apps/my-nest-app/src/app/app.module.ts')).toBeTruthy();
  });

  it("should set the target in 'tsconfig.app.json' to 'es2017'", async () => {
    const tree = await runSchematic(
      'app',
      { name: 'myNestAppWithTarget' },
      appTree
    );
    const tsConfig = tree.readContent(
      'apps/my-nest-app-with-target/tsconfig.app.json'
    );

    expect(tsConfig).toContain('"target": "es2017"');
    expect(tsConfig).toContain('"incremental": true');

    expect(
      tree.exists('apps/my-nest-app-with-target/src/app/app.module.ts')
    ).toBeTruthy();
  });
});
