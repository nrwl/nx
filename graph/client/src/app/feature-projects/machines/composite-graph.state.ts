import { ProjectGraphStateNodeConfig } from './interfaces';
import { assign } from '@xstate/immer';
import { send } from 'xstate';

export const compositeGraphStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'enableCompositeGraph') return;
      ctx.compositeGraph.enabled = true;
      ctx.compositeGraph.context = event.context || undefined;
    }),
  ],
  exit: [
    assign((ctx) => {
      ctx.compositeGraph.enabled = false;
      ctx.compositeGraph.context = undefined;
    }),
  ],
  on: {
    selectAll: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'selectAll') return;
          ctx.compositeGraph.enabled = true;
          ctx.compositeGraph.context = null;
        }),
        send((ctx) => ({
          type: 'enableCompositeGraph',
          context: ctx.compositeGraph.context,
        })),
      ],
    },
    deselectAll: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'deselectAll') return;
          ctx.compositeGraph.enabled = true;
        }),
      ],
    },
    selectAffected: {
      actions: [],
    },
    focusProject: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'focusProject') return;
          ctx.focusedProject = event.projectName;
        }),
      ],
    },
    unfocusProject: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'unfocusProject') return;
          ctx.focusedProject = null;
        }),
        send((ctx) => ({
          type: 'enableCompositeGraph',
          context: ctx.compositeGraph.context,
        })),
      ],
    },
    deselectProject: {
      actions: [],
    },
    selectProject: {
      actions: [],
    },
    expandCompositeNode: {
      actions: [],
    },
    collapseCompositeNode: {
      actions: [],
    },
    enableCompositeGraph: {
      actions: [
        assign((ctx, event) => {
          if (event.type !== 'enableCompositeGraph') return;
          ctx.compositeGraph.enabled = true;
          ctx.compositeGraph.context = event.context || undefined;
          ctx.focusedProject = null;
        }),
      ],
    },
    disableCompositeGraph: {
      target: 'unselected',
    },
    updateGraph: {
      actions: ['setGraph'],
    },
  },
};
