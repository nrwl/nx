"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPnpmLockfileNodes = getPnpmLockfileNodes;
exports.getPnpmLockfileDependencies = getPnpmLockfileDependencies;
exports.stringifyPnpmLockfile = stringifyPnpmLockfile;
const pnpm_normalizer_1 = require("./utils/pnpm-normalizer");
const package_json_1 = require("./utils/package-json");
const object_sort_1 = require("../../../utils/object-sort");
const project_graph_builder_1 = require("../../../project-graph/project-graph-builder");
const project_graph_1 = require("../../../config/project-graph");
const file_hasher_1 = require("../../../hasher/file-hasher");
const catalog_1 = require("../../../utils/catalog");
const project_graph_pruning_1 = require("./project-graph-pruning");
const path_1 = require("path");
const get_workspace_packages_from_graph_1 = require("../utils/get-workspace-packages-from-graph");
const semver_1 = require("semver");
const WORKSPACE_DEP_TYPES = [
    'dependencies',
    'optionalDependencies',
    'peerDependencies',
];
let currentLockFileHash;
let parsedLockFile;
function parsePnpmLockFile(lockFileContent, lockFileHash) {
    if (lockFileHash === currentLockFileHash) {
        return parsedLockFile;
    }
    const results = (0, pnpm_normalizer_1.parseAndNormalizePnpmLockfile)(lockFileContent);
    parsedLockFile = results;
    currentLockFileHash = lockFileHash;
    return results;
}
function getPnpmLockfileNodes(lockFileContent, lockFileHash) {
    const data = parsePnpmLockFile(lockFileContent, lockFileHash);
    if (+data.lockfileVersion.toString() >= 10) {
        console.warn('Nx was tested only with pnpm lockfile version 5-9. If you encounter any issues, please report them and downgrade to older version of pnpm.');
    }
    const isV5 = (0, pnpm_normalizer_1.isV5Syntax)(data);
    return getNodes(data, isV5);
}
function getPnpmLockfileDependencies(lockFileContent, lockFileHash, ctx, keyMap) {
    const data = parsePnpmLockFile(lockFileContent, lockFileHash);
    if (+data.lockfileVersion.toString() >= 10) {
        console.warn('Nx was tested only with pnpm lockfile version 5-9. If you encounter any issues, please report them and downgrade to older version of pnpm.');
    }
    const isV5 = (0, pnpm_normalizer_1.isV5Syntax)(data);
    return getDependencies(data, keyMap, isV5, ctx);
}
function invertRecordWithoutAliases(record) {
    const result = {};
    for (const [depName, depVersion] of Object.entries(record)) {
        if (isAliasVersion(depVersion)) {
            // Ignore alias specifiers so aliases do not replace actual package names
            continue;
        }
        result[depVersion] = depName;
    }
    return result;
}
const cachedInvertedRecords = new Map();
function matchPropValue(record, key, originalPackageName, recordName) {
    if (!record) {
        return undefined;
    }
    if (!cachedInvertedRecords.has(recordName)) {
        // Inversion is only for non-alias specs to avoid alias -> target mislabeling.
        cachedInvertedRecords.set(recordName, invertRecordWithoutAliases(record));
    }
    const packageName = cachedInvertedRecords.get(recordName)[key];
    if (packageName) {
        return packageName;
    }
    // check if non-aliased name is found
    if (record[originalPackageName] &&
        key.startsWith(`/${originalPackageName}/${record[originalPackageName]}`)) {
        return originalPackageName;
    }
}
function matchedDependencyName(importer, key, originalPackageName) {
    return (matchPropValue(importer.dependencies, key, originalPackageName, 'dependencies') ||
        matchPropValue(importer.optionalDependencies, key, originalPackageName, 'optionalDependencies') ||
        matchPropValue(importer.peerDependencies, key, originalPackageName, 'peerDependencies'));
}
function createHashFromSnapshot(snapshot, patchHash) {
    const baseHash = snapshot.resolution?.['integrity'] ||
        (snapshot.resolution?.['tarball']
            ? (0, file_hasher_1.hashArray)([snapshot.resolution['tarball']])
            : undefined);
    // If there's a patch hash, combine it with the base hash
    if (patchHash && baseHash) {
        return (0, file_hasher_1.hashArray)([baseHash, patchHash]);
    }
    return baseHash ?? patchHash;
}
function isAliasVersion(depVersion) {
    return depVersion.startsWith('/') || depVersion.includes('@');
}
/**
 * Finds the appropriate patch hash for a package based on its name and version.
 * Follows PNPM's priority order (https://pnpm.io/settings#patcheddependencies):
 * 1. Exact version match (e.g., "vitest@3.2.4") - highest priority
 * 2. Version range match (e.g., "vitest@^3.0.0")
 * 3. Name-only match (e.g., "vitest") - lowest priority
 */
