import { NxJsonConfiguration } from '../config/nx-json.js';
import { ProjectGraph } from '../config/project-graph.js';
import { daemonClient } from '../daemon/client/client.js';
import { getFileMap } from '../project-graph/build-project-graph.js';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher.js';

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
      projectGraph,
      nxJson,
      rustReferences,
      runnerOptions
    );
  }
}
