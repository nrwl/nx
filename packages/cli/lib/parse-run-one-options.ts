import yargsParser = require('yargs-parser');
import * as fs from 'fs';

function calculateDefaultProjectName(
  cwd: string,
  root: string,
  wc: any,
  nxJson
) {
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
    defaultProjectName = nxJson.cli.defaultProjectName;
  } catch (e) {}
  try {
    if (!defaultProjectName) {
      defaultProjectName = nxJson.defaultProject;
    }
  } catch (e) {}
  return defaultProjectName;
}

const invalidTargetNames = [
  'g',
  'generate',
  'update',
  'migrate',
  'add',
  'affected',
  'run-many',
  'affected:apps',
  'affected:libs',
  'affected:build',
  'affected:test',
  'affected:e2e',
  'affected:dep-graph',
  'affected:lint',
  'print-affected',
  'daemon:start',
  'daemon:stop',
  'format:check',
  'format',
  'format:write',
  'workspace-lint',
  'workspace-generator',
  'workspace-schematic',
  'connect-to-nx-cloud',
  'clear-cache',
  'report',
  'list',
];

export function parseRunOneOptions(
  root: string,
  workspaceJsonConfiguration: any,
  nxJson: any,
  args: string[]
): false | { project; target; configuration; parsedArgs } {
  const defaultProjectName = calculateDefaultProjectName(
    process.cwd(),
    root,
    workspaceJsonConfiguration,
    nxJson
  );

  const parsedArgs = yargsParser(args, {
    boolean: ['prod', 'help'],
    string: ['configuration', 'project'],
    alias: {
      c: 'configuration',
    },
    configuration: {
      'strip-dashed': true,
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

  const projectIsNotSetExplicitly = !project;
  if (!project && defaultProjectName) {
    project = defaultProjectName;
  }

  if (parsedArgs.project) {
    project = parsedArgs.project;
  }
  console.log(project, target);
  // we need both to be able to run a target, no tasks runner
  if (!project || !target) {
    return false;
  }

  // we need both to be able to run a target, no tasks runner
  const p =
    workspaceJsonConfiguration.projects &&
    workspaceJsonConfiguration.projects[project];
  if (!p) return false;

  let targets;
  if (typeof p === 'string') {
    targets = JSON.parse(
      fs.readFileSync(`${p}/project.json`).toString()
    ).targets;
  } else {
    targets = p.architect ?? p.targets;
  }

  // for backwards compat we require targets to be set when use defaultProjectName
  if ((!targets || !targets[target]) && projectIsNotSetExplicitly) return false;
  if (invalidTargetNames.indexOf(target) > -1) return false;

  if (parsedArgs.configuration) {
    configuration = parsedArgs.configuration;
  } else if (parsedArgs.prod) {
    configuration = 'production';
  } else if (
    !configuration &&
    targets &&
    targets[target] &&
    targets[target].defaultConfiguration
  ) {
    configuration = targets[target].defaultConfiguration;
  }

  const res = { project, target, configuration, parsedArgs };
  delete parsedArgs['c'];
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}
