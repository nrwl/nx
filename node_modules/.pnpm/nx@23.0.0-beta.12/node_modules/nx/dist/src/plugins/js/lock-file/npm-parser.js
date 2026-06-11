"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNpmLockfileNodes = getNpmLockfileNodes;
exports.getNpmLockfileDependencies = getNpmLockfileDependencies;
exports.stringifyNpmLockfile = stringifyNpmLockfile;
const fs_1 = require("fs");
const semver_1 = require("semver");
const workspace_root_1 = require("../../../utils/workspace-root");
const operators_1 = require("../../../project-graph/operators");
const project_graph_builder_1 = require("../../../project-graph/project-graph-builder");
const project_graph_1 = require("../../../config/project-graph");
const file_hasher_1 = require("../../../hasher/file-hasher");
const get_workspace_packages_from_graph_1 = require("../utils/get-workspace-packages-from-graph");
let currentLockFileHash;
let parsedLockFile;
function parsePackageLockFile(lockFileContent, lockFileHash) {
    if (lockFileHash === currentLockFileHash) {
        return parsedLockFile;
    }
    const results = JSON.parse(lockFileContent);
    parsedLockFile = results;
    currentLockFileHash = lockFileHash;
    return results;
}
function getNpmLockfileNodes(lockFileContent, lockFileHash) {
    const data = parsePackageLockFile(lockFileContent, lockFileHash);
    return getNodes(data);
}
function getNpmLockfileDependencies(lockFileContent, lockFileHash, ctx, keyMap) {
    const data = parsePackageLockFile(lockFileContent, lockFileHash);
    return getDependencies(data, keyMap, ctx);
}
function getNodes(data) {
    const keyMap = new Map();
    const nodes = new Map();
    if (data.lockfileVersion > 1) {
        Object.entries(data.packages).forEach(([path, snapshot]) => {
            // skip workspaces packages
            if (path === '' || !path.includes('node_modules') || snapshot.link) {
                return;
            }
            const packageName = path.split('node_modules/').pop();
            const version = findV3Version(snapshot, packageName);
            // symlinked packages in workspaces do not have versions
            if (version) {
                createNode(packageName, version, path, nodes, keyMap, snapshot);
            }
        });
    }
    else {
        Object.entries(data.dependencies).forEach(([packageName, snapshot]) => {
            // we only care about dependencies of workspace packages
            if (snapshot.version?.startsWith('file:')) {
                if (snapshot.dependencies) {
                    Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
                        addV1Node(depName, depSnapshot, `${snapshot.version.slice(5)}/node_modules/${depName}`, nodes, keyMap);
                    });
                }
            }
            else {
                addV1Node(packageName, snapshot, `node_modules/${packageName}`, nodes, keyMap);
            }
        });
    }
    const results = {};
    // some packages can be both hoisted and nested
    // so we need to run this check once we have all the nodes and paths
    for (const [packageName, versionMap] of nodes.entries()) {
        const hoistedNode = keyMap.get(`node_modules/${packageName}`);
        if (hoistedNode) {
            hoistedNode.name = `npm:${packageName}`;
        }
        versionMap.forEach((node) => {
            results[node.name] = node;
        });
    }
    return { nodes: results, keyMap };
}
function addV1Node(packageName, snapshot, path, nodes, keyMap) {
    createNode(packageName, snapshot.version, path, nodes, keyMap, snapshot);
    // traverse nested dependencies
    if (snapshot.dependencies) {
        Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
            addV1Node(depName, depSnapshot, `${path}/node_modules/${depName}`, nodes, keyMap);
        });
    }
}
function createNode(packageName, version, key, nodes, keyMap, snapshot) {
    const existingNode = nodes.get(packageName)?.get(version);
    if (existingNode) {
        keyMap.set(key, existingNode);
        return;
    }
    const node = {
        type: 'npm',
        name: version ? `npm:${packageName}@${version}` : `npm:${packageName}`,
        data: {
            version,
            packageName,
            hash: snapshot.integrity ||
                (0, file_hasher_1.hashArray)(snapshot.resolved
                    ? [snapshot.resolved]
                    : version
                        ? [packageName, version]
                        : [packageName]),
        },
    };
    keyMap.set(key, node);
    if (!nodes.has(packageName)) {
        nodes.set(packageName, new Map([[version, node]]));
    }
    else {
        nodes.get(packageName).set(version, node);
    }
}
function findV3Version(snapshot, packageName) {
    let version = snapshot.version;
    const resolved = snapshot.resolved;
    // for tarball packages version might not exist or be useless
    if (!version || (resolved && !resolved.includes(version))) {
        version = resolved;
    }
    // for alias packages name is set
    if (snapshot.name && snapshot.name !== packageName) {
        if (version) {
            version = `npm:${snapshot.name}@${version}`;
        }
        else {
            version = `npm:${snapshot.name}`;
        }
    }
    return version;
}
function getDependencies(data, keyMap, ctx) {
    const dependencies = [];
    if (data.lockfileVersion > 1) {
        Object.entries(data.packages).forEach(([path, snapshot]) => {
            // we are skipping workspaces packages
            if (!keyMap.has(path)) {
                return;
            }
            const sourceName = keyMap.get(path).name;
            [
                snapshot.peerDependencies,
                snapshot.dependencies,
                snapshot.optionalDependencies,
            ].forEach((section) => {
                if (section) {
                    Object.entries(section).forEach(([name, versionRange]) => {
                        const target = findTarget(path, keyMap, name, versionRange);
                        if (target) {
                            const dep = {
                                source: sourceName,
                                target: target.name,
                                type: project_graph_1.DependencyType.static,
                            };
                            (0, project_graph_builder_1.validateDependency)(dep, ctx);
                            dependencies.push(dep);
                        }
                    });
                }
            });
        });
    }
    else {
        Object.entries(data.dependencies).forEach(([packageName, snapshot]) => {
            addV1NodeDependencies(`node_modules/${packageName}`, snapshot, dependencies, keyMap, ctx);
        });
    }
    return dependencies;
}
function findTarget(sourcePath, keyMap, targetName, versionRange, 
// When a package is found at a path but its version doesn't satisfy the
// range (e.g. due to npm overrides), we keep it as a fallback. npm already
// resolved this dependency to that location, so it is the correct target
// even though the semver check fails.
fallback) {
    if (sourcePath && !sourcePath.endsWith('/')) {
        sourcePath = `${sourcePath}/`;
    }
    const searchPath = `${sourcePath}node_modules/${targetName}`;
    if (keyMap.has(searchPath)) {
        const child = keyMap.get(searchPath);
        // if the version is alias to another package we need to parse the versions to compare
        if (child.data.version.startsWith('npm:') &&
            versionRange.startsWith('npm:')) {
            const nodeVersion = child.data.version.slice(child.data.version.indexOf('@', 5) + 1);
            const depVersion = versionRange.slice(versionRange.indexOf('@', 5) + 1);
            if (nodeVersion === depVersion || (0, semver_1.satisfies)(nodeVersion, depVersion)) {
                return child;
            }
        }
        else if (child.data.version === versionRange ||
            (0, semver_1.satisfies)(child.data.version, versionRange)) {
            return child;
        }
        // Version mismatch — save as fallback (could be an npm override)
        if (!fallback) {
            fallback = child;
        }
    }
    // the hoisted package did not match, this dependency is missing
    if (!sourcePath) {
        return fallback;
    }
    return findTarget(sourcePath.split('node_modules/').slice(0, -1).join('node_modules/'), keyMap, targetName, versionRange, fallback);
}
function addV1NodeDependencies(path, snapshot, dependencies, keyMap, ctx) {
    if (keyMap.has(path) && snapshot.requires) {
        const source = keyMap.get(path).name;
        Object.entries(snapshot.requires).forEach(([name, versionRange]) => {
            const target = findTarget(path, keyMap, name, versionRange);
            if (target) {
                const dep = {
                    source: source,
                    target: target.name,
                    type: project_graph_1.DependencyType.static,
                };
                (0, project_graph_builder_1.validateDependency)(dep, ctx);
                dependencies.push(dep);
            }
        });
    }
    if (snapshot.dependencies) {
        Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
            addV1NodeDependencies(`${path}/node_modules/${depName}`, depSnapshot, dependencies, keyMap, ctx);
        });
    }
    const { peerDependencies } = getPeerDependencies(path);
    if (peerDependencies) {
        const node = keyMap.get(path);
        Object.entries(peerDependencies).forEach(([depName, depSpec]) => {
            const target = findTarget(path, keyMap, depName, depSpec);
            if (target) {
                const dep = {
                    source: node.name,
                    target: target.name,
                    type: project_graph_1.DependencyType.static,
                };
                (0, project_graph_builder_1.validateDependency)(dep, ctx);
                dependencies.push(dep);
            }
        });
    }
}
function stringifyNpmLockfile(graph, rootLockFileContent, packageJson) {
    const rootLockFile = JSON.parse(rootLockFileContent);
    const { lockfileVersion } = JSON.parse(rootLockFileContent);
    const workspaceModulesFromGraph = (0, get_workspace_packages_from_graph_1.getWorkspacePackagesFromGraph)(graph);
    const mappedPackages = mapSnapshots(rootLockFile, graph);
    const workspaceModules = mapWorkspaceModules(packageJson, rootLockFile, workspaceModulesFromGraph);
    const output = {
        name: packageJson.name || rootLockFile.name,
        version: packageJson.version || '0.0.1',
        lockfileVersion: rootLockFile.lockfileVersion,
    };
    if (rootLockFile.requires) {
        output.requires = rootLockFile.requires;
    }
    if (packageJson.overrides && Object.keys(packageJson.overrides).length > 0) {
        output.overrides = packageJson.overrides;
    }
    if (lockfileVersion > 1) {
        const packages = mapV3Snapshots(mappedPackages, packageJson);
        output.packages = { ...packages, ...workspaceModules };
    }
    if (lockfileVersion < 3) {
        const dependencies = mapV1Snapshots(mappedPackages);
        output.dependencies = { ...dependencies, ...workspaceModules };
    }
    return JSON.stringify(output, null, 2);
}
const WORKSPACE_DEP_TYPES = [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
];
function mapWorkspaceModules(packageJson, rootLockFile, workspaceModules) {
    const output = {};
    const snapshotsByName = new Map();
    for (const snapshot of Object.values(rootLockFile.packages || rootLockFile.dependencies || {})) {
        if (snapshot.name)
            snapshotsByName.set(snapshot.name, snapshot);
    }
    // Walk transitive workspace deps so every workspace package
    // copy-workspace-modules writes to disk has matching lockfile entries.
    // Without this, `npm ci` errors with "Missing: <pkg> from lock file".
    const queue = Object.keys(packageJson.dependencies ?? {});
    const visited = new Set();
    while (queue.length > 0) {
        const pkgName = queue.shift();
        if (visited.has(pkgName) || !workspaceModules.has(pkgName))
            continue;
        visited.add(pkgName);
        const snapshot = snapshotsByName.get(pkgName);
        output[`node_modules/${pkgName}`] = {
            version: `file:./workspace_modules/${pkgName}`,
            resolved: `workspace_modules/${pkgName}`,
            link: true,
        };
        output[`workspace_modules/${pkgName}`] = {
            name: pkgName,
            version: `0.0.1`,
            dependencies: snapshot?.dependencies,
        };
        for (const depType of WORKSPACE_DEP_TYPES) {
            const deps = snapshot?.[depType];
            if (!deps)
                continue;
            for (const depName of Object.keys(deps))
                queue.push(depName);
        }
    }
    return output;
}
function mapV3Snapshots(mappedPackages, packageJson) {
    const output = {};
    const mappedPackageJson = mapPackageJsonWithWorkspaceModules(packageJson);
    output[''] = mappedPackageJson;
    mappedPackages.forEach((p) => {
        output[p.path] = p.valueV3;
    });
    return output;
}
function mapPackageJsonWithWorkspaceModules(packageJson) {
    for (const [pkgName, pkgVersion] of Object.entries(packageJson.dependencies ?? {})) {
        if (pkgVersion.startsWith('workspace:') || pkgVersion.startsWith('file:')) {
            packageJson.dependencies[pkgName] = `workspace_modules/${pkgName}`;
        }
    }
    return packageJson;
}
function mapV1Snapshots(mappedPackages) {
    const output = {};
    mappedPackages.forEach((p) => {
        getPackageParent(p.path, output)[p.name] = p.valueV1;
    });
    return output;
}
function getPackageParent(path, packages) {
    const segments = path.split(/\/?node_modules\//).slice(1, -1);
    if (!segments.length) {
        return packages;
    }
    let parent = packages[segments.shift()];
    if (!parent.dependencies) {
        parent.dependencies = {};
    }
    while (segments.length) {
        parent = parent.dependencies[segments.shift()];
        if (!parent.dependencies) {
            parent.dependencies = {};
        }
    }
    return parent.dependencies;
}
function mapSnapshots(rootLockFile, graph) {
    const nestedNodes = new Set();
    const visitedNodes = new Map();
    const remappedPackages = new Map();
    // add first level children
    Object.values(graph.externalNodes).forEach((node) => {
        if (node.name === `npm:${node.data.packageName}`) {
            const mappedPackage = mapPackage(rootLockFile, node.data.packageName, node.data.version);
            remappedPackages.set(mappedPackage.path, mappedPackage);
            visitedNodes.set(node, {
                packagePaths: new Set([mappedPackage.path]),
                unresolvedParents: new Set(),
            });
        }
        else {
            nestedNodes.add(node);
        }
    });
    let remappedPackagesArray;
    if (nestedNodes.size) {
        const invertedGraph = (0, operators_1.reverse)(graph);
        nestMappedPackages(invertedGraph, remappedPackages, nestedNodes, visitedNodes, rootLockFile);
        // initially we naively map package paths to topParent/../parent/child
        // but some of those should be nested higher up the tree
        remappedPackagesArray = elevateNestedPaths(remappedPackages);
    }
    else {
        remappedPackagesArray = Array.from(remappedPackages.values());
    }
    return remappedPackagesArray.sort((a, b) => a.path.localeCompare(b.path));
}
function mapPackage(rootLockFile, packageName, version, parentPath = '') {
    const lockfileVersion = rootLockFile.lockfileVersion;
    let valueV3, valueV1;
    if (lockfileVersion < 3) {
        valueV1 = findMatchingPackageV1(rootLockFile.dependencies, packageName, version);
    }
    if (lockfileVersion > 1) {
        valueV3 = findMatchingPackageV3(rootLockFile.packages, packageName, version);
    }
    return {
        path: parentPath + `node_modules/${packageName}`,
        name: packageName,
        valueV1,
        valueV3,
    };
}
function nestMappedPackages(invertedGraph, result, nestedNodes, visitedNodes, rootLockFile) {
    const initialSize = nestedNodes.size;
    if (!initialSize) {
        return;
    }
    nestedNodes.forEach((node) => {
        if (!visitedNodes.has(node)) {
            visitedNodes.set(node, {
                packagePaths: new Set(),
                unresolvedParents: new Set(invertedGraph.dependencies[node.name].map(({ target }) => target)),
            });
        }
        invertedGraph.dependencies[node.name].forEach(({ target }) => {
            if (!visitedNodes.get(node).unresolvedParents.has(target)) {
                return;
            }
            const targetNode = invertedGraph.externalNodes[target];
            if (visitedNodes.has(targetNode) &&
                !visitedNodes.get(targetNode).unresolvedParents.size) {
                visitedNodes.get(targetNode).packagePaths.forEach((path) => {
                    const mappedPackage = mapPackage(rootLockFile, node.data.packageName, node.data.version, path + '/');
                    result.set(mappedPackage.path, mappedPackage);
                    visitedNodes.get(node).packagePaths.add(mappedPackage.path);
                    visitedNodes.get(node).unresolvedParents.delete(target);
                });
            }
        });
        if (!visitedNodes.get(node).unresolvedParents.size) {
            nestedNodes.delete(node);
        }
    });
    if (initialSize === nestedNodes.size) {
        throw new Error([
            'Following packages could not be mapped to the NPM lockfile:',
            ...Array.from(nestedNodes).map((n) => `- ${n.name}`),
        ].join('\n'));
    }
    else {
        nestMappedPackages(invertedGraph, result, nestedNodes, visitedNodes, rootLockFile);
    }
}
// sort paths by number of segments and then alphabetically
function sortMappedPackagesPaths(mappedPackages) {
    return Array.from(mappedPackages.keys()).sort((a, b) => {
        const aLength = a.split('/node_modules/').length;
        const bLength = b.split('/node_modules/').length;
        if (aLength > bLength) {
            return 1;
        }
        if (aLength < bLength) {
            return -1;
        }
        return a.localeCompare(b);
    });
}
function elevateNestedPaths(remappedPackages) {
    const result = new Map();
    const sortedPaths = sortMappedPackagesPaths(remappedPackages);
    sortedPaths.forEach((path) => {
        const segments = path.split('/node_modules/');
        const mappedPackage = remappedPackages.get(path);
        // we keep hoisted packages intact
        if (segments.length === 1) {
            result.set(path, mappedPackage);
            return;
        }
        const packageName = segments.pop();
        const getNewPath = (segs) => `${segs.join('/node_modules/')}/node_modules/${packageName}`;
        // check if grandparent has the same package
        const shouldElevate = (segs) => {
            const elevatedPath = getNewPath(segs.slice(0, -1));
            if (result.has(elevatedPath)) {
                const match = result.get(elevatedPath);
                return (match.valueV1?.version === mappedPackage.valueV1?.version &&
                    match.valueV3?.version === mappedPackage.valueV3?.version);
            }
            return true;
        };
        while (segments.length > 1 && shouldElevate(segments)) {
            segments.pop();
        }
        const newPath = getNewPath(segments);
        if (path !== newPath) {
            if (!result.has(newPath)) {
                mappedPackage.path = newPath;
                result.set(newPath, mappedPackage);
            }
        }
        else {
            result.set(path, mappedPackage);
        }
    });
    return Array.from(result.values());
}
function findMatchingPackageV3(packages, name, version) {
    for (const [key, { dev, peer, ...snapshot }] of Object.entries(packages)) {
        if (key.endsWith(`node_modules/${name}`)) {
            if ([
                snapshot.version,
                snapshot.resolved,
                `npm:${snapshot.name}@${snapshot.version}`,
            ].includes(version)) {
                return snapshot;
            }
        }
    }
}
function findMatchingPackageV1(packages, name, version) {
    for (const [packageName, { dev, peer, dependencies, ...snapshot },] of Object.entries(packages)) {
        if (packageName === name) {
            if (snapshot.version === version) {
                return snapshot;
            }
        }
        if (dependencies) {
            const found = findMatchingPackageV1(dependencies, name, version);
            if (found) {
                return found;
            }
        }
    }
}
// NPM V1 does not track the peer dependencies in the lock file
// so we need to parse them directly from the package.json
function getPeerDependencies(path) {
    const fullPath = `${workspace_root_1.workspaceRoot}/${path}/package.json`;
    if ((0, fs_1.existsSync)(fullPath)) {
        const content = (0, fs_1.readFileSync)(fullPath, 'utf-8');
        const { peerDependencies, peerDependenciesMeta } = JSON.parse(content);
        return {
            ...(peerDependencies && { peerDependencies }),
            ...(peerDependenciesMeta && { peerDependenciesMeta }),
        };
    }
    else {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
            console.warn(`Could not find package.json at "${path}"`);
        }
        return {};
    }
}
