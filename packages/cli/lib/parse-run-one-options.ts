import yargsParser = require('yargs-parser');

export function parseRunOneOptions(
  nxJson: any,
  workspaceConfigJson: any,
  args: string[]
): false | { project; target; configuration; parsedArgs } {
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

  const parsedArgs = yargsParser(args, {
    boolean: ['prod'],
    string: ['configuration', 'project']
  });

  let project;
  let target;
  let configuration;

  if (parsedArgs._[0] === 'run') {
    [project, target, configuration] = parsedArgs._[1].split(':');
    parsedArgs._ = parsedArgs._.slice(1);
  } else {
    target = parsedArgs._[0];
    project = parsedArgs._[1];
    parsedArgs._ = parsedArgs._.slice(2);
  }

  if (!project && defaultProjectName) {
    project = defaultProjectName;
  }

  if (parsedArgs.configuration) {
    configuration = parsedArgs.configuration;
  }
  if (parsedArgs.prod) {
    configuration = 'production';
  }
  if (parsedArgs.project) {
    project = parsedArgs.project;
  }

  // we need both to be able to run a target, no tasks runner
  if (!project || !target) {
    return false;
  }

  // we need both to be able to run a target, no tasks runner
  if (!workspaceConfigJson.projects[project]) return false;

  const res = { project, target, configuration, parsedArgs };
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}
