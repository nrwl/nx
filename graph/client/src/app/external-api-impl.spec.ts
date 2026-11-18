/** @jest-environment node */

import { ProjectElement, ProjectGraphOrchestrator } from '@nx/graph/projects';
import { ExternalApiService } from '@nx/graph-shared';
import { ExternalApiImpl } from './external-api-impl';
import { getRouter } from './get-router';

jest.mock('./get-router', () => ({ getRouter: jest.fn() }));
jest.mock('@nx/graph-shared', () => ({
  ...jest.requireActual('../../../shared/src/lib/external-api'),
  ...jest.requireActual('../../../shared/src/lib/external-api-service'),
}));

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

describe('ExternalApiImpl.selectAllProjects', () => {
  let orchestrator: ProjectGraphOrchestrator;
  let api: ExternalApiImpl;
  let navigate: jest.Mock;
  const allProjects = ['core', 'demo', 'ui', 'unrelated'];

  function visibleProjects() {
    return orchestrator.handleEventResult.projects
      .map((node) => node.name)
      .sort();
  }

  function serializedState() {
    return orchestrator.stateSerializer.serialize({
      c: orchestrator.renderer.rendererConfig,
      s: orchestrator.handleEventResult.state,
    });
  }

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
    });
    orchestrator = new ProjectGraphOrchestrator(null, 'nx-console');
    orchestrator.handleEvent({
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
    });
    orchestrator.handleEvent({
      type: 'updateRendererConfig',
      updater: () => ({
        mode: 'individual',
        showMode: 'all',
        dependencyDistance: 1,
      }),
    });
    orchestrator.handleEvent({ type: 'showAll' });
    // Model the existing URL restoration used by focusProject.
    navigate = jest.fn((url: string) => {
      const state = new URL(url, 'http://localhost').searchParams.get('graph');
      orchestrator.handleEvent(
        {
          type: 'restoreState',
          state: orchestrator.stateSerializer.deserialize(state),
        },
        'restoration'
      );
    });
    jest.mocked(getRouter).mockReturnValue({ navigate });
    api = new ExternalApiImpl();
    api.externalApiService = new ExternalApiService();
    api.externalApiService.sendProjectGraphEvent = (event) =>
      orchestrator.handleEvent(event);
  });

  afterEach(() => {
    orchestrator.destroy();
    Reflect.deleteProperty(globalThis, 'window');
  });

  it('restores all projects and clears focus without navigating', () => {
    expect(visibleProjects()).toEqual(allProjects);
    api.focusProject('demo');
    expect(visibleProjects()).toEqual(['demo', 'ui']);
    expect(orchestrator.handleEventResult.state.type).toBe('focused');
    navigate.mockClear();

    api.selectAllProjects();

    expect(visibleProjects()).toEqual(allProjects);
    expect(orchestrator.handleEventResult.state).toEqual({ type: 'default' });
    expect(orchestrator.cy.nodes('[?focused]')).toHaveLength(0);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('restores manually hidden projects on repeated calls with unchanged serialized state', () => {
    api.selectAllProjects();
    const initialState = serializedState();
    for (const name of ['unrelated', 'core']) {
      orchestrator.handleEvent({
        type: 'excludeNodes',
        nodeIds: [ProjectElement.makeId('project', name)],
      });
      expect(visibleProjects()).toEqual(
        allProjects.filter((project) => project !== name)
      );
      expect(serializedState()).toBe(initialState);

      api.selectAllProjects();
      api.selectAllProjects();

      expect(visibleProjects()).toEqual(allProjects);
      expect(serializedState()).toBe(initialState);
    }
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the selected project', () => {
    orchestrator.handleEvent({
      type: 'selectNode',
      nodeId: ProjectElement.makeId('project', 'demo'),
    });
    expect(orchestrator.cy.elements('[?selected]')).toHaveLength(1);
    jest.mocked(orchestrator.renderer.handleConfigEvent).mockClear();

    api.selectAllProjects();

    expect(orchestrator.cy.elements('[?selected]')).toHaveLength(0);
    expect(orchestrator.renderer.handleConfigEvent).toHaveBeenCalledWith({
      type: 'clearSelectedElements',
    });
    expect(visibleProjects()).toEqual(allProjects);
  });

  it('restores an empty graph and clears its search filter', () => {
    orchestrator.handleEvent({ type: 'filter', query: 'demo' });
    expect(visibleProjects()).toEqual(['demo']);
    orchestrator.handleEvent({ type: 'hideAll' });
    expect(visibleProjects()).toEqual([]);

    api.selectAllProjects();

    expect(visibleProjects()).toEqual(allProjects);
    expect(orchestrator.handleEventResult.rendererConfig.query).toBe('');
    expect(orchestrator.renderer.handleConfigEvent).toHaveBeenCalledWith({
      type: 'clearSelectedElements',
    });
    expect(orchestrator.cy.elements('[?selected]')).toHaveLength(0);
  });

  it('uses reset defaults while preserving ordinary renderer preferences', () => {
    orchestrator.handleEvent({
      type: 'updateRendererConfig',
      updater: () => ({
        groupByFolder: true,
        collapseEdges: true,
        showOnlyExternalDependencies: true,
        rankDir: 'LR',
        theme: 'dark',
        dependencyDistance: 2,
      }),
    });
    api.focusProject('demo');

    api.selectAllProjects();

    expect(orchestrator.handleEventResult.rendererConfig).toMatchObject({
      groupByFolder: false,
      collapseEdges: false,
      showOnlyExternalDependencies: false,
      rankDir: 'LR',
      theme: 'dark',
      dependencyDistance: 2,
      platform: 'nx-console',
      mode: 'individual',
      showMode: 'all',
    });
    expect(visibleProjects()).toEqual(allProjects);
  });
});
