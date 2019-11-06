import { execSync } from 'child_process';
import { basename } from 'path';
import * as yargs from 'yargs';
import { Task } from '../../tasks-runner/tasks-runner';
import { generateGraph } from '../dep-graph';
import { output } from '../output';
import { ProjectNode, ProjectType } from '../shared-models';
import {
  cliCommand,
  getProjectNodes,
  parseFiles,
  printArgsWarning,
  readNxJson,
  readWorkspaceJson,
  TEN_MEGABYTES
} from '../shared-utils';
import { getCommand, getOutputs } from '../../tasks-runner/utils';
import { createTask, runCommand } from '../run-tasks/run-command';
import { Arguments, readEnvironment, splitArgs } from '../run-tasks/utils';
import { readDependencies } from '../read-dependencies';
import { AffectedMetadata } from '../affected/affected-metadata';
import { AffectedMetadataBuilder } from '../affected/affected-metadata-builder';
import { readFileSync } from 'fs';

export interface YargsAffectedOptions
  extends yargs.Arguments,
    AffectedOptions {}

export interface AffectedOptions {
  target?: string;
  configuration?: string;
  runner?: string;
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
  withDeps?: boolean;
}

export function affected(
  command: string,
  parsedArgs: YargsAffectedOptions
): void {
  const env = readEnvironment(parsedArgs.target);
  const touchedFiles = parsedArgs.all ? [] : parseFiles(parsedArgs).files;
  const revisionRange = getAffectedRevisionRange(parsedArgs);
  const affectedMetadata = getAffectedMetadata(
    touchedFiles,
    revisionRange,
    parsedArgs.withDeps
  );
  const projects = (parsedArgs.all
    ? getAllProjects(affectedMetadata)
    : getAffectedProjects(affectedMetadata)
  )
    .filter(app => !parsedArgs.exclude.includes(app.name))
    .filter(
      project =>
        !parsedArgs.onlyFailed || !env.workspace.getResult(project.name)
    );
  try {
    switch (command) {
      case 'apps':
        const apps = projects
          .filter(p => p.type === ProjectType.app)
          .map(p => p.name);
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
        const libs = projects
          .filter(p => p.type === ProjectType.lib)
          .map(p => p.name);
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
      case 'print-affected':
        const {
          args,
          projectWithTargetAndConfig
        } = allProjectsWithTargetAndConfiguration(projects, parsedArgs);
        printAffected(projectWithTargetAndConfig, affectedMetadata, args);
        break;

      case 'dep-graph': {
        const projectNames = projects.map(p => p.name);
        printArgsWarning(parsedArgs);
        generateGraph(parsedArgs as any, projectNames);
        break;
      }

      case 'affected': {
        const {
          args,
          projectWithTargetAndConfig
        } = allProjectsWithTargetAndConfiguration(projects, parsedArgs);
        printArgsWarning(parsedArgs);

        runCommand(
          projectWithTargetAndConfig,
          affectedMetadata.dependencyGraph,
          args,
          env
        );
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

export function getAffectedMetadata(
  touchedFiles: string[],
  revisionRange: { base: null | string; head: null | string },
  withDeps: boolean
): AffectedMetadata {
  const workspaceJson = readWorkspaceJson();
  const nxJson = readNxJson();
  const projectNodes = getProjectNodes(workspaceJson, nxJson);
  const dependencies = readDependencies(nxJson.npmScope, projectNodes);
  const builder = new AffectedMetadataBuilder();
  builder.contextReady({
    readFileAtRevision,
    workspaceJson,
    nxJson,
    dependencies,
    projectNodes,
    revisionRange,
    withDeps
  });
  builder.filesTouched(touchedFiles);
  return builder.build();
}

function getAffectedRevisionRange(parsedArgs: YargsAffectedOptions) {
  return parsedArgs.all || parsedArgs.files
    ? { base: null, head: null }
    : {
        base: parsedArgs.base || 'master',
        // not setting `head` means uncommitted and untracked files are accounted for
        head: parsedArgs.head
      };
}

function readFileAtRevision(file: string, revision: string): string {
  try {
    return !revision
      ? readFileSync(file).toString()
      : execSync(`git show ${revision}:${file}`, {
          maxBuffer: TEN_MEGABYTES
        })
          .toString()
          .trim();
  } catch {
    return '';
  }
}

function allProjectsWithTargetAndConfiguration(
  projects: ProjectNode[],
  parsedArgs: YargsAffectedOptions
) {
  const args = splitArgs(parsedArgs, nxSpecificFlags);
  const projectWithTargetAndConfig = projects.filter(p =>
    projectHasTargetAndConfiguration(
      p,
      args.nxArgs.target,
      args.nxArgs.configuration
    )
  );
  return { args, projectWithTargetAndConfig };
}

function projectHasTargetAndConfiguration(
  project: ProjectNode,
  target: string,
  configuration?: string
) {
  if (!project.architect[target]) {
    return false;
  }

  if (!configuration) {
    return !!project.architect[target];
  } else {
    return (
      project.architect[target].configurations &&
      project.architect[target].configurations[configuration]
    );
  }
}

function getAffectedProjects(
  affectedMetadata: AffectedMetadata
): ProjectNode[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project => affectedMetadata.projectStates[project.name].affected
  );
}

function getAllProjects(affectedMetadata: AffectedMetadata): ProjectNode[] {
  return filterAffectedMetadata(affectedMetadata, () => true);
}

function filterAffectedMetadata(
  affectedMetadata: AffectedMetadata,
  predicate: (project) => boolean
): ProjectNode[] {
  const projects: ProjectNode[] = [];
  visit(affectedMetadata, project => {
    if (predicate(project)) {
      projects.push(project);
    }
  });
  return projects;
}

function visit(
  affectedMetadata: AffectedMetadata,
  visitor: (project: ProjectNode) => void
) {
  const visited = new Set<string>();
  function _visit(projectName: string) {
    if (
      visited.has(projectName) ||
      !affectedMetadata.dependencyGraph.dependencies[projectName]
    ) {
      return;
    }
    visited.add(projectName);
    affectedMetadata.dependencyGraph.dependencies[projectName].forEach(dep => {
      _visit(dep.projectName);
    });
    if (affectedMetadata.dependencyGraph.projects[projectName]) {
      visitor(affectedMetadata.dependencyGraph.projects[projectName]);
    }
  }
  affectedMetadata.dependencyGraph.roots.forEach(root => {
    _visit(root);
  });
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

function printAffected(
  affectedProjects: ProjectNode[],
  affectedMetadata: AffectedMetadata,
  args: Arguments<YargsAffectedOptions>
) {
  const tasks: Task[] = affectedProjects.map(affectedProject =>
    createTask({
      project: affectedProject,
      target: args.nxArgs.target,
      configuration: args.nxArgs.configuration,
      overrides: args.overrides
    })
  );
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  const tasksJson = tasks.map(task => ({
    id: task.id,
    overrides: task.overrides,
    target: task.target,
    command: `${isYarn ? 'yarn' : 'npm run'} ${getCommand(cli, isYarn, task)}`,
    outputs: getOutputs(affectedMetadata.dependencyGraph.projects, task)
  }));
  console.log(
    JSON.stringify(
      {
        tasks: tasksJson,
        dependencyGraph: affectedMetadata.dependencyGraph
      },
      null,
      2
    )
  );
}

/**
 * These options are only for getting an array with properties of AffectedOptions.
 *
 * @remark They are not defaults or useful for anything else
 */
const dummyOptions: AffectedOptions = {
  target: '',
  configuration: '',
  onlyFailed: false,
  'only-failed': false,
  untracked: false,
  uncommitted: false,
  runner: '',
  help: false,
  version: false,
  quiet: false,
  all: false,
  base: 'base',
  head: 'head',
  exclude: ['exclude'],
  files: [''],
  verbose: false,
  plain: false,
  withDeps: false
};

const nxSpecificFlags = Object.keys(dummyOptions);
