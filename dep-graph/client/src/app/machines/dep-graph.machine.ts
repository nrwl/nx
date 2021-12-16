import { assign } from '@xstate/immer';
import { Machine, send, spawn } from 'xstate';
import { getGraphService } from './graph.service';
import { customSelectedStateConfig } from './custom-selected.state';
import { focusedStateConfig } from './focused.state';
import {
  DepGraphContext,
  DepGraphUIEvents,
  DepGraphSchema,
} from './interfaces';
import { textFilteredStateConfig } from './text-filtered.state';
import { unselectedStateConfig } from './unselected.state';

export const initialContext: DepGraphContext = {
  projects: [],
  dependencies: {},
  affectedProjects: [],
  selectedProjects: [],
  focusedProject: null,
  textFilter: '',
  includePath: false,
  searchDepth: 1,
  searchDepthEnabled: false,
  groupByFolder: false,
  workspaceLayout: {
    libsDir: '',
    appsDir: '',
  },
  graph: null,
  lastPerfReport: {
    numEdges: 0,
    numNodes: 0,
    renderTime: 0,
  },
};

const graphActor = (callback, receive) => {
  const graphService = getGraphService();

  receive((e) => {
    const { selectedProjectNames, perfReport } = graphService.handleEvent(e);
    callback({
      type: 'setSelectedProjectsFromGraph',
      selectedProjectNames,
      perfReport,
    });
  });
};

export const depGraphMachine = Machine<
  DepGraphContext,
  DepGraphSchema,
  DepGraphUIEvents
>(
  {
    id: 'DepGraph',
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {},
      unselected: unselectedStateConfig,
      customSelected: customSelectedStateConfig,
      focused: focusedStateConfig,
      textFiltered: textFilteredStateConfig,
    },
    on: {
      initGraph: {
        target: 'unselected',
        actions: [
          'setGraph',
          send(
            (ctx, event) => ({
              type: 'notifyGraphInitGraph',
              projects: ctx.projects,
              dependencies: ctx.dependencies,
              affectedProjects: ctx.affectedProjects,
              workspaceLayout: ctx.workspaceLayout,
              groupByFolder: ctx.groupByFolder,
            }),
            {
              to: (context) => context.graph,
            }
          ),
        ],
      },
      setSelectedProjectsFromGraph: {
        actions: assign((ctx, event) => {
          ctx.selectedProjects = event.selectedProjectNames;
          ctx.lastPerfReport = event.perfReport;
        }),
      },
      selectProject: {
        target: 'customSelected',
        actions: ['notifyGraphShowProject'],
      },
      selectAll: {
        target: 'customSelected',
        actions: ['notifyGraphShowAllProjects'],
      },
      selectAffected: {
        target: 'customSelected',
        actions: ['notifyGraphShowAffectedProjects'],
      },
      deselectProject: [
        {
          target: 'unselected',
          cond: 'deselectLastProject',
        },
        {
          target: 'customSelected',
          actions: ['notifyGraphHideProject'],
        },
      ],
      deselectAll: {
        target: 'unselected',
      },
      focusProject: {
        target: 'focused',
      },
      setGroupByFolder: {
        actions: [
          'setGroupByFolder',
          send(
            (ctx, event) => ({
              type: 'notifyGraphUpdateGraph',
              projects: ctx.projects,
              dependencies: ctx.dependencies,
              affectedProjects: ctx.affectedProjects,
              workspaceLayout: ctx.workspaceLayout,
              groupByFolder: ctx.groupByFolder,
              selectedProjects: ctx.selectedProjects,
            }),
            {
              to: (context) => context.graph,
            }
          ),
        ],
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
      filterByText: {
        target: 'textFiltered',
      },
    },
  },
  {
    guards: {
      deselectLastProject: (ctx) => {
        return ctx.selectedProjects.length <= 1;
      },
    },
    actions: {
      setGroupByFolder: assign((ctx, event) => {
        if (event.type !== 'setGroupByFolder') return;

        ctx.groupByFolder = event.groupByFolder;
      }),
      incrementSearchDepth: assign((ctx) => {
        ctx.searchDepthEnabled = true;
        ctx.searchDepth = ctx.searchDepth + 1;
      }),
      decrementSearchDepth: assign((ctx) => {
        ctx.searchDepthEnabled = true;
        ctx.searchDepth = ctx.searchDepth > 1 ? ctx.searchDepth - 1 : 1;
      }),
      setSearchDepthEnabled: assign((ctx, event) => {
        if (event.type !== 'setSearchDepthEnabled') return;

        ctx.searchDepthEnabled = event.searchDepthEnabled;
      }),
      setIncludeProjectsByPath: assign((ctx, event) => {
        if (event.type !== 'setIncludeProjectsByPath') return;

        ctx.includePath = event.includeProjectsByPath;
      }),
      setGraph: assign((ctx, event) => {
        if (event.type !== 'initGraph' && event.type !== 'updateGraph') return;

        ctx.projects = event.projects;
        ctx.dependencies = event.dependencies;
        ctx.graph = spawn(graphActor, 'graphActor');

        if (event.type === 'initGraph') {
          ctx.workspaceLayout = event.workspaceLayout;
          ctx.affectedProjects = event.affectedProjects;
        }
      }),
      notifyGraphShowProject: send(
        (context, event) => {
          if (event.type !== 'selectProject') return;

          return {
            type: 'notifyGraphShowProject',
            projectName: event.projectName,
          };
        },
        {
          to: (context) => context.graph,
        }
      ),
      notifyGraphHideProject: send(
        (context, event) => {
          if (event.type !== 'deselectProject') return;

          return {
            type: 'notifyGraphHideProject',
            projectName: event.projectName,
          };
        },
        {
          to: (context) => context.graph,
        }
      ),
      notifyGraphShowAllProjects: send(
        (context, event) => ({
          type: 'notifyGraphShowAllProjects',
        }),
        {
          to: (context) => context.graph,
        }
      ),
      notifyGraphHideAllProjects: send(
        (context, event) => ({
          type: 'notifyGraphHideAllProjects',
        }),
        {
          to: (context) => context.graph,
        }
      ),
      notifyGraphShowAffectedProjects: send(
        {
          type: 'notifyGraphShowAffectedProjects',
        },
        {
          to: (ctx) => ctx.graph,
        }
      ),
      notifyGraphFocusProject: send(
        (context, event) => ({
          type: 'notifyGraphFocusProject',
          projectName: context.focusedProject,
          searchDepth: context.searchDepthEnabled ? context.searchDepth : -1,
        }),
        {
          to: (context) => context.graph,
        }
      ),
      notifyGraphFilterProjectsByText: send(
        (context, event) => ({
          type: 'notifyGraphFilterProjectsByText',
          search: context.textFilter,
          includeProjectsByPath: context.includePath,
          searchDepth: context.searchDepthEnabled ? context.searchDepth : -1,
        }),
        {
          to: (context) => context.graph,
        }
      ),
    },
  }
);
