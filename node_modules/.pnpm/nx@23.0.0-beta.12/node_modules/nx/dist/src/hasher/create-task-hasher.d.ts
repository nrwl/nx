import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { TaskHasher } from './task-hasher';
export declare function createTaskHasher(projectGraph: ProjectGraph, nxJson: NxJsonConfiguration, runnerOptions?: any): TaskHasher;
