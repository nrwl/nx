import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('init', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
    tree = await runSchematic('app', { name: 'my-app' }, tree);
  });

  it('should create and import a module', async () => {
    const result = await runSchematic(
      'module',
      {
        name: 'my-mod',
        project: 'my-app',
      },
      tree
    );
    expect(
      result.readContent('apps/my-app/src/app/my-mod/my-mod.module.ts')
    ).toContain(`import { Module } from '@nestjs/common';`);
    expect(result.readContent('apps/my-app/src/app/app.module.ts')).toContain(
      `import { MyModModule } from './my-mod/my-mod.module';`
    );
  });

  it('should create and import a flat module', async () => {
    const result = await runSchematic(
      'module',
      {
        name: 'my-mod',
        project: 'my-app',
        flat: true,
      },
      tree
    );

    expect(
      result.readContent('apps/my-app/src/app/my-mod.module.ts')
    ).toContain(`import { Module } from '@nestjs/common';`);
    expect(result.readContent('apps/my-app/src/app/app.module.ts')).toContain(
      `import { MyModModule } from './my-mod.module';`
    );
  });

  it('should create and import a module from a different path', async () => {
    const result = await runSchematic(
      'module',
      {
        name: 'my-mod',
        project: 'my-app',
        path: 'my-path',
      },
      tree
    );

    expect(
      result.readContent('apps/my-app/src/app/my-path/my-mod/my-mod.module.ts')
    ).toContain(`import { Module } from '@nestjs/common';`);
    expect(result.readContent('apps/my-app/src/app/app.module.ts')).toContain(
      `import { MyModModule } from './my-path/my-mod/my-mod.module';`
    );
  });

  it('should create and import a flat module from a different path', async () => {
    const result = await runSchematic(
      'module',
      {
        name: 'my-mod',
        project: 'my-app',
        path: 'my-path',
        flat: true,
      },
      tree
    );

    expect(
      result.readContent('apps/my-app/src/app/my-path/my-mod.module.ts')
    ).toContain(`import { Module } from '@nestjs/common';`);
    expect(result.readContent('apps/my-app/src/app/app.module.ts')).toContain(
      `import { MyModModule } from './my-path/my-mod.module';`
    );
  });

  it('should create a module and skip the import', async () => {
    const result = await runSchematic(
      'module',
      {
        name: 'my-mod',
        project: 'my-app',
        skipImport: true,
      },
      tree
    );
    expect(
      result.readContent('apps/my-app/src/app/my-mod/my-mod.module.ts')
    ).toContain(`import { Module } from '@nestjs/common';`);
    expect(
      result.readContent('apps/my-app/src/app/app.module.ts')
    ).not.toContain(`import { MyModModule } from './my-mod/my-mod.module';`);
  });
});
