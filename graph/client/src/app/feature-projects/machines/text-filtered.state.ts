import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const textFilteredStateConfig: ProjectGraphStateNodeConfig = {
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
            fileMap: ctx.fileMap,
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
