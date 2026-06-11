import { ProjectGraph } from '../config/project-graph';
import { NxArgs } from '../utils/command-line-utils';
import { CommandGraph } from './command-graph';
export declare function createCommandGraph(projectGraph: ProjectGraph, projectNames: string[], nxArgs: NxArgs): CommandGraph;
