import { execSync } from 'child_process';
import {
  getAffectedApps,
  getAffectedE2e,
  getAffectedProjects,
  parseFiles,
  readDepGraph
} from './shared';
import * as path from 'path';
import * as resolve from 'resolve';
import * as runAll from 'npm-run-all';
import * as yargsParser from 'yargs-parser';
import { generateGraph } from './dep-graph';
import {
  DepGraph,
  ProjectNode,
  ProjectType
} from '@nrwl/schematics/src/command-line/affected-apps';
import { GlobalNxArgs } from './nx';
import * as yargs from 'yargs';

export interface YargsAffectedOptions extends yargs.Arguments {}

export interface AffectedOptions extends GlobalNxArgs {
  parallel: boolean;
  untracked: boolean;
  uncommitted: boolean;
  base: string;
  head: string;
  exclude: string[];
  files: string[];
}

export function affected(
  command: string,
  parsedArgs: any,
  args: string[]
): void {
  let apps: string[];
  let e2eProjects: string[];
  let projects: string[];
  let rest: string[];

  try {
    const p = parseFiles(args);
    rest = p.rest;
    apps = getAffectedApps(p.files).filter(
      app => !parsedArgs.exclude.includes(app)
    );
    e2eProjects = getAffectedE2e(p.files);
    projects = getAffectedProjects(p.files).filter(
      project => !parsedArgs.exclude.includes(project)
    );
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  switch (command) {
    case 'apps':
      console.log(apps.join(' '));
      break;
    case 'build':
      build(apps, parsedArgs);
      break;
    case 'test':
      test(projects, parsedArgs);
      break;
    case 'e2e':
      e2e(e2eProjects, parsedArgs);
      break;
    case 'dep-graph':
      generateGraph(yargsParser(rest), projects);
      break;
  }
}

function printError(command: string, e: any) {
  console.error(e.message);
}

function build(apps: string[], parsedArgs: YargsAffectedOptions) {
  if (apps.length > 0) {
    const normalizedArgs = filterNxSpecificArgs(parsedArgs);
    let message = `Building ${apps.join(', ')}`;
    if (normalizedArgs.length > 0) {
      message += ` with flags: ${normalizedArgs.join(' ')}`;
    }
    console.log(message);

    runCommand(
      'build',
      apps,
      parsedArgs,
      normalizedArgs,
      'Building ',
      'Build succeeded.',
      'Build failed.'
    );
  } else {
    console.log('No apps to build');
  }
}

function test(projects: string[], parsedArgs: YargsAffectedOptions) {
  const depGraph = readDepGraph();
  const sortedProjects = topologicallySortProjects(depGraph);
  const sortedAffectedProjects = sortedProjects.filter(
    pp => projects.indexOf(pp) > -1
  );
  const projectsToTest = sortedAffectedProjects.filter(p => {
    const matchingProject = depGraph.projects.find(pp => pp.name === p);
    return (
      matchingProject.type !== ProjectType.e2e &&
      !!matchingProject.architect['test']
    );
  });

  if (projectsToTest.length > 0) {
    const normalizedArgs = ['--no-watch', ...filterNxSpecificArgs(parsedArgs)];
    let message = `Testing ${projectsToTest.join(', ')}`;
    if (normalizedArgs.length > 0) {
      message += ` with flags: ${normalizedArgs.join(' ')}`;
    }
    console.log(message);

    runCommand(
      'test',
      projectsToTest,
      parsedArgs,
      normalizedArgs,
      'Testing ',
      'Tests passed.',
      'Tests failed.'
    );
  } else {
    console.log('No projects to test');
  }
}

function runCommand(
  command: string,
  projects: string[],
  parsedArgs: YargsAffectedOptions,
  args: string[],
  iterationMessage: string,
  successMessage: string,
  errorMessage: string
) {
  if (parsedArgs.parallel) {
    runAll(
      projects.map(
        app => `ng ${command} -- ${args.join(' ')} --project=${app}`
      ),
      {
        parallel: parsedArgs.parallel,
        stdin: process.stdin,
        stdout: process.stdout,
        stderr: process.stderr
      }
    )
      .then(() => console.log(successMessage))
      .catch(err => console.error(errorMessage));
  } else {
    projects.forEach(project => {
      console.log(iterationMessage + project);
      execSync(
        `node ${ngPath()} ${command} ${args.join(' ')} --project=${project}`,
        {
          stdio: [0, 1, 2]
        }
      );
    });
  }
}

function topologicallySortProjects(deps: DepGraph): string[] {
  const temporary = {};
  const marked = {};
  const res = [];

  while (Object.keys(marked).length !== deps.projects.length) {
    visit(deps.projects.find(p => !marked[p.name]));
  }

  function visit(n: ProjectNode) {
    if (marked[n.name]) return;
    if (temporary[n.name]) return;
    temporary[n.name] = true;
    deps.deps[n.name].forEach(e => {
      visit(deps.projects.find(pp => pp.name === e.projectName));
    });
    marked[n.name] = true;
    res.push(n.name);
  }

  return res;
}

function e2e(apps: string[], parsedArgs: YargsAffectedOptions) {
  if (apps.length > 0) {
    const args = filterNxSpecificArgs(parsedArgs);
    console.log(`Testing ${apps.join(', ')}`);
    apps.forEach(app => {
      execSync(`node ${ngPath()} e2e ${args.join(' ')} --project=${app}`, {
        stdio: [0, 1, 2]
      });
    });
  } else {
    console.log('No apps to test');
  }
}

function filterNxSpecificArgs(parsedArgs: YargsAffectedOptions): string[] {
  const filteredArgs = { ...parsedArgs };
  // Delete Nx arguments from parsed Args
  nxSpecificFlags.forEach(flag => {
    delete filteredArgs[flag];
  });

  // These would be arguments such as app2 in  --app app1 app2 which the CLI does not accept
  delete filteredArgs._;
  // Also remove the node path
  delete filteredArgs.$0;

  // Re-serialize into a list of args
  return Object.keys(filteredArgs).map(filteredArg => {
    if (!Array.isArray(filteredArgs[filteredArg])) {
      filteredArgs[filteredArg] = [filteredArgs[filteredArg]];
    }

    return filteredArgs[filteredArg]
      .map(value => {
        return `--${filteredArg}=${value}`;
      })
      .join(' ');
  });
}

function ngPath() {
  const basePath = path.dirname(
    path.dirname(
      path.dirname(resolve.sync('@angular/cli', { basedir: __dirname }))
    )
  );
  return path.join(basePath, 'bin', 'ng');
}

/**
 * These options are only for getting an array with properties of AffectedOptions.
 *
 * @remark They are not defaults or useful for anything else
 */
const dummyOptions: AffectedOptions = {
  parallel: false,
  untracked: false,
  uncommitted: false,
  help: false,
  version: false,
  quiet: false,
  base: 'base',
  head: 'head',
  exclude: ['exclude'],
  files: ['']
};

const nxSpecificFlags = Object.keys(dummyOptions);
