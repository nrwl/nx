import { assign } from '@xstate/immer';
import { createMachine, send, spawn } from 'xstate';
import { customSelectedStateConfig } from './custom-selected.state';
import { focusedStateConfig } from './focused.state';
import { graphClientActor } from './graph.actor';
import { textFilteredStateConfig } from './text-filtered.state';
import { tracingStateConfig } from './tracing.state';
import { unselectedStateConfig } from './unselected.state';
import { ProjectGraphContext, ProjectGraphMachineEvents } from './interfaces';
import { compositeGraphStateConfig } from './composite-graph.state';

// Define the set of events that should be forwarded to graphActor
export const GRAPH_CLIENT_EVENTS = new Set([
  'initGraph',
  'updateGraph',
  'showAll',
  'hideAll',
  'showAffected',
  'showNonAffected',
  'toggleGroupByFolder',
  'toggleCollapseEdges',
  'toggleShowOnlyExternalDependencies',
  'expandCompositeNode',
  'collapseCompositeNode',
  'excludeNode',
  'includeNode',
  'resetGraph',
  'selectNode',
  'focusNode',
  'removeFocus',
  'toggleNodeDependencies',
  'toggleNodeDependents',
  'updateTransitiveDepth',
  'trace',
  'toggleCompositeGraph',
  'ThemeChange',
  'RankDirChange',
  'ResetLayout',
]);

export const initialContext: ProjectGraphContext = {
  projects: [],
  dependencies: {},
  affectedProjects: [],
  selectedProjects: [],
  focusedProject: null,
  textFilter: '',
  includePath: false,
  searchDepth: 1,
  searchDepthEnabled: true,
  groupByFolder: false,
  collapseEdges: false,
  workspaceLayout: {
    libsDir: '',
    appsDir: '',
  },
  fileMap: {},
  graphActor: null,
  lastPerfReport: {
    numEdges: 0,
    numNodes: 0,
    renderTime: 0,
  },
  tracing: {
    start: null,
    end: null,
    algorithm: 'shortest',
  },
  compositeGraph: {
    enabled: false,
    nodes: [],
  },
};

export const projectGraphMachine = createMachine<
  ProjectGraphContext,
  ProjectGraphMachineEvents
>(
  {
    predictableActionArguments: true,
    id: 'project-graph',
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {},
      unselected: unselectedStateConfig,
      customSelected: customSelectedStateConfig,
      focused: focusedStateConfig,
      textFiltered: textFilteredStateConfig,
      tracing: tracingStateConfig,
      composite: compositeGraphStateConfig,
    },
    on: {
      setGraphClient: {
        actions: [
          assign((ctx, event) => {
            ctx.graphActor = spawn(
              graphClientActor(event.graphClient),
              'projectGraphClientActor'
            );
          }),
        ],
      },
      setGraphClientState: {
        actions: [
          assign((ctx, event) => {
            ctx.collapseEdges = event.state.renderScratchData.collapseEdges;
            ctx.groupByFolder = event.state.renderScratchData.groupByFolder;
            ctx.compositeGraph.enabled =
              event.state.renderScratchData.isComposite;
          }),
        ],
      },
      initGraph: {
        target: 'unselected',
        actions: ['sendToGraphActor'],
      },
      hideAll: {
        target: 'unselected',
        actions: ['sendToGraphActor'],
      },
      showAll: {
        target: 'customSelected',
        actions: ['sendToGraphActor'],
      },
      toggleCompositeGraph: {
        target: 'composite',
      },
      focusNode: {
        target: 'focused',
        actions: ['sendToGraphActor'],
      },
      filter: {
        target: 'textFiltered',
        actions: [
          send(
            (ctx, event) => ({
              type: 'filter',
              filterBy: event.filterBy,
              includeEdges: event.includeEdges || ctx.includePath,
            }),
            { to: (ctx) => ctx.graphActor }
          ),
        ],
      },
      selectProject: {
        target: 'customSelected',
      },
      selectProjects: {
        target: 'customSelected',
      },
      selectAll: {
        target: 'customSelected',
      },
      selectAffected: {
        target: 'customSelected',
      },
      deselectProject: [
        {
          target: 'unselected',
          cond: 'deselectLastProject',
        },
        {
          target: 'customSelected',
        },
      ],
      deselectProjects: [
        {
          target: 'unselected',
          cond: 'deselectLastProject',
        },
        {
          target: 'customSelected',
        },
      ],
      deselectAll: {
        target: 'unselected',
      },
      focusProject: {
        target: 'focused',
      },
      setTracingStart: {
        target: 'tracing',
      },
      setCollapseEdges: {
        actions: ['setCollapseEdges'],
      },
      setGroupByFolder: {
        actions: ['setGroupByFolder'],
      },
      setIncludeProjectsByPath: {
        actions: [
          assign((ctx, event) => {
            ctx.includePath = event.includeProjectsByPath;
          }),
        ],
      },
      incrementSearchDepth: {
        actions: ['incrementSearchDepth'],
      },
      decrementSearchDepth: {
        actions: ['decrementSearchDepth'],
      },
      setSearchDepthEnabled: {
        actions: ['setSearchDepthEnabled'],
      },
      setSearchDepth: {
        actions: ['setSearchDepth'],
      },
      filterByText: {
        target: 'textFiltered',
      },
      enableCompositeGraph: {
        target: 'composite',
      },
      '*': {
        cond: 'isGraphClientEvent',
        actions: ['sendToGraphActor'],
      },
    },
  },
  {
    guards: {
      deselectLastProject: (ctx) => {
        return ctx.selectedProjects.length <= 1;
      },
      isCompositeGraphEnabled: (ctx) => {
        return ctx.compositeGraph.enabled;
      },
      isGraphClientEvent: (ctx, event) => {
        return GRAPH_CLIENT_EVENTS.has(event.type) && ctx.graphActor !== null;
      },
    },
    actions: {
      setGroupByFolder: assign((ctx, event) => {
        if (event.type !== 'setGroupByFolder') return;

        ctx.groupByFolder = event.groupByFolder;
      }),
      setCollapseEdges: assign((ctx, event) => {
        if (event.type !== 'setCollapseEdges') return;

        ctx.collapseEdges = event.collapseEdges;
      }),
      incrementSearchDepth: assign((ctx) => {
        ctx.searchDepthEnabled = true;
        ctx.searchDepth = ctx.searchDepth + 1;
      }),
      decrementSearchDepth: assign((ctx) => {
        ctx.searchDepthEnabled = true;
        ctx.searchDepth = ctx.searchDepth > 1 ? ctx.searchDepth - 1 : 1;
      }),
      setSearchDepth: assign((ctx, event) => {
        if (event.type !== 'setSearchDepth') return;
        ctx.searchDepthEnabled = true;
        ctx.searchDepth = event.searchDepth > 1 ? event.searchDepth : 1;
      }),
      setSearchDepthEnabled: assign((ctx, event) => {
        if (event.type !== 'setSearchDepthEnabled') return;

        ctx.searchDepthEnabled = event.searchDepthEnabled;
      }),
      setIncludeProjectsByPath: assign((ctx, event) => {
        if (event.type !== 'setIncludeProjectsByPath') return;

        ctx.includePath = event.includeProjectsByPath;
      }),
      sendToGraphActor: send((_, event) => event, {
        to: (ctx) => ctx.graphActor,
      }),
    },
  }
);
