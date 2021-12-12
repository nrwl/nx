import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { selectProjectsForFocusedProject } from '../util';
import { DepGraphStateNodeConfig } from './interfaces';

export const focusedStateConfig: DepGraphStateNodeConfig = {
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
            affectedProjects: ctx.affectedProjects,
            workspaceLayout: ctx.workspaceLayout,
            groupByFolder: ctx.groupByFolder,
            selectedProjects: ctx.selectedProjects,
          }),
          {
            to: (context) => context.graph,
          }
        ),
        'notifyGraphFocusProject',
      ],
    },
  },
};
