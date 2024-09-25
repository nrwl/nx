import { Task } from '../../config/task-graph';
import { output } from '../../utils/output';

export function formatFlags(
  leftPadding: string,
  flag: string,
  value: any
): string {
  return flag == '_'
    ? `${leftPadding}  ${(value as string[]).join(' ')}`
    : `${leftPadding}  --${flag}=${formatValue(value)}`;
}

function formatValue(value: any) {
  if (Array.isArray(value)) {
    return `[${value.join(',')}]`;
  } else if (typeof value === 'object') {
    return JSON.stringify(value);
  } else {
    return value;
  }
}

export function formatTargetsAndProjects(
  projectNames: string[],
  targets: string[],
  tasks: Task[]
) {
  let targetsText = '';
  let projectsText = '';
  let dependentTasksText = '';

  const tasksTargets = new Set();
  const tasksProjects = new Set();
  const dependentTasks = new Set();

  tasks.forEach((task) => {
    tasksTargets.add(task.target.target);
    tasksProjects.add(task.target.project);
    if (
      !projectNames.includes(task.target.project) ||
      !targets.includes(task.target.target)
    ) {
      dependentTasks.add(task);
    }
  });

  targets = targets.filter((t) => tasksTargets.has(t)); // filter out targets that don't exist
  projectNames = projectNames.filter((p) => tasksProjects.has(p)); // filter out projects that don't exist

  if (targets.length === 1) {
    targetsText = `target ${output.bold(targets[0])}`;
  } else {
    targetsText = `targets ${targets.map((t) => output.bold(t)).join(', ')}`;
  }

  if (projectNames.length === 1) {
    projectsText = `project ${projectNames[0]}`;
  } else {
    projectsText = `${projectNames.length} projects`;
  }

  if (dependentTasks.size > 0) {
    dependentTasksText = ` and ${output.bold(dependentTasks.size)} ${
      dependentTasks.size === 1 ? 'task' : 'tasks'
    } ${projectNames.length === 1 ? 'it depends on' : 'they depend on'}`;
  }

  return `${targetsText} for ${projectsText}${dependentTasksText}`;
}
