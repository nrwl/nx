import { joinPathFragments, workspaceRoot } from '@nx/devkit';
import {
  createWatchPaths,
  getRelativeDependencyPaths,
} from './create-watch-paths';

describe('createWatchPaths', () => {
  it('should list root paths of dependencies relative to project root', async () => {
    // This test is written based on the Nx repo's project graph.
    jest
      .spyOn(require('@nx/devkit'), 'createProjectGraphAsync')
      .mockResolvedValue({
        nodes: {
          parent: {
            type: 'app',
            name: 'parent',
            data: { root: 'apps/parent' },
          },
          lib: {
            type: 'lib',
            name: 'lib',
            data: { root: 'packages/lib' },
          },
          example: {
            type: 'app',
            name: 'example',
            data: { root: 'examples/example' },
          },
        },
        dependencies: {
          parent: [
            { type: 'static', source: 'parent', target: 'lib' },
            { type: 'static', source: 'parent', target: 'example' },
          ],
          example: [{ type: 'static', source: 'example', target: 'lib' }],
        },
      });
    const testDir = joinPathFragments(workspaceRoot, 'apps/parent');

    const paths = await createWatchPaths(testDir);
    expect(paths).toEqual(['../../packages', '../../examples']);
  });
});

describe('getRelativeDependencyPaths', () => {
  it('should work for standalone projects', () => {
    const project = {
      type: 'app' as const,
      name: 'test',
      data: { root: '.', files: [] },
    };
    const result = getRelativeDependencyPaths(
      project,
      ['lib-1', 'lib-2', 'lib-3'],
      {
        nodes: {
          test: project,
          'lib-1': {
            type: 'lib',
            name: 'lib-1',
            data: { root: 'lib-1' },
          },
          'lib-2': {
            type: 'lib',
            name: 'lib-2',
            data: { root: 'lib-2' },
          },
          'lib-3': {
            type: 'lib',
            name: 'lib-3',
            data: { root: 'lib-3' },
          },
        },
        dependencies: {},
      }
    );

    expect(result).toEqual(['lib-1', 'lib-2', 'lib-3']);
  });

  it('should watch the entire libs folder for integrated monorepos', () => {
    const project = {
      type: 'app' as const,
      name: 'test',
      data: { root: 'apps/test', files: [] },
    };
    const result = getRelativeDependencyPaths(
      project,
      ['lib-1', 'lib-2', 'lib-3'],
      {
        nodes: {
          test: project,
          'lib-1': {
            type: 'lib',
            name: 'lib-1',
            data: { root: 'libs/lib-1' },
          },
          'lib-2': {
            type: 'lib',
            name: 'lib-2',
            data: { root: 'libs/lib-2' },
          },
          'lib-3': {
            type: 'lib',
            name: 'lib-3',
            data: { root: 'libs/lib-3' },
          },
        },
        dependencies: {},
      }
    );

    expect(result).toEqual(['../../libs']);
  });

  it('should watch the entire packages folder for monorepos if apps is not contained in it', () => {
    const project = {
      type: 'app' as const,
      name: 'test',
      data: { root: 'apps/test', files: [] },
    };
    const result = getRelativeDependencyPaths(
      project,
      ['lib-1', 'lib-2', 'lib-3'],
      {
        nodes: {
          test: project,
          'lib-1': {
            type: 'lib',
            name: 'lib-1',
            data: { root: 'packages/lib-1' },
          },
          'lib-2': {
            type: 'lib',
            name: 'lib-2',
            data: { root: 'packages/lib-2' },
          },
          'lib-3': {
            type: 'lib',
            name: 'lib-3',
            data: { root: 'packages/lib-3' },
          },
        },
        dependencies: {},
      }
    );

    expect(result).toEqual(['../../packages']);
  });

  it('should watch individual dependency folder if app is contained in the same base path', () => {
    const project = {
      type: 'app' as const,
      name: 'test',
      data: { root: 'packages/test', files: [] },
    };
    const result = getRelativeDependencyPaths(
      project,
      ['lib-1', 'lib-2', 'lib-3'],
      {
        nodes: {
          test: project,
          'lib-1': {
            type: 'lib',
            name: 'lib-1',
            data: { root: 'packages/lib-1' },
          },
          'lib-2': {
            type: 'lib',
            name: 'lib-2',
            data: { root: 'packages/lib-2' },
          },
          'lib-3': {
            type: 'lib',
            name: 'lib-3',
            data: { root: 'packages/lib-3' },
          },
        },
        dependencies: {},
      }
    );

    expect(result).toEqual([
      '../../packages/lib-1',
      '../../packages/lib-2',
      '../../packages/lib-3',
    ]);
  });
});
