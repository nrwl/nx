"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateNxJson = exports.readNxJson = void 0;
exports.addProjectConfiguration = addProjectConfiguration;
exports.updateProjectConfiguration = updateProjectConfiguration;
exports.removeProjectConfiguration = removeProjectConfiguration;
exports.readProjectConfiguration = readProjectConfiguration;
exports.getProjects = getProjects;
exports.getRelativeProjectJsonSchemaPath = getRelativeProjectJsonSchemaPath;
const minimatch_1 = require("minimatch");
const path_1 = require("path");
const package_json_1 = require("../../plugins/package-json");
const project_json_1 = require("../../plugins/project-json/build-nodes/project-json");
const angular_json_1 = require("../../adapter/angular-json");
const project_nodes_manager_1 = require("../../project-graph/utils/project-configuration/project-nodes-manager");
const workspace_context_1 = require("../../utils/workspace-context");
const output_1 = require("../../utils/output");
const path_2 = require("../../utils/path");
const json_1 = require("./json");
const to_project_name_1 = require("../../config/to-project-name");
var nx_json_1 = require("./nx-json");
Object.defineProperty(exports, "readNxJson", { enumerable: true, get: function () { return nx_json_1.readNxJson; } });
Object.defineProperty(exports, "updateNxJson", { enumerable: true, get: function () { return nx_json_1.updateNxJson; } });
/**
 * Adds project configuration to the Nx workspace.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 * @param standalone - whether the project is configured in workspace.json or not
 */
function addProjectConfiguration(tree, projectName, projectConfiguration, standalone = true) {
    const projectConfigFile = (0, path_2.joinPathFragments)(projectConfiguration.root, 'project.json');
    if (!standalone) {
        output_1.output.warn({
            title: 'Nx only supports standalone projects. Setting standalone to false is ignored.',
        });
    }
    if (tree.exists(projectConfigFile)) {
        throw new Error(`Cannot create a new project ${projectName} at ${projectConfiguration.root}. A project already exists in this directory.`);
    }
    delete projectConfiguration.$schema;
    handleEmptyTargets(projectName, projectConfiguration);
    (0, json_1.writeJson)(tree, projectConfigFile, {
        name: projectName,
        $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
        ...projectConfiguration,
        root: undefined,
    });
}
/**
 * Updates the configuration of an existing project.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @param projectConfiguration - project configuration
 */
function updateProjectConfiguration(tree, projectName, projectConfiguration) {
    if (tree.exists((0, path_2.joinPathFragments)(projectConfiguration.root, 'project.json'))) {
        updateProjectConfigurationInProjectJson(tree, projectName, projectConfiguration);
    }
    else if (tree.exists((0, path_2.joinPathFragments)(projectConfiguration.root, 'package.json'))) {
        updateProjectConfigurationInPackageJson(tree, projectName, projectConfiguration);
    }
    else {
        throw new Error(`Cannot update Project ${projectName} at ${projectConfiguration.root}. It either doesn't exist yet, or may not use project.json for configuration. Use \`addProjectConfiguration()\` instead if you want to create a new project.`);
    }
}
function updateProjectConfigurationInPackageJson(tree, projectName, projectConfiguration) {
    const packageJsonFile = (0, path_2.joinPathFragments)(projectConfiguration.root, 'package.json');
    const packageJson = (0, json_1.readJson)(tree, packageJsonFile);
    projectConfiguration.name = projectName;
    if (packageJson.name === projectConfiguration.name) {
        delete projectConfiguration.name;
    }
    if (projectConfiguration.targets &&
        !Object.keys(projectConfiguration.targets).length) {
        delete projectConfiguration.targets;
    }
    packageJson.nx = {
        ...packageJson.nx,
        ...projectConfiguration,
    };
    // We don't want to ever this since it is inferred
    delete packageJson.nx.root;
    // Only set `nx` property in `package.json` if it is a root project (necessary to mark it as Nx project),
    // or if there are properties to be set. If it is empty, then avoid it so we don't add unnecessary boilerplate.
    if (projectConfiguration.root === '.' ||
        Object.keys(packageJson.nx).length > 0) {
        (0, json_1.writeJson)(tree, packageJsonFile, packageJson);
    }
}
function updateProjectConfigurationInProjectJson(tree, projectName, projectConfiguration) {
    const projectConfigFile = (0, path_2.joinPathFragments)(projectConfiguration.root, 'project.json');
    handleEmptyTargets(projectName, projectConfiguration);
    (0, json_1.writeJson)(tree, projectConfigFile, {
        name: projectConfiguration.name ?? projectName,
        $schema: getRelativeProjectJsonSchemaPath(tree, projectConfiguration),
        ...projectConfiguration,
        root: undefined,
    });
}
/**
 * Removes the configuration of an existing project.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 */
