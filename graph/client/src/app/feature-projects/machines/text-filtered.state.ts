import { assign } from '@xstate/immer';
import { send } from 'xstate';
import { ProjectGraphStateNodeConfig } from './interfaces';

export const textFilteredStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'filterByText') return;

      ctx.textFilter = event.search;
    }),
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
      actions: ['setIncludeProjectsByPath'],
    },
    incrementSearchDepth: {
      actions: ['incrementSearchDepth'],
    },
    decrementSearchDepth: {
      actions: ['decrementSearchDepth'],
    },
    setSearchDepthEnabled: {
      actions: ['setSearchDepthEnabled'],
    },
    updateGraph: {
      actions: ['setGraph'],
    },
  },
};
