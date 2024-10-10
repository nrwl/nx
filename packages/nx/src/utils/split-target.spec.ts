import type { ProjectGraph } from '../config/project-graph';
import { splitTarget } from './split-target';

let projectGraph: ProjectGraph;

describe('splitTarget', () => {
  beforeAll(() => {
    projectGraph = {
      nodes: {
        project: {
          name: 'project',
          data: {
            root: '',
            targets: {
              target: {},
              'target:target': {},
            },
          },
          type: 'app',
        },
      },
      dependencies: {},
    };
  });

  it('should support only project', () => {
    expect(splitTarget('project', projectGraph)).toEqual(['project']);
    expect(splitTarget('random', projectGraph)).toEqual(['random']); // return the project name as is
  });

  it('should split format project:target', () => {
    expect(splitTarget('project:target', projectGraph)).toEqual([
      'project',
      'target',
    ]);

    expect(splitTarget('project:random', projectGraph)).toEqual([
      'project',
      'random',
    ]); // return the target name as is
  });

  it('should split format project:target:configuration', () => {
    expect(splitTarget('project:target:configuration', projectGraph)).toEqual([
      'project',
      'target',
      'configuration',
    ]);

    expect(splitTarget('project:random:configuration', projectGraph)).toEqual([
      'project',
      'random',
      'configuration',
    ]); // return the target name as is

    expect(splitTarget('project:random:random', projectGraph)).toEqual([
      'project',
      'random',
      'random',
    ]); // return the target and configuration name as is
  });

  it('should identify targets that contain colons when present in the graph', () => {
    expect(
      splitTarget('project:target:target:configuration', projectGraph)
    ).toEqual(['project', 'target:target', 'configuration']);

    expect(splitTarget('project:target:target', projectGraph)).toEqual([
      'project',
      'target:target',
    ]);
  });

  it('should identify targets that contain colons when not present in the graph but surrounded by quotes', () => {
    expect(
      splitTarget('project:"other:other":configuration', projectGraph)
    ).toEqual(['project', 'other:other', 'configuration']);

    expect(splitTarget('project:"other:other"', projectGraph)).toEqual([
      'project',
      'other:other',
    ]);
  });
});
