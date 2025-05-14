import {
  addProjectConfiguration,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './update-angular-ssr-imports-to-use-node-entry-point';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  createProjectGraphAsync: () => Promise.resolve(projectGraph),
  formatFiles: jest.fn(),
}));

describe('update-angular-ssr-imports-to-use-node-entry-point migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should replace "CommonEngine*" imports from "@angular/ssr" to "@angular/ssr/node"', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    tree.write(
      'apps/app1/server.ts',
      `import { CommonEngine } from '@angular/ssr';
import type { CommonEngineOptions, CommonEngineRenderOptions } from '@angular/ssr';
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/server.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { CommonEngine } from '@angular/ssr/node';
      import type { CommonEngineOptions, CommonEngineRenderOptions } from '@angular/ssr/node';
      "
    `);
  });

  it('should not re-append "/node" in "CommonEngine*" imports from "@angular/ssr/node"', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    const input = `import { CommonEngine } from '@angular/ssr/node';
import type { CommonEngineOptions, CommonEngineRenderOptions } from '@angular/ssr/node';
`;
    tree.write('apps/app1/server.ts', input);

    await migration(tree);

    expect(tree.read('apps/app1/server.ts', 'utf-8')).toBe(input);
  });

  it('should not replace "CommonEngine*" imports from other packages', async () => {
    addProject('app1', { name: 'app1', root: 'apps/app1' }, [
      'npm:@angular/ssr',
    ]);
    const input = `import { CommonEngine } from 'some-other-package';
import type { CommonEngineOptions, CommonEngineRenderOptions } from '../some-relative-path';
`;
    tree.write('apps/app1/server.ts', input);

    await migration(tree);

    expect(tree.read('apps/app1/server.ts', 'utf-8')).toBe(input);
  });

  function addProject(
    projectName: string,
    config: ProjectConfiguration,
    dependencies: string[]
  ): void {
    projectGraph = {
      dependencies: {
        [projectName]: dependencies.map((d) => ({
          source: projectName,
          target: d,
          type: 'static',
        })),
      },
      nodes: {
        [projectName]: { data: config, name: projectName, type: 'app' },
      },
    };
    addProjectConfiguration(tree, projectName, config);
  }
});
