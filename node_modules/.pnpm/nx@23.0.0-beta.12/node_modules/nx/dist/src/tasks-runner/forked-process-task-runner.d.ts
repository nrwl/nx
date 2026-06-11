import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { PseudoTtyProcess } from './pseudo-terminal';
import { BatchProcess } from './running-tasks/batch-process';
import { RunningTask } from './running-tasks/running-task';
import { Batch } from './tasks-schedule';
export declare class ForkedProcessTaskRunner {
    private readonly options;
    private readonly tuiEnabled;
    cliPath: string;
    private readonly verbose;
    private processes;
    private finishedProcesses;
    private pseudoTerminals;
    constructor(options: DefaultTasksRunnerOptions, tuiEnabled: boolean);
    init(): Promise<void>;
    forkProcessForBatch({ id: batchId, executorName, taskGraph: batchTaskGraph }: Batch, projectGraph: ProjectGraph, fullTaskGraph: TaskGraph, env: NodeJS.ProcessEnv): Promise<BatchProcess>;
    cleanUpBatchProcesses(): void;
    forkProcessLegacy(task: Task, { temporaryOutputPath, streamOutput, pipeOutput, taskGraph, env, }: {
        temporaryOutputPath: string;
        streamOutput: boolean;
        pipeOutput: boolean;
        taskGraph: TaskGraph;
        env: NodeJS.ProcessEnv;
    }): Promise<RunningTask>;
    forkProcess(task: Task, { temporaryOutputPath, streamOutput, taskGraph, env, disablePseudoTerminal, }: {
        temporaryOutputPath: string;
        streamOutput: boolean;
        pipeOutput: boolean;
        taskGraph: TaskGraph;
        env: NodeJS.ProcessEnv;
        disablePseudoTerminal: boolean;
    }): Promise<RunningTask | PseudoTtyProcess>;
    private createPseudoTerminal;
    private forkProcessWithPseudoTerminal;
    private forkProcessWithPrefixAndNotTTY;
    private forkProcessDirectOutputCapture;
    private writeTerminalOutput;
    cleanup(signal?: NodeJS.Signals): void;
    private setupProcessEventListeners;
}
