import * as yargsParser from 'yargs-parser';
import * as yargs from 'yargs';
import {
  getProjectNodes,
  NxJson,
  ProjectNode,
  readNxJson,
  readWorkspaceJson
} from '../shared';
import { WorkspaceResults } from '../workspace-results';
import { output } from '../output';

export interface Arguments<T extends yargs.Arguments> {
  nxArgs: T;
  targetArgs: T;
  overrides: any;
}

const ignoreArgs = ['$0', '_'];
export function splitArgs<T extends yargs.Arguments>(
  args: T,
  nxSpecific: (keyof T)[]
): Arguments<T> {
  const nx: any = {};
  const targetArgs: any = {};

  const overrides = yargsParser(args._.slice(1));
  delete overrides._;

  Object.entries(args).forEach(([key, value]) => {
    if (nxSpecific.includes(key as any)) {
      nx[key] = value;
    } else if (!ignoreArgs.includes(key)) {
      targetArgs[key] = value;
    }
  });

  return { nxArgs: nx, targetArgs, overrides };
}
export interface TaskArgs {
  projects: string[];
  target: string;
  all?: boolean;
}

export function projectHasTargetAndConfiguration(
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

export interface Environment {
  nxJson: NxJson;
  workspaceJson: any;
  workspace: any;
}

export function readEnvironment(target: string): Environment {
  const nxJson = readNxJson();
  const workspaceJson = readWorkspaceJson();
  const workspace = new WorkspaceResults(target);

  return { nxJson, workspaceJson, workspace };
}
