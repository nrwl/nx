import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as resolve from 'resolve';
import * as runAll from 'npm-run-all';
import * as yargs from 'yargs';

import {
  getAffectedApps,
  getAffectedLibs,
  getAffectedProjects,
  getAllAppNames,
  getAllLibNames,
  getProjectNames,
  parseFiles,
  getAllProjectsWithTarget,
  getAffectedProjectsWithTarget,
  readWorkspaceJson,
  printArgsWarning
} from './shared';
import { generateGraph } from './dep-graph';
import { WorkspaceResults } from './workspace-results';
import { output } from './output';

export interface YargsAffectedOptions
  extends yargs.Arguments,
    AffectedOptions {}

export interface AffectedOptions {
  target?: string;
  parallel?: boolean;
  maxParallel?: number;
  untracked?: boolean;
  uncommitted?: boolean;
  all?: boolean;
  base?: string;
  head?: string;
  exclude?: string[];
  files?: string[];
  onlyFailed?: boolean;
  'only-failed'?: boolean;
  'max-parallel'?: boolean;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  quiet?: boolean;
}

const commonCommands = ['build', 'test', 'lint', 'e2e'];

export function affected(parsedArgs: YargsAffectedOptions): void {
  const target = parsedArgs.target;
  const rest: string[] = [
    ...parsedArgs._.slice(1),
    ...filterNxSpecificArgs(parsedArgs)
  ];

  const workspaceResults = new WorkspaceResults(target);

  try {
    switch (target) {
      case 'apps':
        const apps = (parsedArgs.all
          ? getAllAppNames()
          : getAffectedApps(parseFiles(parsedArgs).files)
        )
          .filter(app => !parsedArgs.exclude.includes(app))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );
        printArgsWarning(parsedArgs);
        if (apps.length) {
          output.log({
            title: 'Affected apps:',
            bodyLines: apps.map(app => `${output.colors.gray('-')} ${app}`)
          });
        }
        break;
      case 'libs':
        const libs = (parsedArgs.all
          ? getAllLibNames()
          : getAffectedLibs(parseFiles(parsedArgs).files)
        )
          .filter(app => !parsedArgs.exclude.includes(app))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );
        printArgsWarning(parsedArgs);
        if (libs.length) {
          output.log({
            title: 'Affected libs:',
            bodyLines: libs.map(lib => `${output.colors.gray('-')} ${lib}`)
          });
        }
        break;
      case 'dep-graph':
        const projects = parsedArgs.all
          ? getProjectNames()
          : getAffectedProjects(parseFiles(parsedArgs).files)
              .filter(app => !parsedArgs.exclude.includes(app))
              .filter(
                project =>
                  !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
              );
        printArgsWarning(parsedArgs);
        generateGraph(parsedArgs, projects);
        break;
      default:
        const targetProjects = getProjects(
          target,
          parsedArgs,
          workspaceResults,
          parsedArgs.all
        );
        printArgsWarning(parsedArgs);
        runCommand(target, targetProjects, parsedArgs, rest, workspaceResults);
        break;
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

function getProjects(
  target: string,
  parsedArgs: YargsAffectedOptions,
  workspaceResults: WorkspaceResults,
  all: boolean
) {
  const projects = all
    ? getAllProjectsWithTarget(target)
    : getAffectedProjectsWithTarget(target)(parseFiles(parsedArgs).files);

  return projects
    .filter(project => !parsedArgs.exclude.includes(project))
    .filter(
      project => !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
    );
}

function printError(e: any, verbose?: boolean) {
  const bodyLines = [e.message];
  if (verbose && e.stack) {
    bodyLines.push('');
    bodyLines.push(e.stack);
  }
  output.error({
    title: 'There was a critical error when running your command',
    bodyLines
  });
}

async function runCommand(
  targetName: string,
  projects: string[],
  parsedArgs: YargsAffectedOptions,
  args: string[],
  workspaceResults: WorkspaceResults
) {
  if (projects.length <= 0) {
    output.logSingleLine(
      `No affected projects to run target "${targetName}" on`
    );
    return;
  }

  const bodyLines = projects.map(
    project => `${output.colors.gray('-')} ${project}`
  );
  if (args.length > 0) {
    bodyLines.push('');
    bodyLines.push(
      `${output.colors.gray('With flags:')} ${output.bold(args.join(' '))}`
    );
  }

  output.log({
    title: `${output.colors.gray(
      'Running target'
    )} ${targetName} ${output.colors.gray('for projects:')}`,
    bodyLines
  });

  output.addVerticalSeparator();

  const workspaceJson = readWorkspaceJson();
  const projectMetadata = new Map<string, any>();
  projects.forEach(project => {
    projectMetadata.set(project, workspaceJson.projects[project]);
  });

  // Make sure the `package.json` has the `nx: "nx"` command needed by `npm-run-all`
  const packageJson = JSON.parse(
    fs.readFileSync('./package.json').toString('utf-8')
  );
  if (!packageJson.scripts || !packageJson.scripts.nx) {
    output.error({
      title:
        'The "scripts" section of your `package.json` must contain `"nx": "nx"`',
      bodyLines: [
        output.colors.gray('...'),
        ' "scripts": {',
        output.colors.gray('  ...'),
        '   "nx": "nx"',
        output.colors.gray('  ...'),
        ' }',
        output.colors.gray('...')
      ]
    });
    return process.exit(1);
  }

  try {
    await runAll(
      projects.map(proj => {
        return commonCommands.includes(targetName)
          ? `nx -- ${targetName} ${proj} ${transformArgs(
              args,
              proj,
              projectMetadata.get(proj)
            ).join(' ')} `
          : `nx -- run ${proj}:${targetName} ${transformArgs(
              args,
              proj,
              projectMetadata.get(proj)
            ).join(' ')} `;
      }),
      {
        parallel: parsedArgs.parallel || false,
        maxParallel: parsedArgs.maxParallel || 1,
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
    `Running target "${targetName}" for affected projects succeeded`,
    `Running target "${targetName}" for affected projects failed`
  );

  if (workspaceResults.hasFailure) {
    process.exit(1);
  }
}

function transformArgs(
  args: string[],
  projectName: string,
  projectMetadata: any
) {
  return args.map(arg => {
    const regex = /{project\.([^}]+)}/g;
    return arg.replace(regex, (_, group: string) => {
      if (group.includes('.')) {
        throw new Error('Only top-level properties can be interpolated');
      }

      if (group === 'name') {
        return projectName;
      }
      return projectMetadata[group];
    });
  });
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

/**
 * These options are only for getting an array with properties of AffectedOptions.
 *
 * @remark They are not defaults or useful for anything else
 */
const dummyOptions: AffectedOptions = {
  target: '',
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
  files: [''],
  verbose: false
};

const nxSpecificFlags = Object.keys(dummyOptions);
