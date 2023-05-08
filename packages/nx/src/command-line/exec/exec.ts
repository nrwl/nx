import { execSync } from 'child_process';
import { join } from 'path';
import { exit } from 'process';
import * as yargs from 'yargs-parser';

import { readNxJson } from '../../config/configuration';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { splitArgsIntoNxArgsAndOverrides } from '../../utils/command-line-utils';
import { readJsonFile } from '../../utils/fileutils';
import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { workspaceRoot } from '../../utils/workspace-root';
import { calculateDefaultProjectName } from '../run/run-one';

export async function nxExecCommand(
  args: Record<string, string[]>
): Promise<unknown> {
  const scriptArgV: string[] = readScriptArgV(args);

  // NX is already running
  if (process.env.NX_TASK_TARGET_PROJECT) {
    const command = scriptArgV
      .reduce((cmd, arg) => cmd + `"${arg}" `, '')
      .trim();
    execSync(command, {
      stdio: 'inherit',
      env: process.env,
    });
  } else {
    // nx exec is being ran inside of Nx's context
    return runScriptAsNxTarget(scriptArgV);
  }
}

async function runScriptAsNxTarget(argv: string[]) {
  const projectGraph = await createProjectGraphAsync();

  const { projectName, project } = getProject(projectGraph);

  // NPM, Yarn, and PNPM set this to the name of the currently executing script. Lets use it if we can.
  const targetName = process.env.npm_lifecycle_event;
  const scriptDefinition = getScriptDefinition(project, targetName);

  ensureNxTarget(project, targetName);

  // Get ArgV that is provided in npm script definition
  const providedArgs = yargs(scriptDefinition)._.slice(2);
  const extraArgs =
    providedArgs.length === argv.length ? [] : argv.slice(providedArgs.length);

  const pm = getPackageManagerCommand();
  // `targetName` might be an npm script with `:` like: `start:dev`, `start:debug`.
  let command = `${
    pm.exec
  } nx run ${projectName}:\\\"${targetName}\\\" ${extraArgs.join(' ')}`;
  return execSync(command, { stdio: 'inherit' });
}

function readScriptArgV(args: Record<string, string[]>) {
  const { overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-one',
    { printWarnings: false },
    readNxJson()
  );

  const scriptSeparatorIdx = process.argv.findIndex((el) => el === '--');
  if (scriptSeparatorIdx === -1) {
    output.error({
      title: '`nx exec` requires passing in a command after `--`',
    });
    process.exit(1);
  }

  return overrides.__overrides_unparsed__;
}

function getScriptDefinition(
  project: ProjectGraphProjectNode,
  targetName: string
): PackageJson['scripts'][string] {
  const scriptDefinition = readJsonFile<PackageJson>(
    join(workspaceRoot, project.data.root, 'package.json')
  ).scripts[targetName];

  if (!scriptDefinition) {
    output.error({
      title:
        "`nx exec` is meant to be used in a project's package.json scripts",
      bodyLines: [
        `Nx was unable to find a npm script matching ${targetName} for ${project.name}`,
      ],
    });
    process.exit(1);
  }

  return scriptDefinition;
}

function ensureNxTarget(project: ProjectGraphProjectNode, targetName: string) {
  if (!project.data.targets[targetName]) {
    output.error({
      title: `Nx cannot find a target called "${targetName}" for ${project.name}`,
      bodyLines: [
        `Is ${targetName} missing from ${project.data.root}/package.json's nx.includedScripts field?`,
      ],
    });
    exit(1);
  }
}

function getProject(projectGraph: ProjectGraph) {
  const projectName = calculateDefaultProjectName(
    process.cwd(),
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(projectGraph),
    readNxJson()
  );

  if (!projectName) {
    output.error({
      title: 'Unable to determine project name for `nx exec`',
      bodyLines: [
        "`nx exec` should be ran from within an Nx project's root directory.",
        'Does this package.json belong to an Nx project?',
      ],
    });
    process.exit(1);
  }

  const project: ProjectGraphProjectNode = projectGraph.nodes[projectName];

  return { projectName, project };
}
