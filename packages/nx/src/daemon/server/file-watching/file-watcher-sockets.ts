import { Socket } from 'net';
import type { Minimatch } from 'minimatch';
import { findMatchingProjects } from '../../../utils/find-matching-projects';
import { findAllProjectNodeDependencies } from '../../../utils/project-graph-utils';
import { PromisedBasedQueue } from '../../../utils/promised-based-queue';
import { serverLogger } from '../../logger';
import { sendEmitLogMessageToSocket } from '../client-socket-context';
import { currentProjectGraph } from '../project-graph-incremental-recomputation';
import { handleResult } from '../server';
import type { ChangedFile } from './changed-projects';
import { getProjectsAndGlobalChanges } from './changed-projects';
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

interface RegisteredFileWatcherSocket {
  socket: Socket;
  config: RegisteredFileWatcherConfig;
  // Include/exclude patterns are invariant for the life of the subscription, so
  // they are compiled once here rather than on every file-change batch.
  includeMatchers: Minimatch[];
  excludeMatchers: Minimatch[];
  // Whether this subscription has already been told, in its own terminal, that
  // its filter dropped a whole batch. The condition repeats on every keystroke
  // in an excluded file, so it is only worth saying once per subscription.
  warnedAboutDroppedBatch: boolean;
}

export let registeredFileWatcherSockets: RegisteredFileWatcherSocket[] = [];

/**
 * Registers a watch subscription. Throws when a pattern is invalid — see
 * {@link compileGlobs} — so the caller in `handleMessage` must report the
 * failure back over the socket rather than letting it reject unhandled.
 */
export function registerFileWatcherSocket(watcher: {
  socket: Socket;
  config: RegisteredFileWatcherConfig;
}) {
  registeredFileWatcherSockets.push({
    socket: watcher.socket,
    config: watcher.config,
    includeMatchers: compileGlobs(watcher.config.include ?? [], '--include'),
    excludeMatchers: compileGlobs(watcher.config.exclude ?? [], '--exclude'),
    warnedAboutDroppedBatch: false,
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

/**
 * The workspace watcher has died; no further change events will ever arrive.
 * Registered clients are passive, so without this push they wait forever.
 */
export function notifyFileWatcherSocketsOfError(error: Error) {
  if (!hasRegisteredFileWatcherSockets()) {
    return;
  }

  queue.sendToQueue(async () => {
    await Promise.all(
      registeredFileWatcherSockets.map(({ socket }) =>
        handleResult(
          socket,
          'FILE-WATCH-CHANGED',
          () =>
            Promise.resolve({
              description: 'File watch error',
              response: JSON.stringify({ watcherError: error.message }),
            }),
          'json'
        )
      )
    );
  });
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
      registeredFileWatcherSockets.map((watcher) => {
        const { socket, config, includeMatchers, excludeMatchers } = watcher;
        const hasFilters =
          includeMatchers.length > 0 || excludeMatchers.length > 0;

        const changedProjects = [];
        const changedFiles = [];
        let consideredFileCount = 0;
        if (config.watchProjects === 'all') {
          const selected = selectChangedProjectsAndFiles(
            Object.entries(projectAndGlobalChanges.projects),
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

          // A Map, not a plain object: integer-like object keys are hoisted to
          // the front on iteration, which would reorder a project named e.g.
          // `2024` relative to the order the projects were matched in.
          const watchedProjectFiles = new Map<string, ChangedFile[]>();
          for (const watchedProject of watchedProjects) {
            if (projectAndGlobalChanges.projects[watchedProject]) {
              watchedProjectFiles.set(
                watchedProject,
                projectAndGlobalChanges.projects[watchedProject]
              );
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
        }

        if (hasFilters && consideredFileCount > 0) {
          reportFilterDroppedEntireBatch(watcher, consideredFileCount);
        }
      })
    );
  });
}

/**
 * Files changed but the include/exclude filter dropped the whole batch, so no
 * command runs and `nx watch` looks hung. The daemon log alone can't tell the
 * person who typed the pattern anything, so this goes to their terminal over
 * their own watch socket, and the daemon log keeps the full record.
 *
 * Only the first drop per subscription is sent to the terminal — the condition
 * repeats on every save in an excluded file, and a filter that is doing its job
 * hits this constantly.
 */
function reportFilterDroppedEntireBatch(
  watcher: RegisteredFileWatcherSocket,
  consideredFileCount: number
) {
  const details =
    `include=${JSON.stringify(watcher.config.include ?? [])} ` +
    `exclude=${JSON.stringify(watcher.config.exclude ?? [])}`;

  serverLogger.watcherLog(
    `Include/exclude filter dropped all ${consideredFileCount} changed file(s); no command will run. ${details}`
  );

  if (watcher.warnedAboutDroppedBatch) {
    return;
  }
  watcher.warnedAboutDroppedBatch = true;

  sendEmitLogMessageToSocket(
    watcher.socket,
    `nx watch: the --include/--exclude filter dropped all ${consideredFileCount} changed file(s), so the command did not run. ${details}. ` +
      `Patterns are matched against workspace-root-relative paths, so use "**/*.ts" rather than "*.ts" to match nested files. ` +
      `(Only reported once per watch.)`,
    'warn'
  );
}
