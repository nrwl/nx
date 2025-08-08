import { ProjectGraph } from '@nx/devkit';
import { assign } from 'xstate';
import { createMachine } from 'xstate';

export interface ProjectGraphState {
  projectGraph: null | ProjectGraph;
}

const initialContext: ProjectGraphState = {
  projectGraph: null,
};
export type ProjectGraphEvents = {
  type: 'loadData';
  projectGraph: ProjectGraph;
};
export const projectGraphMachine = createMachine<
  ProjectGraphState,
  ProjectGraphEvents
>({
  id: 'projectGraph',
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
          assign({
            projectGraph: (_, event) => event.projectGraph,
          }),
        ],
      },
    ],
  },
});
