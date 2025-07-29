import { assign } from '@xstate/immer';
import { ProjectGraphStateNodeConfig } from './interfaces';
import { send } from 'xstate';

export const compositeGraphStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      ctx.compositeGraph.enabled =
        event.type === 'toggleCompositeGraph' ? event.composite : true;
    }),
    send(
      (ctx) => ({
        type: 'toggleCompositeGraph',
        composite: ctx.compositeGraph.enabled,
      }),
      { to: (ctx) => ctx.graphActor }
    ),
  ],
  exit: [
    assign((ctx) => {
      ctx.compositeGraph.enabled = false;
    }),
    send(() => ({ type: 'toggleCompositeGraph', composite: false }), {
      to: (ctx) => ctx.graphActor,
    }),
    send(() => ({ type: 'showAll', autoExpand: false }), {
      to: (ctx) => ctx.graphActor,
    }),
  ],
  on: {
    showAll: {
      actions: ['sendToGraphActor'],
    },
    toggleCompositeGraph: {
      actions: [
        assign((ctx, event) => {
          ctx.compositeGraph.enabled = event.composite;
        }),
        'sendToGraphActor',
      ],
    },
  },
};
