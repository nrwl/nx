import { execSync } from 'child_process';
import {
  getAffectedApps,
  getAffectedE2e,
  getAffectedProjects,
  getAllAppNames,
  getAllE2ENames,
  getAllProjectNames,
  parseFiles,
  readDepGraph,
  getAffectedLibs,
  getAllLibNames
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
import { WorkspaceResults } from './workspace-results';

export interface YargsAffectedOptions extends yargs.Arguments {}

export interface AffectedOptions extends GlobalNxArgs {
  parallel: boolean;
  maxParallel: number;
  untracked: boolean;
  uncommitted: boolean;
  all: boolean;
  base: string;
  head: string;
  exclude: string[];
  files: string[];
  onlyFailed: boolean;
  'only-failed': boolean;
  'max-parallel': boolean;
}

export function affected(
  command: string,
  parsedArgs: any,
  args: string[]
): void {
  let apps: string[];
  let e2eProjects: string[];
  let libs: string[];
  let projects: string[];
  let rest: string[];
  const workspaceResults = new WorkspaceResults(command);

  try {
    if (parsedArgs.all) {
      rest = args;
      apps = getAllAppNames()
        .filter(app => !parsedArgs.exclude.includes(app))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );
      e2eProjects = getAllE2ENames()
        .filter(app => !parsedArgs.exclude.includes(app))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );
      libs = getAllLibNames()
        .filter(app => !parsedArgs.exclude.includes(app))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );
      projects = getAllProjectNames()
        .filter(project => !parsedArgs.exclude.includes(project))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );
    } else {
      const p = parseFiles(args);
      rest = p.rest;
      apps = getAffectedApps(p.files)
        .filter(project => !parsedArgs.exclude.includes(project))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );
      e2eProjects = getAffectedE2e(p.files)
        .filter(project => !parsedArgs.exclude.includes(project))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );
      libs = getAffectedLibs(p.files)
        .filter(project => !parsedArgs.exclude.includes(project))
        .filter(
          project => 
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        )
      projects = getAffectedProjects(p.files)
        .filter(project => !parsedArgs.exclude.includes(project))
        .filter(
          project =>
            !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
        );

    }
  } catch (e) {
    printError(e);
    process.exit(1);
  }

  switch (command) {
    case 'apps':
      console.log(apps.join(' '));
      break;
    case 'build':
      build(apps, parsedArgs, workspaceResults);
      break;
    case 'test':
      test(projects, parsedArgs, workspaceResults);
      break;
    case 'lint':
      lint(projects, parsedArgs, workspaceResults);
      break;
    case 'e2e':
      e2e(e2eProjects, parsedArgs, workspaceResults);
      break;
    case 'dep-graph':
      generateGraph(yargsParser(rest), projects);
      break;
    case 'lib':
      build(libs, parsedArgs, workspaceResults);
  }
}

function printError(e: any) {
  console.error(e.message);
}

function build(
  apps: string[],
  parsedArgs: YargsAffectedOptions,
  workspaceResults: WorkspaceResults
) {
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
      workspaceResults,
      'Building ',
      'Build succeeded.',
      'Build failed.'
    );
  } else {
    console.log('No apps to build');
  }
}

function test(
  projects: string[],
  parsedArgs: YargsAffectedOptions,
  workspaceResults: WorkspaceResults
) {
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
      workspaceResults,
      'Testing ',
      'Tests passed.',
      'Tests failed.'
    );
  } else {
    console.log('No projects to test');
  }
}

function lint(
  projects: string[],
  parsedArgs: YargsAffectedOptions,
  workspaceResults: WorkspaceResults
) {
  const depGraph = readDepGraph();
  const sortedProjects = topologicallySortProjects(depGraph);
  const sortedAffectedProjects = sortedProjects.filter(
    pp => projects.indexOf(pp) > -1
  );
  const projectsToLint = sortedAffectedProjects.filter(p => {
    const matchingProject = depGraph.projects.find(pp => pp.name === p);
    return !!matchingProject.architect['lint'];
  });

  if (projectsToLint.length > 0) {
    const normalizedArgs = filterNxSpecificArgs(parsedArgs);
    let message = `Linting ${projectsToLint.join(', ')}`;
    if (normalizedArgs.length > 0) {
      message += ` with flags: ${normalizedArgs.join(' ')}`;
    }
    console.log(message);

    runCommand(
      'lint',
      projectsToLint,
      parsedArgs,
      normalizedArgs,
      workspaceResults,
      'Linting ',
      'Linting passed.',
      'Linting failed.'
    );
  } else {
    console.log('No projects to lint');
  }
}

async function runCommand(
  command: string,
  projects: string[],
  parsedArgs: YargsAffectedOptions,
  args: string[],
  workspaceResults: WorkspaceResults,
  iterationMessage: string,
  successMessage: string,
  errorMessage: string
) {
  if (parsedArgs.parallel) {
    try {
      await runAll(
        projects.map(
          app => `ng ${command} -- ${args.join(' ')} --project=${app}`
        ),
        {
          parallel: parsedArgs.parallel,
          maxParallel: parsedArgs.maxParallel,
          continueOnError: true,
          stdin: process.stdin,
          stdout: process.stdout,
          stderr: process.stderr
        }
      );
      projects.forEach(project => {
        workspaceResults.success(project);
      });
    } catch (e) {
      e.results.forEach((result, i) => {
        if (result.code === 0) {
          workspaceResults.success(projects[i]);
        } else {
          workspaceResults.fail(projects[i]);
        }
      });
    }
    workspaceResults.saveResults();
    workspaceResults.printResults(
      parsedArgs.onlyFailed,
      successMessage,
      errorMessage
    );

    if (workspaceResults.hasFailure) {
      process.exit(1);
    }
  } else {
    let failedProjects = [];
    projects.forEach(project => {
      console.log(iterationMessage + project);
      try {
        execSync(
          `node ${ngPath()} ${command} ${args.join(' ')} --project=${project}`,
          {
            stdio: [0, 1, 2]
          }
        );
        workspaceResults.success(project);
      } catch (e) {
        failedProjects.push(project);
        workspaceResults.fail(project);
      }
    });

    workspaceResults.saveResults();
    workspaceResults.printResults(
      parsedArgs.onlyFailed,
      successMessage,
      errorMessage
    );

    if (workspaceResults.hasFailure) {
      process.exit(1);
    }
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

function e2e(
  apps: string[],
  parsedArgs: YargsAffectedOptions,
  workspaceResults: WorkspaceResults
) {
  if (apps.length > 0) {
    const args = filterNxSpecificArgs(parsedArgs);
    console.log(`Testing ${apps.join(', ')}`);
    apps.forEach(app => {
      try {
        execSync(`node ${ngPath()} e2e ${args.join(' ')} --project=${app}`, {
          stdio: [0, 1, 2]
        });
        workspaceResults.success(app);
      } catch (e) {
        workspaceResults.fail(app);
      }
    });

    workspaceResults.saveResults();
    workspaceResults.printResults(
      parsedArgs.onlyFailed,
      'E2E Tests passed.',
      'E2E Tests failed.'
    );

    if (workspaceResults.hasFailure) {
      process.exit(1);
    }
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
  maxParallel: 3,
  'max-parallel': false,
  onlyFailed: false,
  'only-failed': false,
  untracked: false,
  uncommitted: false,
  help: false,
  version: false,
  quiet: false,
  all: false,
  base: 'base',
  head: 'head',
  exclude: ['exclude'],
  files: ['']
};

const nxSpecificFlags = Object.keys(dummyOptions);
