/** @jest-environment node */

import { GraphStateSerializer } from '@nx/graph';
import {
  ProjectElement,
  ProjectGraphEvent,
  ProjectGraphOrchestrator,
} from '@nx/graph/projects';
import { restoreProjectGraphState } from './restore-project-graph-state';

// Keep the real graph commands and Cytoscape model; only replace canvas drawing.
jest.mock('@nx/graph', () => ({
  ...jest.requireActual('@nx/graph'),
  GraphRenderer: jest
    .fn()
    .mockImplementation(
      (_container, platform, _nodeType, _processor, _layout, config) => {
        const cy = require('cytoscape')({ headless: true });
        return {
          rendererConfig: {
            theme: 'light',
            rankDir: 'TB',
            query: '',
            platform,
            ...config,
          },
          on: jest.fn(() => () => {}),
          handleConfigEvent: jest.fn(),
          setElementsAndRender: (elements = cy.collection()) => ({
            renderedElements: elements,
          }),
          destroy: () => cy.destroy(),
        };
      }
    ),
}));

describe('restoreProjectGraphState', () => {
  let orchestrator: ProjectGraphOrchestrator;
  let graph: Parameters<typeof restoreProjectGraphState>[1];
  const allProjects = ['core', 'demo', 'ui', 'unrelated'];
  const fullState = GraphStateSerializer.serialize({ c: { showMode: 'all' } });
  const focusedState = GraphStateSerializer.serialize({
    c: { dependencyDistance: 1 },
    s: { type: 'focused', nodeId: ProjectElement.makeId('project', 'demo') },
  });

  function visibleProjects() {
    return orchestrator.handleEventResult.projects
      .map((node) => node.name)
      .sort();
  }

  beforeEach(() => {
    orchestrator = new ProjectGraphOrchestrator(null, 'nx');
    graph = {
      send: (...events: ProjectGraphEvent[]) => {
        for (const event of events) orchestrator.handleEvent(event);
        return orchestrator.handleEventResult;
      },
      restoreGraphState: (state) =>
        orchestrator.handleEvent(
          {
            type: 'restoreState',
            state: orchestrator.stateSerializer.deserialize(state),
          },
          'restoration'
        ),
    };
    graph.send(
      {
        type: 'initGraph',
        projects: allProjects.map((name) => ({
          name,
          type: name === 'demo' ? 'app' : 'lib',
          data: { root: name },
        })),
        dependencies: {
          demo: [{ source: 'demo', target: 'ui', type: 'implicit' }],
          ui: [{ source: 'ui', target: 'core', type: 'implicit' }],
          core: [],
          unrelated: [],
        },
        affectedProjects: ['demo'],
      },
      {
        type: 'updateRendererConfig',
        updater: () => ({
          mode: 'individual',
          showMode: 'all',
          dependencyDistance: 1,
        }),
      },
      { type: 'showAll' }
    );
  });

  afterEach(() => orchestrator.destroy());

  it('restores all projects after focusing when showMode is unchanged', () => {
    expect(visibleProjects()).toEqual(allProjects);
    restoreProjectGraphState(focusedState, graph);
    expect(visibleProjects()).toEqual(['demo', 'ui']);

    const result = restoreProjectGraphState(fullState, graph);

    expect(result.state).toEqual({ type: 'default' });
    expect(visibleProjects()).toEqual(allProjects);
    expect(orchestrator.cy.nodes('[?focused]')).toHaveLength(0);
  });

  it.each([undefined, { type: 'default' }])(
    'restores an unfocused snapshot with state %s',
    (state) => {
      restoreProjectGraphState(focusedState, graph);
      const serialized = GraphStateSerializer.serialize({
        c: { ...orchestrator.renderer.rendererConfig },
        s: state,
      });

      restoreProjectGraphState(serialized, graph);

      expect(orchestrator.handleEventResult.state).toEqual({ type: 'default' });
      expect(visibleProjects()).toEqual(allProjects);
    }
  );

  it('restores hidden projects, including after repeated full restorations', () => {
    for (let i = 0; i < 2; i++) {
      graph.send({
        type: 'excludeNodes',
        nodeIds: [ProjectElement.makeId('project', 'unrelated')],
      });
      expect(visibleProjects()).toEqual(['core', 'demo', 'ui']);
      restoreProjectGraphState(fullState, graph);
      restoreProjectGraphState(fullState, graph);
      expect(visibleProjects()).toEqual(allProjects);
    }
  });

  it('preserves renderer preferences instead of resetting the graph configuration', () => {
    graph.send({
      type: 'updateRendererConfig',
      updater: () => ({
        groupByFolder: true,
        collapseEdges: true,
        rankDir: 'LR',
        theme: 'dark',
      }),
    });
    restoreProjectGraphState(focusedState, graph);

    restoreProjectGraphState(fullState, graph);

    expect(orchestrator.handleEventResult.rendererConfig).toMatchObject({
      groupByFolder: true,
      collapseEdges: true,
      rankDir: 'LR',
      theme: 'dark',
    });
    expect(visibleProjects()).toEqual(allProjects);
  });

  it('clears a stale filter and restores the query specified by a snapshot', () => {
    graph.send({ type: 'filter', query: 'demo' });
    restoreProjectGraphState(fullState, graph);
    expect(visibleProjects()).toEqual(allProjects);

    restoreProjectGraphState(
      GraphStateSerializer.serialize({ c: { query: 'unrelated' } }),
      graph
    );
    expect(visibleProjects()).toEqual(['unrelated']);
  });

  it('applies the restored show mode after clearing focus', () => {
    restoreProjectGraphState(focusedState, graph);
    restoreProjectGraphState(
      GraphStateSerializer.serialize({ c: { showMode: 'affected' } }),
      graph
    );
    expect(visibleProjects()).toEqual(['demo']);
    expect(orchestrator.handleEventResult.state).toEqual({ type: 'default' });
  });

  it('keeps focused snapshot restoration intact', () => {
    restoreProjectGraphState(focusedState, graph);
    restoreProjectGraphState(fullState, graph);
    restoreProjectGraphState(focusedState, graph);

    expect(visibleProjects()).toEqual(['demo', 'ui']);
    expect(orchestrator.handleEventResult.state).toEqual({
      type: 'focused',
      nodeId: ProjectElement.makeId('project', 'demo'),
    });
  });

  it('keeps intentional partial and no-op renderer configuration updates focused', () => {
    restoreProjectGraphState(focusedState, graph);
    graph.send({
      type: 'updateRendererConfig',
      updater: () => ({ showMode: 'all' }),
    });
    graph.send({
      type: 'updateRendererConfig',
      updater: () => ({ rankDir: 'LR' }),
    });

    expect(visibleProjects()).toEqual(['demo', 'ui']);
    expect(orchestrator.handleEventResult.state.type).toBe('focused');
    expect(orchestrator.handleEventResult.rendererConfig.rankDir).toBe('LR');
  });

  it('leaves the current graph intact for an unsupported snapshot version', () => {
    restoreProjectGraphState(focusedState, graph);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      restoreProjectGraphState(
        GraphStateSerializer.serialize({ c: {}, v: 99 }),
        graph
      )
    ).toBeUndefined();
    expect(visibleProjects()).toEqual(['demo', 'ui']);
    warning.mockRestore();
  });
});
