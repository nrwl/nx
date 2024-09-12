/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
// nx-ignore-next-line
import { GraphError } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { createMachine } from 'xstate';
import { assign } from '@xstate/immer';

export interface ProjectDetailsState {
  project: null | ProjectGraphProjectNode;
  sourceMap: null | Record<string, string[]>;
  errors: null | GraphError[];
  connectedToCloud: boolean;
}

export type ProjectDetailsEvents =
  | {
      type: 'loadData';
      project: ProjectGraphProjectNode;
      sourceMap: Record<string, string[]>;
      connectedToCloud: boolean;
    }
  | {
      type: 'setErrors';
      errors: GraphError[];
    }
  | {
      type: 'clearErrors';
    };

const initialContext: ProjectDetailsState = {
  project: null,
  sourceMap: null,
  errors: null,
  connectedToCloud: false,
};

export const projectDetailsMachine = createMachine<
  ProjectDetailsState,
  ProjectDetailsEvents
>({
  predictableActionArguments: true,
  preserveActionOrder: true,
  id: 'project-view',
  initial: 'idle',
  context: initialContext,
  states: {
    idle: {},
    loaded: {},
    error: {},
  },
  on: {
    loadData: [
      {
        target: 'loaded',
        cond: (ctx, _event) => ctx.errors === null || ctx.errors.length === 0,
        actions: [
          assign((ctx, event) => {
            ctx.project = event.project;
            ctx.sourceMap = event.sourceMap;
            ctx.connectedToCloud = event.connectedToCloud;
          }),
        ],
      },
      {
        target: 'error',
        cond: (ctx, _event) => ctx.errors !== null && ctx.errors.length > 0,
        actions: [
          assign((ctx, event) => {
            ctx.project = event.project;
            ctx.sourceMap = event.sourceMap;
            ctx.connectedToCloud = event.connectedToCloud;
          }),
        ],
      },
    ],
    setErrors: {
      target: 'error',
      actions: assign((ctx, event) => {
        ctx.errors = event.errors;
      }),
    },
    clearErrors: [
      {
        target: 'idle',
        cond: (ctx, _event) => ctx.project === null,
        actions: assign((ctx) => {
          ctx.errors = null;
        }),
      },
      {
        target: 'loaded',
        cond: (ctx, _event) => ctx.project !== null,
        actions: assign((ctx) => {
          ctx.errors = null;
        }),
      },
    ],
  },
});
