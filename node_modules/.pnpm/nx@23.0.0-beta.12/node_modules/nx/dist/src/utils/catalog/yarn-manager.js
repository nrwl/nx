"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YarnCatalogManager = void 0;
const js_yaml_1 = require("@zkochan/js-yaml");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const fileutils_1 = require("../fileutils");
const output_1 = require("../output");
const manager_1 = require("./manager");
const YARNRC_FILENAME = '.yarnrc.yml';
/**
 * Yarn Berry (v4+) catalog manager implementation
 */
class YarnCatalogManager {
    constructor() {
        this.name = 'yarn';
        this.catalogProtocol = 'catalog:';
    }
    isCatalogReference(version) {
        return version.startsWith(this.catalogProtocol);
    }
    parseCatalogReference(version) {
        if (!this.isCatalogReference(version)) {
            return null;
        }
        const catalogName = version.substring(this.catalogProtocol.length);
        // Normalize both "catalog:" and "catalog:default" to the same representation
        const isDefault = !catalogName || catalogName === 'default';
        return {
            catalogName: isDefault ? undefined : catalogName,
            isDefaultCatalog: isDefault,
        };
    }
    getCatalogDefinitionFilePaths() {
        return [YARNRC_FILENAME];
    }
    getCatalogDefinitions(treeOrRoot) {
        if (typeof treeOrRoot === 'string') {
            const configPath = (0, node_path_1.join)(treeOrRoot, YARNRC_FILENAME);
            if (!(0, node_fs_1.existsSync)(configPath)) {
                return null;
            }
            return readConfigFromFs(configPath);
        }
        else {
            if (!treeOrRoot.exists(YARNRC_FILENAME)) {
                return null;
            }
            return readConfigFromTree(treeOrRoot, YARNRC_FILENAME);
        }
    }
    resolveCatalogReference(treeOrRoot, packageName, version) {
        const catalogRef = this.parseCatalogReference(version);
        if (!catalogRef) {
            return null;
        }
        const catalogDefs = this.getCatalogDefinitions(treeOrRoot);
        if (!catalogDefs) {
            return null;
        }
        let catalogToUse;
        if (catalogRef.isDefaultCatalog) {
            // Check both locations for default catalog
            catalogToUse = catalogDefs.catalog ?? catalogDefs.catalogs?.default;
        }
        else if (catalogRef.catalogName) {
            catalogToUse = catalogDefs.catalogs?.[catalogRef.catalogName];
        }
        return catalogToUse?.[packageName] || null;
    }
    validateCatalogReference(treeOrRoot, packageName, version) {
        const catalogRef = this.parseCatalogReference(version);
        if (!catalogRef) {
            throw new Error(`Invalid catalog reference syntax: "${version}". Expected format: "catalog:" or "catalog:name"`);
        }
        const catalogDefs = this.getCatalogDefinitions(treeOrRoot);
        if (!catalogDefs) {
            throw new Error((0, manager_1.formatCatalogError)(`Cannot get Yarn catalog definitions. No ${YARNRC_FILENAME} found in workspace root.`, [`Create a ${YARNRC_FILENAME} file in your workspace root`]));
        }
        let catalogToUse;
        if (catalogRef.isDefaultCatalog) {
            const hasCatalog = !!catalogDefs.catalog;
            const hasCatalogsDefault = !!catalogDefs.catalogs?.default;
            // Error if both defined
            if (hasCatalog && hasCatalogsDefault) {
                throw new Error("The 'default' catalog was defined multiple times. Use the 'catalog' field or 'catalogs.default', but not both.");
            }
            catalogToUse = catalogDefs.catalog ?? catalogDefs.catalogs?.default;
            if (!catalogToUse) {
                const availableCatalogs = Object.keys(catalogDefs.catalogs || {});
                const suggestions = [
                    `Define a default catalog in ${YARNRC_FILENAME} under the "catalog" key`,
                ];
                if (availableCatalogs.length > 0) {
                    suggestions.push(`Or select from the available named catalogs: ${availableCatalogs
                        .map((c) => `"catalog:${c}"`)
                        .join(', ')}`);
                }
                throw new Error((0, manager_1.formatCatalogError)(`No default catalog defined in ${YARNRC_FILENAME}`, suggestions));
            }
        }
        else if (catalogRef.catalogName) {
            catalogToUse = catalogDefs.catalogs?.[catalogRef.catalogName];
            if (!catalogToUse) {
                const availableCatalogs = Object.keys(catalogDefs.catalogs || {}).filter((c) => c !== 'default');
                const defaultCatalog = !!catalogDefs.catalog
                    ? 'catalog'
                    : !catalogDefs.catalogs?.default
                        ? 'catalogs.default'
                        : null;
                const suggestions = [
                    `Define the catalog in ${YARNRC_FILENAME} under the "catalogs" key`,
                ];
                if (availableCatalogs.length > 0) {
                    suggestions.push(`Or select from the available named catalogs: ${availableCatalogs
                        .map((c) => `"catalog:${c}"`)
                        .join(', ')}`);
                }
                if (defaultCatalog) {
                    suggestions.push(`Or use the default catalog ("${defaultCatalog}")`);
                }
                throw new Error((0, manager_1.formatCatalogError)(`Catalog "${catalogRef.catalogName}" not found in ${YARNRC_FILENAME}`, suggestions));
            }
        }
        if (!catalogToUse[packageName]) {
            let catalogName;
            if (catalogRef.isDefaultCatalog) {
                // Context-aware messaging based on which location exists
                const hasCatalog = !!catalogDefs.catalog;
                catalogName = hasCatalog
                    ? 'default catalog ("catalog")'
                    : 'default catalog ("catalogs.default")';
            }
            else {
                catalogName = `catalog '${catalogRef.catalogName}'`;
            }
            const availablePackages = Object.keys(catalogToUse);
            const suggestions = [
                `Add "${packageName}" to ${catalogName} in ${YARNRC_FILENAME}`,
            ];
            if (availablePackages.length > 0) {
                suggestions.push(`Or select from the available packages in ${catalogName}: ${availablePackages
                    .map((p) => `"${p}"`)
                    .join(', ')}`);
            }
            throw new Error((0, manager_1.formatCatalogError)(`Package "${packageName}" not found in ${catalogName}`, suggestions));
        }
    }
    updateCatalogVersions(treeOrRoot, updates) {
        let checkExists;
        let readYaml;
        let writeYaml;
        if (typeof treeOrRoot === 'string') {
            const configPath = (0, node_path_1.join)(treeOrRoot, YARNRC_FILENAME);
            checkExists = () => (0, node_fs_1.existsSync)(configPath);
            readYaml = () => (0, node_fs_1.readFileSync)(configPath, 'utf-8');
            writeYaml = (content) => (0, node_fs_1.writeFileSync)(configPath, content, 'utf-8');
        }
        else {
            checkExists = () => treeOrRoot.exists(YARNRC_FILENAME);
            readYaml = () => treeOrRoot.read(YARNRC_FILENAME, 'utf-8');
            writeYaml = (content) => treeOrRoot.write(YARNRC_FILENAME, content);
        }
        if (!checkExists()) {
            output_1.output.warn({
                title: `No ${YARNRC_FILENAME} found`,
                bodyLines: [
                    `Cannot update catalog versions without a ${YARNRC_FILENAME} file.`,
                    `Create a ${YARNRC_FILENAME} file to use catalogs.`,
                ],
            });
            return;
        }
        try {
            const configContent = readYaml();
            const configData = (0, js_yaml_1.load)(configContent) || {};
            let hasChanges = false;
            for (const update of updates) {
                const { packageName, version, catalogName } = update;
                const normalizedCatalogName = catalogName === 'default' ? undefined : catalogName;
                let targetCatalog;
                if (!normalizedCatalogName) {
                    // Default catalog - update whichever exists, prefer catalog over catalogs.default
                    if (configData.catalog) {
                        targetCatalog = configData.catalog;
                    }
                    else if (configData.catalogs?.default) {
                        targetCatalog = configData.catalogs.default;
                    }
                    else {
                        // Neither exists, create catalog (shorthand syntax)
                        configData.catalog ??= {};
                        targetCatalog = configData.catalog;
                    }
                }
                else {
                    // Named catalog
                    configData.catalogs ??= {};
                    configData.catalogs[normalizedCatalogName] ??= {};
                    targetCatalog = configData.catalogs[normalizedCatalogName];
                }
                if (targetCatalog[packageName] !== version) {
                    targetCatalog[packageName] = version;
                    hasChanges = true;
                }
            }
            if (hasChanges) {
                writeYaml((0, js_yaml_1.dump)(configData, {
                    indent: 2,
                    quotingType: '"',
                    forceQuotes: true,
                }));
            }
        }
        catch (error) {
            output_1.output.error({
                title: 'Failed to update catalog versions',
                bodyLines: [error instanceof Error ? error.message : String(error)],
            });
            throw error;
        }
    }
}
exports.YarnCatalogManager = YarnCatalogManager;
function readConfigFromFs(path) {
    try {
        return (0, fileutils_1.readYamlFile)(path);
    }
    catch (error) {
        output_1.output.warn({
            title: `Unable to parse ${YARNRC_FILENAME}`,
            bodyLines: [error.toString()],
        });
        return null;
    }
}
function readConfigFromTree(tree, path) {
    const content = tree.read(path, 'utf-8');
    try {
        return (0, js_yaml_1.load)(content, { filename: path });
    }
    catch (error) {
        output_1.output.warn({
            title: `Unable to parse ${YARNRC_FILENAME}`,
            bodyLines: [error.toString()],
        });
        return null;
    }
}
