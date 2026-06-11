"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatFlags = formatFlags;
exports.formatTargetsAndProjects = formatTargetsAndProjects;
const output_1 = require("../../utils/output");
function formatFlags(leftPadding, flag, value) {
    return flag == '_'
        ? `${leftPadding}  ${value.join(' ')}`
        : `${leftPadding}  --${flag}=${formatValue(value)}`;
}
function formatValue(value) {
    if (Array.isArray(value)) {
        return `[${value.join(',')}]`;
    }
    else if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    else {
        return value;
    }
}
function formatTargetsAndProjects(projectNames, targets, tasks) {
    let targetsText = '';
    let projectsText = '';
    let dependentTasksText = '';
    const tasksTargets = new Set();
    const tasksProjects = new Set();
    const dependentTasks = new Set();
    tasks.forEach((task) => {
        tasksTargets.add(task.target.target);
        tasksProjects.add(task.target.project);
        if (!projectNames.includes(task.target.project) ||
            !targets.includes(task.target.target)) {
            dependentTasks.add(task);
        }
    });
    targets = targets.filter((t) => tasksTargets.has(t)); // filter out targets that don't exist
    projectNames = projectNames.filter((p) => tasksProjects.has(p)); // filter out projects that don't exist
    if (targets.length === 1) {
        targetsText = `target ${output_1.output.bold(targets[0])}`;
    }
    else {
        targetsText = `targets ${targets.map((t) => output_1.output.bold(t)).join(', ')}`;
    }
    if (projectNames.length === 1) {
        projectsText = `project ${projectNames[0]}`;
    }
    else {
        projectsText = `${projectNames.length} projects`;
    }
    if (dependentTasks.size > 0) {
        dependentTasksText = ` and ${output_1.output.bold(dependentTasks.size)} ${dependentTasks.size === 1 ? 'task' : 'tasks'} ${projectNames.length === 1 ? 'it depends on' : 'they depend on'}`;
    }
    return `${targetsText} for ${projectsText}${dependentTasksText}`;
}
