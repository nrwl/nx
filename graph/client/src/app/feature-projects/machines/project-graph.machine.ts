import { assign } from '@xstate/immer';
import { createMachine, send, spawn } from 'xstate';
import { customSelectedStateConfig } from './custom-selected.state';
import { focusedStateConfig } from './focused.state';
import { graphActor } from './graph.actor';
import { textFilteredStateConfig } from './text-filtered.state';
import { tracingStateConfig } from './tracing.state';
import { unselectedStateConfig } from './unselected.state';
import { ProjectGraphContext, ProjectGraphMachineEvents } from './interfaces';

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
    },
    on: {
      setProjects: {
        target: 'unselected',
        actions: [
          'setGraph',
          send(
            (ctx, event) => ({
              type: 'notifyGraphInitGraph',
              projects: ctx.projects,
              dependencies: ctx.dependencies,
              fileMap: ctx.fileMap,
              affectedProjects: ctx.affectedProjects,
              workspaceLayout: ctx.workspaceLayout,
              groupByFolder: ctx.groupByFolder,
              collapseEdges: ctx.collapseEdges,
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
        actions: ['notifyGraphShowProjects'],
      },
      selectProjects: {
        target: 'customSelected',
        actions: ['notifyGraphShowProjects'],
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
          actions: ['notifyGraphHideProjects'],
        },
      ],
      deselectProjects: [
        {
          target: 'unselected',
          cond: 'deselectLastProject',
        },
        {
          target: 'customSelected',
          actions: ['notifyGraphHideProjects'],
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
      setTracingEnd: {
        target: 'tracing',
      },
      setCollapseEdges: {
        actions: [
          'setCollapseEdges',
          send(
            (ctx, event) => ({
              type: 'notifyGraphUpdateGraph',
              projects: ctx.projects,
              dependencies: ctx.dependencies,
              affectedProjects: ctx.affectedProjects,
              fileMap: ctx.fileMap,
              workspaceLayout: ctx.workspaceLayout,
              groupByFolder: ctx.groupByFolder,
              collapseEdges: ctx.collapseEdges,
              selectedProjects: ctx.selectedProjects,
            }),
            {
              to: (context) => context.graphActor,
            }
          ),
        ],
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
              fileMap: ctx.fileMap,
              workspaceLayout: ctx.workspaceLayout,
              groupByFolder: ctx.groupByFolder,
              collapseEdges: ctx.collapseEdges,
              selectedProjects: ctx.selectedProjects,
            }),
            {
              to: (context) => context.graphActor,
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
      setSearchDepth: {
        actions: ['setSearchDepth'],
      },
      setTracingAlgorithm: {
        actions: [
          assign((ctx, event) => {
            ctx.tracing.algorithm = event.algorithm;
          }),
          'notifyGraphTracing',
        ],
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
      setGraph: assign((ctx, event) => {
        if (event.type !== 'setProjects' && event.type !== 'updateGraph')
          return;

        ctx.projects = event.projects;
        ctx.dependencies = event.dependencies;
        ctx.fileMap = event.fileMap;
        ctx.graphActor = spawn(graphActor, 'graphActor');
        // ctx.routeSetterActor = spawn(createRouteMachine(), {
        //   name: 'route',
        // });

        if (event.type === 'setProjects') {
          ctx.workspaceLayout = event.workspaceLayout;
          ctx.affectedProjects = event.affectedProjects;
        }
      }),
      notifyGraphTracing: send(
        (ctx, event) => {
          return {
            type: 'notifyGraphTracing',
            start: ctx.tracing.start,
            end: ctx.tracing.end,
            algorithm: ctx.tracing.algorithm,
          };
        },
        {
          to: (context) => context.graphActor,
        }
      ),

      notifyGraphShowProjects: send(
        (context, event) => {
          if (event.type !== 'selectProject' && event.type !== 'selectProjects')
            return;

          if (event.type === 'selectProject') {
            return {
              type: 'notifyGraphShowProjects',
              projectNames: [event.projectName],
            };
          } else {
            return {
              type: 'notifyGraphShowProjects',
              projectNames: event.projectNames,
            };
          }
        },
        {
          to: (context) => context.graphActor,
        }
      ),
      notifyGraphHideProjects: send(
        (context, event) => {
          if (
            event.type !== 'deselectProject' &&
            event.type !== 'deselectProjects'
          )
            return;

          if (event.type === 'deselectProject') {
            return {
              type: 'notifyGraphHideProjects',
              projectNames: [event.projectName],
            };
          } else {
            return {
              type: 'notifyGraphHideProjects',
              projectNames: event.projectNames,
            };
          }
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
