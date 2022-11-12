import { State } from 'xstate';
import { TaskGraphContext, TaskGraphEvents } from './task-graph.machine';

export type TaskGraphState = State<
  TaskGraphContext,
  TaskGraphEvents,
  any,
  {
    value: any;
    context: TaskGraphContext;
  }
>;
