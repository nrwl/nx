"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectJsonProjectsPlugin = void 0;
exports.buildProjectFromProjectJson = buildProjectFromProjectJson;
const node_path_1 = require("node:path");
const fileutils_1 = require("../../../utils/fileutils");
const plugins_1 = require("../../../project-graph/plugins");
exports.ProjectJsonProjectsPlugin = {
    name: 'nx/core/project-json',
    createNodesV2: [
        '{project.json,**/project.json}',
        (configFiles, _, context) => {
            return (0, plugins_1.createNodesFromFiles)((file) => {
                const json = (0, fileutils_1.readJsonFile)((0, node_path_1.join)(context.workspaceRoot, file));
                const project = buildProjectFromProjectJson(json, file);
                return {
                    projects: {
                        [project.root]: project,
                    },
                };
            }, configFiles, _, context);
        },
    ],
};
exports.default = exports.ProjectJsonProjectsPlugin;
function buildProjectFromProjectJson(json, path) {
    const { name, root, ...rest } = json;
    return {
        name,
        root: root ?? (0, node_path_1.dirname)(path),
        ...rest,
    };
}
