"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeWorkspaceChanges = routeWorkspaceChanges;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const workspace_root_1 = require("../../../utils/workspace-root");
const logger_1 = require("../../logger");
const project_graph_incremental_recomputation_1 = require("../project-graph-incremental-recomputation");
const SUMMARY_CAP = 10;
function summarize(files) {
    if (files.length === 0)
        return '(none)';
    if (files.length <= SUMMARY_CAP) {
        return files.map((f) => `  - ${f}`).join('\n');
    }
    return (files
        .slice(0, SUMMARY_CAP)
        .map((f) => `  - ${f}`)
        .join('\n') + `\n  ... and ${files.length - SUMMARY_CAP} more`);
}
/**
 * Categorise a batch of watcher events by type and route them into the
 * recomputation queue. Deletions are taken at face value; created and
 * updated paths are stat'd to skip directories (the project graph only
 * cares about files). A stat error means the file was unlinked between
 * the watcher firing and us looking — drop the event.
 */
function routeWorkspaceChanges(events) {
    logger_1.serverLogger.watcherLog(`[watcher] routeWorkspaceChanges batch: ${events.length} events: ` +
        events.map((e) => `${e.type}:${e.path}`).join(', '));
    const updatedFilesToHash = [];
    const createdFilesToHash = [];
    const deletedFiles = [];
    const droppedDirs = [];
    const droppedStatErrors = [];
    for (const event of events) {
        if (event.type === 'delete') {
            deletedFiles.push(event.path);
            continue;
        }
        try {
            const s = (0, node_fs_1.statSync)((0, node_path_1.join)(workspace_root_1.workspaceRoot, event.path));
            if (!s.isFile()) {
                droppedDirs.push(event.path);
                continue;
            }
            if (event.type === 'update') {
                updatedFilesToHash.push(event.path);
            }
            else {
                createdFilesToHash.push(event.path);
            }
        }
        catch (e) {
            droppedStatErrors.push(`${event.path} (${e instanceof Error ? e.message : String(e)})`);
            // File deleted between watcher emit and stat — drop it.
        }
    }
    if (createdFilesToHash.length ||
        updatedFilesToHash.length ||
        deletedFiles.length ||
        droppedDirs.length ||
        droppedStatErrors.length) {
        logger_1.serverLogger.watcherLog(`File changes detected:\n` +
            `Created:\n${summarize(createdFilesToHash)}\n` +
            `Updated:\n${summarize(updatedFilesToHash)}\n` +
            `Deleted:\n${summarize(deletedFiles)}` +
            (droppedDirs.length
                ? `\nDropped (dirs):\n${summarize(droppedDirs)}`
                : '') +
            (droppedStatErrors.length
                ? `\nDropped (stat errors):\n${summarize(droppedStatErrors)}`
                : ''));
    }
    (0, project_graph_incremental_recomputation_1.scheduleProjectGraphRecomputation)(createdFilesToHash, updatedFilesToHash, deletedFiles);
}
