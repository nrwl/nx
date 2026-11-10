import type { ProjectGraph } from '../../config/project-graph';
import { directlyTouchedProjects } from '../index';
import { transformProjectGraphForLocators } from '../transform-objects';

describe('directlyTouchedProjects', () => {
  const graph = {
    nodes: {
      app: { name: 'app', type: 'app', data: { root: 'apps/app' } },
      lib: { name: 'lib', type: 'lib', data: { root: 'libs/lib' } },
    },
    externalNodes: {},
    dependencies: { app: [], lib: [] },
  } as ProjectGraph;

  // nx.json touches every project for affected, but owns no project's files.
  it('returns only the owner of each changed file, one entry per file', () => {
    expect(
      directlyTouchedProjects(transformProjectGraphForLocators(graph), [
        'apps/app/a.ts',
        'nx.json',
        'apps/app/b.ts',
        'README.md',
      ])
    ).toEqual(['app', 'app']);
  });
});
