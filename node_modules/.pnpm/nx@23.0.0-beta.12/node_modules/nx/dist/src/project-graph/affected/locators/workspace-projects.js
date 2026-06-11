"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImplicitlyTouchedProjects = exports.getTouchedProjects = void 0;
const minimatch_1 = require("minimatch");
const find_project_for_path_1 = require("../../utils/find-project-for-path");
const getTouchedProjects = (touchedFiles, projectGraphNodes) => {
    const projectRootMap = (0, find_project_for_path_1.createProjectRootMappings)(projectGraphNodes);
    return touchedFiles.reduce((affected, f) => {
        const matchingProject = (0, find_project_for_path_1.findProjectForPath)(f.file, projectRootMap);
        if (matchingProject) {
            affected.push(matchingProject);
        }
        return affected;
    }, []);
};
exports.getTouchedProjects = getTouchedProjects;
const getImplicitlyTouchedProjects = (fileChanges, projectGraphNodes, nxJson) => {
    const implicits = {
        'nx.json': '*',
    };
    Object.values(projectGraphNodes || {}).forEach((node) => {
        const namedInputs = {
            ...nxJson.namedInputs,
            ...node.data.namedInputs,
        };
        extractFilesFromTargetInputs(node.data.targets, namedInputs).forEach((input) => {
            implicits[input] ??= [];
            if (Array.isArray(implicits[input])) {
                implicits[input].push(node.name);
            }
        });
    });
    const touched = new Set();
    for (const [pattern, projects] of Object.entries(implicits)) {
        const implicitDependencyWasChanged = fileChanges.some((f) => (0, minimatch_1.minimatch)(f.file, pattern, { dot: true }));
        if (!implicitDependencyWasChanged) {
            continue;
        }
        // File change affects all projects, just return all projects.
        if (projects === '*') {
            return Object.keys(projectGraphNodes);
        }
        else if (Array.isArray(projects)) {
            projects.forEach((project) => touched.add(project));
        }
    }
    return Array.from(touched);
};
exports.getImplicitlyTouchedProjects = getImplicitlyTouchedProjects;
function extractFilesFromTargetInputs(targets, namedInputs) {
    const globalFiles = [];
    for (const target of Object.values(targets || {})) {
        if (target.inputs) {
            globalFiles.push(...extractFilesFromInputs(target.inputs, namedInputs));
        }
    }
    return globalFiles;
}
function extractFilesFromInputs(inputs, namedInputs) {
    const globalFiles = [];
    for (const input of inputs) {
        if (typeof input === 'string' && input in namedInputs) {
            globalFiles.push(...extractFilesFromInputs(namedInputs[input], namedInputs));
        }
        else if (typeof input === 'string' &&
            input.startsWith('{workspaceRoot}/')) {
            globalFiles.push(input.substring('{workspaceRoot}/'.length));
        }
        else if (input.fileset && input.fileset.startsWith('{workspaceRoot}/')) {
            globalFiles.push(input.fileset.substring('{workspaceRoot}/'.length));
        }
    }
    return globalFiles;
}
