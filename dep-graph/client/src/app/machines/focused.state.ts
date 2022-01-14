import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { DepGraphStateNodeConfig } from './interfaces';

export const focusedStateConfig: DepGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'focusProject') return;

      ctx.focusedProject = event.projectName;
    }),
    send(
      (ctx, event) => {
        if (event.type !== 'focusProject') return;

        return {
          type: 'notifyRouteFocusProject',
          focusedProject: event.projectName,
        };
      },
      {
        to: (context) => context.routeSetterActor,
      }
    ),
    'notifyGraphFocusProject',
  ],
  exit: [
    assign((ctx) => {
      ctx.focusedProject = null;
    }),
    'notifyRouteUnfocusProject',
  ],
  on: {
    incrementSearchDepth: {
      actions: [
        'incrementSearchDepth',
        'notifyGraphFocusProject',
        'notifyRouteSearchDepth',
      ],
    },
    decrementSearchDepth: {
      actions: [
        'decrementSearchDepth',
        'notifyGraphFocusProject',
        'notifyRouteSearchDepth',
      ],
    },
    setSearchDepthEnabled: {
      actions: [
        'setSearchDepthEnabled',
        'notifyGraphFocusProject',
        'notifyRouteSearchDepth',
      ],
    },
    setSearchDepth: {
      actions: [
        'setSearchDepth',
        'notifyGraphFocusProject',
        'notifyRouteSearchDepth',
      ],
    },
    unfocusProject: {
      target: 'unselected',
      actions: ['notifyRouteUnfocusProject'],
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
        'notifyGraphFocusProject',
      ],
    },
  },
};
