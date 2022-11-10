import { useSelector } from '@xstate/react';
import { getTaskGraphService } from '../../machines/get-services';
import { TaskGraphState } from '../machines/interfaces';

export type TaskGraphSelector<T> = (taskGraphState: TaskGraphState) => T;

export function useTaskGraphSelector<T>(selectorFunc: TaskGraphSelector<T>): T {
  const taskGraphMachine = getTaskGraphService();

  return useSelector<typeof taskGraphMachine, T>(
    taskGraphMachine,
    selectorFunc
  );
}
