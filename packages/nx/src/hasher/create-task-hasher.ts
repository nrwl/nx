import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import { getFileMap } from '../project-graph/build-project-graph';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher';

export function createTaskHasher(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  runnerOptions?: any
): TaskHasher {
  if (daemonClient.enabled()) {
    return new DaemonBasedTaskHasher(daemonClient, runnerOptions);
  } else {
    const { fileMap, allWorkspaceFiles, rustReferences } = getFileMap();
    return new InProcessTaskHasher(
      fileMap?.projectFileMap,
      allWorkspaceFiles,
      projectGraph,
      nxJson,
      rustReferences,
      runnerOptions
    );
  }
}
