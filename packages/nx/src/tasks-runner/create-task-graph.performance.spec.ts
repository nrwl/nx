import { vi } from 'vitest';
import { ProjectGraph } from '../config/project-graph';
import { TargetDependencies } from '../config/nx-json';
import {
  ProcessTasks,
  createTaskGraph,
  createTaskGraphWithDependencyOverrides,
  filterDummyTasks,
} from './create-task-graph';
import * as reference from './__fixtures__/create-task-graph.reference.fixture';
import * as utils from './utils';

const executor = 'nx:run-commands';
function graph(
  targets: Record<string, Record<string, any>>,
  edges: Record<string, string[]>
): ProjectGraph {
  return {
    nodes: Object.fromEntries(
      Object.entries(targets).map(([name, targets]) => [
        name,
        {
          name,
          type: 'lib',
          data: {
            root: name,
            targets: Object.fromEntries(
              Object.entries(targets).map(([name, config]) => [
                name,
                { executor, ...config },
              ])
            ),
          },
        },
      ])
    ),
    dependencies: Object.fromEntries(
      Object.keys(targets).map((name) => [
        name,
        (edges[name] ?? []).map((target) => ({
          source: name,
          target,
          type: 'static',
        })),
      ])
    ),
  } as ProjectGraph;
}
function compare(
  g: ProjectGraph,
  projects: string[],
  targets: string[],
  configuration?: string,
  overrides = {},
  extra: TargetDependencies = {},
  exclude = false
) {
  // Normalization may mutate object-form entries. Give each algorithm its own input.
  for (const name of [
    'createTaskGraph',
    'createTaskGraphWithDependencyOverrides',
  ] as const) {
    const args = [
      g,
      extra,
      projects,
      targets,
      configuration,
      overrides,
      exclude,
    ] as const;
    const actual = { createTaskGraph, createTaskGraphWithDependencyOverrides }[
      name
    ](...structuredClone(args));
    const expected = reference[name](...structuredClone(args));
    expect(actual).toEqual(expected);
    expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
  }
}
function chain(origins: number, length: number, dead = 0) {
  const targets = {};
  const edges: Record<string, string[]> = {};
  const projects = Array.from({ length: origins }, (_, i) => `app${i}`);
  for (const name of projects) {
    targets[name] = { lint: { dependsOn: ['^X'] } };
    edges[name] = ['lib0', ...(dead ? ['dead0'] : [])];
  }
  for (let i = 0; i < length; i++) {
    targets[`lib${i}`] = {};
    edges[`lib${i}`] = [i === length - 1 ? 'tail' : `lib${i + 1}`];
  }
  for (let i = 0; i < dead; i++) {
    targets[`dead${i}`] = {};
    edges[`dead${i}`] = i === dead - 1 ? [] : [`dead${i + 1}`];
  }
  targets['tail'] = { X: {} };
  return { g: graph(targets, edges), projects };
}

