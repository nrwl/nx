import { useSelector } from '@xstate/react';
import { DepGraphState, TaskGraphState } from '../machines/interfaces';
import { useDepGraphService } from './use-dep-graph';
import { getTaskGraphService } from '../machines/get-services';

export type TaskGraphSelector<T> = (depGraphState: TaskGraphState) => T;

export function useTaskGraphSelector<T>(selectorFunc: TaskGraphSelector<T>): T {
  const taskGraphMachine = getTaskGraphService();

  return useSelector<typeof taskGraphMachine, T>(
    taskGraphMachine,
    selectorFunc
  );
}
