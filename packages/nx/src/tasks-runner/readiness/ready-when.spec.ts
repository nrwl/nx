import type { ProjectGraph } from '../../config/project-graph';
import type { Task, TaskGraph } from '../../config/task-graph';
import type { TargetConfiguration } from '../../config/workspace-json-project-json';
import { createTaskGraph } from '../create-task-graph';
import { getReadyProducerIds, normalizeReadyWhen } from './ready-when';

describe('normalizeReadyWhen', () => {
  it('normalizes each probe kind and keeps the knobs', () => {
    expect(
      normalizeReadyWhen(
        { url: 'http://localhost:4200', timeout: 5, interval: 2 },
        'app:serve'
      )
    ).toEqual({
      kind: 'url',
      url: 'http://localhost:4200',
      timeout: 5,
      interval: 2,
    });
    expect(normalizeReadyWhen({ port: 3000 }, 'app:serve')).toEqual({
      kind: 'port',
      port: 3000,
      timeout: 60_000,
    });
    expect(
      normalizeReadyWhen({ port: 3000, host: 'localhost' }, 'app:serve')
    ).toMatchObject({ kind: 'port', host: 'localhost' });
    expect(
      normalizeReadyWhen({ command: 'docker inspect db' }, 'app:serve')
    ).toMatchObject({ kind: 'command', command: 'docker inspect db' });
    expect(
      normalizeReadyWhen({ logMatches: ['a', 'b'] }, 'app:serve')
    ).toMatchObject({ kind: 'logMatches', logMatches: ['a', 'b'] });
    expect(normalizeReadyWhen({ logMatches: 'a' }, 'app:serve')).toMatchObject({
      kind: 'logMatches',
      logMatches: ['a'],
    });
  });

  it.each([
    ['ready on', 'expected an object'],
    [{}, 'expected exactly one of'],
    [{ url: 'http://x', port: 1 }, 'expected exactly one of'],
    [{ url: 'ftp://x' }, '"url" must be an http or https URL'],
    [{ url: 'not a url' }, '"url" must be an http or https URL'],
    [{ port: 0 }, '"port" must be an integer from 1 to 65535'],
    [{ port: 70000 }, '"port" must be an integer from 1 to 65535'],
    [{ port: 80, host: '' }, '"host" must be a non-empty string'],
    [{ command: '' }, '"command" must be a non-empty string'],
    [{ logMatches: [] }, '"logMatches" must be a non-empty string'],
    [{ logMatches: ['a', ''] }, '"logMatches" must be a non-empty string'],
    [{ port: 80, timeout: 0 }, '"timeout" must be an integer from 1 to'],
    [{ port: 80, timeout: 2 ** 31 }, '"timeout" must be an integer from 1 to'],
    [{ port: 80, interval: 1.5 }, '"interval" must be an integer from 1 to'],
  ])('rejects %j', (readyWhen, reason) => {
    expect(() => normalizeReadyWhen(readyWhen as any, 'app:serve')).toThrow(
      `Task "app:serve" has an invalid "readyWhen": ${reason}`
    );
  });
});

