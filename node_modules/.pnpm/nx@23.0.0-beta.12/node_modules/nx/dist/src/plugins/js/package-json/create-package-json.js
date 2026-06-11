"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPackageJson = createPackageJson;
exports.findProjectsNpmDependencies = findProjectsNpmDependencies;
const fileutils_1 = require("../../../utils/fileutils");
const object_sort_1 = require("../../../utils/object-sort");
const project_graph_1 = require("../../../config/project-graph");
const package_json_1 = require("../../../utils/package-json");
const fs_1 = require("fs");
const workspace_root_1 = require("../../../utils/workspace-root");
const configuration_1 = require("../../../config/configuration");
const nx_deps_cache_1 = require("../../../project-graph/nx-deps-cache");
const path_1 = require("path");
const task_hasher_1 = require("../../../hasher/task-hasher");
const output_1 = require("../../../utils/output");
/**
 * Creates a package.json in the output directory for support to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 * If isProduction flag is set, it wil  remove devDependencies and optional peerDependencies
 */
function createPackageJson(projectName, graph, options = {}, fileMap = null) {
    const projectNode = graph.nodes[projectName];
    const isLibrary = projectNode.type === 'lib';
    const root = options.root ?? workspace_root_1.workspaceRoot;
    const rootPackageJson = (0, fileutils_1.readJsonFile)((0, path_1.join)(root, 'package.json'));
    const npmDeps = findProjectsNpmDependencies(projectNode, graph, options.target, rootPackageJson, {
        helperDependencies: options.helperDependencies,
        isProduction: options.isProduction,
    }, fileMap);
    // default package.json if one does not exist
    let packageJson = {
        name: projectName,
        version: '0.0.1',
    };
    const projectPackageJsonPath = (0, path_1.join)(root, projectNode.data.root, 'package.json');
    if ((0, fs_1.existsSync)(projectPackageJsonPath)) {
        try {
            packageJson = (0, fileutils_1.readJsonFile)(projectPackageJsonPath);
            // for standalone projects we don't want to include all the root dependencies
            if (graph.nodes[projectName].data.root === '.') {
                // TODO: We should probably think more on this - Nx can't always
                // detect all external dependencies, and there's not a way currently
                // to tell Nx that we need one of these deps. For non-standalone projects
                // we tell people to add it to the package.json of the project, and we
                // merge it. For standalone, this pattern doesn't work because of this piece of code.
                // It breaks expectations, but also, I don't know another way around it currently.
                // If Nx doesn't pick up a dep, say some css lib that is only imported in a .scss file,
                // we need to be able to tell it to keep that dep in the generated package.json.
                delete packageJson.dependencies;
                delete packageJson.devDependencies;
            }
            if (options.isProduction) {
                delete packageJson.devDependencies;
            }
        }
        catch (e) { }
    }
    const getVersion = (packageName, version, section) => {
        // Try project package.json first (single section)
        const projectVersion = (0, package_json_1.getDependencyVersionFromPackageJson)(packageName, root, packageJson, [section]);
        if (projectVersion) {
            return projectVersion;
        }
        // For libraries, fall back to root package.json (single section)
        if (isLibrary) {
            const rootVersion = (0, package_json_1.getDependencyVersionFromPackageJson)(packageName, root, rootPackageJson, [section]);
            if (rootVersion) {
                return rootVersion;
            }
        }
        return version;
    };
    Object.entries(npmDeps.dependencies).forEach(([packageName, version]) => {
        if (rootPackageJson.devDependencies?.[packageName] &&
            !packageJson.dependencies?.[packageName] &&
            !packageJson.peerDependencies?.[packageName]) {
            // don't store dev dependencies for production
            if (!options.isProduction) {
                packageJson.devDependencies ??= {};
                packageJson.devDependencies[packageName] = getVersion(packageName, version, 'devDependencies');
            }
        }
        else {
            if (!packageJson.peerDependencies?.[packageName]) {
                packageJson.dependencies ??= {};
                packageJson.dependencies[packageName] = getVersion(packageName, version, 'dependencies');
            }
        }
    });
    if (!isLibrary) {
        Object.entries(npmDeps.peerDependencies).forEach(([packageName, version]) => {
            if (!packageJson.peerDependencies?.[packageName]) {
                if (rootPackageJson.dependencies?.[packageName]) {
                    packageJson.dependencies ??= {};
                    packageJson.dependencies[packageName] = getVersion(packageName, version, 'dependencies');
                    return;
                }
                const isOptionalPeer = npmDeps.peerDependenciesMeta[packageName]?.optional;
                if (!isOptionalPeer) {
                    if (!options.isProduction ||
                        rootPackageJson.dependencies?.[packageName]) {
                        packageJson.peerDependencies ??= {};
                        packageJson.peerDependencies[packageName] = getVersion(packageName, version, 'dependencies');
                    }
                }
                else if (!options.isProduction) {
                    // add peer optional dependencies if not in production
                    packageJson.peerDependencies ??= {};
                    packageJson.peerDependencies[packageName] = version;
                    packageJson.peerDependenciesMeta ??= {};
                    packageJson.peerDependenciesMeta[packageName] = {
                        optional: true,
                    };
                }
            }
        });
    }
    packageJson.devDependencies &&= (0, object_sort_1.sortObjectByKeys)(packageJson.devDependencies);
    packageJson.dependencies &&= (0, object_sort_1.sortObjectByKeys)(packageJson.dependencies);
    packageJson.peerDependencies &&= (0, object_sort_1.sortObjectByKeys)(packageJson.peerDependencies);
    packageJson.peerDependenciesMeta &&= (0, object_sort_1.sortObjectByKeys)(packageJson.peerDependenciesMeta);
    if (rootPackageJson.packageManager && !options.skipPackageManager) {
        if (packageJson.packageManager &&
            packageJson.packageManager !== rootPackageJson.packageManager) {
            output_1.output.warn({
                title: 'Package Manager Mismatch',
                bodyLines: [
                    `The project ${projectName} has explicitly specified "packageManager" config of "${packageJson.packageManager}" but the workspace is using "${rootPackageJson.packageManager}".`,
                    `Please remove the project level "packageManager" config or align it with the workspace root package.json.`,
                ],
            });
        }
        packageJson.packageManager = rootPackageJson.packageManager;
    }
    // region Overrides/Resolutions
    // npm
    if (rootPackageJson.overrides && !options.skipOverrides) {
        packageJson.overrides = {
            ...rootPackageJson.overrides,
            ...packageJson.overrides,
        };
    }
    // pnpm
    if (rootPackageJson.pnpm?.overrides && !options.skipOverrides) {
        packageJson.pnpm ??= {};
        packageJson.pnpm.overrides = {
            ...rootPackageJson.pnpm.overrides,
            ...packageJson.pnpm.overrides,
        };
    }
    // pnpm install configuration
    const rootPnpm = rootPackageJson.pnpm;
    if (rootPnpm) {
        // string[] fields — copy from root
        for (const field of [
            'onlyBuiltDependencies',
            'neverBuiltDependencies',
            'ignoredOptionalDependencies',
        ]) {
            if (rootPnpm[field]) {
                packageJson.pnpm ??= {};
                packageJson.pnpm[field] = rootPnpm[field];
            }
        }
        // object fields — merge with project-level overrides
        if (rootPnpm.allowBuilds) {
            packageJson.pnpm ??= {};
            packageJson.pnpm.allowBuilds = {
                ...rootPnpm.allowBuilds,
                ...packageJson.pnpm.allowBuilds,
            };
        }
        if (rootPnpm.supportedArchitectures) {
            packageJson.pnpm ??= {};
            packageJson.pnpm.supportedArchitectures = {
                ...rootPnpm.supportedArchitectures,
                ...packageJson.pnpm.supportedArchitectures,
            };
        }
    }
    // yarn
    if (rootPackageJson.resolutions && !options.skipOverrides) {
        packageJson.resolutions = {
            ...rootPackageJson.resolutions,
            ...packageJson.resolutions,
        };
    }
    // endregion Overrides/Resolutions
    return packageJson;
}
function findProjectsNpmDependencies(projectNode, graph, target, rootPackageJson, options, fileMap) {
    if (fileMap == null) {
        fileMap = (0, nx_deps_cache_1.readFileMapCache)()?.fileMap?.projectFileMap || {};
    }
    const { selfInputs, dependencyInputs } = target
        ? (0, task_hasher_1.getTargetInputs)((0, configuration_1.readNxJson)(), projectNode, target)
        : { selfInputs: [], dependencyInputs: [] };
    const npmDeps = {
        dependencies: {},
        peerDependencies: {},
        peerDependenciesMeta: {},
    };
    const seen = new Set();
    options.helperDependencies?.forEach((dep) => {
        seen.add(dep);
        npmDeps.dependencies[graph.externalNodes[dep].data.packageName] =
            graph.externalNodes[dep].data.version;
        recursivelyCollectPeerDependencies(dep, graph, npmDeps, seen);
    });
    // if it's production, we want to ignore all found devDependencies
    const ignoredDependencies = options.isProduction && rootPackageJson.devDependencies
        ? [
            ...(options.ignoredDependencies || []),
            ...Object.keys(rootPackageJson.devDependencies),
        ]
        : options.ignoredDependencies || [];
    findAllNpmDeps(fileMap, projectNode, graph, npmDeps, seen, ignoredDependencies, dependencyInputs, selfInputs, false);
    return npmDeps;
}
function findAllNpmDeps(projectFileMap, projectNode, graph, npmDeps, seen, ignoredDependencies, dependencyPatterns, rootPatterns, isTransitiveDependency = false) {
    if (seen.has(projectNode.name))
        return;
    seen.add(projectNode.name);
    const projectFiles = (0, task_hasher_1.filterUsingGlobPatterns)(projectNode.data.root, projectFileMap[projectNode.name] || [], isTransitiveDependency
        ? ['{projectRoot}/**/*']
        : (rootPatterns ?? dependencyPatterns));
    const projectDependencies = new Set();
    projectFiles.forEach((fileData) => fileData.deps?.forEach((dep) => projectDependencies.add((0, project_graph_1.fileDataDepTarget)(dep))));
    for (const dep of projectDependencies) {
        const node = graph.externalNodes[dep];
        if (seen.has(dep)) {
            // if it's in peerDependencies, move it to regular dependencies
            // since this is a direct dependency of the project
            if (node && npmDeps.peerDependencies[node.data.packageName]) {
                npmDeps.dependencies[node.data.packageName] = node.data.version;
                delete npmDeps.peerDependencies[node.data.packageName];
            }
        }
        else {
            if (node) {
                seen.add(dep);
                // do not add ignored dependencies to the list or non-npm dependencies
                if (ignoredDependencies.includes(node.data.packageName) ||
                    node.type !== 'npm') {
                    continue;
                }
                npmDeps.dependencies[node.data.packageName] = node.data.version;
                recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
            }
            else if (graph.nodes[dep]) {
                findAllNpmDeps(projectFileMap, graph.nodes[dep], graph, npmDeps, seen, ignoredDependencies, dependencyPatterns, undefined, true);
            }
        }
    }
}
function recursivelyCollectPeerDependencies(projectName, graph, npmDeps, seen) {
    const npmPackage = graph.externalNodes[projectName];
    if (!npmPackage) {
        return npmDeps;
    }
    const packageName = npmPackage.data.packageName;
    try {
        const packageJson = require(`${packageName}/package.json`);
        if (!packageJson.peerDependencies) {
            return npmDeps;
        }
        Object.keys(packageJson.peerDependencies)
            .map((dependencyName) => `npm:${dependencyName}`)
            .map((dependency) => graph.externalNodes[dependency])
            .filter(Boolean)
            .forEach((node) => {
            if (!seen.has(node.name)) {
                seen.add(node.name);
                npmDeps.peerDependencies[node.data.packageName] = node.data.version;
                if (packageJson.peerDependenciesMeta &&
                    packageJson.peerDependenciesMeta[node.data.packageName] &&
                    packageJson.peerDependenciesMeta[node.data.packageName].optional) {
                    npmDeps.peerDependenciesMeta[node.data.packageName] = {
                        optional: true,
                    };
                }
                recursivelyCollectPeerDependencies(node.name, graph, npmDeps, seen);
            }
        });
        return npmDeps;
    }
    catch (e) {
        return npmDeps;
    }
}
