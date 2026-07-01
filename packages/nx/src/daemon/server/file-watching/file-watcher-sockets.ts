import { Socket } from 'net';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { findAllProjectNodeDependencies } from '../../../utils/project-graph-utils';
import { PromisedBasedQueue } from '../../../utils/promised-based-queue';
import { currentProjectGraph } from '../project-graph-incremental-recomputation';
import { handleResult } from '../server';
import { getProjectsAndGlobalChanges } from './changed-projects';
import { filterChangedFiles } from './glob-filter';

const queue = new PromisedBasedQueue();

export let registeredFileWatcherSockets: {
  socket: Socket;
  config: {
    watchProjects: string[] | 'all';
    includeGlobalWorkspaceFiles: boolean;
    includeDependencies: boolean;
    include?: string[];
    exclude?: string[];
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
        const include = config.include ?? [];
        const exclude = config.exclude ?? [];

        const changedProjects = [];
        const changedFiles = [];
        if (config.watchProjects === 'all') {
          for (const [projectName, projectFiles] of Object.entries(
            projectAndGlobalChanges.projects
          )) {
            const filteredFiles = filterChangedFiles(
              projectFiles,
              include,
              exclude
            );
            if (filteredFiles.length > 0) {
              changedProjects.push(projectName);
              changedFiles.push(...filteredFiles);
            }
          }
        } else {
          const watchedProjects = new Set<string>(
            findMatchingProjects(
              config.watchProjects,
              currentProjectGraph.nodes
            )
          );

          if (config.includeDependencies) {
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
              const filteredFiles = filterChangedFiles(
                projectAndGlobalChanges.projects[watchedProject],
                include,
                exclude
              );
              if (filteredFiles.length > 0) {
                changedProjects.push(watchedProject);
                changedFiles.push(...filteredFiles);
              }
            }
          }
        }

        if (config.includeGlobalWorkspaceFiles) {
          const filteredGlobalFiles = filterChangedFiles(
            projectAndGlobalChanges.globalFiles,
            include,
            exclude
          );
          changedFiles.push(...filteredGlobalFiles);
        }

        if (changedProjects.length > 0 || changedFiles.length > 0) {
          return handleResult(
            socket,
            'FILE-WATCH-CHANGED',
            () =>
              Promise.resolve({
                description: 'File watch changed',
                response: JSON.stringify({
                  changedProjects,
                  changedFiles,
                }),
              }),
            'json'
          );
        }
      })
    );
  });
}
