import { Socket } from 'net';
import {
  ChangedFile,
  projectAndGlobalChanges,
  resetProjectAndGlobalChanges,
  setProjectsAndGlobalChanges,
} from './changed-projects';
import { handleResult } from '../server';

export let registeredFileWatcherSockets: {
  socket: Socket;
  config: {
    watchProjects: string[] | 'all';
    includeGlobalWorkspaceFiles: boolean;
  };
}[] = [];

const createdFilesSet = new Set<string>();
const updatedFilesSet = new Set<string>();
const deletedFilesSet = new Set<string>();

export function removeRegisteredFileWatcherSocket(socket: Socket) {
  registeredFileWatcherSockets = registeredFileWatcherSockets.filter(
    (watcher) => watcher.socket !== socket
  );
}

export function hasRegisteredFileWatcherSockets() {
  return registeredFileWatcherSockets.length > 0;
}

export function trackChangedFilesForFileWatchers(
  createdFiles: string[] | undefined,
  updatedFiles?: string[],
  deletedFiles?: string[]
) {
  if (!hasRegisteredFileWatcherSockets()) {
    return;
  }

  for (const file of createdFiles ?? []) {
    createdFilesSet.add(file);
    updatedFilesSet.delete(file);
    deletedFilesSet.delete(file);
  }

  for (const file of updatedFiles ?? []) {
    updatedFilesSet.add(file);
    createdFilesSet.delete(file);
    deletedFilesSet.delete(file);
  }

  for (const file of deletedFiles ?? []) {
    deletedFilesSet.add(file);
    createdFilesSet.delete(file);
    updatedFilesSet.delete(file);
  }

  setProjectsAndGlobalChanges(
    createdFilesSet,
    updatedFilesSet,
    deletedFilesSet
  );
}

export async function notifyFileWatcherSockets() {
  if (!hasRegisteredFileWatcherSockets()) {
    return;
  }

  await Promise.all(
    registeredFileWatcherSockets.map(({ socket, config }) => {
      let changedProjects = [];
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
  //
  reset();
}

function reset() {
  deletedFilesSet.clear();
  updatedFilesSet.clear();
  createdFilesSet.clear();

  resetProjectAndGlobalChanges();
}
