import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { ExternalObject, FileData, HasherOptions, HashPlanner, ProjectGraph as NativeProjectGraph, NxWorkspaceFilesExternals, TaskHasher } from '../native';
import { PartialHash, TaskHasherImpl } from './task-hasher';
export declare class NativeTaskHasherImpl implements TaskHasherImpl {
    hasher: TaskHasher;
    planner: HashPlanner;
    projectGraphRef: ExternalObject<NativeProjectGraph>;
    allWorkspaceFilesRef: ExternalObject<FileData[]>;
    projectFileMapRef: ExternalObject<Record<string, FileData[]>>;
    options: HasherOptions | undefined;
    constructor(workspaceRoot: string, nxJson: NxJsonConfiguration, projectGraph: ProjectGraph, externals: NxWorkspaceFilesExternals, options: {
        selectivelyHashTsConfig: boolean;
    });
    hashTask(task: Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv, cwd?: string, collectInputs?: boolean): Promise<PartialHash>;
    hashTasks(tasks: Task[], taskGraph: TaskGraph, perTaskEnvs: Record<string, NodeJS.ProcessEnv>, cwd?: string, collectInputs?: boolean): Promise<PartialHash[]>;
}
