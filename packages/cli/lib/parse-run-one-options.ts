import yargsParser = require('yargs-parser');

function calculateDefaultProjectName(cwd: string, root: string, wc: any) {
  let relativeCwd = cwd.replace(/\\/g, '/').split(root.replace(/\\/g, '/'))[1];
  if (relativeCwd) {
    relativeCwd = relativeCwd.startsWith('/')
      ? relativeCwd.substring(1)
      : relativeCwd;
    const matchingProject = Object.keys(wc.projects).find((p) => {
      const projectRoot = wc.projects[p].root;
      return (
        relativeCwd == projectRoot || relativeCwd.startsWith(`${projectRoot}/`)
      );
    });
    if (matchingProject) return matchingProject;
  }
  let defaultProjectName = null;
  try {
    defaultProjectName = wc.cli.defaultProjectName;
  } catch (e) {}
  try {
    if (!defaultProjectName) {
      defaultProjectName = wc.defaultProject;
    }
  } catch (e) {}
  return defaultProjectName;
}

export function parseRunOneOptions(
  root: string,
  workspaceConfigJson: any,
  args: string[]
): false | { project; target; configuration; parsedArgs } {
  const defaultProjectName = calculateDefaultProjectName(
    process.cwd(),
    root,
    workspaceConfigJson
  );

  const parsedArgs = yargsParser(args, {
    boolean: ['prod', 'help'],
    string: ['configuration', 'project'],
    alias: {
      c: 'configuration',
    },
  });

  if (parsedArgs['help']) {
    return false;
  }

  let project;
  let target;
  let configuration;

  if (parsedArgs._[0] === 'run') {
    [project, target, configuration] = (parsedArgs._[1] as any).split(':');
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
  if (!p) return false;

  const targets = p.architect ? p.architect : p.targets;
  if (!targets || !targets[target]) return false;

  const res = { project, target, configuration, parsedArgs };
  delete parsedArgs['c'];
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}
