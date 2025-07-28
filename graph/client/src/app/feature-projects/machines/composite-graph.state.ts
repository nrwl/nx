import { ProjectGraphStateNodeConfig } from './interfaces';
import { assign } from '@xstate/immer';
import { send } from 'xstate';

export const compositeGraphStateConfig: ProjectGraphStateNodeConfig = {
  entry: [],
  exit: [],
  on: {
    // focusProject: {
    //   actions: [
    //     assign((ctx, event) => {
    //       if (event.type !== 'focusProject') return;
    //       ctx.focusedProject = event.projectName;
    //     }),
    //   ],
    // },
    // unfocusProject: {
    //   actions: [
    //     assign((ctx, event) => {
    //       if (event.type !== 'unfocusProject') return;
    //       ctx.focusedProject = null;
    //     }),
    //     send((ctx) => ({
    //       type: 'enableCompositeGraph',
    //       context: ctx.compositeGraph.context,
    //     })),
    //   ],
    // },
    // deselectProject: {
    //   actions: [],
    // },
    // selectProject: {
    //   actions: [],
    // },
    selectExpansion: {
      actions: [
        assign((ctx, event) => {
          ctx.selectingNodeToExpand = event.compositeNodeData;
        }),
      ],
    },
    expandCompositeNode: {
      actions: [
        assign((ctx) => {
          ctx.selectingNodeToExpand = null;
        }),
        send((_, event) => event, { to: (ctx) => ctx.graphActor }),
      ],
    },
  },
};
