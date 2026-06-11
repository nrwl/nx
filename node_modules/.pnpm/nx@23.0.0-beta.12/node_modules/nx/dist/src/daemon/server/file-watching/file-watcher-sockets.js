"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registeredFileWatcherSockets = void 0;
exports.removeRegisteredFileWatcherSocket = removeRegisteredFileWatcherSocket;
exports.hasRegisteredFileWatcherSockets = hasRegisteredFileWatcherSockets;
exports.notifyFileWatcherSockets = notifyFileWatcherSockets;
const find_matching_projects_1 = require("../../../utils/find-matching-projects");
const project_graph_utils_1 = require("../../../utils/project-graph-utils");
const promised_based_queue_1 = require("../../../utils/promised-based-queue");
const project_graph_incremental_recomputation_1 = require("../project-graph-incremental-recomputation");
const server_1 = require("../server");
const changed_projects_1 = require("./changed-projects");
const queue = new promised_based_queue_1.PromisedBasedQueue();
exports.registeredFileWatcherSockets = [];
function removeRegisteredFileWatcherSocket(socket) {
    exports.registeredFileWatcherSockets = exports.registeredFileWatcherSockets.filter((watcher) => watcher.socket !== socket);
}
function hasRegisteredFileWatcherSockets() {
    return exports.registeredFileWatcherSockets.length > 0;
}
function notifyFileWatcherSockets(createdFiles, updatedFiles, deletedFiles) {
    if (!hasRegisteredFileWatcherSockets()) {
        return;
    }
    queue.sendToQueue(async () => {
        const projectAndGlobalChanges = (0, changed_projects_1.getProjectsAndGlobalChanges)(createdFiles, updatedFiles, deletedFiles);
        await Promise.all(exports.registeredFileWatcherSockets.map(({ socket, config }) => {
            const changedProjects = [];
            const changedFiles = [];
            if (config.watchProjects === 'all') {
                for (const [projectName, projectFiles] of Object.entries(projectAndGlobalChanges.projects)) {
                    changedProjects.push(projectName);
                    changedFiles.push(...projectFiles);
                }
            }
            else {
                const watchedProjects = new Set((0, find_matching_projects_1.findMatchingProjects)(config.watchProjects, project_graph_incremental_recomputation_1.currentProjectGraph.nodes));
                if (config.includeDependentProjects) {
                    for (const project of watchedProjects) {
                        for (const dep of (0, project_graph_utils_1.findAllProjectNodeDependencies)(project, project_graph_incremental_recomputation_1.currentProjectGraph)) {
                            watchedProjects.add(dep);
                        }
                    }
                }
                for (const watchedProject of watchedProjects) {
                    if (!!projectAndGlobalChanges.projects[watchedProject]) {
                        changedProjects.push(watchedProject);
                        changedFiles.push(...projectAndGlobalChanges.projects[watchedProject]);
                    }
                }
            }
            if (config.includeGlobalWorkspaceFiles) {
                changedFiles.push(...projectAndGlobalChanges.globalFiles);
            }
            if (changedProjects.length > 0 || changedFiles.length > 0) {
                return (0, server_1.handleResult)(socket, 'FILE-WATCH-CHANGED', () => Promise.resolve({
                    description: 'File watch changed',
                    response: JSON.stringify({
                        changedProjects,
                        changedFiles,
                    }),
                }), 'json');
            }
        }));
    });
}
