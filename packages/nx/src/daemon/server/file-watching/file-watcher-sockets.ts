import { Socket } from 'net';
import { ProjectGraphCache } from '../../../project-graph/nx-deps-cache';
import { PromisedBasedQueue } from '../../../utils/promised-based-queue';
import { handleResult } from '../server';
import { getProjectsAndGlobalChanges } from './changed-projects';

const queue = new PromisedBasedQueue();

export let registeredFileWatcherSockets: {
  socket: Socket;
  config: {
    watchProjects: string[] | 'all';
    includeGlobalWorkspaceFiles: boolean;
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
          for (const watchedProject of config.watchProjects) {
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
          return handleResult(socket, {
            description: 'File watch changed',
            response: JSON.stringify({
              changedProjects,
              changedFiles,
            }),
          });
        }
      })
    );
  });
}
