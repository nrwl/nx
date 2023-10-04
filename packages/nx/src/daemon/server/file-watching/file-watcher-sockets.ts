import { Socket } from 'net';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { ProjectGraph } from '../../../config/project-graph';
import { findAllProjectNodeDependencies } from '../../../utils/project-graph-utils';
import { PromisedBasedQueue } from '../../../utils/promised-based-queue';
import { currentProjectGraph } from '../project-graph-incremental-recomputation';
import { handleResult } from '../server';
import { getProjectsAndGlobalChanges } from './changed-projects';

const queue = new PromisedBasedQueue();

export let registeredFileWatcherSockets: {
  socket: Socket;
  config: {
    watchProjects: string[] | 'all';
    includeGlobalWorkspaceFiles: boolean;
    includeDependentProjects: boolean;
  };
}[] = [];

export function removeRegisteredFileWatcherSocket(socket: Socket) {
  registeredFileWatcherSockets = registeredFileWatcherSockets.filter(
    (watcher) => watcher.socket !== socket
  );
}

export function hasRegisteredFileWatcherSockets() {
  return registeredFileWatcherSockets.length > 0;
}

export function notifyFileWatcherSockets(
  createdFiles: string[] | null,
  updatedFiles: string[],
  deletedFiles: string[]
) {
  if (!hasRegisteredFileWatcherSockets()) {
    return;
  }

  queue.sendToQueue(async () => {
    const projectAndGlobalChanges = getProjectsAndGlobalChanges(
      createdFiles,
      updatedFiles,
      deletedFiles
    );

    await Promise.all(
      registeredFileWatcherSockets.map(({ socket, config }) => {
        const changedProjects = [];
        const changedFiles = [];
        if (config.watchProjects === 'all') {
          for (const [projectName, projectFiles] of Object.entries(
            projectAndGlobalChanges.projects
          )) {
            changedProjects.push(projectName);
            changedFiles.push(...projectFiles);
          }
        } else {
          const watchedProjects = new Set<string>(
            findMatchingProjects(
              config.watchProjects,
              currentProjectGraph.nodes
            )
          );

          if (config.includeDependentProjects) {
            for (const project of watchedProjects) {
              for (const dep of findAllProjectNodeDependencies(
                project,
                currentProjectGraph
              )) {
                watchedProjects.add(dep);
              }
            }
          }

          for (const watchedProject of watchedProjects) {
            if (!!projectAndGlobalChanges.projects[watchedProject]) {
              changedProjects.push(watchedProject);

              changedFiles.push(
                ...projectAndGlobalChanges.projects[watchedProject]
              );
            }
          }
        }

        if (config.includeGlobalWorkspaceFiles) {
          changedFiles.push(...projectAndGlobalChanges.globalFiles);
        }

        if (changedProjects.length > 0 || changedFiles.length > 0) {
          return handleResult(socket, 'FILE-WATCH-CHANGED', () =>
            Promise.resolve({
              description: 'File watch changed',
              response: JSON.stringify({
                changedProjects,
                changedFiles,
              }),
            })
          );
        }
      })
    );
  });
}
