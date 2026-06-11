"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNpmPackageNodes = buildNpmPackageNodes;
const fs_1 = require("fs");
const file_hasher_1 = require("../../../../hasher/file-hasher");
const path_1 = require("path");
const fileutils_1 = require("../../../../utils/fileutils");
const workspace_root_1 = require("../../../../utils/workspace-root");
function buildNpmPackageNodes(builder) {
    const packageJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, 'package.json');
    const packageJson = (0, fs_1.existsSync)(packageJsonPath)
        ? (0, fileutils_1.readJsonFile)(packageJsonPath)
        : {};
    const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    Object.keys(deps).forEach((d) => {
        if (!builder.graph.externalNodes[`npm:${d}`]) {
            builder.addExternalNode({
                type: 'npm',
                name: `npm:${d}`,
                data: {
                    version: deps[d],
                    packageName: d,
                    hash: (0, file_hasher_1.hashArray)([d, deps[d]]),
                },
            });
        }
    });
}
