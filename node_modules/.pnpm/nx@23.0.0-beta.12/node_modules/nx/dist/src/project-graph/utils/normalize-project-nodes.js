"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeProjectNodes = normalizeProjectNodes;
exports.normalizeImplicitDependencies = normalizeImplicitDependencies;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const fileutils_1 = require("../../utils/fileutils");
const find_matching_projects_1 = require("../../utils/find-matching-projects");
async function normalizeProjectNodes({ projects, workspaceRoot }, builder) {
    // Sorting projects by name to make sure that the order of projects in the graph is deterministic.
    // This is important to ensure that expanded properties referencing projects (e.g. implicit dependencies)
    // are also deterministic, and thus don't cause the calculated project configuration hash to shift.
    const sortedProjectNames = Object.keys(projects).sort();
    // Used for expanding implicit dependencies (e.g. `@proj/*` or `tag:foo`)
    const partialProjectGraphNodes = sortedProjectNames.reduce((graph, project) => {
        const projectConfiguration = projects[project];
        graph[project] = {
            name: project,
            type: projectConfiguration.projectType === 'library' ? 'lib' : 'app', // missing fallback to `e2e`
            data: {
                ...projectConfiguration,
            },
        };
        return graph;
    }, {});
    const toAdd = [];
    for (const key of sortedProjectNames) {
        const p = projects[key];
        p.implicitDependencies = normalizeImplicitDependencies(key, p.implicitDependencies, partialProjectGraphNodes);
        p.targets ??= {};
        // TODO: remove in v16
        const projectType = getProjectType(key, p.projectType, workspaceRoot, p.root);
        const tags = p.tags || [];
        toAdd.push({
            name: key,
            type: projectType,
            data: {
                ...p,
                tags,
            },
        });
    }
    // Sort by root directory length (do we need this?)
    toAdd.sort((a, b) => {
        if (!a.data.root)
            return -1;
        if (!b.data.root)
            return -1;
        return a.data.root.length > b.data.root.length ? -1 : 1;
    });
    toAdd.forEach((n) => {
        builder.addNode({
            name: n.name,
            type: n.type,
            data: n.data,
        });
    });
}
function normalizeImplicitDependencies(source, implicitDependencies, projects) {
    if (!implicitDependencies?.length) {
        return implicitDependencies ?? [];
    }
    // Implicit dependencies handle negatives in a different
    // way from most other `projects` fields. This is because
    // they are used for multiple purposes.
    const positivePatterns = [];
    const negativePatterns = [];
    for (const dep of implicitDependencies) {
        if (dep.startsWith('!')) {
            negativePatterns.push(dep);
        }
        else {
            positivePatterns.push(dep);
        }
    }
    // Finds all projects that match a positive pattern and are not excluded by a negative pattern
    const deps = positivePatterns.length
        ? (0, find_matching_projects_1.findMatchingProjects)(positivePatterns.concat(negativePatterns), projects).filter((x) => x !== source)
        : [];
    // Expands negative patterns to equal project names
    const alwaysIgnoredDeps = (0, find_matching_projects_1.findMatchingProjects)(negativePatterns.map((x) => x.slice(1)), projects);
    // We return the matching deps, but keep the negative patterns in the list
    // so that they can be processed later by implicit-project-dependencies.ts
    // This is what allows using a negative implicit dep to remove a dependency
    // detected by createDependencies.
    return deps.concat(alwaysIgnoredDeps.map((x) => '!' + x));
}
function getProjectType(projectName, projectType, workspaceRoot, projectRoot) {
    if (projectType) {
        if (projectType === 'library') {
            return 'lib';
        }
        if (projectName.endsWith('-e2e') || projectName === 'e2e') {
            return 'e2e';
        }
        return 'app';
    }
    if ((0, node_fs_1.existsSync)((0, node_path_1.join)(workspaceRoot, projectRoot, 'tsconfig.lib.json'))) {
        return 'lib';
    }
    if ((0, node_fs_1.existsSync)((0, node_path_1.join)(workspaceRoot, projectRoot, 'tsconfig.app.json'))) {
        return 'app';
    }
    // If it doesn't have any common library entry points, assume it is an application
    const packageJsonPath = (0, node_path_1.join)(workspaceRoot, projectRoot, 'package.json');
    try {
        const packageJson = (0, fileutils_1.readJsonFile)(packageJsonPath);
        if (!packageJson.exports &&
            !packageJson.main &&
            !packageJson.module &&
            !packageJson.bin) {
            return 'app';
        }
    }
    catch { }
    return 'lib';
}
