import { Socket } from 'net';
import type { Minimatch } from 'minimatch';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { findAllProjectNodeDependencies } from '../../../utils/project-graph-utils';
import { PromisedBasedQueue } from '../../../utils/promised-based-queue';
import { serverLogger } from '../../logger';
import { currentProjectGraph } from '../project-graph-incremental-recomputation';
import { handleResult } from '../server';
import { ChangedFile, getProjectsAndGlobalChanges } from './changed-projects';
import {
  compileGlobs,
  filterChangedFiles,
  selectChangedProjectsAndFiles,
} from './glob-filter';

const queue = new PromisedBasedQueue();

export interface RegisteredFileWatcherConfig {
  watchProjects: string[] | 'all';
  includeGlobalWorkspaceFiles: boolean;
  includeDependencies: boolean;
  include?: string[];
  exclude?: string[];
}

export let registeredFileWatcherSockets: {
  socket: Socket;
  config: RegisteredFileWatcherConfig;
  // Include/exclude patterns are invariant for the life of the subscription, so
  // they are compiled once here rather than on every file-change batch.
  includeMatchers: Minimatch[];
  excludeMatchers: Minimatch[];
}[] = [];

export function registerFileWatcherSocket(watcher: {
  socket: Socket;
  config: RegisteredFileWatcherConfig;
}) {
  registeredFileWatcherSockets.push({
    socket: watcher.socket,
    config: watcher.config,
    includeMatchers: compileGlobs(watcher.config.include ?? []),
    excludeMatchers: compileGlobs(watcher.config.exclude ?? []),
  });
}

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
      registeredFileWatcherSockets.map(
        ({ socket, config, includeMatchers, excludeMatchers }) => {
          const hasFilters =
            includeMatchers.length > 0 || excludeMatchers.length > 0;

          const changedProjects = [];
          const changedFiles = [];
          let consideredFileCount = 0;
          if (config.watchProjects === 'all') {
            const selected = selectChangedProjectsAndFiles(
              projectAndGlobalChanges.projects,
              includeMatchers,
              excludeMatchers
            );
            changedProjects.push(...selected.changedProjects);
            changedFiles.push(...selected.changedFiles);
            consideredFileCount += selected.consideredFileCount;
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

            const watchedProjectFiles: Record<string, ChangedFile[]> = {};
            for (const watchedProject of watchedProjects) {
              if (projectAndGlobalChanges.projects[watchedProject]) {
                watchedProjectFiles[watchedProject] =
                  projectAndGlobalChanges.projects[watchedProject];
              }
            }

            const selected = selectChangedProjectsAndFiles(
              watchedProjectFiles,
              includeMatchers,
              excludeMatchers
            );
            changedProjects.push(...selected.changedProjects);
            changedFiles.push(...selected.changedFiles);
            consideredFileCount += selected.consideredFileCount;
          }

          if (config.includeGlobalWorkspaceFiles) {
            consideredFileCount += projectAndGlobalChanges.globalFiles.length;
            const filteredGlobalFiles = filterChangedFiles(
              projectAndGlobalChanges.globalFiles,
              includeMatchers,
              excludeMatchers
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
          } else if (hasFilters && consideredFileCount > 0) {
            // Files changed but the include/exclude filter dropped the entire
            // batch, so no command runs. Log it so a misconfigured pattern is
            // debuggable. Patterns match workspace-relative paths.
            serverLogger.watcherLog(
              `Include/exclude filter dropped all ${consideredFileCount} changed file(s); no command will run. include=${JSON.stringify(
                config.include ?? []
              )} exclude=${JSON.stringify(config.exclude ?? [])}`
            );
          }
        }
      )
    );
  });
}
