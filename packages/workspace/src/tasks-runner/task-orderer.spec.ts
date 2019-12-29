import { TaskOrderer } from './task-orderer';
import { DependencyType } from '../core/project-graph';

describe('TaskStages', () => {
  it('should return empty for an empty array', () => {
    const stages = new TaskOrderer('build', {
      nodes: {},
      dependencies: {}
    }).splitTasksIntoStages([]);
    expect(stages).toEqual([]);
  });

  it('should split tasks into stages based on their dependencies', () => {
    const stages = new TaskOrderer('build', {
      nodes: {},
      dependencies: {
        child1: [],
        child2: [],
        parent: [
          {
            source: 'parent',
            target: 'child1',
            type: DependencyType.static
          },
          {
            source: 'parent',
            target: 'child2',
            type: DependencyType.static
          }
        ],
        grandparent: [
          {
            source: 'grandparent',
            target: 'parent',
            type: DependencyType.static
          }
        ]
      }
    }).splitTasksIntoStages([
      {
        target: { project: 'parent' }
      },
      {
        target: { project: 'child1' }
      },
      {
        target: { project: 'child2' }
      },
      {
        target: { project: 'grandparent' }
      }
    ] as any);

    expect(stages).toEqual([
      [
        {
          target: { project: 'child1' }
        },
        {
          target: { project: 'child2' }
        }
      ],
      [
        {
          target: { project: 'parent' }
        }
      ],
      [
        {
          target: { project: 'grandparent' }
        }
      ]
    ]);
  });
});
