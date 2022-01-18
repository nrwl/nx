import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { DepGraphStateNodeConfig } from './interfaces';

export const textFilteredStateConfig: DepGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'filterByText') return;

      ctx.textFilter = event.search;
    }),
    'notifyGraphFilterProjectsByText',
  ],
  on: {
    clearTextFilter: {
      target: 'unselected',
      actions: assign((ctx) => {
        ctx.includePath = false;
        ctx.textFilter = '';
      }),
    },
    setIncludeProjectsByPath: {
      actions: ['setIncludeProjectsByPath', 'notifyGraphFilterProjectsByText'],
    },
    incrementSearchDepth: {
      actions: ['incrementSearchDepth', 'notifyGraphFilterProjectsByText'],
    },
    decrementSearchDepth: {
      actions: ['decrementSearchDepth', 'notifyGraphFilterProjectsByText'],
    },
    setSearchDepthEnabled: {
      actions: ['setSearchDepthEnabled', 'notifyGraphFilterProjectsByText'],
    },
    updateGraph: {
      actions: [
        'setGraph',
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
        'notifyGraphFilterProjectsByText',
      ],
    },
  },
};
