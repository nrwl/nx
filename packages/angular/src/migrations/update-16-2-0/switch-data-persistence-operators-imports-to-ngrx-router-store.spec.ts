import { ProjectGraph, Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './switch-data-persistence-operators-imports-to-ngrx-router-store';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('switch-data-persistence-operators-imports-to-ngrx-router-store migration', () => {
  let tree: Tree;
  const file = 'apps/app1/src/app/+state/users.effects.ts';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    projectGraph = {
      dependencies: {
        app1: [{ source: 'app1', target: 'npm:@nx/angular', type: 'static' }],
      },
      nodes: {
        app1: {
          data: {
            files: [
              {
                file,
                hash: '',
                dependencies: [
                  {
                    source: 'app1',
                    target: 'npm:@nx/angular',
                    type: 'static',
                  },
                ],
              },
            ],
            root: 'apps/app1',
          },
          name: 'app1',
          type: 'app',
        },
      },
    };
  });

  it('should do nothing when there are no imports from the angular plugin', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
        
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
              
            @Injectable()
            class UsersEffects {}
            "
    `);
  });

  it('should not replace the import path when no operator is imported', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { foo } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
            import { foo } from '@nx/angular';
            
            @Injectable()
            class UsersEffects {}
            "
    `);
  });

  it('should not match imports from angular plugin secondary entry points', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@nx/angular/mf';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
            import { fetch } from '@nx/angular/mf';
            
            @Injectable()
            class UsersEffects {}
            "
    `);
  });

  it('should replace the import path in-place when it is importing an operator', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@ngrx/router-store/data-persistence';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should match imports using @nrwl/angular', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@nrwl/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@ngrx/router-store/data-persistence';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should support multiple operators imports', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch, navigation } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch, navigation } from '@ngrx/router-store/data-persistence';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should add a separate import statement when there are operator and non-operator imports', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch, foo, navigation } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch, navigation } from '@ngrx/router-store/data-persistence';
      import { foo } from '@nx/angular';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should support multiple import statements and import paths', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@nx/angular';
      import { navigation } from '@nrwl/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch } from '@ngrx/router-store/data-persistence';
      import { navigation } from '@ngrx/router-store/data-persistence';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should support renamed import symbols', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch as customFetch } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch as customFetch } from '@ngrx/router-store/data-persistence';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should support multiple imports with renamed and non-renamed symbols', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch as customFetch, navigation } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import {
        fetch as customFetch,
        navigation,
      } from '@ngrx/router-store/data-persistence';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });

  it('should add a separate import statement even with renamed symbols', async () => {
    tree.write(
      file,
      `import { Actions, createEffect, ofType } from '@ngrx/effects';
      import { fetch as customFetch, foo, navigation } from '@nx/angular';
      
      @Injectable()
      class UsersEffects {}
      `
    );

    await migration(tree);

    expect(tree.read(file, 'utf-8')).toMatchInlineSnapshot(`
      "import { Actions, createEffect, ofType } from '@ngrx/effects';
      import {
        fetch as customFetch,
        navigation,
      } from '@ngrx/router-store/data-persistence';
      import { foo } from '@nx/angular';

      @Injectable()
      class UsersEffects {}
      "
    `);
  });
});
