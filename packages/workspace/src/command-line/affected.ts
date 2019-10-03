import * as fs from 'fs';
import * as path from 'path';
import * as runAll from 'npm-run-all';
import * as yargs from 'yargs';

import {
  parseFiles,
  readWorkspaceJson,
  printArgsWarning,
  cliCommand,
  getAffectedMetadata
} from './shared';
import {
  getAffectedApps,
  getAffectedLibs,
  getAffectedProjects,
  getAffectedProjectsWithTarget,
  getAllApps,
  getAllLibs,
  getAllProjects,
  getAllProjectsWithTarget
} from './affected-apps';
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
  plain?: boolean;
}

const commonCommands = ['build', 'test', 'lint', 'e2e'];

export function affected(parsedArgs: YargsAffectedOptions): void {
  const target = parsedArgs.target;
  const rest: string[] = [
    ...parsedArgs._.slice(1),
    ...filterNxSpecificArgs(parsedArgs)
  ];

  const workspaceResults = new WorkspaceResults(target);

  const touchedFiles = parseFiles(parsedArgs).files;
  const affectedMetadata = getAffectedMetadata(touchedFiles);

  try {
    switch (target) {
      case 'apps':
        const apps = (parsedArgs.all
          ? getAllApps(affectedMetadata)
          : getAffectedApps(affectedMetadata)
        )
          .filter(app => !parsedArgs.exclude.includes(app))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );
        if (parsedArgs.plain) {
          console.log(apps.join(' '));
        } else {
          printArgsWarning(parsedArgs);
          if (apps.length) {
            output.log({
              title: 'Affected apps:',
              bodyLines: apps.map(app => `${output.colors.gray('-')} ${app}`)
            });
          }
        }
        break;
      case 'libs':
        const libs = (parsedArgs.all
          ? getAllLibs(affectedMetadata)
          : getAffectedLibs(affectedMetadata)
        )
          .filter(app => !parsedArgs.exclude.includes(app))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );

        if (parsedArgs.plain) {
          console.log(libs.join(' '));
        } else {
          printArgsWarning(parsedArgs);
          if (libs.length) {
            output.log({
              title: 'Affected libs:',
              bodyLines: libs.map(lib => `${output.colors.gray('-')} ${lib}`)
            });
          }
        }
        break;
      case 'dep-graph': {
        const projects = (parsedArgs.all
          ? getAllProjects(affectedMetadata)
          : getAffectedProjects(affectedMetadata)
        )
          .filter(app => !parsedArgs.exclude.includes(app))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );
        printArgsWarning(parsedArgs);
        generateGraph(parsedArgs as any, projects);
        break;
      }
      default: {
        const projects = (parsedArgs.all
          ? getAllProjectsWithTarget(affectedMetadata, target)
          : getAffectedProjectsWithTarget(affectedMetadata, target)
        )
          .filter(project => !parsedArgs.exclude.includes(project))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );
        printArgsWarning(parsedArgs);
        runCommand(target, projects, parsedArgs, rest, workspaceResults);
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
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

  const cli = cliCommand();

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
  if (!packageJson.scripts || !packageJson.scripts[cli]) {
    output.error({
      title: `The "scripts" section of your 'package.json' must contain "${cli}": "${cli}"`,
      bodyLines: [
        output.colors.gray('...'),
        ' "scripts": {',
        output.colors.gray('  ...'),
        `   "${cli}": "${cli}"`,
        output.colors.gray('  ...'),
        ' }',
        output.colors.gray('...')
      ]
    });
    return process.exit(1);
  }

  try {
    const isYarn = path
      .basename(process.env.npm_execpath || 'npm')
      .startsWith('yarn');
    await runAll(
      projects.map(proj => {
        return commonCommands.includes(targetName)
          ? `${cli} ${isYarn ? '' : '--'} ${targetName} ${proj} ${transformArgs(
              args,
              proj,
              projectMetadata.get(proj)
            ).join(' ')} `
          : `${cli} ${
              isYarn ? '' : '--'
            } run ${proj}:${targetName} ${transformArgs(
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
  } finally {
    // fix for https://github.com/nrwl/nx/issues/1666
    if (process.stdin['unref']) (process.stdin as any).unref();
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
  verbose: false,
  plain: false
};

const nxSpecificFlags = Object.keys(dummyOptions);
