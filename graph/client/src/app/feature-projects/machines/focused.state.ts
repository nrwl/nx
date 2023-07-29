import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const focusedStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'focusProject') return;

      ctx.focusedProject = event.projectName;
    }),
    'notifyGraphFocusProject',
  ],
  exit: [
    assign((ctx) => {
      ctx.focusedProject = null;
    }),
  ],
  on: {
    incrementSearchDepth: {
      actions: ['incrementSearchDepth', 'notifyGraphFocusProject'],
    },
    decrementSearchDepth: {
      actions: ['decrementSearchDepth', 'notifyGraphFocusProject'],
    },
    setSearchDepthEnabled: {
      actions: ['setSearchDepthEnabled', 'notifyGraphFocusProject'],
    },
    setSearchDepth: {
      actions: ['setSearchDepth', 'notifyGraphFocusProject'],
    },
    unfocusProject: {
      target: 'unselected',
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
        'notifyGraphFocusProject',
      ],
    },
  },
};
