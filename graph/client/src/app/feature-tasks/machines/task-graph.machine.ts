import { ActorRef, createMachine, send, spawn } from 'xstate';
// nx-ignore-next-line
import { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import { assign } from '@xstate/immer';
import { GraphRenderEvents } from '../../machines/interfaces';
import { taskGraphRenderActor } from './task-graph-render.actor';
// nx-ignore-next-line
import { TaskGraph } from '@nrwl/devkit';

export type TaskGraphRecord = Record<string, TaskGraph>;

export interface TaskGraphContext {
  selectedTaskId: string;
  projects: ProjectGraphProjectNode[];
  taskGraphs: TaskGraphRecord;
  graphActor: ActorRef<GraphRenderEvents>;
}

const initialContext: TaskGraphContext = {
  selectedTaskId: null,
  projects: [],
  taskGraphs: {},
  graphActor: null,
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

export interface TaskGraphSchema {
  states: {
    idle: {};
    initialized: {};
  };
}

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
            actions: [
              'setProjects',
              send(
                (ctx, event) => ({
                  type: 'notifyTaskGraphSetProjects',
                  projects: ctx.projects,
                  taskGraphs: ctx.taskGraphs,
                }),
                {
                  to: (context) => context.graphActor,
                }
              ),
            ],
            target: 'initialized',
          },
        },
      },
      initialized: {
        on: {
          selectTask: {
            actions: [
              'selectTask',
              send(
                (ctx, event) => ({
                  type: 'notifyTaskGraphTaskSelected',
                  taskId: ctx.selectedTaskId,
                }),
                {
                  to: (context) => context.graphActor,
                }
              ),
            ],
          },
        },
      },
    },
  },
  {
    actions: {
      setProjects: assign((ctx, event) => {
        if (event.type !== 'notifyTaskGraphSetProjects') return;
        ctx.graphActor = spawn(taskGraphRenderActor, 'taskGraphRenderActor');

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
