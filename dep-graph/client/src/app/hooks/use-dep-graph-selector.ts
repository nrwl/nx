import { useSelector } from '@xstate/react';
import { DepGraphState } from '../machines/interfaces';
import { useDepGraphService } from './use-dep-graph';

export type DepGraphSelector<T> = (depGraphState: DepGraphState) => T;

export function useDepGraphSelector<T>(selectorFunc: DepGraphSelector<T>): T {
  const depGraphService = useDepGraphService();

  return useSelector<typeof depGraphService, T>(depGraphService, selectorFunc);
}
