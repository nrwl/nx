import { ProjectGraphProjectNode } from '@nx/devkit';
import { RenderGraphConfigEvent } from '@nx/graph';
import { TaskGraphHandleEventResult } from '@nx/graph/tasks/task-graph-client';
import { TaskGraphEvent, TaskGraphs } from '@nx/graph/tasks/task-graph-event';
import { ActorRef, assign, createMachine, send, spawn } from 'xstate';
import { TaskGraphClientActor } from '../feature-tasks/interfaces';
import { graphClientActor } from '../feature-tasks/task-graph.actor';

// Define the set of events that should be forwarded to graphActor
export const GRAPH_CLIENT_EVENTS = new Set([
  'initGraph',
  'mergeGraph',
  'show',
  'hide',
  'toggleGroupByProject',
]);

export interface TaskGraphStateMachineContext {
  taskGraphs: null | TaskGraphs;
  projects: ProjectGraphProjectNode[] | null;
  graphActor: ActorRef<TaskGraphEvent | RenderGraphConfigEvent>;
  handleEventResult: TaskGraphHandleEventResult | null;
}

const initialContext: TaskGraphStateMachineContext = {
  taskGraphs: null,
  projects: null,
  graphActor: null,
  handleEventResult: null,
};

export type TaskGraphStateMachineEvents =
  | {
      type: 'loadData';
      projects: ProjectGraphProjectNode[];
      taskGraphs: TaskGraphs;
    }
  | {
      type: 'setGraphClient';
      graphClient: TaskGraphClientActor;
    }
  | {
      type: 'setInitialCommand';
      command: TaskGraphEvent;
    }
  | {
      type: 'handleEventResult';
      result: TaskGraphHandleEventResult;
    };

export const taskGraphMachine = createMachine<
  TaskGraphStateMachineContext,
  TaskGraphStateMachineEvents
>(
  {
    id: 'taskGraph',
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
              taskGraphs: (_, event) => event.taskGraphs,
              projects: (_, event) => event.projects,
            }),
          ],
        },
      ],
      setGraphClient: {
        actions: [
          assign({
            graphActor: (_, event) =>
              spawn(
                graphClientActor(event.graphClient),
                'taskGraphClientActor'
              ),
          }),
        ],
      },
      handleEventResult: {
        actions: [
          assign({
            handleEventResult: (_, event) => event.result,
          }),
        ],
      },
      '*': {
        cond: 'isGraphClientEvent',
        actions: ['sendToGraphActor'],
      },
    },
  },
  {
    guards: {
      isGraphClientEvent: (ctx, event) => {
        return GRAPH_CLIENT_EVENTS.has(event.type) && ctx.graphActor !== null;
      },
    },
    actions: {
      sendToGraphActor: send((_, event) => event, {
        to: (ctx) => ctx.graphActor,
      }),
    },
  }
);
