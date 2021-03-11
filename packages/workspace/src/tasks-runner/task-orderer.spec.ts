import { TaskOrderer } from './task-orderer';
import { DependencyType } from '../core/project-graph';

describe('TaskStages', () => {
  it('should return empty for an empty array', () => {
    const stages = new TaskOrderer({} as any, 'build', {
      nodes: {},
      dependencies: {},
    }).splitTasksIntoStages([]);
    expect(stages).toEqual([]);
  });

  it('should split tasks into stages based on their dependencies', () => {
    const stages = new TaskOrderer({} as any, 'build', {
      nodes: {
        child1: { type: 'lib' },
        child2: { type: 'lib' },
        parent: { type: 'lib' },
        grandparent: { type: 'lib' },
      } as any,
      dependencies: {
        child1: [],
        child2: [],
        parent: [
          {
            source: 'parent',
            target: 'child1',
            type: DependencyType.static,
          },
          {
            source: 'parent',
            target: 'child2',
            type: DependencyType.static,
          },
        ],
        grandparent: [
          {
            source: 'grandparent',
            target: 'parent',
            type: DependencyType.static,
          },
        ],
      },
    }).splitTasksIntoStages([
      {
        target: { project: 'parent' },
      },
      {
        target: { project: 'child1' },
      },
      {
        target: { project: 'child2' },
      },
      {
        target: { project: 'grandparent' },
      },
    ] as any);

    expect(stages).toEqual([
      [
        {
          target: { project: 'child1' },
        },
        {
          target: { project: 'child2' },
        },
      ],
      [
        {
          target: { project: 'parent' },
        },
      ],
      [
        {
          target: { project: 'grandparent' },
        },
      ],
    ]);
  });

  it('should support custom targets that require strict ordering', () => {
    const stages = new TaskOrderer(
      { strictlyOrderedTargets: ['custom'] } as any,
      'custom',
      {
        nodes: { child1: { type: 'lib' }, parent: { type: 'lib' } } as any,
        dependencies: {
          child1: [],
          parent: [
            {
              source: 'parent',
              target: 'child1',
              type: DependencyType.static,
            },
          ],
        },
      }
    ).splitTasksIntoStages([
      {
        target: { project: 'parent' },
      },
      {
        target: { project: 'child1' },
      },
    ] as any);

    expect(stages).toEqual([
      [
        {
          target: { project: 'child1' },
        },
      ],
      [
        {
          target: { project: 'parent' },
        },
      ],
    ]);

    const noStages = new TaskOrderer(
      { strictlyOrderedTargets: ['custom'] } as any,
      'some-other-custom',
      {
        nodes: {},
        dependencies: {
          child1: [],
          parent: [
            {
              source: 'parent',
              target: 'child1',
              type: DependencyType.static,
            },
          ],
        },
      }
    ).splitTasksIntoStages([
      {
        target: { project: 'parent' },
      },
      {
        target: { project: 'child1' },
      },
    ] as any);

    expect(noStages).toEqual([
      [
        {
          target: { project: 'parent' },
        },
        {
          target: { project: 'child1' },
        },
      ],
    ]);
  });

  it('should split tasks into stages based on their dependencies when there are unrelated packages', () => {
    const stages = new TaskOrderer({} as any, 'build', {
      nodes: {
        app1: { type: 'lib' },
        app2: { type: 'lib' },
        common1: { type: 'lib' },
        common2: { type: 'lib' },
      } as any,
      dependencies: {
        app1: [
          {
            source: 'app1',
            target: 'common1',
            type: DependencyType.static,
          },
        ],
        app2: [
          {
            source: 'app2',
            target: 'common2',
            type: DependencyType.static,
          },
        ],
        common1: [],
        common2: [],
      },
    }).splitTasksIntoStages([
      {
        target: { project: 'app1' },
      },
      {
        target: { project: 'app2' },
      },
      {
        target: { project: 'common1' },
      },
      {
        target: { project: 'common2' },
      },
    ] as any);

    expect(stages).toEqual([
      [
        {
          target: { project: 'common1' },
        },
        {
          target: { project: 'common2' },
        },
      ],
      [
        {
          target: { project: 'app1' },
        },
        {
          target: { project: 'app2' },
        },
      ],
    ]);
  });
});
