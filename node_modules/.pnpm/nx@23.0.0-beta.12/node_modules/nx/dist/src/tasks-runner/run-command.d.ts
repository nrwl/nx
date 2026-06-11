import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { NxArgs } from '../utils/command-line-utils';
import { LifeCycle, TaskResult, TaskResults } from './life-cycle';
import { TasksRunner } from './tasks-runner';
export declare function runCommand(projectsToRun: ProjectGraphProjectNode[], currentProjectGraph: ProjectGraph, { nxJson }: {
    nxJson: NxJsonConfiguration;
}, nxArgs: NxArgs, overrides: any, initiatingProject: string | null, extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>, extraOptions: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
}): Promise<NodeJS.Process['exitCode']>;
export declare function runCommandForTasks(projectsToRun: ProjectGraphProjectNode[], currentProjectGraph: ProjectGraph, { nxJson }: {
    nxJson: NxJsonConfiguration;
}, nxArgs: NxArgs, overrides: any, initiatingProject: string | null, extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>, extraOptions: {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
}): Promise<{
    taskResults: TaskResults;
    completed: boolean;
}>;
export declare function setEnvVarsBasedOnArgs(nxArgs: NxArgs, loadDotEnvFiles: boolean): void;
export declare function invokeTasksRunner({ tasks, projectGraph, taskGraph, lifeCycle, nxJson, nxArgs, loadDotEnvFiles, initiatingProject, initiatingTasks, }: {
    tasks: Task[];
    projectGraph: ProjectGraph;
    taskGraph: TaskGraph;
    lifeCycle: LifeCycle;
    nxJson: NxJsonConfiguration;
    nxArgs: NxArgs;
    loadDotEnvFiles: boolean;
    initiatingProject: string | null;
    initiatingTasks: Task[];
}): Promise<{
    [id: string]: TaskResult;
}>;
export declare function constructLifeCycles(lifeCycle: LifeCycle): LifeCycle[];
export declare function getRunner(nxArgs: NxArgs, nxJson: NxJsonConfiguration): {
    tasksRunner: TasksRunner;
    runnerOptions: any;
};
export declare function getRunnerOptions(runner: string, nxJson: NxJsonConfiguration<string[] | '*'>, nxArgs: NxArgs, isCloudDefault: boolean): any;