function removeProjectConfiguration(tree, projectName) {
    const projectConfiguration = readProjectConfiguration(tree, projectName);
    if (!projectConfiguration) {
        throw new Error(`Cannot delete Project ${projectName}`);
    }
    const projectConfigFile = (0, path_2.joinPathFragments)(projectConfiguration.root, 'project.json');
    if (tree.exists(projectConfigFile)) {
        tree.delete(projectConfigFile);
    }
}
/**
 * Reads a project configuration.
 *
 * @param tree - the file system tree
 * @param projectName - unique name. Often directories are part of the name (e.g., mydir-mylib)
 * @throws If supplied projectName cannot be found
 */
function readProjectConfiguration(tree, projectName) {
    const allProjects = readAndCombineAllProjectConfigurations(tree);
    if (!allProjects[projectName]) {
        // temporary polyfill to make sure our generators work for existing angularcli workspaces
        if (tree.exists('angular.json')) {
            const angularJson = toNewFormat((0, json_1.readJson)(tree, 'angular.json'));
            if (angularJson.projects[projectName])
                return angularJson.projects[projectName];
        }
        throw new Error(`Cannot find configuration for '${projectName}'`);
    }
    return allProjects[projectName];
}
/**
 * Get a map of all projects in a workspace.
 *
 * Use {@link readProjectConfiguration} if only one project is needed.
 */
function getProjects(tree) {
    let allProjects = readAndCombineAllProjectConfigurations(tree);
    // temporary polyfill to make sure our generators work for existing angularcli workspaces
    if (tree.exists('angular.json')) {
        const angularJson = toNewFormat((0, json_1.readJson)(tree, 'angular.json'));
        allProjects = { ...allProjects, ...angularJson.projects };
    }
    return new Map(Object.keys(allProjects || {}).map((projectName) => {
        return [projectName, allProjects[projectName]];
    }));
}
function getRelativeProjectJsonSchemaPath(tree, project) {
    return (0, path_2.normalizePath)((0, path_1.relative)((0, path_1.join)(tree.root, project.root), (0, path_1.join)(tree.root, 'node_modules/nx/schemas/project-schema.json')));
}
function readAndCombineAllProjectConfigurations(tree) {
    /**
     * We can't update projects that come from plugins anyways, so we are going
     * to ignore them for now. Plugins should add their own add/create/update methods
     * if they would like to use devkit to update inferred projects.
     */
    const patterns = [
        '**/project.json',
        'project.json',
        ...(0, package_json_1.getGlobPatternsFromPackageManagerWorkspaces)(tree.root, (p) => (0, json_1.readJson)(tree, p, { expectComments: true }), (p) => {
            const content = tree.read(p, 'utf-8');
            const { load } = require('@zkochan/js-yaml');
            return load(content, { filename: p });
        }, (p) => tree.exists(p)),
    ];
    const globbedFiles = (0, workspace_context_1.globWithWorkspaceContextSync)(tree.root, patterns);
    const createdFiles = findCreatedProjectFiles(tree, patterns);
    const deletedFiles = findDeletedProjectFiles(tree, patterns);
    // Ensure we don't duplicate files that are both globbed and in tree changes
    const allProjectFiles = new Set([...globbedFiles, ...createdFiles]);
    const projectFiles = Array.from(allProjectFiles).filter((r) => deletedFiles.indexOf(r) === -1);
    const rootMap = {};
    for (const projectFile of projectFiles) {
        if ((0, path_1.basename)(projectFile) === 'project.json') {
            const json = (0, json_1.readJson)(tree, projectFile);
            const config = (0, project_json_1.buildProjectFromProjectJson)(json, projectFile);
            if (!config.name) {
                try {
                    const packageJson = (0, json_1.readJson)(tree, (0, path_2.joinPathFragments)(config.root, 'package.json'));
                    if (packageJson.name) {
                        config.name = packageJson.name;
                    }
                }
                catch {
                    // Maybe no package json, is ok.
                }
                config.name ??= (0, to_project_name_1.toProjectName)(projectFile);
            }
            (0, project_nodes_manager_1.mergeProjectConfigurationIntoRootMap)(rootMap, config, undefined, undefined, true);
        }
        if ((0, path_1.basename)(projectFile) === 'package.json') {
            const packageJson = (0, json_1.readJson)(tree, projectFile);
            // We don't want to have all of the extra inferred stuff in here, as
            // when generators update the project they shouldn't inline that stuff.
            // so rather than using `buildProjectFromPackageJson` and stripping it out
            // we are going to build the config manually.
            const config = {
                root: (0, path_1.dirname)(projectFile),
                name: packageJson.name ?? (0, to_project_name_1.toProjectName)(projectFile),
                ...packageJson.nx,
            };
            if (!rootMap[config.root]) {
                (0, project_nodes_manager_1.mergeProjectConfigurationIntoRootMap)(rootMap, 
                // Inferred targets, tags, etc don't show up when running generators
                // This is to help avoid running into issues when trying to update the workspace
                config, undefined, undefined, true);
            }
        }
    }
    return (0, project_nodes_manager_1.readProjectConfigurationsFromRootMap)(rootMap);
}
/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no project.json file, as `glob`
 * cannot find them.
 *
 * We exclude the root `package.json` from this list unless
 * considered a project during workspace generation
 */
