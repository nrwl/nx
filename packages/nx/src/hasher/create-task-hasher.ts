import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import type { UltracacheConfigurations } from '../native';
import type { TaskPlanningContext } from './task-planning-context';
import { getFileMap } from '../project-graph/build-project-graph';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher';

/**
 * `ultracacheConfigurations` is this run's set (see `loadUltracacheConfigurationsForRun`); undefined
 * hashes natively. The daemon gets its version, so it hashes from the same
 * set even after a newer one is imported for the commit.
 */
export function createTaskHasher(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  runnerOptions?: any,
  ultracacheConfigurations?: UltracacheConfigurations,
  planningContext?: TaskPlanningContext
): TaskHasher {
  if (daemonClient.enabled()) {
    return new DaemonBasedTaskHasher(
      daemonClient,
      runnerOptions,
      ultracacheConfigurations
        ? {
            commit: ultracacheConfigurations.commit,
            fetchedAt: ultracacheConfigurations.resolution.fetchedAt,
          }
        : undefined
    );
  } else {
    const { rustReferences } = getFileMap();
    return new InProcessTaskHasher(
      projectGraph,
      nxJson,
      rustReferences,
      runnerOptions,
      planningContext,
      ultracacheConfigurations
    );
  }
}
