"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterAffected = filterAffected;
const file_utils_1 = require("../file-utils");
const workspace_projects_1 = require("./locators/workspace-projects");
const touched_projects_1 = require("../../plugins/js/project-graph/affected/touched-projects");
const operators_1 = require("../operators");
const configuration_1 = require("../../config/configuration");
const project_glob_changes_1 = require("./locators/project-glob-changes");
async function filterAffected(graph, touchedFiles, nxJson = (0, configuration_1.readNxJson)(), packageJson = (0, file_utils_1.readPackageJson)()) {
    // Additional affected logic should be in this array.
    const touchedProjectLocators = [
        workspace_projects_1.getTouchedProjects,
        workspace_projects_1.getImplicitlyTouchedProjects,
        project_glob_changes_1.getTouchedProjectsFromProjectGlobChanges,
        touched_projects_1.getTouchedProjects,
    ];
    const touchedProjects = [];
    for (const locator of touchedProjectLocators) {
        performance.mark(locator.name + ':start');
        const projects = await locator(touchedFiles, graph.nodes, nxJson, packageJson, graph);
        performance.mark(locator.name + ':end');
        performance.measure(locator.name, locator.name + ':start', locator.name + ':end');
        touchedProjects.push(...projects);
    }
    return filterAffectedProjects(graph, {
        projectGraphNodes: graph.nodes,
        nxJson,
        touchedProjects,
    });
}
// -----------------------------------------------------------------------------
function filterAffectedProjects(graph, ctx) {
    const result = {
        nodes: {},
        externalNodes: {},
        dependencies: {},
    };
    const reversed = (0, operators_1.reverse)(graph);
    // Share visited Sets across all touched projects to avoid redundant traversal
    // Previously, each touched project got its own Set, causing shared dependencies
    // to be visited multiple times (O(touchedProjects × sharedDeps) → O(nodes))
    const visitedNodes = new Set();
    const visitedDeps = new Set();
    for (const p of ctx.touchedProjects) {
        addAffectedNodes(p, reversed, result, visitedNodes);
    }
    for (const p of ctx.touchedProjects) {
        addAffectedDependencies(p, reversed, result, visitedDeps);
    }
    return result;
}
function addAffectedNodes(startingProject, reversed, result, visited) {
    if (visited.has(startingProject))
        return;
    const reversedNode = reversed.nodes[startingProject];
    const reversedExternalNode = reversed.externalNodes[startingProject];
    if (!reversedNode && !reversedExternalNode) {
        throw new Error(`Invalid project name is detected: "${startingProject}"`);
    }
    visited.add(startingProject);
    if (reversedNode) {
        result.nodes[startingProject] = reversedNode;
        result.dependencies[startingProject] = [];
    }
    else {
        result.externalNodes[startingProject] = reversedExternalNode;
    }
    reversed.dependencies[startingProject]?.forEach(({ target }) => addAffectedNodes(target, reversed, result, visited));
}
function addAffectedDependencies(startingProject, reversed, result, visited) {
    if (visited.has(startingProject))
        return;
    visited.add(startingProject);
    if (reversed.dependencies[startingProject]) {
        reversed.dependencies[startingProject].forEach(({ target }) => addAffectedDependencies(target, reversed, result, visited));
        reversed.dependencies[startingProject].forEach(({ type, source, target }) => {
            // Since source and target was reversed,
            // we need to reverse it back to original direction.
            if (!result.dependencies[target]) {
                result.dependencies[target] = [];
            }
            result.dependencies[target].push({
                type,
                source: target,
                target: source,
            });
        });
    }
}
