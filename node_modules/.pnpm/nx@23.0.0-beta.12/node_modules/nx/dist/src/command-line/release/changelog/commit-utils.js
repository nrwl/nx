"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapCommitToChange = mapCommitToChange;
exports.createChangesFromCommits = createChangesFromCommits;
exports.filterHiddenChanges = filterHiddenChanges;
exports.getProjectsAffectedByCommit = getProjectsAffectedByCommit;
exports.commitChangesNonProjectFiles = commitChangesNonProjectFiles;
exports.createFileToProjectMap = createFileToProjectMap;
function mapCommitToChange(commit, affectedProjects) {
    return {
        type: commit.type,
        scope: commit.scope,
        description: commit.description,
        body: commit.body,
        isBreaking: commit.isBreaking,
        githubReferences: commit.references,
        authors: commit.authors,
        shortHash: commit.shortHash,
        revertedHashes: commit.revertedHashes,
        affectedProjects,
    };
}
function createChangesFromCommits(commits, fileMap, fileToProjectMap, conventionalCommitsConfig) {
    return filterHiddenChanges(commits.map((c) => {
        const affectedProjects = commitChangesNonProjectFiles(c, fileMap.nonProjectFiles)
            ? '*'
            : getProjectsAffectedByCommit(c, fileToProjectMap);
        return mapCommitToChange(c, affectedProjects);
    }), conventionalCommitsConfig);
}
function filterHiddenChanges(changes, conventionalCommitsConfig) {
    return changes.filter((change) => {
        const type = change.type;
        const typeConfig = conventionalCommitsConfig.types[type];
        if (!typeConfig) {
            // don't include changes with unknown types
            return false;
        }
        return !typeConfig.changelog.hidden;
    });
}
function getProjectsAffectedByCommit(commit, fileToProjectMap) {
    const affectedProjects = new Set();
    for (const affectedFile of commit.affectedFiles) {
        const affectedProject = fileToProjectMap[affectedFile];
        if (affectedProject) {
            affectedProjects.add(affectedProject);
        }
    }
    return Array.from(affectedProjects);
}
function commitChangesNonProjectFiles(commit, nonProjectFiles) {
    return nonProjectFiles.some((fileData) => commit.affectedFiles.includes(fileData.file));
}
function createFileToProjectMap(projectFileMap) {
    const fileToProjectMap = {};
    for (const [projectName, projectFiles] of Object.entries(projectFileMap)) {
        for (const file of projectFiles) {
            fileToProjectMap[file.file] = projectName;
        }
    }
    return fileToProjectMap;
}