afterEach(() => vi.restoreAllMocks());
describe('task graph performance and compatibility', () => {
  it.each(Array.from({ length: 240 }, (_, i) => i + 1))(
    'matches 23.3.0 for seeded graph %i',
    (seed) => {
      let state = seed;
      const random = (n: number) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state % n;
      };
      const targets = {};
      const edges: Record<string, string[]> = {};
      const count = 6 + random(7);
      const names = Array.from({ length: count }, (_, i) => `p${i}`);
      for (let i = 0; i < count; i++) {
        const configs = {
          dev: { source: `dev${i}` },
          prod: { source: `prod${i}` },
        };
        const deps: any[] = [
          '^absent',
          '^codegen-*',
          {
            dependencies: true,
            target: 'X',
            params: random(2) ? 'forward' : 'ignore',
            options: random(2) ? 'forward' : 'ignore',
          },
        ];
        if (random(2)) deps.push('codegen-*');
        if (random(3) === 0)
          deps.push({
            projects: [names[random(count)]],
            target: 'Y',
            params: 'forward',
          });
        if (random(3) === 0) deps.push('self');
        targets[names[i]] = {
          lint: {
            dependsOn: deps,
            options: { source: i },
            configurations: configs,
            defaultConfiguration: 'dev',
          },
          self: {},
        };
        for (const [j, target] of [
          'X',
          'Y',
          'codegen-a',
          'codegen-b',
        ].entries()) {
          // Vary density: absent, singleton, sparse and dense targets.
          const density = (seed + j) % 4;
          if (
            density === 0 ||
            (density === 1 && i !== 0) ||
            (density === 2 && i % 5 !== 0) ||
            (density === 3 && random(4) === 0)
          )
            continue;
          targets[names[i]][target] = {
            configurations: configs,
            defaultConfiguration: random(2) ? 'dev' : undefined,
            continuous: random(4) === 0,
            ...(random(5) === 0 ? { dependsOn: ['^Y'] } : {}),
          };
        }
        edges[names[i]] = names.filter(
          (_, j) => (seed % 3 === 0 || j > i) && random(4) === 0
        );
      }
      // A guaranteed diamond, and regular project/dummy-only cycles.
      edges.p0 = ['p1', 'p2'];
      edges.p1 = ['p3'];
      edges.p2 = ['p3'];
      if (seed % 5 === 0) edges.p3 = ['p0'];
      compare(
        graph(targets, edges),
        names.slice(0, 3),
        ['lint'],
        seed % 2 ? undefined : 'prod',
        { flag: seed, __overrides_unparsed__: ['--flag', String(seed)] },
        {},
        seed % 17 === 0
      );
    }
  );

  it('retains shadowed Y below a project that already has Y', () => {
    const g = graph(
      {
        app: { lint: { dependsOn: ['^X', '^Y'] } },
        lib1: { Y: {} },
        lib2: { Y: {} },
      },
      { app: ['lib1'], lib1: ['lib2'] }
    );
    const result = createTaskGraph(g, {}, ['app'], ['lint'], undefined, {});
    expect(result.dependencies['app:lint']).toEqual(['lib2:Y', 'lib1:Y']);
    compare(g, ['app'], ['lint']);
  });

  it('prunes a dead tree beside a chain of 50 missing targets', () => {
    const { g, projects } = chain(1, 50, 50);
    const spy = vi.spyOn(ProcessTasks.prototype as any, 'createDummyTask');
    const result = createTaskGraph(g, {}, projects, ['lint'], undefined, {});
    expect(result.dependencies['app0:lint']).toEqual(['tail:X']);
    expect(Object.keys(result.tasks)).toHaveLength(2);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(50);
    compare(g, projects, ['lint']);
  });

  it('shares a chain in linear work when the number of origins doubles', () => {
    const measure = (origins: number) => {
      const { g, projects } = chain(origins, 100);
      const dummy = vi.spyOn(ProcessTasks.prototype as any, 'createDummyTask');
      const process = vi.spyOn(ProcessTasks.prototype, 'processTask');
      const result = createTaskGraph(g, {}, projects, ['lint'], undefined, {});
      expect(Object.keys(result.tasks)).toHaveLength(origins + 1);
      for (const name of projects)
        expect(result.dependencies[`${name}:lint`]).toEqual(['tail:X']);
      const counts = {
        dummy: dummy.mock.calls.length,
        process: process.mock.calls.length,
      };
      expect(counts.dummy).toBeLessThan(5 * (origins + 100));
      expect(counts.process).toBeLessThan(5 * (origins + 100));
      vi.restoreAllMocks();
      return counts;
    };
    const first = measure(100),
      second = measure(200);
    expect(second.dummy).toBe(first.dummy);
    expect(second.process - first.process).toBe(100);
  });

  it('shares the whole config list across different missing dependency entries', () => {
    const { g, projects } = chain(20, 30);
    for (const project of projects) {
      g.nodes[project].data.targets.lint.dependsOn = [
        '^missing-one',
        '^X',
        '^missing-two',
      ];
    }
    const dummy = vi.spyOn(ProcessTasks.prototype as any, 'createDummyTask');
    const process = vi.spyOn(ProcessTasks.prototype, 'processTask');
    const result = createTaskGraph(g, {}, projects, ['lint'], undefined, {});
    for (const project of projects)
      expect(result.dependencies[`${project}:lint`]).toEqual(['tail:X']);
    expect(dummy.mock.calls.length).toBe(30);
    expect(process.mock.calls.length).toBe(51);
    vi.restoreAllMocks();
    compare(g, projects, ['lint']);
  });

  it('keeps configuration, options and forwarded CLI overrides separate', () => {
    const g = graph(
      {
        a: {
          lint: {
            dependsOn: ['prep'],
            defaultConfiguration: 'dev',
            configurations: { dev: {} },
          },
          prep: {
            dependsOn: [
              {
                dependencies: true,
                target: 'X',
                params: 'forward',
                options: 'forward',
              },
            ],
            defaultConfiguration: 'dev',
            configurations: { dev: { flavor: 'a' } },
          },
        },
        b: {
          lint: {
            dependsOn: ['prep'],
            defaultConfiguration: 'prod',
            configurations: { prod: {} },
          },
          prep: {
            dependsOn: [
              {
                dependencies: true,
                target: 'X',
                params: 'ignore',
                options: 'forward',
              },
            ],
            defaultConfiguration: 'prod',
            configurations: { prod: { flavor: 'b' } },
          },
        },
        middle: {},
        tail: { X: { configurations: { dev: {}, prod: {} } } },
      },
      { a: ['middle'], b: ['middle'], middle: ['tail'] }
    );
    for (const configuration of [undefined, 'dev', 'prod'])
      compare(g, ['a', 'b'], ['lint'], configuration, { cli: 'yes' });
    const result = createTaskGraph(g, {}, ['a', 'b'], ['lint'], undefined, {
      cli: 'yes',
    });
    expect(result.tasks['tail:X'].overrides).toEqual({
      flavor: 'a',
      cli: 'yes',
    });
  });

  it('separates shared walks with different requested configurations and CLI parameters', () => {
    const g = graph(
      {
        a: {
          lint: {
            dependsOn: [{ dependencies: true, target: 'X', params: 'forward' }],
            configurations: { dev: {} },
          },
        },
        b: {
          lint: {
            dependsOn: [{ dependencies: true, target: 'X', params: 'forward' }],
            configurations: { prod: {} },
          },
        },
        middle: {},
        tail: { X: { configurations: { dev: {}, prod: {} } } },
      },
      { a: ['middle'], b: ['middle'], middle: ['tail'] }
    );
    const run = (Ctor: typeof ProcessTasks | typeof reference.ProcessTasks) => {
      const p = new Ctor({}, structuredClone(g));
      for (const [project, config, flag] of [
        ['a', 'dev', 'first'],
        ['b', 'prod', 'second'],
      ]) {
        const task = (p as any).createTask(
          `${project}:lint:${config}`,
          g.nodes[project],
          'lint',
          config,
          { flag }
        );
        p.tasks[task.id] = task;
        p.dependencies[task.id] = [];
        p.continuousDependencies[task.id] = [];
        p.processTask(task, project, config, { flag });
      }
      p.processTasks([], [], undefined, {}, false);
      return {
        tasks: p.tasks,
        dependencies: p.dependencies,
        continuousDependencies: p.continuousDependencies,
      };
    };
    const actual = run(ProcessTasks);
    expect(actual).toEqual(run(reference.ProcessTasks));
    expect(actual.dependencies['a:lint:dev']).toEqual(['tail:X:dev']);
    expect(actual.dependencies['b:lint:prod']).toEqual(['tail:X:prod']);
    expect(actual.tasks['tail:X:dev'].overrides).toEqual({ flag: 'first' });
    expect(actual.tasks['tail:X:prod'].overrides).toEqual({ flag: 'second' });
  });

  it('retains a targetless project cycle beside a reachable target', () => {
    const g = graph(
      {
        app: { lint: { dependsOn: ['^absent', '^Y'] } },
        fork: {},
        cycle: {},
        leaf: { Y: {} },
      },
      { app: ['fork'], fork: ['cycle', 'leaf'], cycle: ['fork'] }
    );
    compare(g, ['app'], ['lint']);
  });

  it('prunes inert self globs without changing task or edge order', () => {
    const { g, projects } = chain(4, 20, 50);
    for (const project of projects)
      g.nodes[project].data.targets.lint.dependsOn = [
        '^codegen-*',
        'codegen-*',
      ];
    g.nodes.tail.data.targets['codegen-one'] = { executor };
    const spy = vi.spyOn(ProcessTasks.prototype as any, 'createDummyTask');
    const actual = createTaskGraph(g, {}, projects, ['lint'], undefined, {});
    expect(actual.dependencies['app0:lint']).toEqual(['tail:codegen-one']);
    expect(spy.mock.calls.length).toBeLessThanOrEqual(20);
    compare(g, projects, ['lint']);
  });

  it('records both origins and every repeated edge through dummies', () => {
    const { g, projects } = chain(2, 2);
    for (const project of projects) {
      g.nodes[project].data.targets.lint.dependsOn = ['^missing', '^X'];
    }
    const result = createTaskGraphWithDependencyOverrides(
      g,
      {},
      projects,
      ['lint'],
      undefined,
      {}
    );
    expect(
      result.dependencyOverrides['tail:X'].map((edge) => edge.from)
    ).toEqual(['app0:lint', 'app0:lint', 'app1:lint', 'app1:lint']);
    compare(g, projects, ['lint']);
  });

  it('expands every dummy once in a depth 20 diamond, preserving order', () => {
    const deps: Record<string, string[]> = {
      root: ['0a__nx_dummy_task__', '0b__nx_dummy_task__'],
      other: ['0b__nx_dummy_task__', '0a__nx_dummy_task__'],
      first: [],
      last: [],
    };
    const reads = new Map<string, number>();
    for (let i = 0; i < 20; i++)
      for (const side of ['a', 'b']) {
        const id = `${i}${side}__nx_dummy_task__`;
        const children =
          i === 19
            ? ['last', 'first', 'last']
            : [`${i + 1}a__nx_dummy_task__`, `${i + 1}b__nx_dummy_task__`];
        Object.defineProperty(deps, id, {
          enumerable: true,
          configurable: true,
          get: () => {
            reads.set(id, (reads.get(id) ?? 0) + 1);
            return children;
          },
        });
      }
    const expected = structuredClone(deps);
    reads.clear();
    filterDummyTasks(deps);
    expect(deps.root).toEqual(['last', 'first', 'last', 'first']);
    expect(deps.other).toEqual(['last', 'first', 'last', 'first']);
    // findCycles and Object.entries also read each adjacency list once.
    for (const count of reads.values()) expect(count).toBeLessThanOrEqual(3);
    reference.filterDummyTasks(expected);
    expect(deps).toEqual(expected);
  });

  it.each([
    {
      root: ['a__nx_dummy_task__'],
      a__nx_dummy_task__: ['b__nx_dummy_task__', 'real'],
      b__nx_dummy_task__: ['a__nx_dummy_task__'],
      real: [],
    },
    {
      root: ['a__nx_dummy_task__'],
      a__nx_dummy_task__: ['real'],
      real: ['b__nx_dummy_task__'],
      b__nx_dummy_task__: ['a__nx_dummy_task__', 'root'],
    },
    {
      root: ['a__nx_dummy_task__'],
      a__nx_dummy_task__: ['a__nx_dummy_task__', 'real'],
      real: [],
    },
  ])('preserves legacy cycle filtering: %j', (deps) => {
    const expected = structuredClone(deps);
    reference.filterDummyTasks(expected);
    filterDummyTasks(deps);
    expect(deps).toEqual(expected);
  });

  it('expands dependency globs once per project and target', () => {
    const { g, projects } = chain(3, 12);
    g.nodes.app0.data.targets.lint.dependsOn = ['^codegen-*'];
    g.nodes.tail.data.targets['codegen-one'] = { executor };
    g.nodes.tail.data.targets['codegen-two'] = { executor };
    const spy = vi.spyOn(utils, 'getDependencyConfigs');
    const result = createTaskGraph(g, {}, projects, ['lint'], undefined, {});
    expect(result.dependencies['app0:lint']).toEqual([
      'tail:codegen-one',
      'tail:codegen-two',
    ]);
    const pairs = spy.mock.calls.map(([target]) => JSON.stringify(target));
    expect(pairs.length).toBe(new Set(pairs).size);
    expect(
      spy.mock.calls.filter(
        ([target]) => target.project === 'app0' && target.target === 'lint'
      )
    ).toHaveLength(1);
  });
});
