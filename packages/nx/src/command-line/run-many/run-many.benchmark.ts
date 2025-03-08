import type { Bench } from 'tinybench';

import { projectsToRun } from './run-many';
import { ProjectGraph } from '../../config/project-graph';

let projectGraph: ProjectGraph = {
  nodes: {
    proj1: {
      name: 'proj1',
      type: 'lib',
      data: {
        root: 'proj1',
        tags: ['api', 'theme1'],
        targets: {
          build: {},
          test: {},
        },
      },
    },
    proj2: {
      name: 'proj2',
      type: 'lib',
      data: {
        root: 'proj2',
        tags: ['ui', 'theme2'],
        targets: {
          test: {},
        },
      },
    },
  } as any,
  dependencies: {},
};

for (let i = 0; i < 1000000; i++) {
  projectGraph.nodes['proj' + i] = {
    name: 'proj' + i,
    type: 'lib',
    data: {
      root: 'proj' + i,
      targets: {
        test: {},
      },
    } as any,
  };
}

export function registerBenchmarks(bench: Bench) {
  return bench.add(
    'should be able to select and exclude via patterns',
    async () => {
      projectsToRun(
        {
          targets: ['test'],
          projects: ['proj1*'],
          exclude: ['proj12*'],
        },
        projectGraph
      );
    },
    {}
  );
}
