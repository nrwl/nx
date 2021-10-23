import { assign } from '@xstate/immer';
import { Machine } from 'xstate';
import { customSelectedStateConfig } from './custom-selected.state';
import { focusedStateConfig } from './focused.state';
import { DepGraphContext, DepGraphEvents, DepGraphSchema } from './interfaces';
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
};

export const depGraphMachine = Machine<
  DepGraphContext,
  DepGraphSchema,
  DepGraphEvents
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
        actions: assign((ctx, event) => {
          ctx.projects = event.projects;
          ctx.affectedProjects = event.affectedProjects;
          ctx.dependencies = event.dependencies;
        }),
      },

      selectProject: {
        target: 'customSelected',
        actions: [
          assign((ctx, event) => {
            ctx.selectedProjects.push(event.projectName);
          }),
        ],
      },
      selectAll: {
        target: 'customSelected',
        actions: [
          assign((ctx) => {
            ctx.selectedProjects = ctx.projects.map((project) => project.name);
          }),
        ],
      },
      selectAffected: {
        target: 'customSelected',
        actions: [
          assign((ctx) => {
            ctx.selectedProjects = ctx.affectedProjects;
          }),
        ],
      },
      deselectProject: [
        {
          target: 'unselected',
          cond: 'deselectLastProject',
        },
        {
          target: 'customSelected',
          actions: [
            assign((ctx, event) => {
              const index = ctx.selectedProjects.findIndex(
                (project) => project === event.projectName
              );

              ctx.selectedProjects.splice(index, 1);
            }),
          ],
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
          assign((ctx, event: any) => {
            ctx.groupByFolder = event.groupByFolder;
          }),
        ],
      },
      setIncludeProjectsByPath: {
        actions: [
          assign((ctx, event) => {
            ctx.includePath = event.includeProjectsByPath;
          }),
        ],
      },
      setSearchDepth: {
        actions: [
          assign((ctx, event) => {
            ctx.searchDepth = event.searchDepth;
          }),
        ],
      },
      incrementSearchDepth: {
        actions: [
          assign((ctx) => {
            ctx.searchDepth = ctx.searchDepth + 1;
          }),
        ],
      },
      decrementSearchDepth: {
        actions: [
          assign((ctx) => {
            ctx.searchDepth = ctx.searchDepth - 1;
          }),
        ],
      },
      setSearchDepthEnabled: {
        actions: [
          assign((ctx, event) => {
            ctx.searchDepthEnabled = event.searchDepthEnabled;
          }),
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
  }
);
