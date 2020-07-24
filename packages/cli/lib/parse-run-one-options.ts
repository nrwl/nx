import yargsParser = require('yargs-parser');

export function parseRunOneOptions(
  nxJson: any,
  workspaceConfigJson: any,
  args: string[]
): false | { project; target; configuration; parsedArgs } {
  let defaultProjectName = null;
  try {
    defaultProjectName = workspaceConfigJson.cli.defaultProjectName;
  } catch (e) {}
  try {
    if (!defaultProjectName) {
      defaultProjectName = workspaceConfigJson.defaultProject;
    }
  } catch (e) {}

  const parsedArgs = yargsParser(args, {
    boolean: ['prod', 'help'],
    string: ['configuration', 'project'],
  });

  if (parsedArgs['help']) {
    return false;
  }

  let project;
  let target;
  let configuration;

  if (parsedArgs._[0] === 'run') {
    [project, target, configuration] = parsedArgs._[1].split(':');
    parsedArgs._ = parsedArgs._.slice(2);
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
  } else if (parsedArgs.prod) {
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
  const p =
    workspaceConfigJson.projects && workspaceConfigJson.projects[project];
  if (!p || !p.architect || !p.architect[target]) return false;

  const res = { project, target, configuration, parsedArgs };
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}
