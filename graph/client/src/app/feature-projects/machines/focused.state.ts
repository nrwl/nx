import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const focusedStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'focusProject') return;

      ctx.focusedProject = event.projectName;
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
    unfocusProject: {
      target: 'unselected',
    },
    updateGraph: {
      actions: ['setGraph'],
    },
  },
};
