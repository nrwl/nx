import type { ProjectGraph } from '../config/project-graph';
import {
  transformProjectGraphForRust,
  transformProjectGraphForRustWithoutExternals,
} from './transform-objects';

describe('transformProjectGraphForRustWithoutExternals', () => {
  // `app` depends on `lib` and on `npm:react`, which depends on `npm:scheduler`.
  const graph = {
    nodes: {
      app: {
        name: 'app',
        type: 'app',
        data: {
          root: 'apps/app',
          namedInputs: { production: ['default'] },
          targets: { build: { executor: 'x:y', options: { a: 1 } } },
        },
      },
      lib: { name: 'lib', type: 'lib', data: { root: 'libs/lib' } },
    },
    externalNodes: {
      'npm:react': {
        name: 'npm:react',
        type: 'npm',
        data: { packageName: 'react', version: '18.0.0' },
      },
      'npm:scheduler': {
        name: 'npm:scheduler',
        type: 'npm',
        data: { packageName: 'scheduler', version: '0.23.0' },
      },
    },
    dependencies: {
      app: [
        { source: 'app', target: 'lib', type: 'static' },
        { source: 'app', target: 'npm:react', type: 'static' },
      ],
      lib: [],
      'npm:react': [
        { source: 'npm:react', target: 'npm:scheduler', type: 'static' },
      ],
    },
  } as unknown as ProjectGraph;

  it('keeps every project exactly as the full transform does', () => {
    expect(transformProjectGraphForRustWithoutExternals(graph).nodes).toEqual(
      transformProjectGraphForRust(graph).nodes
    );
  });

  // An edge left pointing at a dropped node would describe a graph with
  // nodes it does not contain.
  it('drops the external nodes and every edge that touches one', () => {
    const projectsOnly = transformProjectGraphForRustWithoutExternals(graph);
    expect(projectsOnly.externalNodes).toEqual({});
    expect(projectsOnly.dependencies).toEqual({ app: ['lib'], lib: [] });
  });
});