function findPatchHash(patchEntriesByPackage, packageName, version) {
    const entries = patchEntriesByPackage.get(packageName);
    if (!entries) {
        return undefined; // No patches for this package
    }
    // Check for exact version match first (highest priority)
    const exactMatch = entries.find((entry) => entry.versionSpecifier === version);
    if (exactMatch) {
        return exactMatch.hash;
    }
    // Check for version range matches
    for (const entry of entries) {
        // Skip name-only entries (will be handled at the end with lowest priority)
        if (entry.versionSpecifier === null) {
            continue;
        }
        if ((0, semver_1.validRange)(entry.versionSpecifier)) {
            try {
                if ((0, semver_1.satisfies)(version, entry.versionSpecifier)) {
                    return entry.hash;
                }
            }
            catch {
                // Invalid semver range, skip
            }
        }
    }
    // Fall back to name-only match (lowest priority)
    const nameOnlyMatch = entries.find((entry) => entry.versionSpecifier === null);
    return nameOnlyMatch?.hash;
}
function getNodes(data, isV5) {
    cachedInvertedRecords.clear();
    const keyMap = new Map();
    const nodes = new Map();
    // Extract and pre-parse patch information from patchedDependencies section
    const patchEntriesByPackage = new Map();
    if (data.patchedDependencies) {
        for (const specifier of Object.keys(data.patchedDependencies)) {
            const patchInfo = data.patchedDependencies[specifier];
            if (patchInfo && typeof patchInfo === 'object' && 'hash' in patchInfo) {
                const packageName = extractNameFromKey(specifier, false);
                const versionSpecifier = getVersion(specifier, packageName) || null;
                if (!patchEntriesByPackage.has(packageName)) {
                    patchEntriesByPackage.set(packageName, []);
                }
                patchEntriesByPackage.get(packageName).push({
                    versionSpecifier,
                    hash: patchInfo.hash,
                });
            }
        }
    }
    const maybeAliasedPackageVersions = new Map(); // <version, alias>
    if (data.importers['.'].optionalDependencies) {
        for (const [depName, depVersion] of Object.entries(data.importers['.'].optionalDependencies)) {
            if (isAliasVersion(depVersion)) {
                maybeAliasedPackageVersions.set(depVersion, depName);
            }
        }
    }
    if (data.importers['.'].devDependencies) {
        for (const [depName, depVersion] of Object.entries(data.importers['.'].devDependencies)) {
            if (isAliasVersion(depVersion)) {
                maybeAliasedPackageVersions.set(depVersion, depName);
            }
        }
    }
    if (data.importers['.'].dependencies) {
        for (const [depName, depVersion] of Object.entries(data.importers['.'].dependencies)) {
            if (isAliasVersion(depVersion)) {
                maybeAliasedPackageVersions.set(depVersion, depName);
            }
        }
    }
    const packageNames = new Set();
    for (const [key, snapshot] of Object.entries(data.packages)) {
        let packageNameObj;
        const originalPackageName = extractNameFromKey(key, isV5);
        if (!originalPackageName) {
            continue;
        }
        // Extract version from the key to match against patch specifiers
        const versionFromKey = getVersion(key, originalPackageName);
        // Parse the base version (without peer dependency info, etc.)
        const baseVersion = parseBaseVersion(versionFromKey, isV5);
        // Find the appropriate patch hash using PNPM's priority order:
        // 1. Exact version match, 2. Version range match, 3. Name-only match
        const patchHash = findPatchHash(patchEntriesByPackage, originalPackageName, baseVersion);
        const hash = createHashFromSnapshot(snapshot, patchHash);
        // snapshot already has a name
        if (snapshot.name) {
            packageNameObj = {
                key,
                packageName: snapshot.name,
                hash,
            };
        }
        const rootDependencyName = matchedDependencyName(data.importers['.'], key, originalPackageName) ||
            matchedDependencyName(data.importers['.'], `/${key}`, originalPackageName) ||
            // only root importers have devDependencies
            matchPropValue(data.importers['.'].devDependencies, key, originalPackageName, 'devDependencies') ||
            matchPropValue(data.importers['.'].devDependencies, `/${key}`, originalPackageName, 'devDependencies');
        if (rootDependencyName) {
            packageNameObj = {
                key,
                packageName: rootDependencyName,
                hash,
            };
        }
        if (!snapshot.name && !rootDependencyName) {
            packageNameObj = {
                key,
                packageName: originalPackageName,
                hash,
            };
        }
        if (snapshot.peerDependencies) {
            for (const [depName, depVersion] of Object.entries(snapshot.peerDependencies)) {
                if (isAliasVersion(depVersion)) {
                    maybeAliasedPackageVersions.set(depVersion, depName);
                }
            }
        }
        if (snapshot.optionalDependencies) {
            for (const [depName, depVersion] of Object.entries(snapshot.optionalDependencies)) {
                if (isAliasVersion(depVersion)) {
                    maybeAliasedPackageVersions.set(depVersion, depName);
                }
            }
        }
        if (snapshot.dependencies) {
            for (const [depName, depVersion] of Object.entries(snapshot.dependencies)) {
                if (isAliasVersion(depVersion)) {
                    maybeAliasedPackageVersions.set(depVersion, depName);
                }
            }
        }
        if (packageNameObj) {
            packageNames.add(packageNameObj);
        }
        const aliasedDep = maybeAliasedPackageVersions.get(`/${key}`);
        if (aliasedDep) {
            packageNames.add({
                key,
                packageName: aliasedDep,
                hash,
                alias: true,
            });
        }
        const localAlias = maybeAliasedPackageVersions.get(key);
        if (localAlias) {
            packageNames.add({
                key,
                packageName: localAlias,
                hash,
                alias: true,
            });
        }
    }
    for (const { key, packageName, hash, alias } of packageNames) {
        const rawVersion = findVersion(key, packageName, isV5, alias);
        if (!rawVersion) {
            continue;
        }
        const version = parseBaseVersion(rawVersion, isV5);
        if (!version) {
            continue;
        }
        if (!nodes.has(packageName)) {
            nodes.set(packageName, new Map());
        }
        if (!nodes.get(packageName).has(version)) {
            const node = {
                type: 'npm',
                name: version && !version.startsWith('npm:')
                    ? `npm:${packageName}@${version}`
                    : `npm:${packageName}`,
                data: {
                    version,
                    packageName,
                    hash: hash ?? (0, file_hasher_1.hashArray)([packageName, version]),
                },
            };
            nodes.get(packageName).set(version, node);
            if (!keyMap.has(key)) {
                keyMap.set(key, new Set([node]));
            }
            else {
                keyMap.get(key).add(node);
            }
        }
        else {
            const node = nodes.get(packageName).get(version);
            if (!keyMap.has(key)) {
                keyMap.set(key, new Set([node]));
            }
            else {
                keyMap.get(key).add(node);
            }
        }
    }
    const hoistedDeps = (0, pnpm_normalizer_1.loadPnpmHoistedDepsDefinition)();
    // Pre-build packageName -> key index for O(1) lookup instead of O(n) find() per package
    const hoistedKeysByPackage = new Map();
    for (const key of Object.keys(hoistedDeps)) {
        if (key.startsWith('/')) {
            // Extract package name from key format: /{packageName}/{version}... or /@scope/name/{version}...
            const withoutSlash = key.slice(1);
            const slashIndex = withoutSlash.startsWith('@')
                ? withoutSlash.indexOf('/', withoutSlash.indexOf('/') + 1)
                : withoutSlash.indexOf('/');
            if (slashIndex > 0) {
                const pkgName = withoutSlash.slice(0, slashIndex);
                if (!hoistedKeysByPackage.has(pkgName)) {
                    hoistedKeysByPackage.set(pkgName, key);
                }
            }
        }
    }
    const results = {};
    for (const [packageName, versionMap] of nodes.entries()) {
        let hoistedNode;
        if (versionMap.size === 1) {
            hoistedNode = versionMap.values().next().value;
        }
        else {
            const hoistedVersion = getHoistedVersion(packageName, isV5, hoistedKeysByPackage);
            hoistedNode = versionMap.get(hoistedVersion);
        }
        if (hoistedNode) {
            hoistedNode.name = `npm:${packageName}`;
        }
        versionMap.forEach((node) => {
            results[node.name] = node;
        });
    }
    return { nodes: results, keyMap };
}
function getHoistedVersion(packageName, isV5, hoistedKeysByPackage) {
    let version = (0, package_json_1.getHoistedPackageVersion)(packageName);
    if (!version) {
        // Use pre-built index for O(1) lookup
        const key = hoistedKeysByPackage.get(packageName);
        if (key) {
            version = parseBaseVersion(getVersion(key.slice(1), packageName), isV5);
        }
        else {
            // pnpm might not hoist every package
            // similarly those packages will not be available to be used via import
            return;
        }
    }
    return version;
}
function getDependencies(data, keyMap, isV5, ctx) {
    const results = [];
    Object.keys(data.packages).forEach((key) => {
        const snapshot = data.packages[key];
        const nodes = keyMap.get(key);
        nodes.forEach((node) => {
            [snapshot.dependencies, snapshot.optionalDependencies].forEach((section) => {
                if (section) {
                    Object.keys(section).forEach((name) => {
                        const versionRange = section[name];
                        const version = parseBaseVersion(findVersion(versionRange, name, isV5), isV5);
                        const target = ctx.externalNodes[`npm:${name}@${version}`] ||
                            ctx.externalNodes[`npm:${name}`];
                        if (target) {
                            const dep = {
                                source: node.name,
                                target: target.name,
                                type: project_graph_1.DependencyType.static,
                            };
                            (0, project_graph_builder_1.validateDependency)(dep, ctx);
                            results.push(dep);
                        }
                    });
                }
            });
        });
    });
    return results;
}
function parseBaseVersion(rawVersion, isV5) {
    return isV5 ? rawVersion.split('_')[0] : rawVersion.split('(')[0];
}
function stringifyPnpmLockfile(graph, rootLockFileContent, packageJson, workspaceRoot) {
    const data = (0, pnpm_normalizer_1.parseAndNormalizePnpmLockfile)(rootLockFileContent);
    const { lockfileVersion, packages, importers } = data;
    const { snapshot: rootSnapshot, importers: requiredImporters } = mapRootSnapshot(packageJson, importers, packages, graph, +lockfileVersion, workspaceRoot);
    const snapshots = mapSnapshots(data.packages, graph.externalNodes, +lockfileVersion);
    const workspaceModules = (0, get_workspace_packages_from_graph_1.getWorkspacePackagesFromGraph)(graph);
    // Walk transitive workspace deps so every package copy-workspace-modules
    // writes to disk has a matching importer block. Without this, pnpm errors
    // with ERR_PNPM_OUTDATED_LOCKFILE on transitive workspace chains.
    const allRequiredImporters = { ...requiredImporters };
    const queue = Object.keys(requiredImporters);
    while (queue.length > 0) {
        const pkgName = queue.shift();
        const importer = importers[allRequiredImporters[pkgName]];
        if (!importer)
            continue;
        for (const depType of WORKSPACE_DEP_TYPES) {
            const deps = importer[depType];
            if (!deps)
                continue;
            for (const depName of Object.keys(deps)) {
                if (workspaceModules.has(depName) && !allRequiredImporters[depName]) {
                    allRequiredImporters[depName] =
                        workspaceModules.get(depName).data.root;
                    queue.push(depName);
                }
            }
        }
    }
    const workspaceDependencyImporters = {};
    for (const [packageName, importerPath] of Object.entries(allRequiredImporters)) {
        const baseImporter = importers[importerPath];
        if (!baseImporter)
            continue;
        const importer = structuredClone(baseImporter);
        for (const depType of WORKSPACE_DEP_TYPES) {
            const deps = importer[depType];
            if (!deps)
                continue;
            for (const depName of Object.keys(deps)) {
                if (!workspaceModules.has(depName))
                    continue;
                // All workspace modules are siblings under workspace_modules/, so the
                // relative path between them is relative(packageName, depName).
                // Specifier must match the file: ref copy-workspace-modules writes
                // to the package's package.json — pnpm errors on a mismatch.
                const rel = (0, path_1.relative)(packageName, depName).split(path_1.sep).join('/');
                if (!importer.specifiers)
                    importer.specifiers = {};
                importer.specifiers[depName] = `file:${rel}`;
                deps[depName] = `link:${rel}`;
            }
        }
        workspaceDependencyImporters[`workspace_modules/${packageName}`] = importer;
    }
    const output = {
        ...data,
        lockfileVersion,
        importers: {
            '.': rootSnapshot,
            ...workspaceDependencyImporters,
        },
        packages: (0, object_sort_1.sortObjectByKeys)(snapshots),
    };
    return (0, pnpm_normalizer_1.stringifyToPnpmYaml)(output);
}
function mapSnapshots(packages, nodes, lockfileVersion) {
    const result = {};
    Object.values(nodes).forEach((node) => {
        const matchedKeys = findOriginalKeys(packages, node, lockfileVersion, {
            returnFullKey: true,
        });
        // the package manager doesn't check for types of dependencies
        // so we can safely set all to prod
        matchedKeys.forEach(([key, snapshot]) => {
            if (lockfileVersion >= 9) {
                delete snapshot['dev'];
                result[key] = snapshot;
            }
            else {
                snapshot['dev'] = false; // all dependencies are prod
                remapDependencies(snapshot);
                if (snapshot.resolution?.['tarball']) {
                    // tarballs are not prefixed with /
                    result[key] = snapshot;
                }
                else {
                    result[`/${key}`] = snapshot;
                }
            }
        });
    });
    return result;
}
function remapDependencies(snapshot) {
    [
        'dependencies',
        'optionalDependencies',
        'devDependencies',
        'peerDependencies',
    ].forEach((depType) => {
        if (snapshot[depType]) {
            for (const [packageName, version] of Object.entries(snapshot[depType])) {
                if (version.match(/^[a-zA-Z]+.*/)) {
                    // remap packageName@version to packageName/version
                    snapshot[depType][packageName] = `/${version.replace(/([a-zA-Z].+)@/, '$1/')}`;
                }
            }
        }
    });
}
function findOriginalKeys(packages, { data: { packageName, version } }, lockfileVersion, { returnFullKey } = {}) {
    const matchedKeys = [];
    for (const key of Object.keys(packages)) {
        const snapshot = packages[key];
        // tarball package
        if (key.startsWith(`${packageName}@${version}`) &&
            snapshot.resolution?.['tarball']) {
            matchedKeys.push([getVersion(key, packageName), snapshot]);
        }
        // standard package
        if (lockfileVersion < 6 && key.startsWith(`${packageName}/${version}`)) {
            matchedKeys.push([
                returnFullKey ? key : getVersion(key, packageName),
                snapshot,
            ]);
        }
        if (lockfileVersion >= 6 &&
            lockfileVersion < 9 &&
            key.startsWith(`${packageName}@${version}`)) {
            matchedKeys.push([
                // we need to replace the @ with / for v5-7 syntax because the dpParse function expects old format
                returnFullKey
                    ? key.replace(`${packageName}@${version}`, `${packageName}/${version}`)
                    : getVersion(key, packageName),
                snapshot,
            ]);
        }
        if (lockfileVersion >= 9 && key.startsWith(`${packageName}@${version}`)) {
            matchedKeys.push([
                returnFullKey ? key : getVersion(key, packageName),
                snapshot,
            ]);
        }
        // alias package
        if (versionIsAlias(key, version, lockfileVersion)) {
            if (lockfileVersion >= 9) {
                // no postprocessing needed for v9
                matchedKeys.push([key, snapshot]);
            }
            else {
                // for root specifiers we need to ensure alias is prefixed with /
                const prefixedKey = returnFullKey ? key : `/${key}`;
                const mappedKey = prefixedKey.replace(/(\/?..+)@/, '$1/');
                matchedKeys.push([mappedKey, snapshot]);
            }
        }
    }
    return matchedKeys;
}
// check if version has a form of npm:packageName@version and
// key starts with /packageName/version
function versionIsAlias(key, versionExpr, lockfileVersion) {
    const PREFIX = 'npm:';
    if (!versionExpr.startsWith(PREFIX))
        return false;
    const indexOfVersionSeparator = versionExpr.indexOf('@', PREFIX.length + 1);
    const packageName = versionExpr.slice(PREFIX.length, indexOfVersionSeparator);
    const version = versionExpr.slice(indexOfVersionSeparator + 1);
    return lockfileVersion < 6
        ? key.startsWith(`${packageName}/${version}`)
        : key.startsWith(`${packageName}@${version}`);
}
function mapRootSnapshot(packageJson, rootImporters, packages, graph, lockfileVersion, workspaceRoot) {
    const workspaceModules = (0, get_workspace_packages_from_graph_1.getWorkspacePackagesFromGraph)(graph);
    const snapshot = { specifiers: {} };
    const importers = {};
    [
        'dependencies',
        'optionalDependencies',
        'devDependencies',
        'peerDependencies',
    ].forEach((depType) => {
        if (packageJson[depType]) {
            Object.keys(packageJson[depType]).forEach((packageName) => {
                let version = packageJson[depType][packageName];
                const manager = (0, catalog_1.getCatalogManager)(workspaceRoot);
                if (manager?.isCatalogReference(version)) {
                    version = manager.resolveCatalogReference(workspaceRoot, packageName, version);
                    if (!version) {
                        throw new Error(`Could not resolve catalog reference for package ${packageName}@${version}.`);
                    }
                }
                if (workspaceModules.has(packageName)) {
                    for (const [importerPath, importerSnapshot] of Object.entries(rootImporters)) {
                        const workspaceDep = importerSnapshot.dependencies &&
                            importerSnapshot.dependencies[packageName];
                        if (workspaceDep) {
                            const workspaceDepImporterPath = workspaceDep.replace('link:', '');
                            const importerKeyForPackage = (0, path_1.join)(importerPath, workspaceDepImporterPath);
                            importers[packageName] = importerKeyForPackage;
                            snapshot.specifiers[packageName] =
                                `file:./workspace_modules/${packageName}`;
                            snapshot.dependencies = snapshot.dependencies || {};
                            snapshot.dependencies[packageName] =
                                `link:./workspace_modules/${packageName}`;
                            break;
                        }
                    }
                }
                else {
                    const node = graph.externalNodes[`npm:${packageName}@${version}`] ||
                        (graph.externalNodes[`npm:${packageName}`] &&
                            graph.externalNodes[`npm:${packageName}`].data.version === version
                            ? graph.externalNodes[`npm:${packageName}`]
                            : (0, project_graph_pruning_1.findNodeMatchingVersion)(graph, packageName, version));
                    if (!node) {
                        throw new Error(`Could not find external node for package ${packageName}@${version}.`);
                    }
                    snapshot.specifiers[packageName] = version;
                    // peer dependencies are mapped to dependencies
                    let section = depType === 'peerDependencies' ? 'dependencies' : depType;
                    snapshot[section] = snapshot[section] || {};
                    snapshot[section][packageName] = findOriginalKeys(packages, node, lockfileVersion)[0][0];
                }
            });
        }
    });
    Object.keys(snapshot).forEach((key) => {
        snapshot[key] = (0, object_sort_1.sortObjectByKeys)(snapshot[key]);
    });
    return { snapshot, importers };
}
function findVersion(key, packageName, isV5, alias) {
    if (isV5 && key.startsWith(`${packageName}/`)) {
        return getVersion(key, packageName);
    }
    // this matches v6 syntax and tarball packages
    if (key.startsWith(`${packageName}@`)) {
        return getVersion(key, packageName);
    }
    if (alias) {
        const aliasName = isV5
            ? key.slice(0, key.lastIndexOf('/'))
            : key.slice(0, key.indexOf('@', 2)); // we use 2 to ensure we don't catch the first @
        const version = getVersion(key, aliasName);
        return `npm:${aliasName}@${version}`;
    }
    // for tarball package the entire key is the version spec
    return key;
}
function getVersion(key, packageName) {
    return key.slice(packageName.length + 1);
}
function extractNameFromKey(key, isV5) {
    const versionSeparator = isV5 ? '/' : '@';
    if (key.startsWith('@')) {
        // Scoped package (e.g., "@babel/core@7.12.5" or "@babel/core/7.12.5")
        // Find the end of scope, then look for the first version separator after that
        const scopeEnd = key.indexOf('/');
        const sepIndex = scopeEnd === -1 ? -1 : key.indexOf(versionSeparator, scopeEnd + 1);
        return sepIndex === -1 ? key : key.slice(0, sepIndex);
    }
    else {
        // Non-scoped package (e.g., "react@7.12.5" or "react/7.12.5")
        const sepIndex = key.indexOf(versionSeparator);
        return sepIndex === -1 ? key : key.slice(0, sepIndex);
    }
}
