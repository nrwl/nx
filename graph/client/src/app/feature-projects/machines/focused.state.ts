import { assign } from '@xstate/immer';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const focusedStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'focusNode') return;
      ctx.focusedProject = event.nodeId;
    }),
  ],
  exit: [
    assign((ctx) => {
      ctx.focusedProject = null;
    }),
  ],
  on: {
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
    unfocusNode: {
      target: 'unselected',
    },
  },
};
