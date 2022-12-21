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
  if (tasks.length === 1)
    return `target ${targets[0]} for project ${projectNames[0]}`;

  let text;
  const project =
    projectNames.length === 1
      ? `project ${projectNames[0]}`
      : `${projectNames.length} projects`;
  if (targets.length === 1) {
    text = `target ${output.bold(targets[0])} for ${project}`;
  } else {
    text = `targets ${targets
      .map((t) => output.bold(t))
      .join(', ')} for ${project}`;
  }

  const dependentTasks = tasks.filter(
    (t) =>
      projectNames.indexOf(t.target.project) === -1 ||
      targets.indexOf(t.target.target) === -1
  ).length;

  if (dependentTasks > 0) {
    text += ` and ${output.bold(dependentTasks)} ${
      dependentTasks === 1 ? 'task' : 'tasks'
    } ${projectNames.length === 1 ? 'it depends on' : 'they depend on'}`;
  }
  return text;
}