describe('getReadyProducerIds', () => {
  function task(id: string, continuous = false): Task {
    const [project, target] = id.split(':');
    return {
      id,
      target: { project, target },
      overrides: {},
      outputs: [],
      cache: false,
      parallelism: true,
      continuous,
    };
  }

  function graph(
    e2eTarget: TargetConfiguration,
    serveProjects: string[] = ['app']
  ): { projectGraph: ProjectGraph; taskGraph: TaskGraph } {
    const nodes: ProjectGraph['nodes'] = {
      e2e: {
        name: 'e2e',
        type: 'app',
        data: { root: 'e2e', targets: { e2e: e2eTarget } },
      },
    };
    const taskGraph: TaskGraph = {
      tasks: { 'e2e:e2e': task('e2e:e2e') },
      dependencies: { 'e2e:e2e': [] },
      continuousDependencies: { 'e2e:e2e': [] },
      roots: ['e2e:e2e'],
    };
    for (const project of serveProjects) {
      nodes[project] = {
        name: project,
        type: 'app',
        data: {
          root: project,
          targets: { serve: { continuous: true }, 'serve-static': {} },
        },
      };
      const id = `${project}:serve`;
      taskGraph.tasks[id] = task(id, true);
      taskGraph.dependencies[id] = [];
      taskGraph.continuousDependencies[id] = [];
      taskGraph.continuousDependencies['e2e:e2e'].push(id);
    }
    return {
      projectGraph: {
        nodes,
        dependencies: {
          e2e: serveProjects.map((p) => ({
            source: 'e2e',
            target: p,
            type: 'static',
          })),
        },
      },
      taskGraph,
    };
  }

  function readyProducers(
    e2eTarget: TargetConfiguration,
    serveProjects?: string[]
  ) {
    const { projectGraph, taskGraph } = graph(e2eTarget, serveProjects);
    return getReadyProducerIds(
      taskGraph.tasks['e2e:e2e'],
      taskGraph,
      projectGraph
    );
  }

  it('returns nothing when no entry asks for ready', () => {
    expect(
      readyProducers({
        dependsOn: [
          { projects: ['app'], target: 'serve' },
          { projects: ['app'], target: 'serve', waitFor: 'started' },
          '^serve',
        ],
      })
    ).toEqual([]);
  });

  it('matches a projects entry', () => {
    expect(
      readyProducers(
        {
          dependsOn: [
            { projects: ['app'], target: 'serve', waitFor: 'ready' },
            { projects: ['api'], target: 'serve' },
          ],
        },
        ['app', 'api']
      )
    ).toEqual(['app:serve']);
  });

  it('lets any matching ready entry win', () => {
    expect(
      readyProducers({
        dependsOn: [
          { projects: ['app'], target: 'serve' },
          { dependencies: true, target: 'serve', waitFor: 'ready' },
        ],
      })
    ).toEqual(['app:serve']);
  });

  it('matches a dependencies entry through a dependency without the target', () => {
    const { projectGraph, taskGraph } = graph(
      {
        dependsOn: [{ dependencies: true, target: 'serve', waitFor: 'ready' }],
      },
      ['app']
    );
    projectGraph.nodes.lib = {
      name: 'lib',
      type: 'lib',
      data: { root: 'lib', targets: {} },
    };
    projectGraph.dependencies.e2e = [
      { source: 'e2e', target: 'lib', type: 'static' },
    ];
    projectGraph.dependencies.lib = [
      { source: 'lib', target: 'app', type: 'static' },
    ];
    expect(
      getReadyProducerIds(taskGraph.tasks['e2e:e2e'], taskGraph, projectGraph)
    ).toEqual(['app:serve']);
  });

  describe('with a task graph the builder resolved', () => {
    const serve = { executor: 'nx:run-commands', continuous: true };
    const build = { executor: 'nx:run-commands' };

    function readyProducersFromBuilder(
      dependsOn: TargetConfiguration['dependsOn'],
      targets: Record<string, Record<string, TargetConfiguration>>,
      dependencies: Record<string, string[]>
    ) {
      const projectGraph: ProjectGraph = { nodes: {}, dependencies: {} };
      for (const [name, projectTargets] of Object.entries(targets)) {
        projectGraph.nodes[name] = {
          name,
          type: 'lib',
          data: { root: name, targets: projectTargets },
        };
        projectGraph.dependencies[name] = (dependencies[name] ?? []).map(
          (target) => ({ source: name, target, type: 'static' })
        );
      }
      projectGraph.nodes.e2e.data.targets.e2e = { ...build, dependsOn };
      const taskGraph = createTaskGraph(
        projectGraph,
        {},
        ['e2e'],
        ['e2e'],
        undefined,
        {}
      );
      return {
        edges: taskGraph.continuousDependencies['e2e:e2e'],
        ready: getReadyProducerIds(
          taskGraph.tasks['e2e:e2e'],
          taskGraph,
          projectGraph
        ),
      };
    }

    it('keeps an edge another entry reached through a dependency without its target', () => {
      expect(
        readyProducersFromBuilder(
          ['^build', { dependencies: true, target: 'serve', waitFor: 'ready' }],
          { e2e: {}, lib: { serve }, app: { build, serve } },
          { e2e: ['lib'], lib: ['app'] }
        )
      ).toEqual({
        edges: ['app:serve', 'lib:serve'],
        ready: ['app:serve', 'lib:serve'],
      });
    });

    it('keeps a self edge reached through a project cycle', () => {
      expect(
        readyProducersFromBuilder(
          [{ dependencies: true, target: 'serve', waitFor: 'ready' }],
          { e2e: { serve }, lib: {} },
          { e2e: ['lib'], lib: ['e2e'] }
        )
      ).toEqual({ edges: ['e2e:serve'], ready: ['e2e:serve'] });
    });

    it('lets projects win over dependencies in one entry, as the builder does', () => {
      expect(
        readyProducersFromBuilder(
          [
            {
              projects: ['app'],
              dependencies: true,
              target: 'serve',
              waitFor: 'ready',
            },
            { projects: ['lib'], target: 'serve' },
          ],
          { e2e: {}, lib: { serve }, app: { serve } },
          { e2e: ['lib'] }
        )
      ).toEqual({ edges: ['app:serve', 'lib:serve'], ready: ['app:serve'] });
    });

    it('leaves a started edge alone when a ready entry stops at a closer dependency', () => {
      expect(
        readyProducersFromBuilder(
          [
            { dependencies: true, target: 'serve', waitFor: 'ready' },
            { projects: ['app'], target: 'serve' },
          ],
          { e2e: {}, lib: { serve }, app: { serve } },
          { e2e: ['lib'], lib: ['app'] }
        )
      ).toEqual({ edges: ['lib:serve', 'app:serve'], ready: ['lib:serve'] });
    });

    it('waits for ready where a project cycle makes the builder keep the edge through a plain entry', () => {
      // The builder drops the placeholder chain on the cycle, so only the
      // plain entry keeps app:serve; the ready entry still reaches app
      expect(
        readyProducersFromBuilder(
          [
            { dependencies: true, target: 'serve', waitFor: 'ready' },
            { projects: ['app'], target: 'serve' },
          ],
          { e2e: {}, lib: {}, app: { serve } },
          { e2e: ['lib'], lib: ['e2e', 'app'] }
        )
      ).toEqual({ edges: ['app:serve'], ready: ['app:serve'] });
    });
  });

  it('matches a wildcard target', () => {
    expect(
      readyProducers({
        dependsOn: [{ projects: ['app'], target: 'serve*', waitFor: 'ready' }],
      })
    ).toEqual(['app:serve']);
  });
});
