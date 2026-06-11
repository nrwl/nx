"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HashPlanInspector = void 0;
const nx_json_1 = require("../config/nx-json");
const native_1 = require("../native");
const transform_objects_1 = require("../native/transform-objects");
const find_project_for_path_1 = require("../project-graph/utils/find-project-for-path");
const create_task_graph_1 = require("../tasks-runner/create-task-graph");
const command_line_utils_1 = require("../utils/command-line-utils");
const workspace_context_1 = require("../utils/workspace-context");
const workspace_root_1 = require("../utils/workspace-root");
class HashPlanInspector {
    constructor(projectGraph, workspaceRootPath = workspace_root_1.workspaceRoot, nxJson) {
        this.projectGraph = projectGraph;
        this.workspaceRootPath = workspaceRootPath;
        this.nxJson = nxJson ?? (0, nx_json_1.readNxJson)(this.workspaceRootPath);
        this.projectGraphRef = (0, native_1.transferProjectGraph)((0, transform_objects_1.transformProjectGraphForRust)(this.projectGraph));
        this.planner = new native_1.HashPlanner(this.nxJson, this.projectGraphRef);
    }
    async init() {
        const projectRootMap = (0, find_project_for_path_1.createProjectRootMappings)(this.projectGraph.nodes);
        const map = Object.fromEntries(projectRootMap.entries());
        const { externalReferences } = await (0, workspace_context_1.getNxWorkspaceFilesFromContext)(this.workspaceRootPath, map, false);
        this.inspector = new native_1.HashPlanInspector(externalReferences.allWorkspaceFiles, externalReferences.projectFiles, this.workspaceRootPath);
    }
    /**
     * This is a lower level method which will inspect the hash plan for a set of tasks.
     */
    inspectHashPlan(projectNames, targets, configuration, overrides = {}, extraTargetDependencies = {}, excludeTaskDependencies = false) {
        const taskGraph = (0, create_task_graph_1.createTaskGraph)(this.projectGraph, extraTargetDependencies, projectNames, targets, configuration, overrides, excludeTaskDependencies);
        // Generate task IDs for ALL tasks in the task graph (including dependencies)
        const taskIds = Object.keys(taskGraph.tasks);
        const plansReference = this.planner.getPlansReference(taskIds, taskGraph);
        return this.inspector.inspect(plansReference);
    }
    /**
     * This inspects tasks involved in the execution of a task, including its dependencies by default.
     * @deprecated Prefer inspectTaskInputs
     */
    inspectTask({ project, target, configuration }, parsedArgs = {}, extraTargetDependencies = {}, excludeTaskDependencies = false) {
        // Mirror the exact flow from run-one.ts
        const { nxArgs, overrides } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)({
            ...parsedArgs,
            configuration: configuration,
            targets: [target],
        }, 'run-one', { printWarnings: false }, this.nxJson);
        // Create task graph exactly like run-one.ts does via createTaskGraphAndRunValidations
        const taskGraph = (0, create_task_graph_1.createTaskGraph)(this.projectGraph, extraTargetDependencies, [project], nxArgs.targets, nxArgs.configuration, overrides, excludeTaskDependencies);
        // Generate task IDs for ALL tasks in the task graph (including dependencies)
        const taskIds = Object.keys(taskGraph.tasks);
        const plansReference = this.planner.getPlansReference(taskIds, taskGraph);
        return this.inspector.inspect(plansReference);
    }
    /**
     * Like inspectTask() but returns structured HashInputs objects instead of flat strings.
     * Each input is categorized into files, runtime, environment, depOutputs, or external.
     */
    inspectTaskInputs({ project, target, configuration }, parsedArgs = {}, extraTargetDependencies = {}, excludeTaskDependencies = false) {
        const { nxArgs, overrides } = (0, command_line_utils_1.splitArgsIntoNxArgsAndOverrides)({
            ...parsedArgs,
            configuration: configuration,
            targets: [target],
        }, 'run-one', { printWarnings: false }, this.nxJson);
        const taskGraph = (0, create_task_graph_1.createTaskGraph)(this.projectGraph, extraTargetDependencies, [project], nxArgs.targets, nxArgs.configuration, overrides, excludeTaskDependencies);
        const taskIds = Object.keys(taskGraph.tasks);
        const plansReference = this.planner.getPlansReference(taskIds, taskGraph);
        return this.inspector.inspectInputs(plansReference);
    }
}
exports.HashPlanInspector = HashPlanInspector;
