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
  errors?: GraphError[];
  connectedToCloud?: boolean;
}

export type ProjectDetailsEvents = {
  type: 'loadData';
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  connectedToCloud: boolean;
  errors?: GraphError[];
};

const initialContext: ProjectDetailsState = {
  project: null,
  sourceMap: null,
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
  },
  on: {
    loadData: [
      {
        target: 'loaded',
        actions: [
          assign((ctx, event) => {
            ctx.project = event.project;
            ctx.sourceMap = event.sourceMap;
            ctx.connectedToCloud = event.connectedToCloud;
            ctx.errors = event.errors;
          }),
        ],
      },
    ],
  },
});
