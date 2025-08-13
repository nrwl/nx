import { ProjectGraph } from '@nx/devkit';
import { ActorRef, assign, send, spawn } from 'xstate';
import { createMachine } from 'xstate';
import { ProjectGraphClientActor } from '../feature-projects/machines/interfaces';
import { ProjectGraphEvent } from '@nx/graph/projects/project-graph-event';
import { RenderGraphConfigEvent } from '@nx/graph';
import { GRAPH_CLIENT_EVENTS } from '../feature-projects/machines/project-graph.machine';
import { TaskGraphClientActor } from '../feature-tasks/interfaces';
// import { graphClientActor } from '../feature-tasks/graph.actor';

export interface TaskGraphStateMachineContext {
  projectGraph: null | ProjectGraph;
  graphActor: ActorRef<ProjectGraphEvent | RenderGraphConfigEvent>;
}

const initialContext: TaskGraphStateMachineContext = {
  projectGraph: null,
  graphActor: null,
};
export type TaskGraphStateMachineEvents =
  | {
      type: 'loadData';
      projectGraph: ProjectGraph;
    }
  | {
      type: 'setGraphClient';
      graphClient: TaskGraphClientActor;
    };
export const projectGraphMachine = createMachine<
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
              projectGraph: (_, event) => event.projectGraph,
            }),
          ],
        },
      ],
      setGraphClient: {
        actions: [
          // assign({
          //   graphActor: (_, event) =>
          //     spawn(
          //       graphClientActor(event.graphClient),
          //       'taskGraphClientActor'
          //     ),
          // }),
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
