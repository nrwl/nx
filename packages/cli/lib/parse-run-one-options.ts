import yargsParser = require('yargs-parser');

export function parseRunOneOptions(
  nxJson: any,
  workspaceConfigJson: any,
  args: string[]
): false | { project; target; configuration; overrides } {
  // custom runner is not set, no tasks runner
  if (
    !nxJson.tasksRunnerOptions ||
    !nxJson.tasksRunnerOptions.default ||
    !nxJson.tasksRunnerOptions.default.runner
  ) {
    return false;
  }

  // the list of all possible tasks doesn't include the given name, no tasks runner
  let allPossibleTasks = ['run'];
  Object.values(workspaceConfigJson.projects || {}).forEach((p: any) => {
    allPossibleTasks.push(...Object.keys(p.architect || {}));
  });
  if (allPossibleTasks.indexOf(args[0]) === -1) {
    return false;
  }

  let defaultProjectName = null;
  try {
    defaultProjectName = workspaceConfigJson.cli.defaultProjectName;
  } catch (e) {}

  const overrides = yargsParser(args, {
    boolean: ['prod'],
    string: ['configuration', 'project']
  });

  let project;
  let target;
  let configuration;

  if (overrides._[0] === 'run') {
    [project, target, configuration] = overrides._[1].split(':');
  } else {
    target = overrides._[0];
    project = overrides._[1];
  }

  if (!project && defaultProjectName) {
    project = defaultProjectName;
  }

  if (overrides.configuration) {
    configuration = overrides.configuration;
  }
  if (overrides.prod) {
    configuration = 'production';
  }
  if (overrides.project) {
    project = overrides.project;
  }

  // we need both to be able to run a target, no tasks runner
  if (!project || !target) {
    return false;
  }

  // we need both to be able to run a target, no tasks runner
  if (!workspaceConfigJson.projects[project]) return false;

  const res = { project, target, configuration, overrides };
  delete overrides['_'];
  delete overrides['configuration'];
  delete overrides['prod'];
  delete overrides['project'];

  return res;
}
