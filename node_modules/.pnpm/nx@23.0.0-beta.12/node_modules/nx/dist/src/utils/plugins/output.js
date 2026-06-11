"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPlugins = listPlugins;
exports.listAlsoAvailableCorePlugins = listAlsoAvailableCorePlugins;
exports.listPowerpackPlugins = listPowerpackPlugins;
exports.listPluginCapabilities = listPluginCapabilities;
exports.formatPluginCapabilitiesAsJson = formatPluginCapabilitiesAsJson;
exports.formatPluginsAsJson = formatPluginsAsJson;
const tslib_1 = require("tslib");
const path_1 = require("path");
const pc = tslib_1.__importStar(require("picocolors"));
const output_1 = require("../output");
const package_manager_1 = require("../package-manager");
const workspace_root_1 = require("../workspace-root");
const core_plugins_1 = require("./core-plugins");
const plugin_capabilities_1 = require("./plugin-capabilities");
const package_json_1 = require("../package-json");
function listPlugins(plugins, title) {
    package_json_1.readModulePackageJson;
    const bodyLines = [];
    for (const [, p] of plugins) {
        const capabilities = [];
        if (hasElements(p.executors)) {
            capabilities.push('executors');
        }
        if (hasElements(p.generators)) {
            capabilities.push('generators');
        }
        if (p.projectGraphExtension) {
            capabilities.push('graph-extension');
        }
        if (p.projectInference) {
            capabilities.push('project-inference');
        }
        bodyLines.push(`${pc.bold(p.name)} ${capabilities.length >= 1 ? `(${capabilities.join()})` : ''}`);
    }
    output_1.output.log({
        title: title,
        bodyLines: bodyLines,
    });
}
function listAlsoAvailableCorePlugins(installedPlugins) {
    const alsoAvailable = core_plugins_1.CORE_PLUGINS.filter((p) => !installedPlugins.has(p.name));
    if (alsoAvailable.length) {
        output_1.output.log({
            title: `Also available:`,
            bodyLines: alsoAvailable.map((p) => {
                return `${pc.bold(p.name)} (${p.capabilities})`;
            }),
        });
    }
}
function listPowerpackPlugins() {
    const powerpackLink = 'https://nx.dev/plugin-registry#powerpack';
    output_1.output.log({
        title: `Available Powerpack Plugins: ${powerpackLink}`,
    });
}
async function listPluginCapabilities(pluginName, projects, json = false) {
    const plugin = await (0, plugin_capabilities_1.getPluginCapabilities)(workspace_root_1.workspaceRoot, pluginName, projects);
    if (!plugin) {
        if (json) {
            console.log(JSON.stringify({ error: `${pluginName} is not installed` }));
            return;
        }
        const pmc = (0, package_manager_1.getPackageManagerCommand)();
        output_1.output.note({
            title: `${pluginName} is not currently installed`,
            bodyLines: [
                `Use "${pmc.addDev} ${pluginName}" to install the plugin.`,
                `After that, use "${pmc.exec} nx g ${pluginName}:init" to add the required peer deps and initialize the plugin.`,
            ],
        });
        return;
    }
    const hasBuilders = hasElements(plugin.executors);
    const hasGenerators = hasElements(plugin.generators);
    const hasProjectGraphExtension = !!plugin.projectGraphExtension;
    const hasProjectInference = !!plugin.projectInference;
    if (!hasBuilders &&
        !hasGenerators &&
        !hasProjectGraphExtension &&
        !hasProjectInference) {
        if (json) {
            console.log(JSON.stringify({
                name: plugin.name,
                path: plugin.path,
                generators: {},
                executors: {},
                projectGraphExtension: false,
                projectInference: false,
            }));
            return;
        }
        output_1.output.warn({ title: `No capabilities found in ${pluginName}` });
        return;
    }
    if (json) {
        console.log(JSON.stringify(formatPluginCapabilitiesAsJson(plugin), null, 2));
        return;
    }
    const bodyLines = [];
    if (plugin.path) {
        bodyLines.push(`${pc.bold('Path:')} ${plugin.path}`);
        bodyLines.push('');
    }
    if (hasGenerators) {
        bodyLines.push(pc.bold(pc.green('GENERATORS')));
        bodyLines.push('');
        bodyLines.push(...Object.keys(plugin.generators).map((name) => `${pc.bold(name)} : ${plugin.generators[name].description}`));
        if (hasBuilders) {
            bodyLines.push('');
        }
    }
    if (hasBuilders) {
        bodyLines.push(pc.bold(pc.green('EXECUTORS/BUILDERS')));
        bodyLines.push('');
        bodyLines.push(...Object.keys(plugin.executors).map((name) => {
            const definition = plugin.executors[name];
            return typeof definition === 'string'
                ? pc.bold(name)
                : `${pc.bold(name)} : ${definition.description}`;
        }));
    }
    if (hasProjectGraphExtension) {
        bodyLines.push(`✔️  Project Graph Extension`);
    }
    if (hasProjectInference) {
        bodyLines.push(`✔️  Project Inference`);
    }
    output_1.output.log({
        title: `Capabilities in ${plugin.name}:`,
        bodyLines,
    });
}
function formatPluginCapabilitiesAsJson(plugin) {
    const generators = {};
    for (const [name, entry] of Object.entries(plugin.generators ?? {})) {
        generators[name] = {
            description: entry.description ?? '',
            path: resolveCapabilityPath(plugin.path, entry.factory ?? entry.implementation),
            schema: resolveCapabilityPath(plugin.path, entry.schema),
        };
    }
    const executors = {};
    for (const [name, entry] of Object.entries(plugin.executors ?? {})) {
        if (typeof entry === 'string') {
            executors[name] = { description: '', path: null, schema: null };
        }
        else {
            executors[name] = {
                description: entry.description ?? '',
                path: resolveCapabilityPath(plugin.path, entry.implementation),
                schema: resolveCapabilityPath(plugin.path, entry.schema),
            };
        }
    }
    return {
        name: plugin.name,
        path: plugin.path ?? null,
        generators,
        executors,
        projectGraphExtension: !!plugin.projectGraphExtension,
        projectInference: !!plugin.projectInference,
    };
}
function formatPluginsAsJson(localPlugins, installedPlugins) {
    function formatPluginSummary(plugin) {
        const capabilities = [];
        if (hasElements(plugin.executors)) {
            capabilities.push('executors');
        }
        if (hasElements(plugin.generators)) {
            capabilities.push('generators');
        }
        if (plugin.projectGraphExtension) {
            capabilities.push('graph-extension');
        }
        if (plugin.projectInference) {
            capabilities.push('project-inference');
        }
        return {
            name: plugin.name,
            path: plugin.path ?? null,
            capabilities,
        };
    }
    return {
        localWorkspacePlugins: Array.from(localPlugins.values()).map(formatPluginSummary),
        installedPlugins: Array.from(installedPlugins.values()).map(formatPluginSummary),
    };
}
function resolveCapabilityPath(pluginPath, relativePath) {
    if (!pluginPath || !relativePath) {
        return null;
    }
    return (0, path_1.join)(pluginPath, relativePath);
}
function hasElements(obj) {
    return obj && Object.values(obj).length > 0;
}
