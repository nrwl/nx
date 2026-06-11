"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listHandler = listHandler;
const nx_json_1 = require("../../config/nx-json");
const project_graph_1 = require("../../project-graph/project-graph");
const output_1 = require("../../utils/output");
const plugins_1 = require("../../utils/plugins");
const workspace_root_1 = require("../../utils/workspace-root");
const output_2 = require("../../utils/plugins/output");
/**
 * List available plugins or capabilities within a specific plugin
 *
 * @remarks
 *
 * Must be run within an Nx workspace
 *
 */
async function listHandler(args) {
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
    const projects = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
    if (args.plugin) {
        await (0, plugins_1.listPluginCapabilities)(args.plugin, projects.projects, args.json);
    }
    else {
        const nxJson = (0, nx_json_1.readNxJson)();
        const localPlugins = await (0, plugins_1.getLocalWorkspacePlugins)(projects, nxJson);
        const installedPlugins = await (0, plugins_1.getInstalledPluginsAndCapabilities)(workspace_root_1.workspaceRoot, projects.projects);
        if (args.json) {
            console.log(JSON.stringify((0, output_2.formatPluginsAsJson)(localPlugins, installedPlugins), null, 2));
            return;
        }
        if (localPlugins.size) {
            (0, plugins_1.listPlugins)(localPlugins, 'Local workspace plugins:');
        }
        (0, plugins_1.listPlugins)(installedPlugins, 'Installed plugins:');
        (0, plugins_1.listAlsoAvailableCorePlugins)(installedPlugins);
        (0, output_2.listPowerpackPlugins)();
        output_1.output.note({
            title: 'Community Plugins',
            bodyLines: [
                'Looking for a technology / framework not listed above?',
                'There are many excellent plugins maintained by the Nx community.',
                'Search for the one you need here: https://nx.dev/plugin-registry.',
            ],
        });
        output_1.output.note({ title: `Use "nx list [plugin]" to find out more` });
    }
}
