import { assign } from '@xstate/immer';
import { Machine, send, spawn } from 'xstate';
import { customSelectedStateConfig } from './custom-selected.state';
import { focusedStateConfig } from './focused.state';
import { graphActor } from './graph.actor';
import {
  DepGraphContext,
  DepGraphSchema,
  DepGraphUIEvents,
} from './interfaces';
import { createRouteMachine } from './route-setter.machine';
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
  graphActor: null,
  routeSetterActor: null,
  routeListenerActor: null,
  lastPerfReport: {
    numEdges: 0,
    numNodes: 0,
    renderTime: 0,
  },
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
              to: (context) => context.graphActor,
            }
          ),
        ],
      },
      setSelectedProjectsFromGraph: {
        actions: [
          assign((ctx, event) => {
            ctx.selectedProjects = event.selectedProjectNames;
            ctx.lastPerfReport = event.perfReport;
          }),
        ],
      },
      selectProject: {
        target: 'customSelected',
        actions: ['notifyGraphShowProject'],
      },
      selectAll: {
        target: 'customSelected',
        actions: ['notifyGraphShowAllProjects', 'notifyRouteSelectAll'],
      },
      selectAffected: {
        target: 'customSelected',
        actions: [
          'notifyGraphShowAffectedProjects',
          'notifyRouteSelectAffected',
        ],
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
              to: (context) => context.graphActor,
            }
          ),
          send(
            (ctx, event) => {
              if (event.type !== 'setGroupByFolder') return;

              return {
                type: 'notifyRouteGroupByFolder',
                groupByFolder: event.groupByFolder,
              };
            },
            {
              to: (context) => context.routeSetterActor,
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
        actions: ['incrementSearchDepth', 'notifyRouteSearchDepth'],
      },
      decrementSearchDepth: {
        actions: ['decrementSearchDepth', 'notifyRouteSearchDepth'],
      },
      setSearchDepthEnabled: {
        actions: ['setSearchDepthEnabled', 'notifyRouteSearchDepth'],
      },
      setSearchDepth: {
        actions: ['setSearchDepth', 'notifyRouteSearchDepth'],
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
      selectActionCannotBePersistedToRoute: (ctx, event) => {
        return event.type !== 'selectAffected' && event.type !== 'selectAll';
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
      setGraph: assign((ctx, event) => {
        if (event.type !== 'initGraph' && event.type !== 'updateGraph') return;

        ctx.projects = event.projects;
        ctx.dependencies = event.dependencies;
        ctx.graphActor = spawn(graphActor, 'graphActor');
        ctx.routeSetterActor = spawn(createRouteMachine(), {
          name: 'route',
        });

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
          to: (context) => context.graphActor,
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
          to: (context) => context.graphActor,
        }
      ),
      notifyGraphShowAllProjects: send(
        (context, event) => ({
          type: 'notifyGraphShowAllProjects',
        }),
        {
          to: (context) => context.graphActor,
        }
      ),
      notifyGraphHideAllProjects: send(
        (context, event) => ({
          type: 'notifyGraphHideAllProjects',
        }),
        {
          to: (context) => context.graphActor,
        }
      ),
      notifyGraphShowAffectedProjects: send(
        {
          type: 'notifyGraphShowAffectedProjects',
        },
        {
          to: (ctx) => ctx.graphActor,
        }
      ),
      notifyGraphFocusProject: send(
        (context, event) => ({
          type: 'notifyGraphFocusProject',
          projectName: context.focusedProject,
          searchDepth: context.searchDepthEnabled ? context.searchDepth : -1,
        }),
        {
          to: (context) => context.graphActor,
        }
      ),
      notifyRouteUnfocusProject: send(
        () => ({
          type: 'notifyRouteUnfocusProject',
        }),
        {
          to: (ctx) => ctx.routeSetterActor,
        }
      ),
      notifyRouteSelectAll: send(
        () => ({
          type: 'notifyRouteSelectAll',
        }),
        {
          to: (ctx) => ctx.routeSetterActor,
        }
      ),
      notifyRouteSelectAffected: send(
        () => ({
          type: 'notifyRouteSelectAffected',
        }),
        {
          to: (ctx) => ctx.routeSetterActor,
        }
      ),
      notifyRouteClearSelect: send(
        () => ({
          type: 'notifyRouteClearSelect',
        }),
        {
          to: (ctx) => ctx.routeSetterActor,
        }
      ),
      notifyRouteSearchDepth: send(
        (ctx, event) => ({
          type: 'notifyRouteSearchDepth',
          searchDepth: ctx.searchDepth,
          searchDepthEnabled: ctx.searchDepthEnabled,
        }),

        {
          to: (ctx) => ctx.routeSetterActor,
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
          to: (context) => context.graphActor,
        }
      ),
    },
  }
);
