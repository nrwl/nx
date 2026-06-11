"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertWorkspaceValidity = assertWorkspaceValidity;
const find_matching_projects_1 = require("./find-matching-projects");
const output_1 = require("./output");
const devkit_internals_1 = require("../devkit-internals");
function assertWorkspaceValidity(projects, nxJson) {
    const projectNames = Object.keys(projects);
    const projectGraphNodes = projectNames.reduce((graph, project) => {
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
    const invalidImplicitDependencies = new Map();
    if (nxJson.implicitDependencies) {
        output_1.output.warn({
            title: 'Using `implicitDependencies` for global implicit dependencies configuration is no longer supported.',
            bodyLines: [
                'Use "namedInputs" instead. You can run "nx repair" to automatically migrate your configuration.',
                'For more information about the usage of "namedInputs" see https://nx.dev/deprecated/global-implicit-dependencies#global-implicit-dependencies',
            ],
        });
    }
    const projectsWithNonArrayImplicitDependencies = new Map();
    projectNames.reduce((map, projectName) => {
        const project = projects[projectName];
        if (!!project.implicitDependencies &&
            !Array.isArray(project.implicitDependencies)) {
            projectsWithNonArrayImplicitDependencies.set(projectName, project.implicitDependencies);
            return map;
        }
        if (!project.implicitDependencies) {
            return map;
        }
        detectAndSetInvalidProjectGlobValues(map, projectName, project.implicitDependencies, projects, projectGraphNodes);
        return map;
    }, invalidImplicitDependencies);
    if (projectsWithNonArrayImplicitDependencies.size === 0 &&
        invalidImplicitDependencies.size === 0) {
        // No issues
        return;
    }
    let message = '';
    if (projectsWithNonArrayImplicitDependencies.size > 0) {
        message += `The following implicitDependencies should be an array of strings:\n`;
        projectsWithNonArrayImplicitDependencies.forEach((implicitDependencies, projectName) => {
            message += `  ${projectName}.implicitDependencies: "${implicitDependencies}"\n`;
        });
        message += '\n';
    }
    if (invalidImplicitDependencies.size > 0) {
        message += `The following implicitDependencies point to non-existent project(s):\n`;
        message += [...invalidImplicitDependencies.keys()]
            .map((key) => {
            const projectNames = invalidImplicitDependencies.get(key);
            return `  ${key}\n${projectNames
                .map((projectName) => `    ${projectName}`)
                .join('\n')}`;
        })
            .join('\n\n');
    }
    throw new devkit_internals_1.WorkspaceValidityError(message);
}
function detectAndSetInvalidProjectGlobValues(map, sourceName, desiredImplicitDeps, projectConfigurations, projects) {
    const invalidProjectsOrGlobs = desiredImplicitDeps.filter((implicit) => {
        const projectName = implicit.startsWith('!')
            ? implicit.substring(1)
            : implicit;
        // Do not error on cross-workspace implicit dependency references
        if (projectName.startsWith('nx-cloud:')) {
            return false;
        }
        return !(projectConfigurations[projectName] ||
            (0, find_matching_projects_1.findMatchingProjects)([implicit], projects).length);
    });
    if (invalidProjectsOrGlobs.length > 0) {
        map.set(sourceName, invalidProjectsOrGlobs);
    }
}
