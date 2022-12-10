import { useSelector } from '@xstate/react';
import { ProjectGraphState } from '../machines/interfaces';
import { getProjectGraphService } from '../../machines/get-services';

export type ProjectGraphSelector<T> = (
  projectGraphState: ProjectGraphState
) => T;

export function useProjectGraphSelector<T>(
  selectorFunc: ProjectGraphSelector<T>
): T {
  const projectGraphService = getProjectGraphService();

  return useSelector<typeof projectGraphService, T>(
    projectGraphService,
    selectorFunc
  );
}
