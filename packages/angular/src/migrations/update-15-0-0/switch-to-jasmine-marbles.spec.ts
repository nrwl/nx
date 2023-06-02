import {
  addProjectConfiguration,
  DependencyType,
  ProjectGraph,
  readJson,
  updateJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { jasmineMarblesVersion } from '../../utils/versions';
import switchToJasmineMarbles from './switch-to-jasmine-marbles';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  readCachedProjectGraph: jest.fn().mockImplementation(() => projectGraph),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => projectGraph),
}));

describe('switchToJasmineMarbles', () => {
  it('should correctly migrate a file that is using imports from nrwl/angular/testing that exist in jasmine-marbles', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });

    projectGraph = {
      nodes: {},
      dependencies: {
        test: [
          {
            type: DependencyType.static,
            source: 'test',
            target: 'npm:@nrwl/angular',
          },
        ],
      },
    };

    addProjectConfiguration(tree, 'test', {
      name: 'test',
      root: '',
    });

    tree.write(
      'test/a/b/mytest.spec.ts',
      `import {hot, cold} from '@nrwl/angular/testing';`
    );
    tree.write(
      'test/c/d/mytest.spec.ts',
      `import {hot, getTestScheduler} from '@nrwl/angular/testing';`
    );
    tree.write(
      'test/e/mytest.spec.ts',
      `import {getTestScheduler, time} from '@nrwl/angular/testing';`
    );

    // ACT
    await switchToJasmineMarbles(tree);

    // ASSERT
    expect(tree.read('test/a/b/mytest.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "
          import {hot,cold} from 'jasmine-marbles';"
    `);
    expect(tree.read('test/c/d/mytest.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "
          import {hot,getTestScheduler} from 'jasmine-marbles';"
    `);
    expect(tree.read('test/e/mytest.spec.ts', 'utf-8')).toMatchInlineSnapshot(`
      "
          import {getTestScheduler,time} from 'jasmine-marbles';"
    `);
  });

  it('should correctly migrate and split imports from nrwl/angular/testing that exist in jasmine-marbles and nrwl/angular/testing', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = {
      nodes: {},
      dependencies: {
        test: [
          {
            type: DependencyType.static,
            source: 'test',
            target: 'npm:@nrwl/angular',
          },
        ],
      },
    };

    addProjectConfiguration(tree, 'test', {
      name: 'test',
      root: '',
    });
    tree.write(
      'a/b/mytest.spec.ts',
      `import {hot, cold, readFirst} from '@nrwl/angular/testing';`
    );
    tree.write(
      'c/d/mytest.spec.ts',
      `import {hot, getTestScheduler, readAll} from '@nrwl/angular/testing';`
    );
    tree.write(
      'e/mytest.spec.ts',
      `import {getTestScheduler, time, readAll, readFirst} from '@nrwl/angular/testing';`
    );

    // ACT
    await switchToJasmineMarbles(tree);

    // ASSERT
    expect(tree.read('a/b/mytest.spec.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import {readFirst} from '@nrwl/angular/testing';
          import {hot,cold} from 'jasmine-marbles';"
    `);
    expect(tree.read('c/d/mytest.spec.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import {readAll} from '@nrwl/angular/testing';
          import {hot,getTestScheduler} from 'jasmine-marbles';"
    `);
    expect(tree.read('e/mytest.spec.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import {readAll,readFirst} from '@nrwl/angular/testing';
          import {getTestScheduler,time} from 'jasmine-marbles';"
    `);
  });

  it('should add jasmine-marbles as a dependency if it does not exist but uses jasmine-marbles symbols in files', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = {
      nodes: {},
      dependencies: {
        test: [
          {
            type: DependencyType.static,
            source: 'test',
            target: 'npm:@nrwl/angular',
          },
        ],
      },
    };

    addProjectConfiguration(tree, 'test', {
      name: 'test',
      root: '',
    });
    tree.write(
      'a/b/mytest.spec.ts',
      `import {hot, cold, readFirst} from '@nrwl/angular/testing';`
    );

    // ACT
    await switchToJasmineMarbles(tree);

    // ASSERT

    const jasmineMarblesDependency = readJson(tree, 'package.json')
      .devDependencies['jasmine-marbles'];
    expect(jasmineMarblesDependency).toBeTruthy();
    expect(jasmineMarblesDependency).toBe(jasmineMarblesVersion);
  });

  it('should add compatible jasmine-marbles version when rxjs version is <7.0.0', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    projectGraph = {
      nodes: {},
      dependencies: {
        test: [
          {
            type: DependencyType.static,
            source: 'test',
            target: 'npm:@nrwl/angular',
          },
        ],
      },
    };
    addProjectConfiguration(tree, 'test', {
      name: 'test',
      root: '',
    });
    tree.write(
      'a/b/mytest.spec.ts',
      `import {hot, cold, readFirst} from '@nrwl/angular/testing';`
    );
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: { ...json.dependencies, rxjs: '^6.6.7' },
    }));

    // ACT
    await switchToJasmineMarbles(tree);

    // ASSERT

    const jasmineMarblesDependency = readJson(tree, 'package.json')
      .devDependencies['jasmine-marbles'];
    expect(jasmineMarblesDependency).toBe('~0.8.3');
  });
});
