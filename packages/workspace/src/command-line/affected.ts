import * as yargs from 'yargs';
import { generateGraph } from './dep-graph';
import { output } from '../utils/output';
import { parseFiles, printArgsWarning } from './shared';
import { runCommand } from '../tasks-runner/run-command';
import { NxArgs, splitArgsIntoNxArgsAndOverrides } from './utils';
import { filterAffected } from '../core/affected-project-graph';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraphNode,
  ProjectType,
  withDeps
} from '../core/project-graph';
import { calculateFileChanges, readEnvironment } from '../core/file-utils';
import { printAffected } from './print-affected';
import { projectHasTargetAndConfiguration } from '../utils/project-has-target-and-configuration';
import { DefaultReporter } from '../tasks-runner/default-reporter';

export function affected(command: string, parsedArgs: yargs.Arguments): void {
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(parsedArgs);

  const env = readEnvironment(nxArgs.target);
  const projectGraph = createProjectGraph();
  let affectedGraph = nxArgs.all
    ? projectGraph
    : filterAffected(
        projectGraph,
        calculateFileChanges(parseFiles(nxArgs).files, nxArgs)
      );
  if (parsedArgs.withDeps) {
    affectedGraph = onlyWorkspaceProjects(
      withDeps(projectGraph, Object.values(affectedGraph.nodes))
    );
  }
  const affectedProjects = Object.values(
    parsedArgs.all ? projectGraph.nodes : affectedGraph.nodes
  )
    .filter(n => !parsedArgs.exclude.includes(n.name))
    .filter(n => !parsedArgs.onlyFailed || !env.workspace.getResult(n.name));

  try {
    switch (command) {
      case 'apps':
        const apps = affectedProjects
          .filter(p => p.type === ProjectType.app)
          .map(p => p.name);
        if (parsedArgs.plain) {
          console.log(apps.join(' '));
        } else {
          printArgsWarning(nxArgs);
          if (apps.length) {
            output.log({
              title: 'Affected apps:',
              bodyLines: apps.map(app => `${output.colors.gray('-')} ${app}`)
            });
          }
        }
        break;

      case 'libs':
        const libs = affectedProjects
          .filter(p => p.type === ProjectType.lib)
          .map(p => p.name);
        if (parsedArgs.plain) {
          console.log(libs.join(' '));
        } else {
          printArgsWarning(nxArgs);
          if (libs.length) {
            output.log({
              title: 'Affected libs:',
              bodyLines: libs.map(lib => `${output.colors.gray('-')} ${lib}`)
            });
          }
        }
        break;

      case 'dep-graph':
        const projectNames = affectedProjects.map(p => p.name);
        printArgsWarning(nxArgs);
        generateGraph(parsedArgs as any, projectNames);
        break;

      case 'print-affected':
        if (nxArgs.target) {
          const projectWithTargetAndConfig = allProjectsWithTargetAndConfiguration(
            affectedProjects,
            nxArgs
          );
          printAffected(
            projectWithTargetAndConfig,
            affectedProjects,
            projectGraph,
            nxArgs,
            overrides
          );
        } else {
          printAffected([], affectedProjects, projectGraph, nxArgs, overrides);
        }
        break;

      case 'affected': {
        const projectWithTargetAndConfig = allProjectsWithTargetAndConfiguration(
          affectedProjects,
          nxArgs
        );
        printArgsWarning(nxArgs);
        runCommand(
          projectWithTargetAndConfig,
          projectGraph,
          env,
          nxArgs,
          overrides,
          new DefaultReporter()
        );
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

function allProjectsWithTargetAndConfiguration(
  projects: ProjectGraphNode[],
  nxArgs: NxArgs
) {
  return projects.filter(p =>
    projectHasTargetAndConfiguration(p, nxArgs.target, nxArgs.configuration)
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
