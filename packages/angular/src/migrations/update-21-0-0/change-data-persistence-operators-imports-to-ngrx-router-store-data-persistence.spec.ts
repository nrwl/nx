import {
  addProjectConfiguration,
  DependencyType,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { FileMapCache } from 'nx/src/project-graph/nx-deps-cache';
import migration from './change-data-persistence-operators-imports-to-ngrx-router-store-data-persistence';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(() => Promise.resolve(projectGraph)),
}));
let fileMapCache: FileMapCache;
jest.mock('nx/src/project-graph/nx-deps-cache', () => ({
  ...jest.requireActual('nx/src/project-graph/nx-deps-cache'),
  readFileMapCache: jest.fn().mockImplementation(() => fileMapCache),
}));

describe('change-data-persistence-operators-imports-to-ngrx-router-store-data-persistence migration', () => {
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
          data: { root: 'apps/app1' },
          name: 'app1',
          type: 'app',
        },
      },
    };
    fileMapCache = {
      fileMap: {
        projectFileMap: {
          app1: [
            {
              file,
              hash: '',
              deps: [['app1', 'npm:@nx/angular', DependencyType.static]],
            },
          ],
        },
      },
    } as unknown as FileMapCache;
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
