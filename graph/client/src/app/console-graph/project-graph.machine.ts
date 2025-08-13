import { ProjectGraph } from '@nx/devkit';
import { ActorRef, assign, send, spawn, createMachine } from 'xstate';
import { ProjectGraphClientActor } from '../feature-projects/machines/interfaces';
import { graphClientActor } from '../feature-projects/machines/graph.actor';
import {
  ProjectGraphEvent,
  ProjectGraphEventType,
} from '@nx/graph/projects/project-graph-event';
import { RenderGraphConfigEvent } from '@nx/graph';
import { GRAPH_CLIENT_EVENTS } from '../feature-projects/machines/project-graph.machine';
import { ProjectGraphHandleEventResult } from '@nx/graph/projects/project-graph-client';

export interface ProjectGraphStateMachineContext {
  projectGraph: null | ProjectGraph;
  graphActor: ActorRef<ProjectGraphEvent | RenderGraphConfigEvent>;
  handleEventResult: ProjectGraphHandleEventResult | null;
}

const initialContext: ProjectGraphStateMachineContext = {
  projectGraph: null,
  graphActor: null,
  handleEventResult: null,
};
export type ProjectGraphStateMachineEvents =
  | {
      type: 'loadData';
      projectGraph: ProjectGraph;
    }
  | {
      type: 'setGraphClient';
      graphClient: ProjectGraphClientActor;
    }
  | {
      type: 'setInitialCommand';
      command: ProjectGraphEvent;
    }
  | {
      type: 'handleEventResult';
      result: ProjectGraphHandleEventResult;
    };
export const projectGraphMachine = createMachine<
  ProjectGraphStateMachineContext,
  ProjectGraphStateMachineEvents
>(
  {
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
      setGraphClient: {
        actions: [
          assign({
            graphActor: (_, event) =>
              spawn(
                graphClientActor(event.graphClient),
                'projectGraphClientActor'
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
