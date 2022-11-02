import { createMachine } from 'xstate';
// nx-ignore-next-line
import { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import { assign } from '@xstate/immer';

export type TaskGraphRecord = Record<
  string,
  Record<string, Record<string, any>>
>;

export interface TaskGraphContext {
  selectedTaskId: string;
  projects: ProjectGraphProjectNode[];
  taskGraphs: TaskGraphRecord;
}

const initialContext: TaskGraphContext = {
  selectedTaskId: null,
  projects: [],
  taskGraphs: {},
};

export type TaskGraphEvents =
  | {
      type: 'notifyTaskGraphSetProjects';
      projects: ProjectGraphProjectNode[];
      taskGraphs: TaskGraphRecord;
    }
  | {
      type: 'selectTask';
      taskId: string;
    };

export const taskGraphMachine = createMachine<
  TaskGraphContext,
  TaskGraphEvents
>(
  {
    predictableActionArguments: true,
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {
        on: {
          notifyTaskGraphSetProjects: {
            actions: ['setProjects'],
            target: 'initialized',
          },
        },
      },
      initialized: {
        on: {
          selectTask: {
            actions: ['selectTask'],
          },
        },
      },
    },
  },
  {
    actions: {
      setProjects: assign((ctx, event) => {
        if (event.type !== 'notifyTaskGraphSetProjects') return;

        ctx.projects = event.projects;
        ctx.taskGraphs = event.taskGraphs;
      }),
      selectTask: assign((ctx, event) => {
        if (event.type !== 'selectTask') return;

        ctx.selectedTaskId = event.taskId;
      }),
    },
  }
);
