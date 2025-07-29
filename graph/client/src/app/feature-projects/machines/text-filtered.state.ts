import { assign } from '@xstate/immer';
import { ProjectGraphStateNodeConfig } from './interfaces';
import { send } from 'xstate';

export const textFilteredStateConfig: ProjectGraphStateNodeConfig = {
  entry: [
    assign((ctx, event) => {
      if (event.type !== 'filter' || typeof event.filterBy !== 'string') return;
      ctx.textFilter = event.filterBy;
      ctx.includePath = event.includeEdges ?? ctx.includePath;
    }),
  ],
  exit: [
    assign((ctx) => {
      ctx.textFilter = '';
      ctx.includePath = false;
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
      actions: [
        'setIncludeProjectsByPath',
        send(
          (ctx) => ({
            type: 'filter',
            filterBy: ctx.textFilter,
            includeEdges: ctx.includePath,
          }),
          { to: (ctx) => ctx.graphActor }
        ),
      ],
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