function findCreatedProjectFiles(tree, globPatterns) {
    const createdProjectFiles = [];
    for (const change of tree.listChanges()) {
        // Include both CREATE and UPDATE changes to handle project files
        // created during generator callbacks (which are marked as UPDATE
        // since the tree has already been flushed to disk)
        if (change.type === 'CREATE' || change.type === 'UPDATE') {
            const fileName = (0, path_1.basename)(change.path);
            if (globPatterns.some((pattern) => (0, minimatch_1.minimatch)(change.path, pattern, { dot: true }))) {
                createdProjectFiles.push(change.path);
            }
            else if (fileName === 'package.json') {
                try {
                    const contents = JSON.parse(change.content.toString());
                    if (contents.nx) {
                        createdProjectFiles.push(change.path);
                    }
                }
                catch { }
            }
        }
    }
    return createdProjectFiles.map(path_2.normalizePath);
}
/**
 * Used to ensure that projects created during
 * the same devkit generator run show up when
 * there is no project.json file, as `glob`
 * cannot find them.
 */
function findDeletedProjectFiles(tree, globPatterns) {
    return tree
        .listChanges()
        .filter((f) => {
        return (f.type === 'DELETE' &&
            globPatterns.some((pattern) => (0, minimatch_1.minimatch)(f.path, pattern)));
    })
        .map((r) => r.path);
}
function toNewFormat(w) {
    const projects = {};
    Object.keys(w.projects || {}).forEach((name) => {
        if (typeof w.projects[name] === 'string')
            return;
        const projectConfig = w.projects[name];
        if (projectConfig.architect) {
            (0, angular_json_1.renamePropertyWithStableKeys)(projectConfig, 'architect', 'targets');
        }
        if (projectConfig.schematics) {
            (0, angular_json_1.renamePropertyWithStableKeys)(projectConfig, 'schematics', 'generators');
        }
        Object.values(projectConfig.targets || {}).forEach((target) => {
            if (target.builder !== undefined) {
                (0, angular_json_1.renamePropertyWithStableKeys)(target, 'builder', 'executor');
            }
        });
        projects[name] = projectConfig;
    });
    w.projects = projects;
    if (w.schematics) {
        (0, angular_json_1.renamePropertyWithStableKeys)(w, 'schematics', 'generators');
    }
    if (w.version !== 2) {
        w.version = 2;
    }
    return w;
}
function handleEmptyTargets(projectName, projectConfiguration) {
    if (projectConfiguration.targets &&
        !Object.keys(projectConfiguration.targets).length) {
        // Re-order `targets` to appear after the `// target` comment.
        delete projectConfiguration.targets;
        projectConfiguration['// targets'] =
            `to see all targets run: nx show project ${projectName} --web`;
        projectConfiguration.targets = {};
    }
    else {
        delete projectConfiguration['// targets'];
    }
}
