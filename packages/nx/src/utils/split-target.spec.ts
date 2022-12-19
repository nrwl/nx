import { ProjectGraphProjectNode } from '@nrwl/nx-cloud/lib/core/models/run-context.model';
import { ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { splitTarget } from './split-target';

const cases = [
  { input: 'project', expected: ['project'] },
  { input: 'project:target', expected: ['project', 'target'] },
  { input: 'project:target:config', expected: ['project', 'target', 'config'] },
  {
    input: 'project:"target:target":config',
    expected: ['project', 'target:target', 'config'],
  },
  {
    input: 'project:target:target:config',
    expected: ['project', 'target:target', 'config'],
  },
];

const projectGraph = new ProjectGraphBuilder()
  .addNode<ProjectGraphProjectNode<ProjectConfiguration>>({
    name: 'project',
    data: {
      files: [],
      root: '',
      targets: {
        target: {},
        'target:target': {},
      },
    },
    type: 'app',
  })
  .getUpdatedProjectGraph();

describe('splitTarget', () => {
  it.each(cases)('$input -> $expected', ({ input, expected }) => {
    expect(splitTarget(input, projectGraph)).toEqual(expected);
  });
});
