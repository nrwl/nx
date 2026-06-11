"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTarget = resolveTarget;
exports.hasCustomHasher = hasCustomHasher;
exports.normalizePath = normalizePath;
exports.deduplicateFolderEntries = deduplicateFolderEntries;
exports.pc = pc;
exports.printList = printList;
const path_1 = require("path");
const calculate_default_project_name_1 = require("../../../config/calculate-default-project-name");
const configuration_1 = require("../../../config/configuration");
const project_graph_1 = require("../../../project-graph/project-graph");
const find_matching_projects_1 = require("../../../utils/find-matching-projects");
const output_1 = require("../../../utils/output");
const split_target_1 = require("../../../utils/split-target");
const workspace_root_1 = require("../../../utils/workspace-root");
async function resolveTarget(args, opts) {
    performance.mark('code-loading:end');
    performance.measure('code-loading', 'init-local', 'code-loading:end');
    let graph;
    let sourceMaps;
    if (opts?.withSourceMaps) {
        const result = await (0, project_graph_1.createProjectGraphAndSourceMapsAsync)();
        graph = result.projectGraph;
        sourceMaps = result.sourceMaps;
    }
    else {
        graph = await (0, project_graph_1.createProjectGraphAsync)();
    }
    const nxJson = (0, configuration_1.readNxJson)();
    const { projectName, targetName, configurationName } = resolveTargetIdentifier(args, graph, nxJson);
    const node = resolveProjectNode(projectName, graph);
    if (!node.data.targets?.[targetName]) {
        reportTargetNotFound(projectName, targetName, node);
    }
    const configuration = configurationName ?? args.configuration;
    if (configuration) {
        validateConfiguration(projectName, targetName, configuration, node.data.targets[targetName]);
    }
    return {
        graph,
        nxJson,
        projectName,
        targetName,
        configuration,
        node,
        sourceMaps,
    };
}
// ── Target identifier & project resolution ──────────────────────────
function resolveTargetIdentifier(args, graph, nxJson) {
    if (!args.target) {
        output_1.output.error({
            title: 'No target specified.',
            bodyLines: [
                `Please specify a target using:`,
                `  nx show target <project:target>`,
                `  nx show target <target>  (infers project from cwd)`,
            ],
        });
        process.exit(1);
    }
    const defaultProjectName = (0, calculate_default_project_name_1.calculateDefaultProjectName)(process.cwd(), workspace_root_1.workspaceRoot, (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(graph), nxJson);
    const [project, target, config] = (0, split_target_1.splitTarget)(args.target, graph, {
        currentProject: defaultProjectName,
    });
    if (project && target) {
        return {
            projectName: project,
            targetName: target,
            configurationName: config,
        };
    }
    const targetName = project; // splitTarget returns the string as the first element
    const projectName = defaultProjectName;
    if (!projectName) {
        output_1.output.error({
            title: `Could not infer project from the current working directory.`,
            bodyLines: [
                `Please specify the project explicitly:`,
                `  nx show target <project>:${targetName}`,
                ``,
                `Or run this command from within a project directory.`,
            ],
        });
        process.exit(1);
    }
    return { projectName, targetName };
}
function resolveProjectNode(projectName, graph) {
    let node = graph.nodes[projectName];
    if (!node) {
        const projects = (0, find_matching_projects_1.findMatchingProjects)([projectName], graph.nodes);
        if (projects.length === 1) {
            node = graph.nodes[projects[0]];
        }
        else if (projects.length > 1) {
            output_1.output.error({
                title: `Multiple projects matched "${projectName}":`,
                bodyLines: projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
            });
            process.exit(1);
        }
        else {
            output_1.output.error({ title: `Could not find project "${projectName}".` });
            process.exit(1);
        }
    }
    return node;
}
function reportTargetNotFound(projectName, targetName, node) {
    const availableTargets = Object.keys(node.data.targets ?? {});
    output_1.output.error({
        title: `Target "${targetName}" not found for project "${projectName}".`,
        bodyLines: availableTargets.length
            ? [`Available targets:`, ...availableTargets.map((t) => `  - ${t}`)]
            : [`This project has no targets configured.`],
    });
    process.exit(1);
}
function validateConfiguration(projectName, targetName, configuration, targetConfig) {
    const availableConfigs = Object.keys(targetConfig.configurations ?? {});
    if (!availableConfigs.includes(configuration)) {
        output_1.output.error({
            title: `Configuration "${configuration}" not found for target "${projectName}:${targetName}".`,
            bodyLines: availableConfigs.length
                ? [
                    `Available configurations:`,
                    ...availableConfigs.map((c) => `  - ${c}`),
                ]
                : [`This target has no configurations.`],
        });
        process.exit(1);
    }
}
// ── Custom hasher detection ──────────────────────────────────────────
/**
 * Checks whether a target's executor defines a custom hasher.
 * Returns true if the executor has a hasherFactory — meaning the
 * standard input-based hashing is bypassed for this target.
 */
function hasCustomHasher(projectName, targetName, graph) {
    // Lazy require avoids a circular dependency with tasks-runner/utils.
    const { getExecutorForTask } = require('../../../tasks-runner/utils');
    try {
        const { projects } = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(graph);
        const task = {
            id: `${projectName}:${targetName}`,
            target: { project: projectName, target: targetName },
            overrides: {},
        };
        return !!getExecutorForTask(task, projects).hasherFactory;
    }
    catch {
        return false;
    }
}
// ── Small helpers shared across slices ───────────────────────────────
function normalizePath(p) {
    const absolute = (0, path_1.resolve)(process.cwd(), p);
    return (0, path_1.relative)(workspace_root_1.workspaceRoot, absolute).replace(/\\/g, '/');
}
function deduplicateFolderEntries(items) {
    const normalized = items.map((item) => ({
        original: item,
        path: normalizePath(item),
    }));
    return normalized
        .filter(({ path }) => {
        const dirPrefix = path.endsWith('/') ? path : path + '/';
        return !normalized.some((other) => other.path !== path && other.path.startsWith(dirPrefix));
    })
        .map(({ original }) => original);
}
let _pc;
function pc() {
    return (_pc ??= require('picocolors'));
}
function printList(header, items, prefix = '\n') {
    if (items.length === 0)
        return;
    console.log(`${prefix}${pc().bold(header)}:`);
    for (const item of items)
        console.log(`  ${item}`);
}
