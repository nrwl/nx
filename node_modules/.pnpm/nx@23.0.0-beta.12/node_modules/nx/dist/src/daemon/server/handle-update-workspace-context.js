"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUpdateWorkspaceContext = handleUpdateWorkspaceContext;
const project_graph_incremental_recomputation_1 = require("./project-graph-incremental-recomputation");
async function handleUpdateWorkspaceContext(createdFiles, updatedFiles, deletedFiles) {
    (0, project_graph_incremental_recomputation_1.scheduleProjectGraphRecomputation)(createdFiles, updatedFiles, deletedFiles);
    return {
        response: '{}',
        description: 'handleUpdateContextFiles',
    };
}
